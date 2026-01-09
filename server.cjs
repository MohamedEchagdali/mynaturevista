// server.js - Unified refactored server 
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// IMPORT CONFIGURATIONS
// ========================================
const corsOptions = require('./config/cors');
const { pool } = require('./db/config');

// ========================================
// IMPORT MIDDLEWARES
// ========================================
const { corsErrorHandler, generalErrorHandler, notFoundHandler } = require('./middlewares/errorHandler');

// ========================================
// CRON JOBS
// ========================================
cron.schedule('0 9 * * *', async () => {
  require('./scripts/renewalReminder');
});

// ========================================
// STRIPE WEBHOOK - MUST BE FIRST (RAW BODY)
// ========================================
app.post('/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  require('./routes/stripeWebhook')
);

// HELMET - SECURITY HEADERS
// ========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      
      // Scripts: allows self, inline, and necessary CDNs
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://js.stripe.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
        "https://www.google.com",
        "https://www.gstatic.com",
        "https://translate.google.com",
        "https://translate.googleapis.com",
        "https://translate-pa.googleapis.com",
        "https://cdnjs.cloudflare.com",
        "https://use.fontawesome.com"
      ],
      
      // Script attributes: allows inline event handlers
      scriptSrcAttr: ["'unsafe-hashes'", "'unsafe-inline'"],
      
      // Styles: allows self, inline, and style CDNs
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
        "https://use.fontawesome.com",
        "https://unpkg.com",
        "https://translate.googleapis.com",
        "https://www.gstatic.com"
      ],
      
      // Images: allows self, data URIs, and cloud services
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "http:",
        "https://res.cloudinary.com",
        "https://*.stripe.com",
        "https://translate.google.com",
        "https://www.gstatic.com"
      ],
      
      // Media: allows videos and audio from Cloudinary
      mediaSrc: [
        "'self'",
        "https://res.cloudinary.com",
        "blob:",
        "data:"
      ],
      
      // Fonts: allows Google Fonts and other CDNs
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
        "https://use.fontawesome.com",
        "data:"
      ],
      
      // Connections: allows necessary API calls
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://res.cloudinary.com",
        "https://www.google.com",
        "https://translate.googleapis.com",
        "https://translate-pa.googleapis.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com"
      ],
      
      // Frames: allows iframes from specific services + data URIs
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://hooks.stripe.com",
        "https://www.google.com",
        "https://translate.google.com",
        "data:",
        "blob:"
      ],
      
      frameAncestors: ["*"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ========================================
// GLOBAL MIDDLEWARES
// ========================================
app.use(cors(corsOptions));
app.use(corsErrorHandler);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Export pool for use in middlewares
module.exports.pool = pool;

// ========================================
// WIDGET ROUTES
// ========================================
const widgetsRouter = require('./routes/widgetRoute');
app.use('/', widgetsRouter);

// ========================================
// API ROUTES
// ========================================
const contactRoutes = require('./routes/contactRoutes');
const authRoutes = require("./routes/authRoutes");
const gdprRoutes = require("./routes/gdprRoutes");
const apiKeysRoutes = require("./routes/apikeysRoutes");
const domainsRoutes = require('./routes/domains');
const statsRoutes = require("./routes/statsRoutes");
const accountDeletionRoutes = require('./routes/accountDeletionRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const customPlacesRoutes = require('./routes/customPlacesRoutes');
const countriesRoutes = require('./routes/countries');
const placesRoutes = require('./routes/places');
const authController = require('./controllers/authController');
const billingRoutes = require('./routes/billingRoutes');


// Authentication and management routes
app.use('/api', contactRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', accountDeletionRoutes);
app.use("/api", authRoutes);
app.use("/api/gdpr", gdprRoutes);
app.use("/api/keys", apiKeysRoutes);
app.use('/api/domains', domainsRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/custom-places', customPlacesRoutes);

// Data routes
app.use('/api/countries', countriesRoutes);
app.use('/api/places', placesRoutes);

// Password recovery routes
app.post('/api/forgot-password', authController.forgotPassword);
app.post('/api/reset-password', authController.resetPassword);

app.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// ========================================
// STATIC FILES WITH INTELLIGENT CACHING
// ========================================

// 1. Widget directory with moderate caching
app.use('/widget', express.static(path.join(__dirname, 'public/widget'), {
    maxAge: '1h',
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.js')) {
            res.set('Cache-Control', 'public, max-age=3600');
            res.set('X-Content-Type', 'application/javascript');
        } else if (filepath.endsWith('.css')) {
            res.set('Cache-Control', 'public, max-age=3600');
        } else if (filepath.endsWith('.html')) {
            res.set('Cache-Control', 'no-cache');
        }
    }
}));

// 2. Dashboard without cache (dynamic pages)
app.use('/dashboard', express.static(path.join(__dirname, 'public/dashboard'), {
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
            res.set('Cache-Control', 'no-store');
        } else if (filepath.endsWith('.js') || filepath.endsWith('.css')) {
            res.set('Cache-Control', 'public, max-age=600');
        }
    }
}));

// 3. Landing page with moderate caching
app.use('/landing', express.static(path.join(__dirname, 'public/landing'), {
    maxAge: '10m',
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.html')) {
            res.set('Cache-Control', 'public, max-age=600');
        }
    }
}));

// 4. Other static files (images, fonts, etc.)
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    setHeaders: (res, filepath) => {
        // Images and fonts: long cache
        if (filepath.match(/\.(jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot)$/)) {
            res.set('Cache-Control', 'public, max-age=86400');
        }
        // HTML: no cache by default
        else if (filepath.endsWith('.html')) {
            res.set('Cache-Control', 'no-cache');
        }
    }
}));

// Main page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "landing", "landingPage.html"));
});

app.get('/loginSignup', (req, res) => {
  res.json({ message: 'Login/Signup route working' });
});

// ========================================
// GET GENERAL STATISTICS
// ========================================
app.get('/api/stats', async (req, res) => {
    try {
        const totalResult = await pool.query('SELECT COUNT(*) as total FROM natural_places');
        const apiKeysResult = await pool.query('SELECT COUNT(*) as total FROM api_keys WHERE is_active = true');
        
        res.json({
            totalPlaces: parseInt(totalResult.rows[0].total),
            activeApiKeys: parseInt(apiKeysResult.rows[0].total),
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// ADMINISTRATIVE ENDPOINTS
// ========================================
app.post('/api/admin/apikeys', async (req, res) => {
    const { api_key, description, allowed_origins } = req.body;

    if (!api_key || !allowed_origins) {
        return res.status(400).json({ error: 'Missing required fields: api_key and allowed_origins' });
    }

    try {
        await pool.query(
            `INSERT INTO api_keys (api_key, description, allowed_origins)
             VALUES ($1, $2, $3)`,
            [api_key, description || '', allowed_origins]
        );

        res.status(201).json({
            message: 'API key created successfully',
            api_key: api_key
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ error: 'API key already exists' });
        }
        console.error('Error creating API key:', error);
        res.status(500).json({ error: 'Error creating API key' });
    }
});

// Debug endpoint to verify API keys
app.get('/api/debug/apikeys', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, client_id, api_key, is_active, domain, description, allowed_origins, created_at FROM api_keys ORDER BY created_at DESC'
        );

        res.json({
            total: result.rows.length,
            keys: result.rows
        });
    } catch (error) {
        console.error('Error fetching API keys:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========================================
// DEBUG: Cache verification endpoint
// ========================================
app.get('/api/debug/cache', (req, res) => {
    const { getCacheStats } = require('./middlewares/cacheMiddleware');
    const stats = getCacheStats();

    res.json({
        enabled: true,
        stats: stats,
        keys: require('./middlewares/cacheMiddleware').dataCache.keys()
    });
});
// ========================================
// ERROR HANDLING AND 404
// ========================================
app.use(notFoundHandler);
app.use(generalErrorHandler);

// ========================================
// START SERVER
// ========================================
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// ========================================
// GRACEFUL SHUTDOWN
// ========================================
process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await pool.end();
    process.exit(0);
});

module.exports = app;