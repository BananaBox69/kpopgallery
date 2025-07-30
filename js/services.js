import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { config } from "./config.js";
import { state } from "./state.js";
import { ui } from "./ui.js";
import { handlers } from "./handlers.js";

// --- 4. SERVICES (Firebase & Core Logic) ---
export const services = {
    db: null,
    auth: null,
    initFirebase() {
        const app = initializeApp(config.firebase);
        this.db = getFirestore(app);
        this.auth = getAuth(app);
    },
    initListeners() {
        onAuthStateChanged(this.auth, (user) => {
            state.user = user;
            state.isAdminView = !!user;
            ui.render();
        });
        onSnapshot(doc(this.db, 'settings', 'siteContent'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                state.siteContent = { groupSubtitles: {}, groupBanners: {}, disclaimerText: "", memberQuotes: {}, ...data };
            }
            state.isDataReady.content = true;
            this.checkInitialRender();
        }, (error) => console.error("Error fetching site content:", error));
        onSnapshot(doc(this.db, 'settings', 'metadata'), (docSnap) => {
            if (docSnap.exists()) state.metadata = { groupLogos: {}, ...docSnap.data() };
            state.isDataReady.metadata = true;
            this.checkInitialRender();
        }, (error) => console.error("Error fetching metadata:", error));
        onSnapshot(collection(this.db, 'cards'), (snapshot) => {
            state.cards = snapshot.docs.map(doc => ({
                docId: doc.id,
                id: doc.data().displayId || doc.id,
                version: doc.data().description || '',
                image: doc.data().imageUrl || `https://placehold.co/220x341/121212/ff4757?text=Image+Missing&font=playfair+display`,
                backImage: doc.data().backImage || `https://placehold.co/220x341/1e1e1e/ffffff?text=Card+Back&font=playfair+display`,
                dateAdded: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date(),
                ...doc.data()
            }));
            state.basket = state.basket.filter(item =>
                state.cards.some(card => card.docId === item.docId && card.status === 'available')
            );
            state.isDataReady.cards = true;
            this.checkInitialRender();
        }, (error) => console.error("Error fetching cards:", error));
    },
    checkInitialRender() {
        if (Object.values(state.isDataReady).every(Boolean)) {
            ui.render();
            handlers.checkDisclaimer();
        }
    },
    async login(email, password) { return signInWithEmailAndPassword(this.auth, email, password); },
    async logout() { return signOut(this.auth); },
    async saveCard(cardData, docId) {
        if (docId) {
            return updateDoc(doc(this.db, 'cards', docId), cardData);
        } else {
            const groupPrefix = config.groupPrefixes[cardData.group] || 'XX';
            const memberPrefix = (cardData.group === 'IU' && cardData.member === 'IU') ? config.memberPrefixes.IU : cardData.member.charAt(0).toUpperCase();
            const q = query(collection(this.db, 'cards'), where('group', '==', cardData.group), where('member', '==', cardData.member));
            const querySnapshot = await getDocs(q);
            let maxCardNum = 0;
            querySnapshot.forEach(docSnap => {
                const numPart = (docSnap.data().displayId || '').split('-')[2];
                if (numPart) maxCardNum = Math.max(maxCardNum, parseInt(numPart, 10) || 0);
            });
            cardData.displayId = `${groupPrefix}-${memberPrefix}-${String(maxCardNum + 1).padStart(3, '0')}`;
            cardData.createdAt = serverTimestamp();
            return addDoc(collection(this.db, 'cards'), cardData);
        }
    },
    async deleteCard(docId) { return deleteDoc(doc(this.db, "cards", docId)); },
    async saveSiteContent(content) { return setDoc(doc(this.db, 'settings', 'siteContent'), content, { merge: true }); },
    async bulkUpdate(docIds, action, value) {
        const promises = [];
        docIds.forEach(docId => {
            if (action === 'delete') {
                promises.push(this.deleteCard(docId));
            } else {
                const updateData = { [action]: value };
                promises.push(updateDoc(doc(this.db, 'cards', docId), updateData));
            }
        });
        return Promise.all(promises);
    }
};