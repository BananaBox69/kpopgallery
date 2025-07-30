import { state, dom } from "./state.js";
import { services } from "./services.js";
import { ui } from "./ui.js";
import { utils } from "./utils.js";

// --- 7. EVENT HANDLERS ---
export const handlers = {
    scrollTimeout: null,
    arrowRightSVG: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
    arrowLeftSVG: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`,
    init() {
        document.body.addEventListener('click', this.handleGlobalClick.bind(this));
        dom.adminView.addEventListener('change', this.handleAdminFormChange.bind(this));
        dom.adminView.addEventListener('input', this.handleAdminFormInput.bind(this));
        dom.floatingNavContainer.addEventListener('click', this.handleNavClick.bind(this));
        dom.navToggleBtn.addEventListener('click', this.toggleNav.bind(this));
        dom.navToggleBtn.innerHTML = this.arrowRightSVG;
        dom.floatingEmptyBtn.addEventListener('click', () => this.confirmEmptyBasket());
        
        dom.filterBubble.addEventListener('click', () => dom.filterSidebar.classList.add('visible'));
        dom.closeFilterBtn.addEventListener('click', () => dom.filterSidebar.classList.remove('visible'));
        dom.filterForm.search.addEventListener('input', this.handleUserFilterChange.bind(this));
        dom.filterForm.album.addEventListener('change', this.handleUserFilterChange.bind(this));
        dom.filterForm.version.addEventListener('change', this.handleUserFilterChange.bind(this));
        dom.filterForm.tags.addEventListener('click', this.handleUserFilterChange.bind(this));
        
        dom.tutorialNextBtn.addEventListener('click', this.handleTutorialNext.bind(this));
        dom.tutorialCloseBtn.addEventListener('click', this.closeTutorial.bind(this));
    },
    toggleNav() {
        dom.floatingNavContent.classList.toggle('is-hidden');
        const isHidden = dom.floatingNavContent.classList.contains('is-hidden');
        dom.navToggleBtn.innerHTML = isHidden ? this.arrowLeftSVG : this.arrowRightSVG;
    },
    handleNavClick(e) {
        const navBtn = e.target.closest('a.nav-btn');
        if (!navBtn) return;

        e.preventDefault();
        const targetId = navBtn.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            clearTimeout(this.scrollTimeout);
            dom.userView.style.scrollSnapType = 'none';
            targetElement.scrollIntoView({ behavior: 'smooth' });
            
            if (!dom.floatingNavContent.classList.contains('is-hidden')) {
                this.toggleNav();
            }

            this.scrollTimeout = setTimeout(() => {
                dom.userView.style.scrollSnapType = '';
            }, 1000);
        }
    },
    handleGlobalClick(e) {
        const target = e.target;
        if (dom.filterSidebar.classList.contains('visible') && !dom.filterSidebar.contains(target) && !target.closest('#filter-bubble')) {
            dom.filterSidebar.classList.remove('visible');
        }

        const adminCardItem = target.closest('.admin-card-item');
        if (adminCardItem && !target.closest('button, [data-action="preview-image"]')) {
            this.toggleAdminSelection(adminCardItem.dataset.docId);
            return;
        }

        const actionTarget = target.closest('[data-action]');
        const action = actionTarget?.dataset.action;

        if (target.classList.contains('modal-overlay') && target.dataset.dismissable !== 'false') {
            const modal = target.closest('.modal-overlay');
            if (modal) modal.classList.remove('visible');
            return;
        }
         if (target.classList.contains('close-modal-btn') || target.id === 'confirm-no-btn') {
            const modal = target.closest('.modal-overlay');
            if (modal) modal.classList.remove('visible');
            return;
        }
        if(target.closest('#checkout-btn')) this.showBasketModal();
        if(target.closest('#info-bubble')) this.showInfoModal();
        if(target.closest('#admin-panel-bubble')) this.handleAdminBubbleClick();
        
        const cardWrapper = target.closest('.carousel-card');
        if (cardWrapper) {
            if (target.closest('.card-flip-overlay')) {
                cardWrapper.classList.toggle('is-flipped');
            } else if (target.closest('.carousel-card-front .card-click-overlay')) {
                this.toggleBasketItem(cardWrapper, cardWrapper.dataset.docId);
            }
        }

        if (target.closest('.add-to-basket-main-btn')) this.toggleBasketItem(target, target.dataset.docId);
        if (target.closest('[data-action="empty-basket"]') && target.closest('#basket-modal-overlay')) {
            this.confirmEmptyBasket();
        }

        if (!action) return;
        const docId = actionTarget.closest('[data-doc-id]')?.dataset.docId;
        switch(action) {
            case 'logout': this.logout(); break;
            case 'add-card': this.showAdminForm(); break;
            case 'edit-card': this.showAdminForm(docId); break;
            case 'delete-card': this.confirmDeleteCard(docId); break;
            case 'edit-content': this.showContentEditor(); break;
            case 'preview-image': this.showImagePreview(actionTarget.src); break;
            case 'unselect-all': this.unselectAllAdminCards(); break;
            case 'bulk-update': this.handleBulkUpdate(actionTarget); break;
            case 'toggle-rare': this.handleBulkToggleRare(); break;
            case 'bulk-archive': this.confirmBulkArchiveAction('archive'); break;
            case 'bulk-delete': this.confirmBulkDelete(); break;
            case 'reset-filters': this.resetUserFilters(); break;
        }
    },
    toggleBasketItem(targetElement, docId) {
        if (!docId) return;
        const card = state.cards.find(c => c.docId === docId);
        if (!card || card.status !== 'available') return;
        const basketIndex = state.basket.findIndex(item => item.docId === docId);
        if (basketIndex > -1) {
            state.basket.splice(basketIndex, 1);
        } else {
            state.basket.push(card);
            this.playAddToBasketAnimation(targetElement, card.image);
        }
        ui.updateFloatingBasket();
        ui.updateCardUIState(docId);
    },
    playAddToBasketAnimation(target, imageUrl) {
        const rect = target.getBoundingClientRect();
        const basketRect = dom.floatingBasket.getBoundingClientRect();
        const flyingCard = document.createElement('img');
        flyingCard.src = imageUrl;
        flyingCard.className = 'flying-card';
        flyingCard.style.top = `${rect.top}px`;
        flyingCard.style.left = `${rect.left}px`;
        document.body.appendChild(flyingCard);
        
        requestAnimationFrame(() => {
            flyingCard.style.top = `${basketRect.top + basketRect.height / 2}px`;
            flyingCard.style.left = `${basketRect.left + basketRect.width / 2}px`;
            flyingCard.style.transform = 'scale(0.2)';
            flyingCard.style.opacity = '0.5';
        });
        setTimeout(() => flyingCard.remove(), 700);
    },
    handleAdminBubbleClick() {
        if (state.user) {
            state.isAdminView = true;
            ui.render();
        } else {
            this.showLoginModal();
        }
    },
    async logout() {
        try {
            await services.logout();
            utils.showMessageBox('Logged out successfully.', 'success');
        } catch (error) {
            console.error("Logout failed:", error);
            utils.showMessageBox('Logout failed.', 'error');
        }
    },
    handleAdminFormChange(e) {
        const filterEl = e.target.closest('[data-filter]');
        const sortEl = e.target.closest('[data-sort]');
        if(filterEl) {
            state.adminFilters[filterEl.dataset.filter] = filterEl.value;
            if(filterEl.dataset.filter === 'group') ui.updateAdminMemberFilter();
            ui.applyAdminFiltersAndSort();
        }
        if(sortEl) {
            state.adminSort[sortEl.dataset.sort] = sortEl.value;
            ui.applyAdminFiltersAndSort();
        }
    },
    handleAdminFormInput(e) {
        const filterEl = e.target.closest('[data-filter="searchTerm"]');
        if(filterEl) {
            state.adminFilters.searchTerm = filterEl.value;
            ui.applyAdminFiltersAndSort();
        }
    },
    toggleAdminSelection(docId) {
        const checkbox = dom.adminView.querySelector(`.admin-card-item[data-doc-id="${docId}"] .bulk-checkbox`);
        if (state.adminSelectedIds.has(docId)) {
            state.adminSelectedIds.delete(docId);
            if(checkbox) checkbox.checked = false;
        } else {
            state.adminSelectedIds.add(docId);
            if(checkbox) checkbox.checked = true;
        }
        ui.renderAdminList(state.cards);
        ui.applyAdminFiltersAndSort();
    },
    unselectAllAdminCards() {
        state.adminSelectedIds.clear();
        ui.applyAdminFiltersAndSort();
    },
    handleBulkUpdate(button) {
        const { field, value } = button.dataset;
        let updateValue = value;

        if (field === 'discount') {
            updateValue = Number(value);
        }

        services.bulkUpdate(state.adminSelectedIds, field, updateValue)
            .then(() => {
                utils.showMessageBox(`Bulk update successful.`, 'success');
                ui.applyAdminFiltersAndSort();
            })
            .catch(err => {
                console.error("Bulk update failed:", err);
                utils.showMessageBox(`Bulk update failed.`, 'error');
            });
    },
    handleBulkToggleRare() {
        if (state.adminSelectedIds.size === 0) {
            utils.showMessageBox('No cards selected for toggling rarity.', 'info');
            return;
        }

        const promises = [];
        state.adminSelectedIds.forEach(docId => {
            const card = state.cards.find(c => c.docId === docId);
            if (card) {
                const newIsRare = !card.isRare;
                promises.push(services.bulkUpdate([docId], 'isRare', newIsRare));
            }
        });
        Promise.all(promises)
            .then(() => {
                utils.showMessageBox(`Bulk rarity toggled successfully!`, 'success');
                ui.applyAdminFiltersAndSort();
            })
            .catch(err => {
                console.error("Bulk rarity toggle failed:", err);
                utils.showMessageBox(`Bulk rarity toggle failed.`, 'error');
            });
    },
    confirmBulkArchiveAction(actionType) {
        const count = state.adminSelectedIds.size;
        const verb = actionType === 'archive' ? 'archive' : 'delete';
        this.showConfirmationModal(`Are you sure you want to ${verb} ${count} selected card(s)? This action cannot be undone.`, (result) => {
            if (result === 'yes') {
                const updateField = actionType === 'archive' ? 'status' : 'delete';
                const updateValue = actionType === 'archive' ? 'archived' : null;
                
                services.bulkUpdate(state.adminSelectedIds, updateField, updateValue)
                    .then(() => {
                        utils.showMessageBox(`${count} card(s) ${verb}d.`, 'success');
                        state.adminSelectedIds.clear();
                        ui.applyAdminFiltersAndSort();
                    })
                   .catch(err => {
                        console.error(`Bulk ${verb} failed:`, err);
                        utils.showMessageBox(`Bulk ${verb} failed.`, 'error');
                    });
            }
        });
    },
    confirmDeleteCard(docId) {
        this.showConfirmationModal('Are you sure you want to permanently delete this card?', async (result) => {
            if (result === 'yes') {
                try {
                    await services.deleteCard(docId);
                    utils.showMessageBox('Card deleted successfully.', 'success');
                } catch (error) {
                    console.error('Error deleting card:', error);
                    utils.showMessageBox('Error deleting card.', 'error');
                }
            }
        });
    },
    confirmEmptyBasket() {
        this.showConfirmationModal('Are you sure you want to empty your basket?', (result) => {
            if (result === 'yes') {
                const itemsToRemove = [...state.basket];
                state.basket = [];
                itemsToRemove.forEach(item => ui.updateCardUIState(item.docId));
                ui.updateFloatingBasket();
                if (dom.modals.basket.classList.contains('visible')) {
                    this.showBasketModal();
                }
            }
        });
    },
    checkDisclaimer() {
        if (localStorage.getItem('disclaimerAcknowledged') === 'true') {
            this.startTutorial();
        } else {
            this.showDisclaimerModal();
        }
    },
    showDisclaimerModal() {
        const disclaimerText = this.getDisclaimerText();
        const content = `
            <div class="modal-content-box">
                <div class="modal-header"><h2 class="text-2xl font-bold">Disclaimer</h2></div>
                <div class="modal-body text-left">${disclaimerText}</div>
                <div class="modal-footer p-4 flex justify-end gap-4 border-t border-gray-700">
                    <button id="refuse-btn" class="bg-red-600 text-white py-2 px-6 rounded-full">Refuse</button>
                    <button id="acknowledge-btn" class="bg-green-600 text-white py-2 px-6 rounded-full">Acknowledge</button>
                </div>
            </div>`;
        ui.openModal('disclaimer', content, false);
        dom.userView.classList.add('blurred');
        dom.modals.disclaimer.querySelector('#acknowledge-btn').addEventListener('click', () => {
            localStorage.setItem('disclaimerAcknowledged', 'true');
            ui.closeModal('disclaimer');
            dom.userView.classList.remove('blurred');
            this.startTutorial();
        });
        dom.modals.disclaimer.querySelector('#refuse-btn').addEventListener('click', () => {
            window.location.href = 'https://www.google.com';
        });
    },
    getDisclaimerText() {
        const dbText = state.siteContent.disclaimerText;
        return dbText || `
            <h3 class="text-lg font-bold text-red-400 mb-2">This is NOT a Shop!</h3>
            <p class="mb-4">This website is for displaying a private photocard collection. Its purpose is to make it easier for others to see what is available for trade or sale. This is done by me as a private person, not for commercial gain.</p>
            <strong class="text-white">Condition of Cards:</strong>
            <p class="mb-4">Even though all cards are treated with the utmost care and are kept in clean sleeves at all times, small defects like scratches or little dents can exist from manufacturing or shipping. Highly sensitive people should refrain from buying.</p>
            <strong class="text-white">Private Sale Policy:</strong>
            <p>As a private person, I do not offer refunds, returns, or any kind of warranties.</p>
        `;
    },
    showLoginModal() {
        const content = `
            <div class="modal-content-box login-modal">
                <div class="modal-header flex justify-between items-center"><h2 class="text-2xl font-bold">Admin Login</h2><button class="close-modal-btn text-2xl">&times;</button></div>
                <div class="modal-body">
                    <form id="login-form">
                        <div class="form-group"><label>Email:</label><input type="email" name="email" required></div>
                        <div class="form-group"><label>Password:</label><input type="password" name="password" required></div>
                        <p class="login-error-message text-red-500 text-sm mb-4 h-5"></p>
                        <button type="submit" class="bg-blue-600 text-white py-2 px-4 rounded-full w-full">Login</button>
                    </form>
                </div>
            </div>`;
        ui.openModal('login', content);
        dom.modals.login.querySelector('#login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const errorEl = form.querySelector('.login-error-message');
            try {
                await services.login(form.email.value, form.password.value);
                ui.closeModal('login');
            } catch (error) {
                errorEl.textContent = 'Invalid email or password.';
                console.error("Login failed:", error);
            }
        });
    },
    showInfoModal() {
        const content = `
            <div class="modal-content-box info-modal">
                <div class="modal-header flex justify-between items-center"><h2 class="text-2xl font-bold">Selling Process Info</h2><button class="close-modal-btn text-2xl">&times;</button></div>
                <div class="modal-body info-modal-content">${state.siteContent.infoText || ''} ${this.getDisclaimerText()}</div>
            </div>`;
        ui.openModal('info', content);
    },
    showImagePreview(src) {
        const content = `
            <div class="modal-content-box max-w-lg relative">
                <button class="close-modal-btn absolute top-2 right-4 text-white text-4xl z-10">&times;</button>
                <img src="${src}" class="w-full h-auto rounded-lg">
            </div>`;
        ui.openModal('imagePreview', content);
    },
    showConfirmationModal(message, onConfirm, type = 'confirm', customButtons = null) {
        let buttonsHtml = '';
        if (type === 'confirm') {
            buttonsHtml = `
                <button id="confirm-yes-btn" class="bg-red-600 text-white py-2 px-6 rounded-full">Yes</button>
                <button id="confirm-no-btn" class="bg-gray-600 text-white py-2 px-6 rounded-full">No</button>
            `;
        } else if (type === 'yesno' && customButtons) {
             buttonsHtml = `
                <button id="confirm-yes-btn" class="bg-green-600 text-white py-2 px-6 rounded-full">Yes</button>
                <button id="confirm-no-btn" class="bg-red-600 text-white py-2 px-6 rounded-full">No</button>
            `;
        }
        
        const content = `
            <div class="modal-content-box">
                <div class="modal-header"><h2 class="text-2xl font-bold">Confirmation</h2></div>
                <div class="modal-body text-center">
                    <p class="mb-6 text-lg">${message}</p>
                    <div class="flex justify-center gap-4">
                        ${buttonsHtml}
                    </div>
                </div>
            </div>`;
        ui.openModal('confirmation', content);
        dom.modals.confirmation.querySelector('#confirm-yes-btn').addEventListener('click', () => {
            onConfirm('yes');
            ui.closeModal('confirmation');
        }, { once: true });
        dom.modals.confirmation.querySelector('#confirm-no-btn').addEventListener('click', () => {
            onConfirm('no');
            ui.closeModal('confirmation');
        }, { once: true });
    },
    showBasketModal() {
        const generateMessage = () => {
            const country = dom.modals.basket.querySelector('#shipping-country').value;
            const shipping = dom.modals.basket.querySelector('#shipping-method').value;
            const payment = dom.modals.basket.querySelector('#payment-method').value;
            let message = "Hello! I would like to buy the following card(s):\n\n";
            let totalPrice = 0;
            let cardList = state.basket.map(item => {
                const price = utils.calculateDiscountedPrice(item.price, item.discount);
                totalPrice += price;
                return `${item.id}\n${item.member} - ${item.album}\n${item.version}\n€${price.toFixed(2)}`;
            }).join('\n\n');
            message += `${cardList}\n\n------------------------------\n`;
            message += `TOTAL (${state.basket.length} cards): €${totalPrice.toFixed(2)} (excl. shipping)\n\n--- Shipping & Payment ---\nShip to: ${country || 'Please specify'}\nShipping Method: ${shipping}\nPayment Method: ${payment}\n`;
            dom.modals.basket.querySelector('#generated-message').value = message;
        };
        const basketItemsHtml = state.basket.length > 0 ? state.basket.map(item => `
            <div class="basket-item">
                <img src="${item.image}" class="basket-item-img" onerror="this.onerror=null;this.src='https://placehold.co/60x93/121212/ff4757?text=Img';">
                <div class="basket-item-info">
                    <p class="font-semibold">${item.member} - ${item.album}</p>
                    <p class="text-sm text-gray-400">€${utils.calculateDiscountedPrice(item.price, item.discount).toFixed(2)}</p>
                </div>
                <button class="remove-item-btn" data-doc-id="${item.docId}">&times;</button>
            </div>`).join('') : '<p class="text-center text-gray-400">Your basket is empty.</p>';
        const content = `
            <div class="modal-content-box basket-modal">
                <div class="modal-header flex justify-between items-center">
                    <h2 class="text-2xl font-bold">Your Basket</h2>
                    <div>
                        ${state.basket.length > 0 ? '<button data-action="empty-basket" class="text-sm bg-red-800 px-3 py-1 rounded-full">Empty Basket</button>' : ''}
                        <button class="close-modal-btn text-2xl ml-4">&times;</button>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="form-group"><label>Ship to (Country):</label><input type="text" id="shipping-country" list="country-suggestions" placeholder="e.g., Germany, USA, Japan"><datalist id="country-suggestions">${(state.metadata.countries || []).map(c => `<option value="${c}"></option>`).join('')}</datalist></div>
                    <div class="grid grid-cols-2 gap-4"><div class="form-group"><label>Shipping Method:</label><select id="shipping-method"><option>Cheapest</option><option>Tracked</option><option>Insured</option></select></div><div class="form-group"><label>Payment Method:</label><select id="payment-method"><option>PayPal F&F</option><option>Wise</option><option>Bank Transfer (EU)</option></select></div></div>
                    <div class="form-group"><label>Your Message for Instagram:</label><textarea id="generated-message" readonly></textarea></div>
                    <div class="flex justify-between items-center gap-4"><a href="https://www.instagram.com/bananatrades877/" target="_blank" rel="noopener noreferrer" class="text-center w-full bg-gray-600 text-white py-2 px-4 rounded-full">Open Instagram</a><button id="copy-message-btn" class="w-full bg-blue-500 text-white py-2 px-4 rounded-full">Copy Message</button></div>
                    <hr class="my-4 border-gray-700"><div id="basket-items-container">${basketItemsHtml}</div>
                </div>
            </div>`;
        ui.openModal('basket', content, false);
        const modalBody = dom.modals.basket.querySelector('.modal-body');
        modalBody.addEventListener('input', generateMessage);
        modalBody.querySelector('#copy-message-btn').addEventListener('click', () => {
            const country = modalBody.querySelector('#shipping-country').value;
            if (!country.trim()) {
                utils.showMessageBox('Please specify the shipping country.', 'error');
                return;
            }
            const textarea = modalBody.querySelector('#generated-message');
            textarea.select();
            document.execCommand('copy');
            utils.showMessageBox('Message copied to clipboard!', 'success');
        });
        modalBody.querySelector('#basket-items-container').addEventListener('click', e => {
            const removeBtn = e.target.closest('.remove-item-btn');
            if (removeBtn) {
                this.toggleBasketItem(removeBtn, removeBtn.dataset.docId);
                this.showBasketModal();
            }
        });
        generateMessage();
    },
    showAdminForm(docId = null) {
        const card = docId ? state.cards.find(c => c.docId === docId) : {};
        const isEditing = !!docId;
        const content = `
            <div class="modal-content-box admin-form-modal">
                <div class="modal-header flex justify-between items-center"><h2 class="text-2xl font-bold">${isEditing ? `Edit Card: ${card.id || ''}` : 'Add New Card'}</h2><button class="close-modal-btn text-2xl">&times;</button></div>
                <div class="modal-body">
                    <form id="admin-card-form" class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                        <div class="form-group"><label>Group:</label><select name="group" required><option value="">Select Group</option>${(state.metadata.groupOrder || []).map(g => `<option value="${g}" ${card.group === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Member:</label><select name="member" required></select></div>
                        <div class="form-group col-span-full"><label>Album:</label><input type="text" name="album" required value="${card.album || ''}" list="album-suggestions"><datalist id="album-suggestions"></datalist></div>
                        <div class="form-group col-span-full"><label>Version (Description):</label><input type="text" name="description" required value="${card.version || ''}" list="version-suggestions"><datalist id="version-suggestions"></datalist></div>
                        <div class="form-group"><label>Price (€):</label><input type="number" name="price" step="0.01" required value="${card.price || ''}"></div>
                        <div class="form-group"><label>Discount (%):</label><select name="discount">${[0, 10, 20].map(d => `<option value="${d}" ${card.discount == d ? 'selected' : ''}>${d > 0 ? d + '%' : 'None'}</option>`).join('')}</select></div>
                        <div class="form-group"><label>Status:</label><select name="status">${['available', 'reserved', 'sold', 'archived'].map(s => `<option value="${s}" ${card.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}</select></div>
                        <div class="form-group flex items-center"><input type="checkbox" name="isRare" class="mr-2 h-4 w-4" ${card.isRare ? 'checked' : ''}><label class="mb-0">Is Rare?</label></div>
                        <div class="form-group col-span-full"><label>Front Image URL:</label><input type="url" name="imageUrl" required value="${card.image || ''}"></div>
                        <div class="form-group col-span-full"><label>Back Image URL:</label><input type="url" name="backImage" required value="${card.backImage || ''}"></div>
                        <div class="form-group col-span-full mt-2 flex gap-4">
                            <button type="submit" name="save" class="bg-green-600 text-white py-2 px-4 rounded-full w-full">Save Card</button>
                            ${!isEditing ? `<button type="submit" name="save_add" class="bg-blue-600 text-white py-2 px-4 rounded-full w-full">Save & Add Another</button>` : ''}
                        </div>
                    </form>
                </div>
            </div>`;
        ui.openModal('adminForm', content, false);
        const form = dom.modals.adminForm.querySelector('#admin-card-form');
        const groupSelect = form.querySelector('[name="group"]');
        const memberSelect = form.querySelector('[name="member"]');
        const albumInput = form.querySelector('[name="album"]');
        const albumDatalist = form.querySelector('#album-suggestions');
        const versionInput = form.querySelector('[name="description"]');
        const versionDatalist = form.querySelector('#version-suggestions');
        const populateAlbumSuggestions = () => {
            albumDatalist.innerHTML = '';
            const group = groupSelect.value;
            const member = memberSelect.value;
            if (!group || !member || !state.metadata.albums?.[group]) return;
            const groupAlbums = state.metadata.albums[group].group_albums || {};
            const memberAlbums = state.metadata.albums[group][member] || {};
            const allAlbumNames = new Set([...Object.keys(groupAlbums), ...Object.keys(memberAlbums)]);
            albumDatalist.innerHTML = [...allAlbumNames].map(name => `<option value="${name}"></option>`).join('');
        };
        const populateVersionSuggestions = () => {
            versionDatalist.innerHTML = '';
            const group = groupSelect.value;
            const member = memberSelect.value;
            const albumName = albumInput.value;
            if (!group || !member || !albumName || !state.metadata.albums?.[group]) return;
            const groupAlbums = state.metadata.albums[group].group_albums || {};
            const memberAlbums = state.metadata.albums[group][member] || {};
            let versions = [];
            if (groupAlbums[albumName]?.versions) versions = groupAlbums[albumName].versions;
            else if (memberAlbums[albumName]?.versions) versions = memberAlbums[albumName].versions;
            versionDatalist.innerHTML = versions.map(name => `<option value="${name}"></option>`).join('');
        };
        const updateMembersAndSuggestions = (selectedMember = '') => {
            const members = (state.metadata.memberOrder || {})[groupSelect.value] || [];
            memberSelect.innerHTML = `<option value="">Select Member</option>` + members.map(m => `<option value="${m}" ${selectedMember === m ? 'selected' : ''}>${m}</option>`).join('');
            if (selectedMember) memberSelect.value = selectedMember;
            populateAlbumSuggestions();
            populateVersionSuggestions();
        };
        groupSelect.addEventListener('change', () => updateMembersAndSuggestions());
        memberSelect.addEventListener('change', () => {
            populateAlbumSuggestions();
            versionInput.value = '';
            populateVersionSuggestions();
        });
        albumInput.addEventListener('input', populateVersionSuggestions);
        updateMembersAndSuggestions(isEditing ? card.member : '');
        if (isEditing) populateVersionSuggestions();
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitter = e.submitter?.name;
            const formData = new FormData(form);
            const cardData = {
                group: formData.get('group'), member: formData.get('member'), album: formData.get('album'),
                description: formData.get('description'), price: parseFloat(formData.get('price')),
                discount: parseInt(formData.get('discount')), status: formData.get('status'),
                imageUrl: formData.get('imageUrl'), backImage: formData.get('backImage'),
                isRare: formData.get('isRare') === 'on',
            };
            try {
                await services.saveCard(cardData, docId);
                utils.showMessageBox(`Card ${isEditing ? 'updated' : 'added'} successfully!`, 'success');
                if (submitter === 'save_add' && !isEditing) {
                    const savedGroup = formData.get('group');
                    const savedMember = formData.get('member');
                    form.reset();
                    groupSelect.value = savedGroup;
                    updateMembersAndSuggestions(savedMember);
                    albumInput.focus();
                } else {
                    ui.closeModal('adminForm');
                }
            } catch (error) {
                console.error("Error saving card:", error);
                utils.showMessageBox("Error saving card.", 'error');
            }
        });
    },
    showContentEditor() {
        const groupSettingsHtml = (state.metadata.groupOrder || []).map(groupName => `
            <div class="form-group p-4 border border-gray-700 rounded-lg mb-4">
                <h4 class="text-lg font-bold mb-2 text-white">${groupName}</h4>
                <label class="text-sm text-gray-400">Subtitle:</label>
                <textarea name="groupSubtitles.${groupName}" rows="1" class="w-full bg-gray-800 p-2 rounded mb-2 text-white">${(state.siteContent.groupSubtitles || {})[groupName] || ''}</textarea>
                <label class="text-sm text-gray-400">Banner URL:</label>
                <input type="url" name="groupBanners.${groupName}" class="w-full bg-gray-800 p-2 rounded text-white" value="${(state.siteContent.groupBanners || {})[groupName] || ''}" placeholder="https://example.com/banner.jpg">
            </div>`).join('');
        const memberQuotesHtml = (state.metadata.groupOrder || []).map(groupName => {
            const members = (state.metadata.memberOrder || {})[groupName] || [];
            if (members.length === 0) return '';
            const memberInputs = members.map(memberName => `
                <div class="form-group">
                    <label class="text-sm text-gray-400">${memberName}'s Quote:</label>
                    <textarea name="memberQuotes.${groupName}.${memberName}" rows="2" class="w-full bg-gray-800 p-2 rounded text-white">${(state.siteContent.memberQuotes?.[groupName]?.[memberName] || '')}</textarea>
                </div>
            `).join('');
            return `<div class="p-4 border border-gray-700 rounded-lg mb-4">
                <h4 class="text-lg font-bold mb-2 text-white">${groupName} Quotes</h4>
                ${memberInputs}
            </div>`;
        }).join('');

        const content = `
            <div class="modal-content-box content-editor-modal">
                <div class="modal-header flex justify-between items-center"><h2 class="text-2xl font-bold">Edit Site Content</h2><button class="close-modal-btn text-2xl">&times;</button></div>
                <div class="modal-body">
                    <form id="site-content-form">
                        <div class="form-group"><label>Site Title:</label><input type="text" name="title" value="${state.siteContent.title || ''}"></div>
                        <div class="form-group"><label>Site Subtitle:</label><textarea name="subtitle" rows="2">${state.siteContent.subtitle || ''}</textarea></div>
                        <h3 class="text-xl font-bold mt-4 mb-2">Group Settings</h3><div>${groupSettingsHtml}</div>
                        <h3 class="text-xl font-bold mt-4 mb-2">Member Quotes</h3><div>${memberQuotesHtml}</div>
                        <div class="form-group"><label>Info Text (HTML allowed):</label><textarea name="infoText" rows="10">${state.siteContent.infoText || ''}</textarea></div>
                        <div class="form-group"><label>Disclaimer Text (HTML allowed):</label><textarea name="disclaimerText" rows="10">${state.siteContent.disclaimerText || ''}</textarea></div>
                        <button type="submit" class="bg-green-600 text-white py-2 px-4 rounded-full w-full">Save Site Content</button>
                    </form>
                </div>
            </div>`;
        ui.openModal('contentEditor', content, false);
        dom.modals.contentEditor.querySelector('#site-content-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedContent = {
                title: e.target.title.value, subtitle: e.target.subtitle.value, infoText: e.target.infoText.value,
                disclaimerText: e.target.disclaimerText.value,
                groupSubtitles: {}, groupBanners: {},
                memberQuotes: {}
            };
            (state.metadata.groupOrder || []).forEach(groupName => {
                updatedContent.groupSubtitles[groupName] = e.target[`groupSubtitles.${groupName}`].value;
                updatedContent.groupBanners[groupName] = e.target[`groupBanners.${groupName}`].value;
                
                updatedContent.memberQuotes[groupName] = {};
                const members = (state.metadata.memberOrder || {})[groupName] || [];
                members.forEach(memberName => {
                    const quoteValue = e.target[`memberQuotes.${groupName}.${memberName}`].value;
                    if (quoteValue) {
                        updatedContent.memberQuotes[groupName][memberName] = quoteValue;
                    }
                });
            });
            try {
                await services.saveSiteContent(updatedContent);
                utils.showMessageBox('Site content updated!', 'success');
                ui.closeModal('contentEditor');
            } catch (error) {
                console.error("Error saving site content:", error);
                utils.showMessageBox('Error saving content.', 'error');
            }
            ui.render();
        });
    },
    
    handleUserFilterChange(e) {
        const sectionId = state.activeMemberSectionId;
        if (!sectionId) return;

        const filters = state.userFilters[sectionId];
        const target = e.target;
        if (target.name === 'searchTerm' || target.name === 'album' || target.name === 'version') {
            filters[target.name] = target.value;
        } else if (target.classList.contains('filter-tag')) {
            const tag = target.dataset.tag;
            if (filters.tags.has(tag)) {
                filters.tags.delete(tag);
            } else {
                filters.tags.add(tag);
            }
            target.classList.toggle('active');
        }

        ui.updateActiveMemberSectionView();
    },
    resetUserFilters() {
        const sectionId = state.activeMemberSectionId;
        if (!sectionId) return;

        state.userFilters[sectionId] = {
            searchTerm: '',
            album: 'All',
            version: 'All',
            tags: new Set()
        };
        ui.updateFilterSidebarUI();
        ui.updateActiveMemberSectionView();
    },
    startTutorial() {
        if (localStorage.getItem('photocard_tutorial_seen_v2') === 'true') {
            return;
        }
        this.showTutorialStep(1);
    },
    showTutorialStep(step) {
        dom.tutorialOverlay.classList.add('visible');
        dom.userView.classList.add('tutorial-active');
        
        const bubble = dom.tutorialBubble;
        
        bubble.style.opacity = '0';
        bubble.style.visibility = 'hidden';
        bubble.style.top = '-1000px';
        bubble.style.left = '-1000px';
        bubble.classList.add('visible');
        dom.tutorialCloneContainer.innerHTML = '';

        let targetEl;
        if (step === 1) {
            targetEl = dom.infoBubble;
            dom.tutorialContent.textContent = "Click here to learn about the buying procedure and rules.";
            dom.tutorialNextBtn.style.display = 'block';
            dom.tutorialCloseBtn.textContent = 'Skip';
        } else if (step === 2) {
            targetEl = dom.filterBubble;
            dom.tutorialContent.textContent = "You can filter and look for specific cards / albums using the filter function. Keep in mind that the filters are member specific and don't carry on to other members.";
            dom.tutorialNextBtn.style.display = 'none';
            dom.tutorialCloseBtn.textContent = 'Got it!';
        }

        if (!targetEl) return;
        const targetRect = targetEl.getBoundingClientRect();
        const cloneEl = targetEl.cloneNode(true);
        cloneEl.style.top = `${targetRect.top}px`;
        cloneEl.style.left = `${targetRect.left}px`;
        cloneEl.style.width = `${targetRect.width}px`;
        cloneEl.style.height = `${targetRect.height}px`;
        cloneEl.style.margin = '0';
        dom.tutorialCloneContainer.appendChild(cloneEl);
        
        setTimeout(() => {
            this.positionTutorialBubble(cloneEl);
            bubble.style.visibility = 'visible';
            bubble.style.opacity = '1';
        }, 50);
    },
    positionTutorialBubble(targetEl) {
        const bubble = dom.tutorialBubble;
        const pointer = bubble.querySelector('.tutorial-bubble-pointer');
        const targetRect = targetEl.getBoundingClientRect();
        const bubbleRect = bubble.getBoundingClientRect();
        const pointerSize = 15;
        const margin = 10;
        let top, left, pointerClass;

        if (targetRect.left - bubbleRect.width - pointerSize > margin) {
            left = targetRect.left - bubbleRect.width - pointerSize;
            top = targetRect.top + (targetRect.height / 2) - (bubbleRect.height / 2);
            pointerClass = 'right';
        } 
        else if (targetRect.top - bubbleRect.height - pointerSize > margin) {
            left = targetRect.left + (targetRect.width / 2) - (bubbleRect.width / 2);
            top = targetRect.top - bubbleRect.height - pointerSize;
            pointerClass = 'bottom';
        }
        else if (targetRect.right + bubbleRect.width + pointerSize < window.innerWidth - margin) {
            left = targetRect.right + pointerSize;
            top = targetRect.top + (targetRect.height / 2) - (bubbleRect.height / 2);
            pointerClass = 'left';
        }
        else {
            left = targetRect.left + (targetRect.width / 2) - (bubbleRect.width / 2);
            top = targetRect.bottom + pointerSize;
            pointerClass = 'top';
        }
        
        top = Math.max(margin, Math.min(top, window.innerHeight - bubbleRect.height - margin));
        left = Math.max(margin, Math.min(left, window.innerWidth - bubbleRect.width - margin));

        bubble.style.top = `${top}px`;
        bubble.style.left = `${left}px`;
        pointer.className = `tutorial-bubble-pointer ${pointerClass}`;
    },
    handleTutorialNext() {
        this.showTutorialStep(2);
    },
    closeTutorial() {
        const bubble = dom.tutorialBubble;
        bubble.style.opacity = '0';
        setTimeout(() => {
            bubble.classList.remove('visible');
            bubble.style.visibility = 'hidden';
            dom.tutorialOverlay.classList.remove('visible');
            dom.userView.classList.remove('tutorial-active');
            dom.tutorialCloneContainer.innerHTML = '';
        }, 300);
        localStorage.setItem('photocard_tutorial_seen_v2', 'true');
    }
};