//aubscriptionMiddleware.js
const { pool } = require('../db/config');

const subscriptionMiddleware = async (req, res, next) => {
    try {
        const userId = req.user.id;       
        // Consultar suscripción con límites
        const result = await pool.query(`
            SELECT 
                c.id, 
                c.email, 
                c.is_subscribed,
                s.plan_type,
                s.status,
                s.is_active,
                s.domains_allowed,
                s.openings_limit,
                s.custom_places_limit,
                s.current_period_end,
                s.current_openings_used,
                s.extra_domains_purchased
            FROM clients c
            LEFT JOIN subscriptions s ON c.id = s.client_id
            WHERE c.id = $1
        `, [userId]);
       
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                subscription_required: true
            });
        }
       
        const user = result.rows[0];
       
        // Verify if user has active subscription
        if (!user.is_subscribed || !user.is_active || user.status !== 'active') {

            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(403).json({
                    error: 'Subscription required',
                    message: 'You need an active subscription to access this feature',
                    subscription_required: true,
                    redirect_url: '/dashboard/payment.html'
                });
            }

            return res.redirect('/dashboard/payment.html?reason=subscription_required');
        }

        // Check if subscription has expired
        if (user.current_period_end && new Date(user.current_period_end) < new Date()) {

            await pool.query(
                'UPDATE subscriptions SET is_active = false, status = $1 WHERE client_id = $2',
                ['expired', userId]
            );

            if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
                return res.status(403).json({
                    error: 'Subscription expired',
                    message: 'Your subscription has expired. Please renew your plan.',
                    subscription_expired: true,
                    redirect_url: '/dashboard/payment.html'
                });
            }

            return res.redirect('/dashboard/payment.html?reason=subscription_expired');
        }

        req.user.is_subscribed = user.is_subscribed;
        req.user.subscription_verified = true;
        req.user.plan_type = user.plan_type || 'starter';
        req.user.subscription_limits = {
            domains_allowed: user.domains_allowed || 1,
            openings_limit: user.openings_limit || 3000,
            custom_places_limit: user.custom_places_limit || 0,
            current_openings_used: user.current_openings_used || 0,
            extra_domains_purchased: user.extra_domains_purchased || 0
        };

        next();

    } catch (error) {
        console.error('❌ Error in subscriptionMiddleware:', error);

        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(500).json({
                error: 'Internal server error',
                subscription_required: true
            });
        }

        return res.redirect('/dashboard/payment.html?reason=error');
    }
};

/**
 * Middleware to verify domain limits
 */
const checkDomainLimit = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const domainCount = await pool.query(
            'SELECT COUNT(DISTINCT domain) as count FROM api_keys WHERE client_id = $1',
            [userId]
        );

        const currentDomains = parseInt(domainCount.rows[0].count);
        const allowedDomains = req.user.subscription_limits?.domains_allowed || 1;

        if (currentDomains >= allowedDomains) {
            return res.status(403).json({
                error: 'Domain limit reached',
                message: `Your ${req.user.plan_type} plan allows ${allowedDomains} domain(s). You currently have ${currentDomains}.`,
                current: currentDomains,
                limit: allowedDomains,
                upgrade_required: true
            });
        }

        next();

    } catch (error) {
        console.error('Error checking domain limit:', error);
        res.status(500).json({ error: 'Error verifying domain limit' });
    }
};

/**
 * Middleware to verify custom places limits
 */
const checkCustomPlacesLimit = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const customPlacesLimit = req.user.subscription_limits?.custom_places_limit || 0;

        if (customPlacesLimit === -1) {
            return next();
        }

        if (customPlacesLimit === 0) {
            return res.status(403).json({
                error: 'Feature not available',
                message: 'Custom places are not available in your current plan. Upgrade to Business or Enterprise.',
                upgrade_required: true,
                plan_type: req.user.plan_type
            });
        }

        const placesCount = await pool.query(
            'SELECT COUNT(*) as count FROM client_custom_places WHERE client_id = $1',
            [userId]
        );

        const currentPlaces = parseInt(placesCount.rows[0].count);

        if (req.method === 'PUT') {
            return next();
        }

        if (currentPlaces >= customPlacesLimit) {
            return res.status(403).json({
                error: 'Custom places limit reached',
                message: `Your ${req.user.plan_type} plan allows ${customPlacesLimit} custom places. You currently have ${currentPlaces}.`,
                current: currentPlaces,
                limit: customPlacesLimit,
                upgrade_required: true
            });
        }

        next();

    } catch (error) {
        console.error('Error checking custom places limit:', error);
        res.status(500).json({ error: 'Error verifying custom places limit' });
    }
};

/**
 * Middleware to track and verify widget openings limit
 */
const checkOpeningsLimit = async (req, res, next) => {
    try {
        const apiKey = req.query.apikey || req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({ error: 'API key required' });
        }

        const result = await pool.query(`
            SELECT
                c.id as client_id,
                s.openings_limit,
                s.current_openings_used,
                s.current_period_end,
                s.plan_type
            FROM api_keys ak
            JOIN clients c ON ak.client_id = c.id
            JOIN subscriptions s ON c.id = s.client_id
            WHERE ak.api_key = $1 AND ak.is_active = true AND s.is_active = true
        `, [apiKey]);

        if (result.rows.length === 0) {
            return res.status(403).json({ error: 'Invalid API key or inactive subscription' });
        }

        const subscription = result.rows[0];
        const openingsLimit = subscription.openings_limit || 3000;
        const currentOpenings = subscription.current_openings_used || 0;

        if (currentOpenings >= openingsLimit) {
            return res.status(429).json({
                error: 'Monthly openings limit reached',
                message: `You have reached your monthly limit of ${openingsLimit.toLocaleString()} widget openings.`,
                current: currentOpenings,
                limit: openingsLimit,
                plan_type: subscription.plan_type,
                upgrade_required: true
            });
        }

        await pool.query(`
            UPDATE subscriptions
            SET current_openings_used = current_openings_used + 1
            WHERE client_id = $1
        `, [subscription.client_id]);


        next();

    } catch (error) {
        console.error('Error checking openings limit:', error);
        res.status(500).json({ error: 'Error verifying openings limit' });
    }
};

module.exports = {
    subscriptionMiddleware,
    checkDomainLimit,
    checkCustomPlacesLimit,
    checkOpeningsLimit
};