// utils/sanitizer.js
// ============================================================
// SANITIZERS UNIFICADOS: sanitize-html (backend) + DOMPurify (landing page)
// ============================================================

const sanitizeHtml = require('sanitize-html');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// ============================================================
// Configuración para sanitize-html (uso backend / API)
// ============================================================

const strictConfig = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape'
};

const moderateConfig = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape'
};

const richConfig = {
  allowedTags: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre'
  ],
  allowedAttributes: {
    'a': ['href', 'title', 'target'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  disallowedTagsMode: 'recursiveEscape',
  transformTags: {
    'a': (tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: attribs.target || '_blank'
      }
    })
  }
};

// ============================================================
// Funciones de sanitización con sanitize-html (backend / API)
// ============================================================

function sanitizeStrict(input) {
  if (!input || typeof input !== 'string') return '';
  return sanitizeHtml(input, strictConfig).trim();
}

function sanitizeModerate(input) {
  if (!input || typeof input !== 'string') return '';
  return sanitizeHtml(input, moderateConfig).trim();
}

function sanitizeRich(input) {
  if (!input || typeof input !== 'string') return '';
  return sanitizeHtml(input, richConfig).trim();
}

function sanitizeObject(obj, level = 'strict') {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitizer = {
    strict: sanitizeStrict,
    moderate: sanitizeModerate,
    rich: sanitizeRich
  }[level] || sanitizeStrict;

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizer(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitized[key] = sanitizeObject(obj[key], level);
    } else {
      sanitized[key] = obj[key];
    }
  }

  return sanitized;
}

function escapeHtml(input) {
  if (!input || typeof input !== 'string') return '';
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;'
  };
  return input.replace(/[&<>"'\/]/g, char => htmlEntities[char]);
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const dangerousSchemes = /^(javascript|data|vbscript|file):/i;
  if (dangerousSchemes.test(trimmed)) return '';

  try {
    const urlObj = new URL(trimmed);
    if (!['http:', 'https:'].includes(urlObj.protocol)) return '';
    return urlObj.href;
  } catch {
    return '';
  }
}

function sanitizeMiddleware(level = 'strict') {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body, level);
    }
    next();
  };
}

// ============================================================
// DOMPurify (uso landing page / front-end server-side render)
// ============================================================

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Escapa HTML especial con DOMPurify (landing)
 */
function domEscapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.toString().replace(/[&<>"']/g, m => map[m]);
}

/**
 * Sanitiza HTML con formato básico (landing)
 */
function domSanitizeModerate(text) {
  if (!text) return '';
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p'],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false
  });
}

/**
 * Sanitiza texto plano (landing)
 */
function domSanitizeStrict(text) {
  if (!text) return '';
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  });
}

/**
 * Validación de email (landing)
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitiza URL (landing)
 */
function domSanitizeUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return '';
    return urlObj.toString();
  } catch {
    return '';
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // sanitize-html (backend / API)
  sanitizeStrict,
  sanitizeModerate,
  sanitizeRich,
  sanitizeObject,
  escapeHtml,
  sanitizeUrl,
  sanitizeMiddleware,

  // DOMPurify (landing / SSR)
  domEscapeHtml,
  domSanitizeStrict,
  domSanitizeModerate,
  domSanitizeUrl,
  isValidEmail
};
