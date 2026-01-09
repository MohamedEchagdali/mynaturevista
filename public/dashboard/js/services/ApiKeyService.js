// services/ApiKeyService.js - IMPROVED VERSION
import { ApiClient } from '../utils/api.js';

export class ApiKeyService {
  /**
   * Gets user's base domain (from registration)
   */
  static async getBaseDomain() {
    try {
      const response = await ApiClient.get('/user/profile');
      return {
        success: true,
        domain: response.domain,
        isBase: true
      };
    } catch (error) {
      console.error('Error getting base domain:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gets all available domains (base + active extras)
   */
  static async getAllDomains() {
    try {
      const response = await ApiClient.get('/domains/all');
      return {
        success: true,
        baseDomain: response.baseDomain, // Registration domain
        extraDomains: response.extraDomains || [], // Paid domains
        totalDomains: 1 + (response.extraDomains?.length || 0)
      };
    } catch (error) {
      console.error('Error getting domains:', error);
      return {
        success: false,
        baseDomain: null,
        extraDomains: [],
        error: error.message
      };
    }
  }

  /**
   * Gets all user's API keys grouped by domain
   */
  static async getAllKeys() {
    try {
      const response = await ApiClient.get('/keys/my-keys');
      
      // Group keys by domain
      const keysByDomain = {};
      response.keys.forEach(key => {
        if (!keysByDomain[key.domain]) {
          keysByDomain[key.domain] = [];
        }
        keysByDomain[key.domain].push(key);
      });

      return {
        success: true,
        keys: response.keys || [],
        keysByDomain: keysByDomain,
        limits: response.limits || {
          domains_used: 0,
          domains_allowed: 1,
          domains_extra: 0,
          can_add_domain: false
        }
      };
    } catch (error) {
      console.error('Error getting API keys:', error);
      return {
        success: false,
        keys: [],
        keysByDomain: {},
        error: error.message
      };
    }
  }

  /**
   * Generates an API key for a specific domain
   * @param {Object} keyData
   * @param {string} keyData.domain - Domain (required)
   * @param {string} [keyData.description] - Optional description
   */
  static async generateKey(keyData) {
    try {
      if (!keyData.domain) {
        throw new Error('Domain is required');
      }

      const response = await ApiClient.post('/keys/generate', keyData);
      return response;
    } catch (error) {
      console.error('Error generating API key:', error);
      
      if (error.message.includes('403')) {
        return {
          success: false,
          error: 'Domain limit reached',
          limit_reached: true
        };
      }
      
      return {
        success: false,
        error: error.message || 'Error generating API key'
      };
    }
  }

  /**
   * Revokes a specific API key
   */
  static async revokeKey(keyId) {
    try {
      const response = await ApiClient.post(`/keys/revoke/${keyId}`);
      return response;
    } catch (error) {
      console.error('Error revoking API key:', error);
      return {
        success: false,
        error: error.message || 'Error revoking API key'
      };
    }
  }

  /**
   * Gets domain usage statistics
   */
  static async getDomainStats() {
    try {
      const [domainsResponse, keysResponse] = await Promise.all([
        this.getAllDomains(),
        this.getAllKeys()
      ]);

      const baseDomain = domainsResponse.baseDomain;
      const extraDomains = domainsResponse.extraDomains || [];
      const allDomains = [baseDomain, ...extraDomains.map(d => d.domain)].filter(Boolean);

      // Count domains with API keys
      const domainsWithKeys = Object.keys(keysResponse.keysByDomain);

      return {
        success: true,
        baseDomain: baseDomain,
        extraDomains: extraDomains,
        totalAvailable: allDomains.length,
        totalUsed: domainsWithKeys.length,
        domainsWithKeys: domainsWithKeys,
        domainsWithoutKeys: allDomains.filter(d => !domainsWithKeys.includes(d))
      };
    } catch (error) {
      console.error('Error getting statistics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}