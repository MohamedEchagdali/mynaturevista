// middlewares/domainValidationMiddleware.js
const pool = require('../db/config');

/**
 * Middleware to validate that requests come from registered domains
 * Verifies Origin/Referer against API key's allowed_origins
 */
const validateDomainOrigin = async (req, res, next) => {
  try {
    // Get API key from header or query
    const apiKey = req.headers['x-api-key'] || req.query.apikey;
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'API key required',
        code: 'MISSING_API_KEY'
      });
    }

    // Get Origin and Referer from request
    const origin = req.get('Origin') || req.get('Referer');
    
    if (!origin) {
      /*console.log('⚠️ Request without Origin/Referer:', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });*/
      
      // 🔥 FIX 1: Allow requests without origin in development
      if (process.env.NODE_ENV !== 'production') {
        return next();
      }
      
      // In production, reject requests without origin
      return res.status(403).json({ 
        error: 'Origin header required',
        code: 'MISSING_ORIGIN',
        message: 'Requests must include a valid Origin or Referer'
      });
    }

    // Get API key information and allowed domains
    const result = await pool.query(`
      SELECT 
        ak.id,
        ak.client_id,
        ak.domain,
        ak.allowed_origins,
        ak.is_active,
        c.email,
        c.is_subscribed
      FROM api_keys ak
      JOIN clients c ON ak.client_id = c.id
      WHERE ak.api_key = $1
    `, [apiKey]);

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }

    const keyData = result.rows[0];

    // Verify that API key is active
    if (!keyData.is_active) {
      return res.status(403).json({ 
        error: 'Inactive API key',
        code: 'INACTIVE_API_KEY'
      });
    }

    // Verify that client has active subscription
    if (!keyData.is_subscribed) {
      return res.status(403).json({ 
        error: 'Subscription required',
        code: 'SUBSCRIPTION_REQUIRED'
      });
    }

    // Parse received origin
    const requestOrigin = normalizeOrigin(origin);
    
    // 🔥 FIX 2: Properly parse allowed_origins (PostgreSQL returns string)
    let allowedOrigins = [];
    
    if (keyData.allowed_origins) {
      if (Array.isArray(keyData.allowed_origins)) {
        allowedOrigins = keyData.allowed_origins;
      } else if (typeof keyData.allowed_origins === 'string') {
        try {
          // Convert PostgreSQL format {"a","b"} to JSON ["a","b"]
          const jsonString = keyData.allowed_origins
            .replace(/^\{/, '[')
            .replace(/\}$/, ']');
          allowedOrigins = JSON.parse(jsonString);
        } catch (parseError) {
          console.error('⚠️ Error parsing allowed_origins:', parseError);
          allowedOrigins = [];
        }
      }
    }

    // 🔥 FIX 3: Allow localhost in development
    if (process.env.NODE_ENV !== 'production') {
      const isLocalhost = requestOrigin.includes('localhost') || 
                         requestOrigin.includes('127.0.0.1') ||
                         requestOrigin.includes('file://');
      
      if (isLocalhost) {
        
        // ✅ Add info to request for next middleware
        req.apiKeyData = keyData;
        req.validatedOrigin = requestOrigin;
        
        return next();
      }
    }

    // Verify if origin is allowed
    const isAllowed = isOriginAllowed(requestOrigin, allowedOrigins);

    if (!isAllowed) {
      console.warn('🚫 Origin not allowed:', {
        requestOrigin,
        allowedOrigins,
        apiKeyId: keyData.id,
        clientEmail: keyData.email
      });

      return res.status(403).json({ 
        error: 'Unauthorized domain',
        code: 'UNAUTHORIZED_DOMAIN',
        message: `The domain ${requestOrigin} is not authorized to use this API key`,
        allowedDomains: allowedOrigins.map(o => extractDomain(o))
      });
    }

    // ✅ Valid origin - add info to request
    req.apiKeyData = keyData;
    req.validatedOrigin = requestOrigin;

    next();

  } catch (error) {
    console.error('❌ Error validating origin:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Normalize origin for comparison
 */
function normalizeOrigin(origin) {
  if (!origin) return null;
  
  try {
    // Clean referer (may come with full path)
    let cleanOrigin = origin.split('?')[0]; // Remove query params
    
    // If it's a referer with path, extract only the origin
    if (cleanOrigin.includes('://')) {
      const url = new URL(cleanOrigin);
      cleanOrigin = `${url.protocol}//${url.host}`;
    }
    
    return cleanOrigin.toLowerCase().trim();
  } catch (error) {
    console.error('Error normalizing origin:', error);
    return origin.toLowerCase().trim();
  }
}

/**
 * Extract clean domain from URL
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return url;
  }
}

/**
 * Verify if an origin is allowed
 * Supports wildcards for subdomains: *.example.com
 */
function isOriginAllowed(requestOrigin, allowedOrigins) {
  if (!requestOrigin || !allowedOrigins || allowedOrigins.length === 0) {
    return false;
  }

  for (const allowedOrigin of allowedOrigins) {
    const normalizedAllowed = normalizeOrigin(allowedOrigin);
    
    // Exact match
    if (requestOrigin === normalizedAllowed) {
      return true;
    }

    // Support for subdomain wildcards
    // Example: https://*.example.com allows https://blog.example.com
    if (normalizedAllowed.includes('*')) {
      const pattern = normalizedAllowed
        .replace(/\./g, '\\.')
        .replace(/\*/g, '[a-zA-Z0-9-]+');
      
      const regex = new RegExp(`^${pattern}$`, 'i');
      
      if (regex.test(requestOrigin)) {
        return true;
      }
    }

    // Automatic subdomain support
    // If allowed is example.com, allow *.example.com
    try {
      const requestUrl = new URL(requestOrigin);
      const allowedUrl = new URL(normalizedAllowed);
      
      if (requestUrl.hostname.endsWith(`.${allowedUrl.hostname}`)) {
        return true;
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }

  return false;
}

/**
 * More permissive middleware for development/testing
 */
const validateDomainOriginDev = async (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  
  return validateDomainOrigin(req, res, next);
};

module.exports = {
  validateDomainOrigin,
  validateDomainOriginDev,
  normalizeOrigin,
  isOriginAllowed
};