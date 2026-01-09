// services/DomainPurchaseService.js
import { ApiClient } from '../utils/api.js';

export class DomainPurchaseService {
  /**
   * Initiate the purchase process for an additional domain
   * @param {string} domain - The domain to add
   * @returns {Promise<Object>} - Stripe checkout URL
   */
  static async purchaseDomain(domain) {
    try {
      const response = await ApiClient.post('/domains/purchase', { domain });
      return response;
    } catch (error) {
      console.error('Error in DomainPurchaseService.purchaseDomain:', error);
      
      return {
        success: false,
        error: error.message || 'Error processing domain purchase'
      };
    }
  }

  /**
   * Verify the status of a domain purchase
   * @param {string} sessionId - Stripe session ID
   * @returns {Promise<Object>} - Purchase status
   */
  static async verifyPurchase(sessionId) {
    try {
      const response = await ApiClient.get(`/domains/verify-purchase/${sessionId}`);
      return response;
    } catch (error) {
      console.error('Error in DomainPurchaseService.verifyPurchase:', error);
      
      return {
        success: false,
        error: error.message || 'Error verifying purchase'
      };
    }
  }

  /**
   * Get user's active additional domains
   * @returns {Promise<Object>} - List of additional domains
   */
  static async getAdditionalDomains() {
    try {
      const response = await ApiClient.get('/domains/additional');
      return response;
    } catch (error) {
      console.error('Error in DomainPurchaseService.getAdditionalDomains:', error);
      
      return {
        success: false,
        domains: [],
        error: error.message || 'Error fetching additional domains'
      };
    }
  }

  /**
   * Cancel an additional domain
   * @param {number} domainId - Additional domain ID
   * @returns {Promise<Object>} - Cancellation result
   */
  static async cancelDomain(domainId) {
    try {
      const response = await ApiClient.post(`/domains/cancel/${domainId}`);
      return response;
    } catch (error) {
      console.error('Error in DomainPurchaseService.cancelDomain:', error);
      
      return {
        success: false,
        error: error.message || 'Error canceling additional domain'
      };
    }
  }
}