// middlewares/index.js
// Centralized authentication and authorization middleware

const jwt = require("jsonwebtoken");
const { pool } = require('../db/config');
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

/**
 * PASO 2: Middleware único y central
 *
 * requireAuth: Solo valida token JWT
 * requireSubscription: Consulta DB y valida suscripción activa
 */

/**
 * requireAuth - Validates JWT token only
 * Does NOT check subscription status
 * Use this for routes that need authentication but not subscription
 * Example: /api/profile, /api/subscription-status
 *
 * PASO 3: Validates token_version to enable server-side token invalidation
 */
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    if (req.accepts("html")) {
      return res.redirect("/dashboard/loginSignup.html");
    }
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const userId = decoded.userId || decoded.id;

    // PASO 3: Validate token_version from database
    // This allows server-side token invalidation (real logout)
    if (decoded.tokenVersion !== undefined) {
      const result = await pool.query(
        'SELECT token_version FROM clients WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        if (req.accepts("html")) {
          return res.redirect("/dashboard/loginSignup.html");
        }
        return res.status(401).json({ message: "User not found" });
      }

      const currentTokenVersion = result.rows[0].token_version;

      // If token versions don't match, the token has been invalidated
      if (decoded.tokenVersion !== currentTokenVersion) {
        if (req.accepts("html")) {
          return res.redirect("/dashboard/loginSignup.html?reason=token_invalidated");
        }
        return res.status(401).json({
          message: "Token has been invalidated. Please login again.",
          reason: "token_invalidated"
        });
      }
    }

    // Token is valid
    req.user = {
      id: userId,
      email: decoded.email,
      tokenVersion: decoded.tokenVersion
    };

    next();
  } catch (err) {
    if (req.accepts("html")) {
      return res.redirect("/dashboard/loginSignup.html");
    }
    return res.status(401).json({ message: "Invalid token" });
  }
};

/**
 * requireSubscription - Validates active subscription from DB
 * Must be used AFTER requireAuth
 * Queries database in real-time to check subscription status
 * Use this for routes that need active subscription
 * Example: /api/stats, /api/dashboard
 */
const requireSubscription = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Real-time DB query - NO trust in JWT
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

        // Verify active subscription from DB, not JWT
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

        // Check if subscription expired
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

        // Attach subscription info to request
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
        console.error('❌ Error in requireSubscription:', error);

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
 * checkDomainLimit - Validates domain limits
 * Use AFTER requireAuth + requireSubscription
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
 * checkCustomPlacesLimit - Validates custom places limits
 * Use AFTER requireAuth + requireSubscription
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
 * checkOpeningsLimit - Track and validate widget openings limit
 * Use for public API endpoints with API key authentication
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
    // Main middleware (PASO 2)
    requireAuth,
    requireSubscription,

    // Limit checkers
    checkDomainLimit,
    checkCustomPlacesLimit,
    checkOpeningsLimit,

    // Legacy exports for backwards compatibility
    authMiddleware: requireAuth,
    subscriptionMiddleware: requireSubscription
};
