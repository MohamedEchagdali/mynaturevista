// ===== main.js =====
import { CONFIG } from './config/constants.js';
import { AuthUtils } from './utils/auth.js';
import { SidebarManager } from './components/SidebarManager.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { ApiKeyManager } from './pages/ApiAccessPage.js';
import { ButtonsPage } from './pages/ButtonsPage.js';
import { ButtonsEditorPage } from './pages/ButtonsEditorPage.js';
import { UpdatePlanPage } from './pages/UpdatePlanPage.js';
import { ChartsPage } from './pages/ChartsPage.js';
import { TablesPage } from './pages/TablesPage.js';
import { WidgetSettingsPage } from './pages/WidgetSettingsPage.js';
import { UserService } from './services/UserService.js';

class UserDisplay {
  constructor() {
    this.user = null;
  }

  async init() {
    await this.loadUserData();
    this.updateSidebarUsername();

    try {
      const user = await UserService.getProfile();

      // Fill email
      const emailInput = document.getElementById('email');
      if (emailInput && user?.email) {
        emailInput.value = user.email;
      }

      // Fill domain from database
      const domainInput = document.getElementById('domain');
      if (domainInput && user?.domain) {
        domainInput.value = user.domain;
      }
    } catch (e) {
      console.error("Could not load user data:", e);
    }
  }

  async loadUserData() {
    try {
      this.user = await UserService.getProfile();
    } catch (error) {
      console.error('Error loading user data for sidebar:', error);
    }
  }

  updateSidebarUsername() {
    const userNameElements = document.querySelectorAll(".userName");
    const userName = this.user?.name || "User";
    
    userNameElements.forEach(span => {
      span.textContent = userName;
    });
  }

  // Public method to update after profile changes
  async refresh() {
    await this.loadUserData();
    this.updateSidebarUsername();
  }
}

class App {
  constructor() {
    this.currentPage = null;
    this.userDisplay = null;
  }

  async init() {
    // Verify authentication
    if (!AuthUtils.isAuthenticated()) {
      AuthUtils.redirectToLogin();
      return;
    }

    // Get current page
    const page = document.body.dataset.page;
   
    // Initialize global components
    this.setupGlobalComponents();

    // Initialize user display in sidebar
    this.userDisplay = new UserDisplay();
    await this.userDisplay.init();

    // Initialize specific page
    await this.initPageSpecific(page);

    // Load plan only if element exists
    await this.loadUserPlanIfNeeded();
  }

  setupGlobalComponents() {
    // Sidebar toggle
    SidebarManager.init();
   
    // Global logout buttons
    document.querySelectorAll('[data-logout]').forEach(button => {
      button.addEventListener('click', AuthUtils.logout);
    });

    // Global functions for compatibility with existing HTML
    window.logout = AuthUtils.logout;
    
    window.toggleForm = () => {
      if (this.currentPage && typeof this.currentPage.toggleForm === 'function') {
        this.currentPage.toggleForm();
      }
    };

    window.updateTotal = () => {
      if (this.currentPage && typeof this.currentPage.updatePlanTotal === 'function') {
        this.currentPage.updatePlanTotal();
      }
    };

    window.updatePlanTotal = () => {
      if (this.currentPage && typeof this.currentPage.updatePlanTotal === 'function') {
        this.currentPage.updatePlanTotal();
      }
    };

    window.togglePaymentSection = () => {
      if (this.currentPage && typeof this.currentPage.togglePaymentSection === 'function') {
        this.currentPage.togglePaymentSection();
      }
    };

    window.submitDataRequest = () => {
      if (this.currentPage && typeof this.currentPage.submitGDPRRequest === 'function') {
        this.currentPage.submitGDPRRequest();
      }
    };

    // Global function to refresh username in sidebar
    window.refreshUserDisplay = () => {
      if (this.userDisplay) {
        this.userDisplay.refresh();
      }
    };
  }

  async initPageSpecific(page) {
    const pageClasses = {
      'dashboard': DashboardPage,
      'accountSettings': ProfilePage,
      'apiAccess': ApiKeyManager,
      'buttons': ButtonsPage,
      'buttonsEditor': ButtonsEditorPage,
      'charts': ChartsPage,
      'profileSettings': ProfilePage,
      'updatePlan': UpdatePlanPage,
      'widgetSettings': WidgetSettingsPage,
      'tables': TablesPage,
      'customPlaces': null,
      'contact': null,        // ← ADD
      'billing': null,         // ← ADD
      'addDomain': null,
      'deleteAccount': null
    };

    const PageClass = pageClasses[page];
    if (PageClass) {
      this.currentPage = new PageClass();

      // Pass userDisplay reference to pages that may need it
      if (this.currentPage && typeof this.currentPage.setUserDisplay === 'function') {
        this.currentPage.setUserDisplay(this.userDisplay);
      }

      await this.currentPage.init();
    } else if (page === 'customPlaces' || page === 'contact' || page === 'billing' || page === 'addDomain') {
      // These pages handle their own initialization or don't need an initializer
    } else {
      console.warn(`No initializer found for page: ${page}`);
    }
  }

  // Load complete plan with domains used
  async loadUserPlanIfNeeded() {
    const currentPlanElement = document.getElementById("currentPlan");

    // Only load if element exists on the page
    if (!currentPlanElement) {
      return;
    }

    try {

      // Use the original endpoint that works correctly
      const response = await fetch("/api/user/current-plan", {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Extract plan information
      const planName = data.planName || 'Free';
      const domainsUsed = data.domainsUsed || 1;
      const domainLimit = this.getPlanDomainLimit(planName);

      // Create HTML with all information
      const planHTML = `
        <strong>${planName}</strong>

      `;

      currentPlanElement.innerHTML = planHTML;

    } catch (err) {
      if (currentPlanElement) {
        currentPlanElement.innerHTML = `
          <span style="color: #dc3545;">Error loading plan</span>
        `;
      }
    }
  }

  // Determine domain limit based on plan
  getPlanDomainLimit(planName) {
    const limits = {
      'Starter': 1,
      'Business': 1,  // 1 base domain (+ additional with €10 each)
      'Enterprise': 1  // 1 base domain (+ additional with €15 each)
    };
    return limits[planName] || 1;
  }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init().catch(console.error);
});