// routes/statsRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/config');
const authMiddleware = require('../middlewares/authMiddleware');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Cache and rate limiting configuration
const CACHE_DIR = path.join(__dirname, '..', 'cache', 'exports');

const exportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { 
        error: 'Too many export requests. Please wait before trying again.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`Rate limit exceeded for export - User: ${req.user?.id}, IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many export requests',
            message: 'You have exceeded the export limit. Please wait 15 minutes before trying again.',
            retryAfter: '15 minutes'
        });
    }
});

async function initCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
        console.log('Export cache directory ready');
    } catch (error) {
        console.error('Error creating export cache directory:', error);
    }
}

initCacheDir();

async function cleanOldCache() {
    try {
        const files = await fs.readdir(CACHE_DIR);
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        for (const file of files) {
            const filePath = path.join(CACHE_DIR, file);
            const stats = await fs.stat(filePath);
            
            if (now - stats.mtimeMs > oneHour) {
                await fs.unlink(filePath);
                console.log(`Deleted old export: ${file}`);
            }
        }
    } catch (error) {
        console.error('Error cleaning cache:', error);
    }
}

setInterval(cleanOldCache, 60 * 60 * 1000);

async function logExportDownload(clientId, type, domain, period, cached) {
    try {
        await pool.query(`
            INSERT INTO export_downloads 
            (client_id, export_type, domain, period, cached, downloaded_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
        `, [clientId, type, domain || 'global', period, cached]);
    } catch (error) {
        console.error('Error logging export download:', error);
    }
}

router.use(authMiddleware);

/**
 * GET /api/stats/dashboard
 * Distinguishes between openings (is_opening=true) and internal navigation
 */
router.get('/dashboard', async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            console.error('No req.user or req.user.id');
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const clientId = req.user.id;
        const period = parseInt(req.query.period) || 30;
        const domain = req.query.domain; // 🔥 GET SELECTED DOMAIN

        if (!domain) {
            return res.status(400).json({ error: 'Domain parameter required' });
        }

        // 1. Subscription data (global)
        const subscription = await pool.query(`
            SELECT 
                plan_type,
                openings_limit,
                current_openings_used,
                domains_allowed,
                custom_places_limit,
                current_period_end,
                next_billing_date,
                status
            FROM subscriptions
            WHERE client_id = $1 AND status = 'active'
            LIMIT 1
        `, [clientId]);

        // 2. Active domains (global count)
        const domains = await pool.query(`
            SELECT COUNT(DISTINCT domain) as active_domains
            FROM (
                SELECT domain FROM api_keys WHERE client_id = $1 AND is_active = true
                UNION
                SELECT domain FROM extra_domains WHERE client_id = $1 AND status = 'active'
            ) AS all_domains
        `, [clientId]);

        // 3. Custom places 🔥 FILTERED BY DOMAIN
        const places = await pool.query(`
            SELECT COUNT(*) as custom_places
            FROM client_custom_places
            WHERE client_id = $1 AND domain = $2
        `, [clientId, domain]);

        // 4. Month openings 🔥 FILTERED BY DOMAIN
        const openings = await pool.query(`
            SELECT COUNT(*) as current_month_openings
            FROM widget_usage
            WHERE client_id = $1
            AND domain = $2
            AND is_opening = true
            AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
        `, [clientId, domain]);

        // 5. Internal navigation 🔥 FILTERED BY DOMAIN
        const internalNavigation = await pool.query(`
            SELECT COUNT(*) as internal_clicks
            FROM widget_usage
            WHERE client_id = $1
            AND domain = $2
            AND is_opening = false
            AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
        `, [clientId, domain]);

        // 6. Recent usage statistics 🔥 FILTERED BY DOMAIN
        const recentStats = await pool.query(`
            SELECT 
                COUNT(*) as total_views,
                COUNT(DISTINCT country_name) as countries_viewed,
                AVG(response_time)::int as avg_response_time
            FROM widget_usage
            WHERE client_id = $1
            AND domain = $2
            AND created_at >= NOW() - INTERVAL '${period} days'
        `, [clientId, domain]);

        // Calculate days until renewal
        let daysUntilRenewal = null;
        let renewalDate = null;
        
        if (subscription.rows.length > 0 && subscription.rows[0].next_billing_date) {
            renewalDate = new Date(subscription.rows[0].next_billing_date);
            const today = new Date();
            daysUntilRenewal = Math.ceil((renewalDate - today) / (1000 * 60 * 60 * 24));
        }

        const response = {
            subscription: subscription.rows[0] || {
                plan_type: 'free',
                openings_limit: 3000,
                current_openings_used: 0,
                domains_allowed: 1,
                custom_places_limit: 0,
                status: 'inactive'
            },
            selectedDomain: domain, // 🔥 RETURN SELECTED DOMAIN
            metrics: {
                openings: {
                    current: parseInt(openings.rows[0].current_month_openings) || 0,
                    limit: subscription.rows[0]?.openings_limit || 3000,
                    percentage: subscription.rows[0]?.openings_limit 
                        ? ((parseInt(openings.rows[0].current_month_openings) || 0) / subscription.rows[0].openings_limit * 100).toFixed(1)
                        : 0
                },
                internalNavigation: {
                    current: parseInt(internalNavigation.rows[0].internal_clicks) || 0,
                    label: 'Internal clicks this month'
                },
                domains: {
                    active: parseInt(domains.rows[0].active_domains) || 0,
                    allowed: subscription.rows[0]?.domains_allowed || 1
                },
                customPlaces: {
                    current: parseInt(places.rows[0].custom_places) || 0,
                    limit: subscription.rows[0]?.custom_places_limit || 0
                },
                renewal: {
                    daysUntil: daysUntilRenewal,
                    date: renewalDate
                }
            },
            recentActivity: {
                ...recentStats.rows[0],
                domains_used: 1 // Only current domain
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Error in /api/stats/dashboard:', error);
        res.status(500).json({ error: 'Error getting dashboard statistics' });
    }
});

/**
 * GET /api/stats/domains
 * List of domains with statistics
 */
router.get('/domains', async (req, res) => {
    try {
        const clientId = req.user.id;
        const period = parseInt(req.query.period) || 30;

        const domainsStats = await pool.query(`
            SELECT 
                wu.domain,
                COUNT(*) as total_views,
                COUNT(*) FILTER (WHERE wu.is_opening = true) as openings,
                COUNT(*) FILTER (WHERE wu.is_opening = false) as internal_navigation,
                COUNT(DISTINCT wu.country_name) as countries_accessed,
                COUNT(DISTINCT wu.place_name) as places_accessed,
                COUNT(DISTINCT wu.widget_type) as widget_types_used,
                AVG(wu.response_time)::int as avg_response_time,
                MAX(wu.created_at) as last_activity,
                COUNT(CASE WHEN wu.created_at >= CURRENT_DATE - 1 THEN 1 END) as views_today,
                COUNT(CASE WHEN wu.created_at >= CURRENT_DATE - 7 THEN 1 END) as views_week
            FROM widget_usage wu
            WHERE wu.client_id = $1
            AND wu.created_at >= NOW() - INTERVAL '${period} days'
            AND wu.domain IS NOT NULL
            GROUP BY wu.domain
            ORDER BY openings DESC
        `, [clientId]);

        const domainsWithInfo = await Promise.all(domainsStats.rows.map(async (domainStat) => {
            const isPrimary = await pool.query(`
                SELECT domain FROM api_keys 
                WHERE client_id = $1 AND domain = $2 AND is_active = true
                LIMIT 1
            `, [clientId, domainStat.domain]);

            const isExtra = await pool.query(`
                SELECT domain FROM extra_domains 
                WHERE client_id = $1 AND domain = $2 AND status = 'activo'
                LIMIT 1
            `, [clientId, domainStat.domain]);

            return {
                ...domainStat,
                type: isPrimary.rows.length > 0 ? 'primary' : (isExtra.rows.length > 0 ? 'extra' : 'unknown'),
                is_active: isPrimary.rows.length > 0 || isExtra.rows.length > 0
            };
        }));

        res.json({
            total: domainsWithInfo.length,
            domains: domainsWithInfo
        });

    } catch (error) {
        console.error('Error in /api/stats/domains:', error);
        res.status(500).json({ error: 'Error getting domain statistics' });
    }
});

/**
 * GET /api/stats/overview
 * Returns openings vs internal navigation correctly
 */
router.get('/overview', async (req, res) => {
    try {
        const clientId = req.user.id;
        const period = parseInt(req.query.period) || 30;
        const domain = req.query.domain;

        const whereClause = domain 
            ? `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days' AND domain = $2`
            : `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days'`;
        
        const params = domain ? [clientId, domain] : [clientId];

        // Updated query that correctly separates openings from navigation
        const widgetStats = await pool.query(`
            SELECT 
                COUNT(*) as total_views,
                COUNT(*) FILTER (WHERE is_opening = true) as total_openings,
                COUNT(*) FILTER (WHERE is_opening = false) as internal_navigation,
                COUNT(DISTINCT DATE(created_at)) as active_days,
                AVG(response_time)::int as avg_response_time,
                COUNT(DISTINCT widget_type) as widget_types,
                COUNT(DISTINCT domain) as domains_used
            FROM widget_usage
            WHERE ${whereClause}
        `, params);

        // Query for plan opening limit (needed for progress)
        const subscription = await pool.query(`
            SELECT openings_limit
            FROM subscriptions
            WHERE client_id = $1 AND status = 'active'
            LIMIT 1
        `, [clientId]);

        const apiStats = await pool.query(`
            SELECT 
                COUNT(*) as total_calls,
                COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
                AVG(response_time)::int as avg_response_time
            FROM api_usage
            WHERE client_id = $1
            AND created_at >= NOW() - INTERVAL '${period} days'
        `, [clientId]);

        const stats = widgetStats.rows[0];
        
        const response = {
            filter: {
                domain: domain || 'global',
                period: period
            },
            widgets: {
                totalViews: parseInt(stats.total_views) || 0,
                totalOpenings: parseInt(stats.total_openings) || 0,
                internalNavigation: parseInt(stats.internal_navigation) || 0,
                openingsLimit: subscription.rows[0]?.openings_limit || 3000,
                activeDays: parseInt(stats.active_days) || 0,
                avgResponseTime: parseInt(stats.avg_response_time) || 0,
                widgetTypes: parseInt(stats.widget_types) || 0,
                domainsUsed: parseInt(stats.domains_used) || 0
            },
            api: {
                totalCalls: parseInt(apiStats.rows[0].total_calls) || 0,
                errorCount: parseInt(apiStats.rows[0].error_count) || 0,
                avgResponseTime: parseInt(apiStats.rows[0].avg_response_time) || 0
            }
        };


        res.json(response);
    } catch (error) {
        console.error('Error in /api/stats/overview:', error);
        res.status(500).json({ error: 'Error getting statistics overview' });
    }
});

/**
 * GET /api/stats/timeline
 * Temporal evolution (keeps all views for charts)
 */
router.get('/timeline', async (req, res) => {
    try {
        const clientId = req.user.id;
        const period = parseInt(req.query.period) || 30;
        const domain = req.query.domain;

        const whereClause = domain 
            ? `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days' AND domain = $2`
            : `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days'`;
        
        const params = domain ? [clientId, domain] : [clientId];

        const widgetTimeline = await pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as views,
                COUNT(*) FILTER (WHERE is_opening = true) as openings,
                COUNT(*) FILTER (WHERE is_opening = false) as internal_clicks
            FROM widget_usage
            WHERE ${whereClause}
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, params);

        const apiTimeline = await pool.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as calls
            FROM api_usage
            WHERE client_id = $1
            AND created_at >= NOW() - INTERVAL '${period} days'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [clientId]);

        res.json({
            filter: {
                domain: domain || 'global',
                period: period
            },
            widgetUsage: widgetTimeline.rows,
            apiUsage: apiTimeline.rows
        });
    } catch (error) {
        console.error('Error in /api/stats/timeline:', error);
        res.status(500).json({ error: 'Error getting timeline' });
    }
});
router.get('/widgets-breakdown', async (req, res) => {
    try {
        const clientId = req.user.id;
        const period = parseInt(req.query.period) || 30;
        const domain = req.query.domain;

        const whereClause = domain 
            ? `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days' AND domain = $2`
            : `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days'`;
        
        const params = domain ? [clientId, domain] : [clientId];

        const breakdown = await pool.query(`
            SELECT 
                widget_type,
                COUNT(*) as total_views,
                COUNT(DISTINCT country_name) as countries_accessed,
                COUNT(DISTINCT place_name) as places_accessed,
                AVG(response_time)::int as avg_response_time
            FROM widget_usage
            WHERE ${whereClause}
            GROUP BY widget_type
            ORDER BY total_views DESC
        `, params);

        res.json({
            filter: {
                domain: domain || 'global',
                period: period
            },
            breakdown: breakdown.rows
        });
    } catch (error) {
        console.error('Error in /api/stats/widgets-breakdown:', error);
        res.status(500).json({ error: 'Error getting widgets breakdown' });
    }
});

router.get('/performance', async (req, res) => {
    try {
        const clientId = req.user.id;
        const period = parseInt(req.query.period) || 30;
        const domain = req.query.domain;

        const whereClause = domain 
            ? `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days' AND domain = $2`
            : `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days'`;
        
        const params = domain ? [clientId, domain] : [clientId];

        const hourlyPerformance = await pool.query(`
            SELECT 
                EXTRACT(HOUR FROM created_at)::int as hour,
                COUNT(*) as requests,
                AVG(response_time)::int as avg_response_time,
                MIN(response_time)::int as min_response_time,
                MAX(response_time)::int as max_response_time
            FROM widget_usage
            WHERE ${whereClause}
            AND response_time IS NOT NULL
            GROUP BY EXTRACT(HOUR FROM created_at)
            ORDER BY hour ASC
        `, params);

        res.json({
            filter: {
                domain: domain || 'global',
                period: period
            },
            hourlyPerformance: hourlyPerformance.rows
        });
    } catch (error) {
        console.error('Error in /api/stats/performance:', error);
        res.status(500).json({ error: 'Error getting performance data' });
    }
});

router.get('/countries', async (req, res) => {
    try {
        const clientId = req.user.id;
        const period = parseInt(req.query.period) || 30;
        const country = req.query.country;
        const domain = req.query.domain;

        let whereClause = `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days'`;
        const params = [clientId];
        let paramCount = 2;

        if (domain) {
            whereClause += ` AND domain = $${paramCount}`;
            params.push(domain);
            paramCount++;
        }

        if (country) {
            whereClause += ` AND country_name = $${paramCount}`;
            params.push(country);

            const countryDetails = await pool.query(`
                SELECT 
                    place_name,
                    COUNT(*) as views,
                    AVG(response_time)::int as avg_response_time,
                    MAX(created_at) as last_viewed
                FROM widget_usage
                WHERE ${whereClause}
                    AND place_name IS NOT NULL
                GROUP BY place_name
                ORDER BY views DESC
            `, params);

            res.json({
                country: country,
                domain: domain || 'global',
                places: countryDetails.rows,
                totalPlaces: countryDetails.rows.length
            });
        } else {
            whereClause += ' AND country_name IS NOT NULL';
            
            const countries = await pool.query(`
                SELECT 
                    country_name,
                    COUNT(*) as views,
                    COUNT(DISTINCT place_name) as unique_places,
                    AVG(response_time)::int as avg_response_time,
                    MAX(created_at) as last_viewed
                FROM widget_usage
                WHERE ${whereClause}
                GROUP BY country_name
                ORDER BY views DESC
            `, params);

            res.json({
                domain: domain || 'global',
                countries: countries.rows,
                totalCountries: countries.rows.length
            });
        }
    } catch (error) {
        console.error('Error in /api/stats/countries:', error);
        res.status(500).json({ error: 'Error getting country statistics' });
    }
});

router.get('/export', exportLimiter, async (req, res) => {
    try {
        const clientId = req.user.id;
        const type = req.query.type || 'widget';
        const period = parseInt(req.query.period) || 30;
        const domain = req.query.domain || 'global';

        const cacheKey = crypto
            .createHash('sha256')
            .update(`${clientId}-${type}-${domain}-${period}`)
            .digest('hex');
        
        const cachePath = path.join(CACHE_DIR, `${cacheKey}.csv`);

        try {
            const stats = await fs.stat(cachePath);
            const fileAge = Date.now() - stats.mtimeMs;
            
            if (fileAge < 5 * 60 * 1000) {
                const csvContent = await fs.readFile(cachePath, 'utf-8');
                
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="stats_${type}_${domain}_${Date.now()}.csv"`);
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('X-Daily-Limited', 'false');
                
                await logExportDownload(clientId, type, domain, period, true);
                
                return res.send(csvContent);
            }
        } catch (error) {
            // No cache
        }

        const dailyExports = await pool.query(`
            SELECT COUNT(*) as count
            FROM export_downloads
            WHERE client_id = $1
            AND downloaded_at >= CURRENT_DATE
            AND cached = false
        `, [clientId]);
        
        const DAILY_LIMIT = 50;
        const dailyCount = parseInt(dailyExports.rows[0].count);

        if (dailyCount >= DAILY_LIMIT) {
            console.warn(`Daily limit reached - User: ${clientId} (${dailyCount}/${DAILY_LIMIT})`);

            return res.status(429).json({
                error: 'Daily export limit reached',
                message: `You have reached ${DAILY_LIMIT} new exports today. Try again with the same filters to use cache, or wait until midnight.`,
                retryAfter: 'midnight',
                current: dailyCount,
                limit: DAILY_LIMIT,
                hint: 'Cached exports (same period/domain) are not limited'
            });
        }

        let query, filename;

        if (type === 'widget') {
            let whereClause = `client_id = $1 AND created_at >= NOW() - INTERVAL '${period} days'`;
            const params = [clientId];

            if (domain !== 'global') {
                whereClause += ' AND domain = $2';
                params.push(domain);
            }

            query = {
                text: `
                    SELECT 
                        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as timestamp,
                        widget_type,
                        event_type,
                        is_opening,
                        domain,
                        country_name,
                        place_name,
                        response_time,
                        ip_address,
                        referer
                    FROM widget_usage
                    WHERE ${whereClause}
                    ORDER BY created_at DESC
                    LIMIT 10000
                `,
                values: params
            };
            filename = `widget_stats_${domain}_${Date.now()}.csv`;
        } else {
            query = {
                text: `
                    SELECT 
                        TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as timestamp,
                        endpoint,
                        method,
                        status_code,
                        response_time,
                        ip_address
                    FROM api_usage
                    WHERE client_id = $1
                    AND created_at >= NOW() - INTERVAL '${period} days'
                    ORDER BY created_at DESC
                    LIMIT 10000
                `,
                values: [clientId]
            };
            filename = `api_stats_${Date.now()}.csv`;
        }

        const result = await pool.query(query.text, query.values);

        if (result.rows.length === 0) {
            return res.status(404).json({ 
                error: 'No data available',
                message: 'No statistics found for the selected period and filters.'
            });
        }

        const headers = Object.keys(result.rows[0]);
        const BOM = '\uFEFF';
        
        const csv = BOM + [
            headers.join(','),
            ...result.rows.map(row => 
                headers.map(header => {
                    const value = row[header];
                    if (value === null) return '';
                    const stringValue = String(value).replace(/"/g, '""');
                    return `"${stringValue}"`;
                }).join(',')
            )
        ].join('\n');

        try {
            await fs.writeFile(cachePath, csv, 'utf-8');
        } catch (cacheError) {
            console.warn('Could not cache export:', cacheError);
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Record-Count', result.rows.length);
        res.setHeader('X-Daily-Remaining', DAILY_LIMIT - dailyCount - 1);
        res.send(csv);

        await logExportDownload(clientId, type, domain, period, false);
    } catch (error) {
        console.error('Error in /api/stats/export:', error);
        res.status(500).json({
            error: 'Export failed',
            message: 'There was an error generating your export. Please try again.'
        });
    }
});

router.get('/usage', async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(`
            SELECT 
                s.current_openings_used,
                s.openings_limit,
                s.plan_type,
                s.next_billing_date
            FROM subscriptions s
            WHERE s.client_id = $1 AND s.is_active = true
        `, [userId]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                usage: {
                    current_openings: 0,
                    openings_limit: 0,
                    percentage: 0,
                    plan_type: 'none'
                }
            });
        }

        const data = result.rows[0];
        const percentage = data.openings_limit > 0 
            ? Math.round((data.current_openings_used / data.openings_limit) * 100)
            : 0;

        res.json({
            success: true,
            usage: {
                current_openings: data.current_openings_used,
                openings_limit: data.openings_limit,
                percentage: percentage,
                plan_type: data.plan_type,
                next_billing_date: data.next_billing_date
            }
        });

    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;