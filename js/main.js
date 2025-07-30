import { services } from './services.js';
import { handlers } from './handlers.js';

/**
 * =================================================================
 * K-POP PHOTOCARD GALLERY - REFACTORED APPLICATION
 * =================================================================
 */
((window) => {
    // --- 8. APP INITIALIZATION ---
    const App = {
        init() {
            console.log("Initializing K-Pop Gallery App...");
            services.initFirebase();
            handlers.init();
            services.initListeners();
        }
    };
    App.init();
})(window);