import { state, dom } from "./state.js";
import { config } from "./config.js";
import { utils } from "./utils.js";

// --- 6. UI RENDERING MODULE ---
export const ui = {
    render() {
        dom.userView.style.display = state.isAdminView ? 'none' : 'block';
        dom.adminView.style.display = state.isAdminView ? 'block' : 'none';
        if (state.isAdminView) {
            this.renderAdminView();
        } else {
            if (!state.isDataReady.cards) {
                this.renderSkeletonLoader();
            } else {
                this.renderUserView();
            }
        }
    },
    renderUserView() {
        dom.siteTitle.textContent = state.siteContent.title;
        dom.siteSubtitle.innerHTML = state.siteContent.subtitle.replace(/\n/g, '<br>');
        this.renderCollection();
        this.updateFloatingBasket();
    },
    renderCollection() {
        const availableCards = state.cards.filter(card => card.status !== 'sold' && card.status !== 'archived');
        const groupedData = utils.groupData(availableCards);
        
        const sectionsToRender = [];
        const groupOrder = state.metadata.groupOrder || [];
        groupOrder.forEach(groupName => {
            const membersInGroup = state.metadata.memberOrder?.[groupName] || [];
            const membersWithCards = membersInGroup.filter(memberName =>
                groupedData[groupName]?.[memberName]?.length > 0
             );
            if (membersWithCards.length > 0) {
                sectionsToRender.push({ type: 'group', name: groupName });
                membersWithCards.forEach(memberName => {
                    sectionsToRender.push({ type: 'member', group: groupName, name: memberName, cards: groupedData[groupName][memberName] });
                });
            }
        });
        dom.collectionContainer.innerHTML = '';
        
        if (dom.headerScrollArrow) {
            dom.headerScrollArrow.style.opacity = sectionsToRender.length > 0 ? '1' : '0';
        }

        if (groupOrder.length === 0 && state.cards.length > 0) {
            dom.collectionContainer.innerHTML = `<p class="text-center text-xl text-gray-400 p-8">Metadata not found.</p>`;
            return;
        }

        sectionsToRender.forEach((sectionData, index) => {
            let sectionEl;
            if (sectionData.type === 'group') {
                sectionEl = this.createGroupIntroSection(sectionData.name);
            } else {
                sectionEl = this.createMemberSection(sectionData.group, sectionData.name, sectionData.cards);
            }

            if (index < sectionsToRender.length - 1) { 
                const arrow = document.createElement('div');
                arrow.className = 'scroll-down-arrow';
                arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg>`;
                
                const nextSectionData = sectionsToRender[index + 1];
                let nextArrowColor;
                if (nextSectionData.type === 'group') {
                    nextArrowColor = config.colors[nextSectionData.name]?.group;
                } else { 
                    nextArrowColor = config.colors[nextSectionData.group]?.[nextSectionData.name];
                }
                if (nextArrowColor) {
                    arrow.style.color = nextArrowColor;
                }

                sectionEl.appendChild(arrow);
            }
            
            dom.collectionContainer.appendChild(sectionEl);
        });
        this.renderFloatingNav(sectionsToRender);
        this.updateFloatingBasket();
        this.initIntersectionObserver();
    },
    createGroupIntroSection(groupName) {
        const section = document.createElement('section');
        const sectionId = `group-${groupName.toLowerCase().replace(/\s/g, '-')}`;
        section.id = sectionId;
        section.className = 'showcase-section group-intro text-center';
        const groupColor = config.colors[groupName]?.group || '#ffffff';
        const glowRgb = config.glowColors[groupName] || '255, 71, 87';
        section.style.setProperty('--hero-glow-color', `rgba(${glowRgb}, 0.5)`);
        section.dataset.color = groupColor;
        section.dataset.groupColor = groupColor;
        const bannerUrl = state.siteContent.groupBanners?.[groupName];
        const logoUrl = state.metadata.groupLogos?.[groupName];
        section.innerHTML = `
            ${bannerUrl ? `<div class="group-banner" style="background-image: url(${bannerUrl})"></div>` : ''}
            <div class="title-container">
                <h2 class="hero-title font-display animate-in">${groupName}</h2>
                <p class="group-subtitle animate-in" style="transition-delay: 0.1s;">${(state.siteContent.groupSubtitles || {})[groupName] || ''}</p>
            </div>
            ${logoUrl ? `<img src="${logoUrl}" class="group-logo animate-in" style="transition-delay: 0.2s;">` : ''}
        `;
        return section;
    },
    createMemberSection(groupName, memberName, cards) {
        const section = document.createElement('section');
        const memberColor = config.colors[groupName]?.[memberName] || '#ffffff';
        const groupColor = config.colors[groupName]?.group || '#ffffff';
        const isIU = groupName === 'IU' && memberName === 'IU';
        const memberNameColor = isIU ? 'var(--color-iu-member)' : memberColor;
        const groupNameColor = isIU ? 'var(--color-iu)' : memberColor;
        
        const sectionId = `member-${groupName.toLowerCase().replace(/\s/g, '-')}-${memberName.toLowerCase().replace(/\s/g, '-')}`;
        section.className = 'showcase-section member-section-container';
        section.id = sectionId;
        section.dataset.color = memberColor;
        section.dataset.groupColor = groupColor;
        section.style.setProperty('--member-color', memberColor);
        section.style.setProperty('--group-color', groupColor);
        if (!state.userFilters[sectionId]) {
            state.userFilters[sectionId] = {
                searchTerm: '',
                album: 'All',
                version: 'All',
                tags: new Set()
            };
        }
        
        const filteredCards = this.applyUserFilters(cards, sectionId);
        const initialCard = filteredCards[0] || {};
        const finalPrice = utils.calculateDiscountedPrice(initialCard.price || 0, initialCard.discount);
        const isInBasket = state.basket.some(item => item.docId === initialCard.docId);
        const signatureUrl = state.metadata.memberSignatures?.[groupName]?.[memberName];
        const quote = state.siteContent.memberQuotes?.[groupName]?.[memberName];

        const cardsPerPage = 10;
        const totalPages = Math.ceil(filteredCards.length / cardsPerPage);
        const showPagination = filteredCards.length > cardsPerPage;
        section.innerHTML = `
            <div class="room-backdrop"></div>
            ${quote ? `<div class="member-quote animate-in" style="transition-delay: 0.3s;">${quote.replace(/\n/g, '<br>')}</div>` : ''}
            <div class="member-section">
                <div class="card-details-panel">
                    <p class="card-id-text animate-in">${initialCard.id || 'N/A'}</p>
                    <h2 class="member-name animate-in" style="color: ${memberNameColor}; transition-delay: 0.05s;">${memberName}</h2>
                    <p class="group-name animate-in" style="color: ${groupNameColor}; transition-delay: 0.1s;">${groupName}</p>
                    <p class="album-name animate-in" style="transition-delay: 0.15s;">${initialCard.album || (filteredCards.length === 0 ? 'No matching cards found' : '')}</p>
                    <p class="version-name animate-in" style="transition-delay: 0.2s;">${initialCard.version || ''}</p>
                    <p class="price-tag animate-in" style="transition-delay: 0.25s;">${initialCard.price ? `€${finalPrice.toFixed(2)}` : ''}</p>
                    <div class="original-price-container animate-in" style="transition-delay: 0.3s;">
                        ${(initialCard.price && finalPrice < initialCard.price) ? `<span class="original-price">€${(initialCard.price || 0).toFixed(2)}</span>` : ''}
                    </div>
                    <button class="add-to-basket-main-btn animate-in ${isInBasket ? 'in-basket' : ''}" data-doc-id="${initialCard.docId}" ${!initialCard.docId || initialCard.status !== 'available' ? 'disabled' : ''} style="transition-delay: 0.35s;">
                        ${initialCard.status ? (initialCard.status.charAt(0).toUpperCase() + initialCard.status.slice(1)) : 'Add to Basket'}
                    </button>
                </div>
                <div class="carousel-container">
                    <div class="carousel"></div>
                    <div class="carousel-arrow left" data-direction="1">&#9664;</div>
                    <div class="carousel-arrow right" data-direction="-1">&#9654;</div>
                    ${showPagination ? `
                    <div class="carousel-pagination">
                        <button class="page-btn prev-page">&#9664;</button>
                        <span class="page-indicator">1 / ${totalPages}</span>
                        <button class="page-btn next-page">&#9654;</button>
                    </div>
                    ` : ''}
                </div>
            </div>
            ${signatureUrl ? `<div class="member-signature animate-in" style="-webkit-mask-image: url(${signatureUrl}); mask-image: url(${signatureUrl}); background-color: var(--member-color); transition-delay: 0.3s;"></div>` : ''}
        `;
        this.initCarousel(section, filteredCards, sectionId, groupName);
        return section;
    },
    createCarouselCard(card, index, pageCards) {
        const isInBasket = state.basket.some(item => item.docId === card.docId);
        const isNew = (Date.now() - card.dateAdded.getTime()) < 7 * 24 * 60 * 60 * 1000;

        let tagsHtml = '';
        if (isNew) tagsHtml += '<div class="tag">NEW</div>';
        if (card.discount === 20) tagsHtml += '<div class="tag" style="color: #BA55D3;">SUPER SALE</div>';
        else if (card.discount === 10) tagsHtml += '<div class="tag" style="color: #FF4757;">SALE</div>';
        if (card.isRare) tagsHtml += `<div class="tag" style="color: gold;">RARE</div>`;
        return `
            <div class="carousel-card ${card.status || ''} ${index === 0 ? 'is-active show-tags' : ''} ${isInBasket ? 'in-basket' : ''}" data-doc-id="${card.docId}" data-index="${index}" data-is-new="${isNew}" data-is-rare="${card.isRare}">
                <div class="carousel-card-inner">
                    <div class="carousel-card-face carousel-card-front">
                        <img src="${card.image}" onerror="this.onerror=null;this.src='https://placehold.co/220x341/121212/ff4757?text=Image+Missing&font=playfair+display';">
                        <div class="card-id-overlay">${card.id}</div>
                        <div class="card-tags">${tagsHtml}</div>
                        <div class="card-flip-overlay" title="Flip card"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg></div>
                        <div class="card-click-overlay" ${card.status === 'available' ? '' : 'style="pointer-events:none;"'}></div>
                        <div class="card-added-indicator" style="color: ${config.colors[card.group]?.[card.member] || '#ffffff'};">&#x2764;</div>
                        ${card.status ? `<div class="card-status-overlay">${card.status.toUpperCase()}</div>` : ''}
                        <div class="card-sheen-overlay"></div>
                        <div class="sparkle-container"></div>
                    </div>
                    <div class="carousel-card-face carousel-card-back">
                        <img src="${card.backImage}" onerror="this.onerror=null;this.src='https://placehold.co/220x341/1e1e1e/ffffff?text=Card+Back&font=playfair+display';">
                        <div class="card-flip-overlay" title="Flip card"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg></div>
                        <div class="card-status-overlay-back"></div>
                        ${card.status ? `<div class="card-status-overlay">${card.status.toUpperCase()}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    },
    updateFloatingBasket() {
        const allArrows = document.querySelectorAll('.scroll-down-arrow');
        if (state.basket.length > 0) {
            const totalItems = state.basket.length;
            const totalPrice = state.basket.reduce((sum, item) => sum + utils.calculateDiscountedPrice(item.price, item.discount), 0);
            dom.basketInfo.innerHTML = `<span>${totalItems} item${totalItems > 1 ? 's' : ''}</span> | <strong>Total: €${totalPrice.toFixed(2)}</strong>`;
            dom.floatingEmptyBtn.classList.remove('hidden');
            dom.floatingBasket.classList.add('visible');
            allArrows.forEach(arrow => arrow.classList.add('raised'));
        } else {
            dom.floatingEmptyBtn.classList.add('hidden');
            dom.floatingBasket.classList.remove('visible');
            allArrows.forEach(arrow => arrow.classList.remove('raised'));
        }
    },
    updateCardUIState(docId) {
        const isInBasket = state.basket.some(item => item.docId === docId);
        const card = state.cards.find(c => c.docId === docId);
        if (!card) return;

        const groupColor = config.colors[card.group]?.group;
        document.querySelectorAll(`[data-doc-id='${docId}']`).forEach(el => {
            if (el.classList.contains('carousel-card')) {
                el.classList.toggle('in-basket', isInBasket);
            }
            if (el.classList.contains('add-to-basket-main-btn')) {
                el.classList.toggle('in-basket', isInBasket);
                el.textContent = isInBasket ? 'In Basket' : 'Add to Basket';
                
                if (isInBasket && groupColor) {
                    el.style.backgroundColor = groupColor;
                } else {
                    el.style.backgroundColor = '';
                }
            }
        });
    },
    renderFloatingNav(sectionsToRender) {
        dom.floatingNavContent.innerHTML = ''; // Clear previous nav

        // --- Create the Toggle Button first, as it's a special case ---
        const navToggleBtn = document.createElement('button');
        navToggleBtn.id = 'nav-toggle-btn';
        navToggleBtn.innerHTML = this.arrowRightSVG; // Set the initial icon here

        // --- Define the ideal structure of our grid ---
        const layout = {
            'Red Velvet': { row: 0, members: ['Irene', 'Seulgi', 'Wendy', 'Joy', 'Yeri'] },
            'IU': { row: 1, members: ['IU'] },
            'aespa': { row: 2, members: ['Karina', 'Giselle', 'Winter', 'Ningning'] }
        };
        const numRows = 3;
        const numCols = 7;
        const navGrid = Array.from({ length: numRows }, () => Array(numCols).fill(null));

        // --- Determine which buttons should be created ---
        const buttonsToCreate = {}; // e.g., { 'Red Velvet': true, 'Irene': true, ... }
        sectionsToRender.forEach(section => {
            buttonsToCreate[section.name] = true;
            if (section.group) {
                buttonsToCreate[section.group] = true; // Make sure parent group is also flagged
            }
        });

        // --- Fill the grid based on the layout and visibility ---
        Object.keys(layout).forEach(groupName => {
            const groupConfig = layout[groupName];
            const rowIndex = groupConfig.row;

            // Place member buttons
            groupConfig.members.forEach((memberName, memberIndex) => {
                let colIndex = -1;
                if (groupName === 'Red Velvet') colIndex = memberIndex;
                if (groupName === 'IU') colIndex = 4;
                if (groupName === 'aespa') colIndex = memberIndex + 1;

                if (colIndex !== -1) {
                    if (buttonsToCreate[memberName]) {
                        const btn = document.createElement('a');
                        btn.href = `#member-${groupName.toLowerCase().replace(/\s/g, '-')}-${memberName.toLowerCase().replace(/\s/g, '-')}`;
                        btn.className = 'nav-btn';
                        btn.style.backgroundColor = config.colors[groupName]?.[memberName] || 'var(--default-ui-color)';
                        btn.textContent = (groupName === 'IU' && memberName === 'IU') ? config.groupPrefixes.IU : memberName.charAt(0);
                        navGrid[rowIndex][colIndex] = btn;
                    }
                }
            });

            // Place group button
            if (buttonsToCreate[groupName]) {
                const groupBtn = document.createElement('a');
                groupBtn.href = `#group-${groupName.toLowerCase().replace(/\s/g, '-')}`;
                groupBtn.className = 'nav-btn';
                groupBtn.style.backgroundColor = config.colors[groupName]?.group || 'var(--default-ui-color)';
                groupBtn.textContent = (groupName === 'IU') ? config.memberPrefixes.IU : config.groupPrefixes[groupName] || groupName.charAt(0);
                navGrid[rowIndex][5] = groupBtn;
            }
        });

        // --- Place special static buttons ---
        if (buttonsToCreate['IU']) {
            const homeBtn = document.createElement('a');
            homeBtn.href = '#main-section';
            homeBtn.className = 'nav-btn';
            homeBtn.style.backgroundColor = 'var(--default-ui-color)';
            homeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`;
            navGrid[1][6] = homeBtn;
        }

        // --- Assemble the final DOM elements ---
        const navCluster = document.createElement('div');
        navCluster.className = 'nav-cluster';

        navGrid.forEach(rowData => {
            const rowEl = document.createElement('div');
            rowEl.className = 'nav-row';
            let hasContentInRow = rowData.some(cell => cell !== null);
            
            if (hasContentInRow) {
                rowData.forEach(cellData => {
                    if (cellData) {
                        rowEl.appendChild(cellData);
                    } else {
                        const emptyCell = document.createElement('div');
                        emptyCell.className = 'nav-cell empty';
                        rowEl.appendChild(emptyCell);
                    }
                });
                navCluster.appendChild(rowEl);
            }
        });

        // Add the finished grid and the toggle button to the main container
        dom.floatingNavContent.appendChild(navCluster);
        dom.floatingNavContent.after(navToggleBtn); // Place toggle button after the content
    },
        
    renderAdminView() {
        dom.adminView.innerHTML = `
            <div class="admin-header">
                <h1 class="text-3xl font-bold">Admin Panel</h1>
                <div class="admin-controls">
                    <button data-action="edit-content" class="bg-blue-500 text-white py-2 px-4 rounded-full">Edit Site Content</button>
                    <button data-action="add-card" class="bg-green-500 text-white py-2 px-4 rounded-full">Add New Card</button>
                    <button data-action="logout" class="bg-red-500 text-white py-2 px-4 rounded-full">Logout</button>
                </div>
            </div>
            <div class="admin-filters-sort-search">
                <div class="form-group"><label>Group:</label><select data-filter="group"></select></div>
                <div class="form-group"><label>Member:</label><select data-filter="member"></select></div>
                <div class="form-group"><label>Status:</label><select data-filter="status"><option value="All">All (Default)</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="archived">Archived</option><option value="Sale">On Sale</option><option value="New">New</option></select></div>
                <div class="form-group"><label>Sort:</label><select data-sort="by"><option value="default">Default</option><option value="id">ID</option><option value="price">Price</option><option value="group">Group</option><option value="member">Member</option><option value="album">Album</option><option value="version">Version</option><option value="dateAdded">Date Added</option></select></div>
                <div class="form-group"><label>Order:</label><select data-sort="order"><option value="asc">Asc</option><option value="desc">Desc</option></select></div>
                <div class="form-group flex-grow"><label>Search:</label><input type="text" data-filter="searchTerm" placeholder="Search..."></div>
            </div>
            <div id="admin-list-info" class="text-gray-400 mb-4"></div>
            <div id="admin-bulk-actions" class="admin-bulk-actions"></div>
            <div id="admin-card-list" class="admin-card-list"></div>
        `;
        this.populateAdminFilters();
        this.applyAdminFiltersAndSort();
    },
    populateAdminFilters() {
        const groupFilter = dom.adminView.querySelector('[data-filter="group"]');
        groupFilter.innerHTML = '<option value="All">All Groups</option>';
        (state.metadata.groupOrder || []).forEach(groupName => {
            groupFilter.innerHTML += `<option value="${groupName}">${groupName}</option>`;
        });
        groupFilter.value = state.adminFilters.group;
        this.updateAdminMemberFilter();
        dom.adminView.querySelector('[data-filter="member"]').value = state.adminFilters.member;
        dom.adminView.querySelector('[data-filter="status"]').value = state.adminFilters.status;
        dom.adminView.querySelector('[data-sort="by"]').value = state.adminSort.by;
        dom.adminView.querySelector('[data-sort="order"]').value = state.adminSort.order;
        dom.adminView.querySelector('[data-filter="searchTerm"]').value = state.adminFilters.searchTerm;
    },
    updateAdminMemberFilter() {
        const memberFilter = dom.adminView.querySelector('[data-filter="member"]');
        memberFilter.innerHTML = '<option value="All">All Members</option>';
        const selectedGroup = state.adminFilters.group;
        const members = selectedGroup === 'All'
            ? Object.values(state.metadata.memberOrder || {}).flat()
            : (state.metadata.memberOrder || {})[selectedGroup] || [];
        new Set(members).forEach(memberName => {
            memberFilter.innerHTML += `<option value="${memberName}">${memberName}</option>`;
        });
    },
    applyAdminFiltersAndSort() {
        let filteredData = [...state.cards];
        const { group, member, status, searchTerm } = state.adminFilters;
        const { by, order } = state.adminSort;
        if (group !== 'All') filteredData = filteredData.filter(c => c.group === group);
        if (member !== 'All') filteredData = filteredData.filter(c => c.member === member);
        if (status === 'All') {
            filteredData = filteredData.filter(c => c.status !== 'archived');
        } else if (status === 'Sale') {
            filteredData = filteredData.filter(c => c.discount > 0);
        } else if (status === 'New') {
            filteredData = filteredData.filter(c => (Date.now() - c.dateAdded.getTime()) < 7 * 24 * 60 * 60 * 1000);
        } else {
            filteredData = filteredData.filter(c => c.status === status);
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredData = filteredData.filter(c => Object.values(c).some(val => String(val).toLowerCase().includes(term)));
        }
        filteredData.sort((a, b) => {
            let compare = 0;
            if (by === 'default') {
                const groupCompare = (state.metadata.groupOrder || []).indexOf(a.group) - (state.metadata.groupOrder || []).indexOf(b.group);
                if (groupCompare !== 0) return groupCompare;
                const memberCompare = ((state.metadata.memberOrder || {})[a.group] || []).indexOf(a.member) - ((state.metadata.memberOrder || {})[b.group] || []).indexOf(b.member);
                if (memberCompare !== 0) return memberCompare;
                return a.id.localeCompare(b.id);
            }
            const valA = a[by];
            const valB = b[by];
            if (typeof valA === 'string') compare = valA.localeCompare(valB);
            else if (typeof valA === 'number') compare = valA - valB;
            else if (valA instanceof Date) compare = valA.getTime() - b.dateAdded.getTime();
            return order === 'asc' ? compare : -compare;
        });
        this.renderAdminList(filteredData);
    },
    renderAdminList(dataToRender) {
        const listEl = document.getElementById('admin-card-list');
        if (!listEl) return;
        document.getElementById('admin-list-info').textContent = `Showing ${dataToRender.length} of ${state.cards.length} total cards.`;
        listEl.innerHTML = dataToRender.map(card => {
            const memberColor = config.colors[card.group]?.[card.member] || '#ffffff';
            let statusHtml = `<span class="capitalize text-gray-300">(${card.status})</span>`;
            if ((Date.now() - card.dateAdded.getTime()) < 7 * 24 * 60 * 60 * 1000) 
            statusHtml += `<span class="text-white ml-2">New</span>`;
            if (card.discount === 20) statusHtml += `<span class="text-purple-400 ml-2">Super Sale</span>`;
            else if (card.discount === 10) statusHtml += `<span class="text-red-400 ml-2">Sale</span>`;
            if (card.isRare) statusHtml += `<span class="text-yellow-400 ml-2">Rare</span>`;

            return `
                <div class="admin-card-item ${card.status || ''}-card ${state.adminSelectedIds.has(card.docId) ? 'selected' : ''}" data-doc-id="${card.docId}">
                    <input type="checkbox" class="bulk-checkbox w-5 h-5 pointer-events-none" ${state.adminSelectedIds.has(card.docId) ? 'checked' : ''}>
                    <img src="${card.image}" data-action="preview-image" class="admin-card-thumb" onerror="this.onerror=null;this.src='https://placehold.co/50x77/121212/ff4757?text=Img';">
                    <div class="admin-card-info" style="color: ${memberColor};">
                        <span><strong>ID:</strong> ${card.id}</span>
                        <span><strong>Group:</strong> ${card.group}</span>
                        <span><strong>Member:</strong> ${card.member}</span>
                        <span><strong>Album:</strong> ${card.album}</span>
                        <span><strong>Version:</strong> ${card.version}</span>
                        <span><strong>Price:</strong> €${card.price.toFixed(2)}</span>
                        <span><strong>Status:</strong> ${statusHtml}</span>
                    </div>
                    <div class="admin-card-actions">
                        <button data-action="edit-card" class="bg-blue-600 text-white px-3 py-1 rounded-md">Edit</button>
                        <button data-action="delete-card" class="bg-red-600 text-white px-3 py-1 rounded-md">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
        ui.renderBulkActions();
    },
    renderBulkActions() {
        const bulkActionsBar = document.getElementById('admin-bulk-actions');
        if (!bulkActionsBar) return;
        const count = state.adminSelectedIds.size;
        bulkActionsBar.innerHTML = `
            <span class="text-white self-center">${count} selected</span>
            <button data-action="unselect-all" class="bg-gray-500 p-2 rounded-md" ${count === 0 ? 'disabled' : ''}>Unselect All</button>
            <button data-action="bulk-update" data-field="discount" data-value="10" class="bg-red-500 p-2 rounded-md" ${count === 0 ? 'disabled' : ''}>Sale</button>
            <button data-action="bulk-update" data-field="discount" data-value="20" class="bg-purple-500 p-2 rounded-md" ${count === 0 ? 'disabled' : ''}>Super Sale</button>
            <button data-action="bulk-update" data-field="discount" data-value="0" class="bg-gray-500 p-2 rounded-md" ${count === 0 ? 'disabled' : ''}>Clear Sale</button>
            <button data-action="bulk-update" data-field="status" data-value="available" class="bg-green-500 p-2 rounded-md" ${count === 0 ? 'disabled' : ''}>Mark Available</button>
            <button data-action="bulk-update" data-field="status" data-value="reserved" class="bg-orange-500 p-2 rounded-md" ${count === 0 ? 'disabled' : ''}>Mark Reserved</button>
            <button data-action="bulk-update" data-field="status" data-value="sold" class="bg-gray-600 p-2 rounded-md" ${count === 0 ? 'disabled' : ''}>Mark Sold</button>
            <button data-action="toggle-rare" class="bg-yellow-600 text-white p-2 rounded-md" ${count === 0 ? 'disabled' : ''}>Toggle Rare</button>
            <button data-action="bulk-archive" class="bg-indigo-700 p-2 rounded-md" ${count === 0 ? 'disabled' : ''}>Archive</button>
        `;
    },
    openModal(modalKey, contentHtml, isDismissable = true) {
        const modal = dom.modals[modalKey];
        if (modal) {
            modal.innerHTML = contentHtml;
            if (!isDismissable) {
                modal.dataset.dismissable = 'false';
            } else {
                delete modal.dataset.dismissable;
            }
            modal.classList.add('visible');
        }
    },
    closeModal(modalKey) {
        const modal = dom.modals[modalKey];
        if (modal) {
            modal.classList.remove('visible');
        }
    },
    initIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const sectionId = entry.target.id;
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    const memberColor = entry.target.dataset.color;
                    const groupColor = entry.target.dataset.groupColor;
                    
                    const newUIColor = memberColor || groupColor || 'var(--default-ui-color)';
                    const newEmptyBtnColor = groupColor || 'var(--default-ui-color)';

                    document.documentElement.style.setProperty('--floating-ui-color', newUIColor);
                    dom.floatingEmptyBtn.style.backgroundColor = newEmptyBtnColor;
                    const groupNameForGlow = Object.keys(config.colors).find(key => {
                        const colorData = config.colors[key];
                        return colorData.group === entry.target.dataset.groupColor;
                    });
                    const glowRgb = config.glowColors[groupNameForGlow] || '119, 119, 119';
                    document.documentElement.style.setProperty('--hero-glow-color', `rgba(${glowRgb}, 0.5)`);
                    if (sectionId.startsWith('member-')) {
                        state.activeMemberSectionId = sectionId;
                        this.updateFilterSidebarUI();
                    }

                } else {
                    entry.target.classList.remove('is-visible');
                }
            });
        }, { threshold: 0.6 });
        document.querySelectorAll('.showcase-section').forEach(section => observer.observe(section));
    },
    initCarousel(section, cards, sectionId, groupName) {
        const detailsPanel = section.querySelector('.card-details-panel');
        const carouselEl = section.querySelector('.carousel');
        const leftArrow = section.querySelector('.carousel-arrow.left');
        const rightArrow = section.querySelector('.carousel-arrow.right');
        const prevPageBtn = section.querySelector('.prev-page');
        const nextPageBtn = section.querySelector('.page-btn.next-page');
        const pageIndicator = section.querySelector('.page-indicator');

        cards.sort((a, b) => {
            const albumCompare = (a.album || '').localeCompare(b.album || '');
            if (albumCompare !== 0) return albumCompare;
            const versionCompare = (a.description || '').localeCompare(b.description || '');
            if (versionCompare !== 0) return versionCompare;
            return (a.id || '').localeCompare(b.id || '');
        });
        const cardsPerPage = 10;
        const totalPages = Math.ceil(cards.length / cardsPerPage);
        state.carouselPages[sectionId] = 0;

        let cardsForPage = [];
        let currentIndex = 0;
        let rotation = 0;
        let angle = 0;
        const renderPage = () => {
            const currentPage = state.carouselPages[sectionId] || 0;
            const startIndex = currentPage * cardsPerPage;
            const endIndex = startIndex + cardsPerPage;
            cardsForPage = cards.slice(startIndex, endIndex);
            carouselEl.innerHTML = cardsForPage.map((card, i) => this.createCarouselCard(card, i, cardsForPage)).join('');
            
            const baseRadius = 400;
            const cardWidth = 220;
            leftArrow.style.left = `calc(50% - ${baseRadius / 2}px - ${cardWidth / 4}px)`;
            rightArrow.style.left = `calc(50% + ${baseRadius / 2}px + ${cardWidth / 4}px)`;
            
            currentIndex = 0;
            rotation = 0;
            angle = cardsForPage.length > 0 ? 360 / cardsForPage.length : 0;
            
            const cardElements = carouselEl.querySelectorAll('.carousel-card');
            cardElements.forEach((card, i) => {
                card.style.transform = `rotateY(${angle * i}deg) translateZ(${baseRadius}px)`;
            });
            carouselEl.style.transform = `rotateY(0deg)`;
            
            if (pageIndicator) {
                pageIndicator.textContent = `${currentPage + 1} / ${totalPages}`;
                prevPageBtn.disabled = currentPage === 0;
                nextPageBtn.disabled = currentPage === totalPages - 1;
            }

            updateDetails();
        };

        let isDown = false, startX, startRotation;

        const spawnSparkles = (sparkleContainer, color = 'white') => {
            sparkleContainer.innerHTML = '';
            const numSparkles = (color === 'gold') ? 40 : 20;
            for (let i = 0; i < numSparkles; i++) {
                const sparkle = document.createElement('div');
                sparkle.className = 'sparkle';
                const size = Math.random() * 3 + 1;
                sparkle.style.width = `${size}px`;
                sparkle.style.height = `${size}px`;
                
                sparkle.style.setProperty('--sparkle-color', color);
                if (color === 'gold') {
                    sparkle.style.setProperty('--sparkle-color-shadow-1', 'rgba(255,215,0,0.7)');
                    sparkle.style.setProperty('--sparkle-color-shadow-2', 'rgba(255,215,0,0.4)');
                } else {
                    sparkle.style.setProperty('--sparkle-color-shadow-1', 'rgba(255,255,255,0.7)');
                    sparkle.style.setProperty('--sparkle-color-shadow-2', 'rgba(255,255,255,0.4)');
                }

                sparkle.style.left = `${Math.random() * 100}%`;
                sparkle.style.top = `${Math.random() * 100}%`;
                
                sparkle.style.setProperty('--sparkle-end-x', `${(Math.random() * 2 - 1) * 100}px`);
                sparkle.style.setProperty('--sparkle-end-y', `${(Math.random() * 2 - 1) * 100}px`);

                sparkle.style.animationDelay = `${Math.random() * 0.5}s`;

                sparkleContainer.appendChild(sparkle);
            }
        };
        const updateDetails = () => {
            if (cardsForPage.length === 0) {
                detailsPanel.querySelector('.card-id-text').textContent = 'N/A';
                detailsPanel.querySelector('.album-name').textContent = 'No matching cards found';
                detailsPanel.querySelector('.version-name').textContent = '';
                detailsPanel.querySelector('.price-tag').textContent = '';
                detailsPanel.querySelector('.original-price-container').innerHTML = '';
                const mainBtn = detailsPanel.querySelector('.add-to-basket-main-btn');
                mainBtn.disabled = true;
                mainBtn.textContent = 'Unavailable';
                mainBtn.classList.remove('in-basket');
                mainBtn.dataset.docId = '';
                return;
            }
            const card = cardsForPage[currentIndex];
            const finalPrice = utils.calculateDiscountedPrice(card.price, card.discount);
            const isInBasket = state.basket.some(item => item.docId === card.docId);
            detailsPanel.querySelector('.card-id-text').textContent = card.id;
            detailsPanel.querySelector('.album-name').textContent = card.album;
            detailsPanel.querySelector('.version-name').textContent = card.version;
            detailsPanel.querySelector('.price-tag').textContent = `€${finalPrice.toFixed(2)}`;
            detailsPanel.querySelector('.original-price-container').innerHTML = finalPrice < card.price ? `<span class="original-price">€${(card.price || 0).toFixed(2)}</span>` : '';
            const mainBtn = detailsPanel.querySelector('.add-to-basket-main-btn');
            mainBtn.dataset.docId = card.docId;
            mainBtn.disabled = card.status !== 'available';
            mainBtn.textContent = card.status ? (card.status.charAt(0).toUpperCase() + card.status.slice(1)) : (isInBasket ? 'In Basket' : 'Add to Basket');
            mainBtn.classList.toggle('in-basket', isInBasket);
            if (isInBasket) {
                const groupColor = config.colors[groupName]?.group || '#28a745';
                mainBtn.style.backgroundColor = groupColor;
            } else {
                mainBtn.style.backgroundColor = '';
            }
            
            const cardElements = carouselEl.querySelectorAll('.carousel-card');
            cardElements.forEach((cardEl, i) => {
                const isActive = i === currentIndex;
                const cardData = cardsForPage[i];
                const isNew = cardData.dateAdded && (Date.now() - cardData.dateAdded.getTime()) < 7 * 24 * 60 * 60 * 1000;
                const isRare = cardData.isRare;

                const numCards = cardsForPage.length;
                const leftNeighborIndex = (currentIndex - 1 + numCards) % numCards;
                const rightNeighborIndex = (currentIndex + 1) % numCards;

                const isNeighbor = (i === leftNeighborIndex || i === rightNeighborIndex);
                
                cardEl.classList.toggle('is-active', isActive);

                const sheenOverlay = cardEl.querySelector('.card-sheen-overlay');
                if (sheenOverlay) {
                    sheenOverlay.classList.toggle('is-sheen-active', isActive || isNeighbor);
                }

                const sparkleContainer = cardEl.querySelector('.sparkle-container');
                if (sparkleContainer) {
                    if (isActive) {
                        if (isRare) {
                            sparkleContainer.classList.add('has-sparkle');
                            spawnSparkles(sparkleContainer, 'gold');
                        } else if (isNew) {
                            sparkleContainer.classList.add('has-sparkle');
                            spawnSparkles(sparkleContainer, 'white');
                        } else {
                            sparkleContainer.classList.remove('has-sparkle');
                        }
                    } else {
                        sparkleContainer.classList.remove('has-sparkle');
                    }
                }

                if (isActive && cardEl.classList.contains('is-flipped')) {
                    const innerCard = cardEl.querySelector('.carousel-card-inner');
                    if (innerCard) {
                        innerCard.style.transition = 'none';
                        cardEl.classList.remove('is-flipped');
                        void innerCard.offsetWidth;
                        innerCard.style.transition = '';
                    }
                }

                cardEl.classList.toggle('show-tags', isActive || isNeighbor);
            });
        };
        
        const rotateCarousel = (direction) => {
            if (cardsForPage.length === 0) return;
            rotation += angle * direction;
            currentIndex = (currentIndex - direction + cardsForPage.length) % cardsForPage.length;
            carouselEl.style.transform = `rotateY(${rotation}deg)`;
            updateDetails();
        };
        leftArrow.addEventListener('click', () => rotateCarousel(1));
        rightArrow.addEventListener('click', () => rotateCarousel(-1));

        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', () => {
                if (state.carouselPages[sectionId] > 0) {
                    state.carouselPages[sectionId]--;
                    renderPage();
                }
            });
        }
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', () => {
                if (state.carouselPages[sectionId] < totalPages - 1) {
                    state.carouselPages[sectionId]++;
                    renderPage();
                }
            });
        }

        carouselEl.addEventListener('mousedown', (e) => {
            if (e.target.closest('.card-flip-overlay') || e.target.closest('.card-click-overlay') || e.target.closest('.card-status-overlay-back')) {
                return;
            }
            isDown = true;
            carouselEl.classList.add('is-dragging');
            startX = e.clientX;
            startRotation = rotation;
        });
        window.addEventListener('mouseup', () => {
            if (!isDown || cardsForPage.length === 0) return;
            isDown = false;
            carouselEl.classList.remove('is-dragging');
            rotation = Math.round(rotation / angle) * angle;
            currentIndex = (-(rotation / angle) % cardsForPage.length + cardsForPage.length) % cardsForPage.length;
            carouselEl.style.transition = 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
            carouselEl.style.transform = `rotateY(${rotation}deg)`;
            updateDetails();
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDown) return; e.preventDefault();
            const walk = (e.clientX - startX); rotation = startRotation + (walk * 0.5);
            carouselEl.style.transition = 'none'; 
            carouselEl.style.transform = `rotateY(${rotation}deg)`;
        });
        section.addEventListener('mousemove', e => {
            const cardInner = e.target.closest('.carousel-card-inner');
            if (!cardInner) return;
            const cardWrapper = cardInner.parentElement;
            const rect = cardWrapper.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const centerX = rect.width / 2, centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * 5;
            const rotateY = ((centerX - x) / centerX) * 5;
            cardInner.style.setProperty('--tilt-x', `${rotateX}deg`);
            cardInner.style.setProperty('--tilt-y', `${rotateY}deg`);
        });
        section.addEventListener('mouseleave', e => {
            const cardInner = e.target.closest('.carousel-card-inner');
            if(cardInner) {
                cardInner.style.setProperty('--tilt-x', `0deg`);
                cardInner.style.setProperty('--tilt-y', `0deg`);
            }
        }, true);
        renderPage();
    },
    renderSkeletonLoader() {
        const skeletonGroup = `
            <section class="showcase-section">
                <div class="skeleton skeleton-text" style="width: 300px; height: 4rem; margin-bottom: 1rem;"></div>
                <div class="skeleton skeleton-text" style="width: 500px; height: 1.25rem;"></div>
            </section>
        `;
        const skeletonMember = `
            <section class="showcase-section">
                <div class="member-section">
                    <div class="card-details-panel text-center">
                        <div class="skeleton skeleton-text mx-auto" style="width: 100px; height: 1rem; margin-bottom: 1.5rem;"></div>
                        <div class="skeleton skeleton-text mx-auto" style="width: 250px; height: 3.5rem; margin-bottom: 0.5rem;"></div>
                        <div class="skeleton skeleton-text mx-auto" style="width: 150px; height: 1.5rem; margin-bottom: 1.5rem;"></div>
                        <div class="skeleton skeleton-text mx-auto" style="width: 300px; height: 1.1rem; margin-bottom: 0.5rem;"></div>
                        <div class="skeleton skeleton-text mx-auto" style="width: 200px; height: 0.9rem; margin-bottom: 1rem;"></div>
                        <div class="skeleton skeleton-text mx-auto" style="width: 120px; height: 2.5rem; margin: 0 auto;"></div>
                    </div>
                    <div class="carousel-container flex justify-center items-center">
                        <div class="skeleton skeleton-card"></div>
                    </div>
                </div>
            </section>
        `;
        dom.collectionContainer.innerHTML = skeletonGroup + skeletonMember + skeletonMember;
    },
    applyUserFilters(cards, sectionId) {
        const filters = state.userFilters[sectionId];
        if (!filters) return cards;

        return cards.filter(card => {
            if (filters.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                const searchableText = `${card.album} ${card.version} ${card.id}`.toLowerCase();
                if (!searchableText.includes(term)) return false;
            }
            if (filters.album !== 'All' && card.album !== filters.album) return false;
            if (filters.version !== 'All' && card.version !== filters.version) return false;
            if (filters.tags.size > 0) {
                const isNew = (Date.now() - (card.dateAdded?.getTime() || 0)) < 7 * 24 * 60 * 60 * 1000;
                for (const tag of filters.tags) {
                    if (tag === 'new' && !isNew) return false;
                    if (tag === 'rare' && !card.isRare) return false;
                    if (tag === 'sale' && card.discount !== 10) return false;
                    if (tag === 'super-sale' && card.discount !== 20) return false;
                }
            }
            return true;
        });
    },
    updateFilterSidebarUI() {
        const sectionId = state.activeMemberSectionId;
        if (!sectionId || !sectionId.startsWith('member-')) {
            dom.filterSidebar.classList.remove('visible');
            return;
        }
        
        const sectionEl = document.getElementById(sectionId);
        const color = sectionEl.dataset.color || 'var(--default-ui-color)';
        dom.filterSidebar.style.setProperty('--floating-ui-color', color);
        
        const lastHyphenIndex = sectionId.lastIndexOf('-');
        const groupSlug = sectionId.substring('member-'.length, lastHyphenIndex);
        const memberSlug = sectionId.substring(lastHyphenIndex + 1);

        const groupName = Object.keys(config.colors).find(g => g.toLowerCase().replace(/\s/g, '-') === groupSlug);
        const memberName = Object.keys(config.colors[groupName] || {}).find(m => m.toLowerCase().replace(/\s/g, '-') === memberSlug);

        if (!groupName || !memberName) return;
        const allMemberCards = state.cards.filter(c => c.group === groupName && c.member === memberName && c.status !== 'sold' && c.status !== 'archived');
        const albums = [...new Set(allMemberCards.map(c => c.album).filter(Boolean))].sort();
        const versions = [...new Set(allMemberCards.map(c => c.version).filter(Boolean))].sort();
        dom.filterForm.album.innerHTML = '<option value="All">All Albums</option>' + albums.map(a => `<option value="${a}">${a}</option>`).join('');
        dom.filterForm.version.innerHTML = '<option value="All">All Versions</option>' + versions.map(v => `<option value="${v}">${v}</option>`).join('');
        const currentFilters = state.userFilters[sectionId];
        dom.filterForm.search.value = currentFilters.searchTerm;
        dom.filterForm.album.value = currentFilters.album;
        dom.filterForm.version.value = currentFilters.version;
        dom.filterForm.tags.querySelectorAll('.filter-tag').forEach(tagEl => {
            tagEl.classList.toggle('active', currentFilters.tags.has(tagEl.dataset.tag));
        });
    },
    updateActiveMemberSectionView() {
        const sectionId = state.activeMemberSectionId;
        if (!sectionId) return;

        const sectionEl = document.getElementById(sectionId);
        
        const lastHyphenIndex = sectionId.lastIndexOf('-');
        const groupSlug = sectionId.substring('member-'.length, lastHyphenIndex);
        const memberSlug = sectionId.substring(lastHyphenIndex + 1);
        
        const groupName = Object.keys(config.colors).find(g => g.toLowerCase().replace(/\s/g, '-') === groupSlug);
        const memberName = Object.keys(config.colors[groupName] || {}).find(m => m.toLowerCase().replace(/\s/g, '-') === memberSlug);

        if (!groupName || !memberName) return;
        const originalCards = state.cards.filter(c => c.group === groupName && c.member === memberName && c.status !== 'sold' && c.status !== 'archived');
        const filteredCards = this.applyUserFilters(originalCards, sectionId);
        
        this.initCarousel(sectionEl, filteredCards, sectionId, groupName);
    }
};