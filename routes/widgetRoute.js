// routes/widgetRoute.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const NodeCache = require('node-cache'); // npm install node-cache
const { validateApiKey } = require('../services/apiKeyService');
const { trackWidgetUsage } = require('../middlewares/usageTrackingMiddleware');
const { checkOpeningsLimit } = require('../middlewares/subscriptionMiddleware');
const { validateDomainOrigin } = require('../middlewares/domainValidationMiddleware');

const router = express.Router();

// 🆕 TEMPLATE CACHE (5 minutes)
const templateCache = new NodeCache({ 
    stdTTL: 300, // 5 minutes
    checkperiod: 60 // Clean up every minute
});

// Validation middleware (NO CHANGES)
const widgetValidationMiddleware = async (req, res, next) => {
    const apiKey = req.query.apikey;
    const origin = req.get('Origin') || req.get('Referer') || req.get('Host');
    
    //console.log(`🔍 Validation middleware - Route: ${req.path}, API Key: ${apiKey}`);
    
    if (!apiKey) {
        console.log("✗ Missing API key");
        return res.status(403).send('✗ Missing API key');
    }
    
    const validation = await validateApiKey(apiKey, origin);
    
    if (!validation.valid) {
        console.log(`✗ Validation failed: ${validation.reason}`);
        return res.status(403).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Restricted Access</title>
                <style>
                    body { 
                      font-family: 'Poppins', sans-serif;
                      background: linear-gradient(135deg, #00b894 0%, #ff6b6b 100%);
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      min-height: 100vh;
                      margin: 0;
                    }
                    .error-container {
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        text-align: center;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        max-width: 400px;
                    }
                    .error-icon { font-size: 48px; margin-bottom: 20px; color: #ff6b6b; }
                    h1 { color: #333; margin-bottom: 15px; font-size: 24px; }
                    p { color: #666; font-size: 16px; line-height: 1.5; }
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-icon">❌</div>
                    <h1>Invalid API Key</h1>
                    <p>${validation.reason}</p>
                </div>
            </body>
            </html>
        `);
    }
    
    next();
};

// 🆕 FUNCTION WITH CACHE
// 🆕 FUNCTION WITH CACHE (UPDATED)
function renderCustomizedHtml(filePath, req, res) {
    const customName = req.query.name || 'ExplorNatura';
    const apiKey = req.query.apikey || '';
    
    // Generate unique cache key (without API key to share between users)
    const cacheKey = `template-${path.basename(filePath)}-${customName}`;
    
    // Try to get from cache
    const cachedHtml = templateCache.get(cacheKey);
    
    if (cachedHtml) {
        console.log(`✅ Template served from cache: ${cacheKey}`);
        
        // Only replace API key (unique per user)
        const finalHtml = cachedHtml.replace(/{{API_KEY}}/g, apiKey);
        
        // ✅ USE res.setHeader instead of res.set to NOT override CSP
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.setHeader('X-Template-Cache', 'HIT');
        
        return res.send(finalHtml);
    }
    
    // No cache, read file
    fs.readFile(filePath, 'utf8', (err, html) => {
        if (err) {
            console.error(`✗ Error reading ${path.basename(filePath)}:`, err);
            return res.status(500).send(`Internal error`);
        }
        
        // Prepare template (without API key yet)
        let templateHtml = html.replace(/{{CUSTOM_NAME}}/g, customName);
        
        // Save to cache (without API key)
        templateCache.set(cacheKey, templateHtml);
        
        // Now insert unique API key
        const finalHtml = templateHtml.replace(/{{API_KEY}}/g, apiKey);
        
        // ✅ USE res.setHeader instead of res.set to NOT override CSP
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'private, max-age=300');
        res.setHeader('X-Template-Cache', 'MISS');
        
        res.send(finalHtml);
    });
}

// Widget routes WITH validation (NO CHANGES in middlewares)
router.get('/widget.html', 
    widgetValidationMiddleware,
    trackWidgetUsage,
    checkOpeningsLimit,
    validateDomainOrigin,
    (req, res) => {
        const filePath = path.join(__dirname, '../public/widget/widget.html');
        renderCustomizedHtml(filePath, req, res);
    }
);

router.get('/widget-country.html',
    widgetValidationMiddleware,
    trackWidgetUsage,
    checkOpeningsLimit,
    validateDomainOrigin,
    (req, res) => {
        const filePath = path.join(__dirname, '../public/widget/widget-country.html');
        renderCustomizedHtml(filePath, req, res);
    }
);

router.get('/widget-eachPlace.html',
    widgetValidationMiddleware,
    trackWidgetUsage,
    checkOpeningsLimit,
    validateDomainOrigin,
    (req, res) => {
        const filePath = path.join(__dirname, '../public/widget/widget-eachPlace.html');
        renderCustomizedHtml(filePath, req, res);
    }
);

module.exports = router;