// ===== services/UserService.js =====
import { ApiClient } from '../utils/api.js';

export class UserService {
  static async getProfile() {
    return ApiClient.get('/getProfile');
  }

  static async updateProfile(userData) {
    return ApiClient.put('/updateProfile', userData);
  }

  static async changePassword(passwordData) {
    return ApiClient.post('/changePassword', passwordData);
  }

  static async checkSubscriptionStatus() {
    return ApiClient.get('/subscription-status');
  }

  static async submitGDPRRequest(requestData) {
    return ApiClient.post('/gdpr/data-request', requestData);
  }
}
