// public/js/sanitizer.js - Frontend sanitization with DOMPurify
// Import DOMPurify from CDN in HTML: <script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"></script>

/**
 * Sanitizes HTML before using innerHTML
 * @param {string} dirty - Unsanitized HTML
 * @param {object} config - DOMPurify configuration (optional)
 * @returns {string} Sanitized HTML
 */
function sanitizeHTML(dirty, config = {}) {
  if (!dirty || typeof dirty !== 'string') return '';

  // Verify that DOMPurify is available
  if (typeof DOMPurify === 'undefined') {
    console.error('DOMPurify is not loaded. Add the DOMPurify script to your HTML.');
    // Fallback: basic escape
    return escapeHTML(dirty);
  }

  const defaultConfig = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a', 'span', 'div'],
    ALLOWED_ATTR: ['href', 'title', 'class', 'id'],
    ALLOW_DATA_ATTR: false,
    ...config
  };

  return DOMPurify.sanitize(dirty, defaultConfig);
}

/**
 * Strictly sanitizes HTML (text only, no tags)
 * @param {string} dirty - Unsanitized HTML
 * @returns {string} Text without HTML
 */
function sanitizeText(dirty) {
  if (!dirty || typeof dirty !== 'string') return '';

  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [],
      KEEP_CONTENT: true
    });
  }

  return escapeHTML(dirty);
}

/**
 * Sanitizes and sets element content safely
 * @param {HTMLElement} element - DOM element
 * @param {string} content - HTML content to insert
 * @param {object} config - DOMPurify configuration (optional)
 */
function safeSetInnerHTML(element, content, config = {}) {
  if (!element || !(element instanceof HTMLElement)) {
    console.error('safeSetInnerHTML: first argument must be an HTML element');
    return;
  }

  element.innerHTML = sanitizeHTML(content, config);
}

/**
 * Creates an element safely with sanitized content
 * @param {string} tagName - HTML tag name
 * @param {string} content - HTML content
 * @param {object} attributes - Element attributes
 * @returns {HTMLElement} Created element
 */
function createSafeElement(tagName, content = '', attributes = {}) {
  const element = document.createElement(tagName);

  // Set attributes safely
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'style') {
      // Sanitize styles
      const sanitizedStyle = sanitizeCSS(value);
      element.setAttribute('style', sanitizedStyle);
    } else if (key.startsWith('on')) {
      // DO NOT allow event handlers as attributes
      console.warn(`Event attribute "${key}" not allowed for security reasons`);
    } else {
      element.setAttribute(key, value);
    }
  }

  // Set sanitized content
  if (content) {
    element.innerHTML = sanitizeHTML(content);
  }

  return element;
}

/**
 * Sanitizes CSS properties to prevent injections
 * @param {string} css - CSS string
 * @returns {string} Sanitized CSS
 */
function sanitizeCSS(css) {
  if (!css || typeof css !== 'string') return '';

  // Remove javascript: and dangerous expressions
  const dangerous = /javascript:|expression\(|behavior:|import|@import/gi;
  return css.replace(dangerous, '');
}

/**
 * Basic HTML escape (fallback if DOMPurify is not available)
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHTML(text) {
  if (!text || typeof text !== 'string') return '';

  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitizes URLs to prevent javascript: and data: schemes
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL or empty string if dangerous
 */
function sanitizeURL(url) {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.trim();

  // Block dangerous schemes
  const dangerousSchemes = /^(javascript|data|vbscript|file):/i;
  if (dangerousSchemes.test(trimmed)) {
    console.warn('Dangerous URL blocked:', trimmed);
    return '';
  }

  try {
    const urlObj = new URL(trimmed, window.location.origin);
    if (!['http:', 'https:', 'mailto:'].includes(urlObj.protocol)) {
      return '';
    }
    return urlObj.href;
  } catch {
    // If it's a valid relative URL, allow it
    if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
      return trimmed;
    }
    return '';
  }
}

/**
 * Sets an href attribute safely
 * @param {HTMLElement} element - Anchor element
 * @param {string} url - URL to set
 */
function safeSetHref(element, url) {
  const safeUrl = sanitizeURL(url);
  if (safeUrl) {
    element.href = safeUrl;
    // Add rel="noopener noreferrer" for external links
    if (safeUrl.startsWith('http') && !safeUrl.startsWith(window.location.origin)) {
      element.rel = 'noopener noreferrer';
      element.target = '_blank';
    }
  }
}

/**
 * Sanitizes data before sending to API
 * @param {object} data - Object with form data
 * @returns {object} Sanitized data
 */
function sanitizeFormData(data) {
  if (!data || typeof data !== 'object') return {};

  const sanitized = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Sanitize strings (remove HTML but keep text)
      sanitized[key] = sanitizeText(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeFormData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Export functions if used as module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    sanitizeHTML,
    sanitizeText,
    safeSetInnerHTML,
    createSafeElement,
    sanitizeCSS,
    escapeHTML,
    sanitizeURL,
    safeSetHref,
    sanitizeFormData
  };
}