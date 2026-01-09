// ===== utils/api.js =====
import { AuthUtils } from './auth.js';
import { CONFIG } from '../config/constants.js';

export class ApiClient {
  static async request(endpoint, options = {}) {
    const token = AuthUtils.getToken();
   
    if (!token && !options.skipAuth) {
      AuthUtils.redirectToLogin();
      return;
    }

    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    // Retry configuration
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 1000; // 1 second
    const maxDelay = options.maxDelay || 30000; // 30 seconds max

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${CONFIG.API_BASE}${endpoint}`, config);
       
        if (response.status === 401) {
          AuthUtils.logout();
          return;
        }

        // Handle rate limiting
        if (response.status === 429) {
          if (attempt === maxRetries) {
            // Parse the response to get better error info
            let errorData;
            try {
              errorData = await response.json();
            } catch (e) {
              errorData = { error: 'Rate limit exceeded' };
            }
            throw new Error(errorData.error || 'Rate limit exceeded. Please try again later.');
          }
          
          // Get retry delay from headers or response body
          let delay = baseDelay * Math.pow(2, attempt);
          
          const retryAfter = response.headers.get('Retry-After');
          if (retryAfter) {
            const retrySeconds = parseInt(retryAfter);
            // Cap the retry delay to prevent extremely long waits
            if (retrySeconds < 300) { // Max 5 minutes
              delay = retrySeconds * 1000;
            } else {
              // If server wants us to wait too long, use exponential backoff instead
              delay = Math.min(maxDelay, baseDelay * Math.pow(2, attempt));
            }
          }
          
          // Cap delay to reasonable maximum
          delay = Math.min(delay, maxDelay);
          
          console.warn(`Rate limited. Retrying in ${Math.round(delay/1000)}s... (attempt ${attempt + 1}/${maxRetries + 1})`);
          
          // Don't wait if delay is too long (more than 30 seconds)
          if (delay > maxDelay) {
            throw new Error('Rate limit delay too long. Please try again later.');
          }
          
          await this.sleep(delay);
          continue; // Retry the request
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        if (attempt === maxRetries) {
          console.error('API request failed after retries:', error);
          throw error;
        }
       
        // Only retry on network errors or rate limiting
        if (error.name === 'TypeError' || error.message.includes('Rate limit')) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
          console.warn(`Request failed. Retrying in ${Math.round(delay/1000)}s... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await this.sleep(delay);
          continue;
        }
       
        // Don't retry on other errors
        throw error;
      }
    }
  }

  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  static post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
}