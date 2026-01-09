// ===== pages/ProfilePage.js =====
import { UserService } from '../services/UserService.js';
import { AlertManager } from '../components/AlertManager.js';
import { ValidationUtils } from '../utils/validation.js';

export class ProfilePage {
  constructor() {
    this.user = null;
    this.setupEventListeners();
  }

  async init() {
    await this.loadUserData();
    this.updateDisplay();
  }

  async loadUserData() {
    try {
      this.user = await UserService.getProfile();
    } catch (error) {
      console.error('Error loading profile:', error);
      AlertManager.show("Error loading user data");
    }
  }

  setupEventListeners() {
    // Profile update form
    const updateForm = document.getElementById("updateForm");
    if (updateForm) {
      updateForm.addEventListener("submit", (e) => this.handleProfileUpdate(e));
    }

    // Password change form
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
    }

    // Account tabs
    this.setupAccountTabs();
  }

  setupAccountTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        const targetContent = document.getElementById(target);
        if (targetContent) {
          targetContent.classList.add('active');
        }
      });
    });
  }

  async handlePasswordChange(e) {
    e.preventDefault();
   
    const currentPassword = document.getElementById('currentPassword')?.value.trim();
    const newPassword = document.getElementById('newPassword')?.value.trim();
    const confirm = document.getElementById('confirmNewPassword')?.value.trim();
    const errorElement = document.getElementById('passwordError');
    const successElement = document.getElementById('passwordSuccess');
    
    // Clear previous messages
    if (errorElement) {
      errorElement.textContent = '';
      errorElement.style.display = 'none';
    }
    if (successElement) {
      successElement.textContent = '';
      successElement.style.display = 'none';
    }
    
    // Validations
    if (!currentPassword || !newPassword || !confirm) {
      this.showPasswordError('Please complete all fields.');
      return;
    }
    
    if (newPassword !== confirm) {
      this.showPasswordError('Passwords do not match.');
      return;
    }
    
    if (newPassword.length < 6) {
      this.showPasswordError('Password must be at least 6 characters long.');
      return;
    }

    try {
      const result = await UserService.changePassword({ currentPassword, newPassword });
      this.showPasswordSuccess(result.message || 'Password changed successfully');
      document.getElementById('passwordForm').reset();
    } catch (error) {
      console.error('Error in changePassword:', error);
      this.showPasswordError('Error changing password.');
    }
  }

  showPasswordError(message) {
    const errorElement = document.getElementById('passwordError');
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
  }

  showPasswordSuccess(message) {
    const successElement = document.getElementById('passwordSuccess');
    if (successElement) {
      successElement.textContent = message;
      successElement.style.display = 'block';
    }
  }

  getProfileFormData() {
    return {
      name: this.getValue("fullName"),
      domain: this.getValue("domain"),
      phone: this.getValue("phone"),
      email: this.getValue("email"),
      addresses: this.getValue("address")
    };
  }

  validateProfileData(data) {
    const phoneClean = data.phone.replace(/[^\d+]/g, '');
    if (!/^\d+$/.test(phoneClean) && data.phone) {
      AlertManager.show("Phone number can only contain digits.");
      return false;
    }

    if (data.email && !ValidationUtils.isValidEmail(data.email)) {
      AlertManager.show("Please enter a valid email address.");
      return false;
    }

    return true;
  }

  updateDisplay() {
    if (!this.user) return;

    const elements = {
      fullName: document.getElementById("fullName"),
      domain: document.getElementById("domain"),
      email: document.getElementById("email"),
      phone: document.getElementById("phone"),
      address: document.getElementById("address"),
      profileName: document.getElementById("profileName"),
      profileDomain: document.getElementById("profileDomain"),
      profileEmail: document.getElementById("profileEmail"),
      profilePhone: document.getElementById("profilePhone"),
      profileAddress: document.getElementById("profileAddress"),
      userNameFooter: document.querySelectorAll(".userName"),
      userId: document.getElementById("userId")
    };

    // Form fields
    if (elements.fullName) elements.fullName.value = this.user.name || "";
    if (elements.domain) elements.domain.value = this.user.domain || "";
    if (elements.email) elements.email.value = this.user.email || "";
    if (elements.phone) elements.phone.value = this.user.phone || "";
    if (elements.address) elements.address.value = this.user.addresses || "";

    // Display elements
    if (elements.profileName) elements.profileName.textContent = this.user.name || "no name";
    if (elements.profileDomain) elements.profileDomain.textContent = this.user.domain || "example.com";
    if (elements.profileEmail) elements.profileEmail.textContent = this.user.email || "email@gmail.com";
    if (elements.profilePhone) elements.profilePhone.textContent = this.user.phone || "NOT DEFINED";
    if (elements.profileAddress) elements.profileAddress.textContent = this.user.addresses || "NOT DEFINED";
    if (elements.userId) elements.userId.textContent = this.user.id || "No ID";

    elements.userNameFooter.forEach(span => {
      span.textContent = this.user.name || "User";
    });
  }

  toggleForm() {
    const form = document.getElementById("updateForm");
    const editButton = document.querySelector("button[onclick='toggleForm()']");
    
    if (!form) return;
    
    if (form.style.display === "none" || form.style.display === "") {
      form.style.display = "block";
      if (editButton) editButton.textContent = "Cancel Edit";
    } else {
      form.style.display = "none";
      if (editButton) editButton.textContent = "Edit Profile";
    }
  }

  getValue(elementId) {
    const element = document.getElementById(elementId);
    return element ? element.value.trim() : '';
  }

  // GDPR functionality - Enhanced method for ProfilePage.js
  async submitGDPRRequest() {
    // Prevent multiple simultaneous requests
    if (this.gdprRequestInProgress) { 
      return;
    }

    const email = document.getElementById('verification-email')?.value;
    const reason = document.getElementById('reason')?.value;
    const submitBtn = document.getElementById('submit-request');
    const btnText = document.getElementById('btn-text');
    const btnLoading = document.getElementById('btn-loading');
    const successMsg = document.getElementById('success-message');
    const errorMsg = document.getElementById('error-message');
    const errorText = document.getElementById('error-text');

    // Reset messages
    if (successMsg) successMsg.style.display = 'none';
    if (errorMsg) errorMsg.style.display = 'none';

    // Validation
    if (!email || !email.includes('@')) {
      if (errorText) errorText.textContent = 'Please enter a valid email address.';
      if (errorMsg) errorMsg.style.display = 'block';
      return;
    }

    // Set loading state and prevent multiple requests
    this.gdprRequestInProgress = true;
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'inline';

    try {
      // Configure retries with reasonable limits
      const result = await UserService.submitGDPRRequest({
        email: email.trim().toLowerCase(),
        reason: reason,
        timestamp: new Date().toISOString()
      }, {
        maxRetries: 2, // Fewer retries for GDPR requests
        baseDelay: 5000, // 5 seconds base delay
        maxDelay: 30000 // Max 30 seconds delay
      });

      if (successMsg) successMsg.style.display = 'block';
      const requestForm = document.getElementById('request-form');
      if (requestForm) requestForm.style.display = 'none';

    } catch (error) {
      console.error('Data request error:', error);
      
      let errorMessage = 'Network error. Please try again later.';
      
      // Customize error message based on error type
      if (error.message.includes('Rate limit')) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (error.message.includes('429')) {
        errorMessage = 'Server is busy. Please try again in a few minutes.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      if (errorText) errorText.textContent = errorMessage;
      if (errorMsg) errorMsg.style.display = 'block';
      
    } finally {
      // Reset button state and allow new requests
      this.gdprRequestInProgress = false;
      if (submitBtn) submitBtn.disabled = false;
      if (btnText) btnText.style.display = 'inline';
      if (btnLoading) btnLoading.style.display = 'none';
    }
  }
}