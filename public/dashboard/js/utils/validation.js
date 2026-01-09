// ===== utils/validation.js =====
export class ValidationUtils {
  static isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  static isValidPhone(phone) {
    const phoneClean = phone.replace(/[^\d+]/g, '');
    return /^\+?[\d\s-()]+$/.test(phone) && phoneClean.length >= 9;
  }
}