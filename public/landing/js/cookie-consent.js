// ========================================
// COOKIE CONSENT MANAGER - GDPR/CCPA COMPLIANT 
// ========================================

class CookieConsentManager {
    constructor() {
        this.cookieName = 'myNaturevista_cookie_consent';
        this.cookieExpiry = 365; 
        this.defaultPreferences = {
            necessary: true,      
            analytics: false,
            marketing: false,
            preferences: false
        };
        
        this.init();
    }
    
    init() {
        const existingConsent = this.getConsent();
        
        if (!existingConsent) {
            setTimeout(() => {
                this.showBanner();
            }, 1000);
        } else {
            this.applyConsent(existingConsent);
        }
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Accept all button
        document.getElementById('acceptAllCookies')?.addEventListener('click', () => {
            this.acceptAll();
        });
        
        // Reject all button (except necessary)
        document.getElementById('rejectAllCookies')?.addEventListener('click', () => {
            this.rejectAll();
        });
        
        // Customize button
        document.getElementById('customizeCookies')?.addEventListener('click', () => {
            this.showSettings();
        });
        
        // Save custom preferences
        document.getElementById('savePreferences')?.addEventListener('click', () => {
            this.saveCustomPreferences();
        });
        
        // Close modal
        document.getElementById('closeCookieModal')?.addEventListener('click', () => {
            this.hideSettings();
        });
        
        // Close modal on outside click
        document.getElementById('cookieSettingsModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'cookieSettingsModal') {
                this.hideSettings();
            }
        });
    }
    
    showBanner() {
        const banner = document.getElementById('cookieConsentBanner');
        if (banner) {
            banner.classList.add('show');
        }
    }
    
    hideBanner() {
        const banner = document.getElementById('cookieConsentBanner');
        if (banner) {
            banner.classList.remove('show');
        }
    }
    
    showSettings() {
        const modal = document.getElementById('cookieSettingsModal');
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            // Load current preferences in toggles
            const currentConsent = this.getConsent() || this.defaultPreferences;
            this.updateToggles(currentConsent);
        }
    }
    
    hideSettings() {
        const modal = document.getElementById('cookieSettingsModal');
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    }
    
    updateToggles(preferences) {
        Object.keys(preferences).forEach(key => {
            const toggle = document.getElementById(`cookie-${key}`);
            if (toggle) {
                toggle.checked = preferences[key];
            }
        });
    }
    
    acceptAll() {
        const allAccepted = {
            necessary: true,
            analytics: true,
            marketing: true,
            preferences: true,
            timestamp: new Date().toISOString()
        };
        
        this.saveConsent(allAccepted);
        this.applyConsent(allAccepted);
        this.hideBanner(); 
    }
    
    rejectAll() {
        const onlyNecessary = {
            necessary: true,
            analytics: false,
            marketing: false,
            preferences: false,
            timestamp: new Date().toISOString()
        };
        
        this.saveConsent(onlyNecessary);
        this.applyConsent(onlyNecessary);
        this.hideBanner(); 
    }
    
    saveCustomPreferences() {
        const preferences = {
            necessary: true, // Always true
            analytics: document.getElementById('cookie-analytics')?.checked || false,
            marketing: document.getElementById('cookie-marketing')?.checked || false,
            preferences: document.getElementById('cookie-preferences')?.checked || false,
            timestamp: new Date().toISOString()
        };
        
        this.saveConsent(preferences);
        this.applyConsent(preferences);
        this.hideBanner();
        this.hideSettings(); 
    }
    
    saveConsent(preferences) {
        const consentData = {
            ...preferences,
            version: '1.0',
            timestamp: new Date().toISOString()
        };
        
        // Save in localStorage
        localStorage.setItem(this.cookieName, JSON.stringify(consentData));
        
        // Also save in cookie for backend
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + this.cookieExpiry);
        
        document.cookie = `${this.cookieName}=${JSON.stringify(consentData)}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict`;
    }
    
    getConsent() {
        // Try to get from localStorage first
        const stored = localStorage.getItem(this.cookieName);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error('Error parsing consent:', e);
            }
        }
        
        // Try to get from cookie
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === this.cookieName) {
                try {
                    return JSON.parse(decodeURIComponent(value));
                } catch (e) {
                    console.error('Error parsing cookie consent:', e);
                }
            }
        }
        
        return null;
    }
    
    applyConsent(preferences) {
        // Apply Google Analytics if accepted
        if (preferences.analytics) {
            this.enableGoogleAnalytics();
        } else {
            this.disableGoogleAnalytics();
        }
        
        // Apply marketing cookies (Facebook Pixel, etc.)
        if (preferences.marketing) {
            this.enableMarketingCookies();
        } else {
            this.disableMarketingCookies();
        }
        
        // Apply preference cookies
        if (preferences.preferences) {
            this.enablePreferenceCookies();
        }
        
        // Dispatch custom event so other parts of the app know
        window.dispatchEvent(new CustomEvent('cookieConsentUpdated', {
            detail: preferences
        }));
    }
    
    enableGoogleAnalytics() { 
        //console.log('Google Analytics enabled');
        
        // Example (uncomment when you have GA):
        /*
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', 'YOUR-GA-ID');
        */
    }
    
    disableGoogleAnalytics() { 
        // Disable GA if active
        window['ga-disable-YOUR-GA-ID'] = true;
    }
    
    enableMarketingCookies() {
        //console.log('Marketing cookies enabled');
        
        // Your marketing pixels will go here (Facebook, etc.)
    }
    
    disableMarketingCookies() {
        //console.log('Marketing cookies disabled');
    }
    
    enablePreferenceCookies() {
        //console.log('Preference cookies enabled');
    }
    
    // Public method to revoke consent
    revokeConsent() {
        localStorage.removeItem(this.cookieName);
        document.cookie = `${this.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        
        // Reload page to show banner again
        window.location.reload();
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.cookieConsent = new CookieConsentManager();
    });
} else {
    window.cookieConsent = new CookieConsentManager();
}