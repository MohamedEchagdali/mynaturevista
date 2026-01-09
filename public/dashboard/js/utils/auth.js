// ===== utils/auth.js =====
import { CONFIG } from '../config/constants.js';

export class AuthUtils {
  static getToken() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN) || 
           sessionStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
  }

  static logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    localStorage.removeItem('userData');
    window.location.replace(CONFIG.LOGIN_URL);
  }

  static redirectToLogin() {
    window.location.href = CONFIG.LOGIN_URL;
  }

  static isAuthenticated() {
    return !!this.getToken();
  }

  static async isAdmin() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role === 'admin';
    } catch (error) {
      console.error('Error verifying admin role:', error);
      return false;
    }
  }

}

