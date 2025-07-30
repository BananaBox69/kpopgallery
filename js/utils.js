// --- 5. UTILITY FUNCTIONS ---
export const utils = {
    calculateDiscountedPrice(originalPrice, discountPercentage) {
        if (!discountPercentage || discountPercentage === 0) return originalPrice;
        let discountAmount = 0;
        if (discountPercentage === 10) discountAmount = Math.max(0.50, originalPrice * 0.10);
        else if (discountPercentage === 20) discountAmount = Math.max(1.00, originalPrice * 0.20);
        const rawDiscountedPrice = originalPrice - discountAmount;
        const roundedPrice = Math.ceil(rawDiscountedPrice * 2) / 2;
        return Math.max(1.00, roundedPrice);
    },
    groupData(data) {
        return data.reduce((acc, card) => {
            (acc[card.group] = acc[card.group] || {})[card.member] = (acc[card.group][card.member] || []);
            acc[card.group][card.member].push(card);
            return acc;
        }, {});
    },
    showMessageBox(message, type = 'info', duration = 3000) {
        const box = document.createElement('div');
        box.className = `message-box ${type}`;
        box.textContent = message;
        document.body.appendChild(box);
        setTimeout(() => box.classList.add('visible'), 10);
        setTimeout(() => {
            box.classList.remove('visible');
            setTimeout(() => box.remove(), 300);
        }, duration);
    }
};