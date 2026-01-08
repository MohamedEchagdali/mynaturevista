// middlewares/usageTrackingMiddleware.js - VERSIÓN COMPLETA Y CORREGIDA
const { pool } = require('../db/config');

async function trackWidgetUsage(req, res, next) {
    const startTime = Date.now();
    
    const trackingData = {
        apiKey: req.query.apikey,
        widgetType: extractWidgetType(req.path),
        
        countryName: req.query.country || null,
        placeName: req.query.place || req.query.name || null,
        customName: req.query.customName || req.query.name || null,
        
        isInternalNavigation: req.query.action === 'navigate' || req.query.internal === 'true',
        
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'] || req.headers['origin']
    };

    const originalSend = res.send;
    res.send = function(data) {
        const responseTime = Date.now() - startTime;
        
        logWidgetUsage({
            ...trackingData,
            responseTime,
            statusCode: res.statusCode
        }).catch(err => {
            console.error('❌ Error tracking widget usage:', err);
        });

        originalSend.apply(res, arguments);
    };

    next();
}

function extractWidgetType(path) {
    if (!path) return 'unknown';

    let widgetType = path
        .replace(/^\//, '')
        .replace(/\.html$/, '')
        .trim();

    if (!widgetType || widgetType === '') {
        widgetType = 'widget';
    }
    return widgetType;
}

/**
 * Determines if this is REAL internal navigation within the widget
 * or an external opening (even if URL has internal=true)
 *
 * Logic:
 * - If no referer → External opening
 * - If referer is from a widget page → Internal navigation
 * - If referer is from external site → External opening (counts as new opening)
 */
function isRealInternalNavigation(referer) {
    // No referer = external opening (direct link, bookmark, etc.)
    if (!referer) {
        return false;
    }

    try {
        const refererUrl = new URL(referer);
        const widgetPages = ['widget.html', 'widget-country.html', 'widget-eachPlace.html'];

        // Check if referer comes from a widget page
        const isFromWidgetPage = widgetPages.some(page =>
            refererUrl.pathname.includes(page)
        );

        // Only count as internal if coming from another widget page
        return isFromWidgetPage;

    } catch (error) {
        // Invalid referer URL = external opening
        return false;
    }
}

async function logWidgetUsage(data) {
    try {
        const apiKeyResult = await pool.query(
            'SELECT id, client_id, domain FROM api_keys WHERE api_key = $1',
            [data.apiKey]
        );

        if (apiKeyResult.rows.length === 0) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ API Key not found for tracking:', data.apiKey);
            }
            return;
        }

        const { id: apiKeyId, client_id: clientId, domain: rawDomain } = apiKeyResult.rows[0];

        const domain = rawDomain
            ? rawDomain
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .replace(/\/$/, '')
                .trim()
                .toLowerCase()
            : 'unknown';

        let eventType;
        let isCountableOpening = false;

        // 🔥 FIX: Use the new function to detect REAL internal navigation
        // This fixes the issue where direct links with internal=true weren't counted as openings
        const isInternal = isRealInternalNavigation(data.referer);

        if (isInternal) {
            // Real internal navigation within the widget
            if (data.countryName && !data.placeName) {
                eventType = 'navigate_country';
            } else if (data.placeName) {
                eventType = 'navigate_place';
            } else if (!data.countryName && !data.placeName) {
                eventType = 'navigate_index';
            } else {
                eventType = 'navigate';
            }
            isCountableOpening = false;
        } else {
            // External opening (counts towards usage limits)
            // This includes:
            // - Direct URL access
            // - Links from external websites
            // - Bookmarks
            // - Shared links (even if they have internal=true in URL)
            eventType = 'open';
            isCountableOpening = true;
        }

        if (process.env.NODE_ENV === 'development') {
            console.log(`📊 Tracking: ${eventType} (opening: ${isCountableOpening}) - Widget: ${data.widgetType} - Referer: ${data.referer ? 'present' : 'none'}`);
        }

        let countryName = data.countryName;
        let placeData = null;

        if (data.placeName && !countryName) {
            const placeResult = await pool.query(
                'SELECT name, data FROM natural_places WHERE name = $1',
                [data.placeName]
            );

            if (placeResult.rows.length > 0) {
                placeData = placeResult.rows[0].data;
                if (placeData && placeData.country) {
                    countryName = placeData.country;
                }
            }
        }

        await pool.query(
            `INSERT INTO widget_usage
            (client_id, api_key_id, widget_type, event_type, is_opening, ip_address,
             user_agent, referer, domain, country_name, place_name, place_data,
             custom_name, response_time, date, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_DATE, NOW())`,
            [
                clientId,
                apiKeyId,
                data.widgetType,
                eventType,
                isCountableOpening,
                data.ipAddress,
                data.userAgent,
                data.referer,
                domain,
                countryName,
                data.placeName,
                placeData ? JSON.stringify(placeData) : null,
                data.customName,
                data.responseTime
            ]
        );

    } catch (error) {
        console.error('❌ Error in logWidgetUsage:', error);
        throw error;
    }
}

/**
 * Middleware to track API usage
 */
async function trackApiUsage(req, res, next) {
    const shouldTrack = req.path.startsWith('/api/places');

    if (!shouldTrack) {
        return next();
    }

    const startTime = Date.now();

    const trackingData = {
        endpoint: req.path,
        method: req.method,
        queryParams: req.query,
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent']
    };

    const originalJson = res.json.bind(res);
    res.json = function(data) {
        const responseTime = Date.now() - startTime;

        const apiKey = req.headers['x-api-key'] || req.query.apikey;

        if (apiKey) {
            logApiUsage({
                ...trackingData,
                apiKey,
                responseTime,
                statusCode: res.statusCode
            }).catch(err => {
                console.error('❌ Error tracking API usage:', err);
            });
        }
        return originalJson(data);
    };

    next();
}

/**
 * Helper function to log API usage
 */
async function logApiUsage(data) {
    try {
        const apiKeyResult = await pool.query(
            'SELECT id, client_id FROM api_keys WHERE api_key = $1',
            [data.apiKey]
        );

        if (apiKeyResult.rows.length === 0) {
            return;
        }

        const { id: apiKeyId, client_id: clientId } = apiKeyResult.rows[0];

        await pool.query(
            `INSERT INTO api_usage
            (client_id, api_key_id, endpoint, method, status_code,
             response_time, ip_address, user_agent, query_params, date, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE, NOW())`,
            [
                clientId,
                apiKeyId,
                data.endpoint,
                data.method,
                data.statusCode,
                data.responseTime,
                data.ipAddress,
                data.userAgent,
                JSON.stringify(data.queryParams)
            ]
        );
    } catch (error) {
        console.error('❌ Error in logApiUsage:', error);
        throw error;
    }
}

module.exports = {
    trackWidgetUsage,
    trackApiUsage
};