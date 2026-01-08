// config/cors.js
const { pool } = require('../db/config');

const corsOptions = {
  origin: async function (origin, callback) {
    // Development: allow without origin
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // Production: require origin
    if (!origin && process.env.NODE_ENV === 'production') {
      console.warn('⚠️ PROD: Blocked request without origin');
      return callback(new Error('Origin header required'), false);
    }

    try {
      const normalizedOrigin = origin.toLowerCase().trim();

      // Get allowed_origins from database
      const result = await pool.query(`
        SELECT allowed_origins 
        FROM api_keys 
        WHERE is_active = true 
          AND allowed_origins IS NOT NULL
      `);

      // Parse PostgreSQL arrays
      const allowedOrigins = [];
      
      result.rows.forEach(row => {
        let origins = [];
        
        if (Array.isArray(row.allowed_origins)) {
          origins = row.allowed_origins;
        } else if (typeof row.allowed_origins === 'string') {
          try {
            const jsonString = row.allowed_origins
              .replace(/^\{/, '[')
              .replace(/\}$/, ']');
            origins = JSON.parse(jsonString);
          } catch (e) {
            console.warn('⚠️ Error parsing origins:', e.message);
          }
        }
        
        origins.forEach(o => {
          const normalized = o.toLowerCase().trim();
          if (!allowedOrigins.includes(normalized)) {
            allowedOrigins.push(normalized);
          }
        });
      });

      // Static whitelist
      const staticWhitelist = [
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5500',
        process.env.LANDING_URL,
        process.env.FRONTEND_URL,
        process.env.API_URL,
        process.env.ADMIN_PANEL_URL
      ].filter(Boolean).map(url => url.toLowerCase());

      const allAllowedOrigins = [...allowedOrigins, ...staticWhitelist];

      // Verify origin
      const isAllowed = allAllowedOrigins.some(allowed => {
        if (normalizedOrigin === allowed) {
          return true;
        }

        // Subdomains
        try {
          const originUrl = new URL(normalizedOrigin);
          const allowedUrl = new URL(allowed);
          
          if (originUrl.hostname.endsWith(`.${allowedUrl.hostname}`)) {
            return true;
          }
        } catch (e) {}

        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn('🚫 CORS: Origin blocked');
        callback(null, false);
      }

    } catch (error) {
      console.error('❌ CORS error:', error);
      callback(error, false);
    }
  },
  
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};

module.exports = corsOptions;