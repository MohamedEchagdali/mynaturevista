// authRoutes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const { subscriptionMiddleware } = require('../middlewares/subscriptionMiddleware');
const { pool } = require('../db/config');

// ============================================================================
// NUEVO: Middleware centralizado (MEJORAS SEGURIDAD B2B)
// ============================================================================
// Opcionalmente, puedes usar los nuevos middlewares centralizados:
// const { requireAuth, requireSubscription } = require('../middlewares');
//
// requireAuth: Solo valida token JWT (sin consultar suscripción)
// requireSubscription: Valida token + suscripción activa desde DB
//
// Uso: router.get('/route', requireAuth, requireSubscription, controller)
// ============================================================================

router.post("/login", authController.login);
router.post("/signup", authController.signup);

// ========================================
// PROFILE ENDPOINTS WITH SUBSCRIPTION LIMITS
// ========================================

// Common function to get user profile with subscription limits
async function getUserProfile(req, res) {
    try {
        // Enhanced query with subscription information and limits
        const result = await pool.query(`
            SELECT 
                c.id,
                c.name,
                c.email,
                c.domain,
                c.phone,
                c.addresses,
                c.is_subscribed,
                c.created_at,
                c.updated_at,
                s.plan_type as plan,
                s.is_active as subscription_active,
                s.status as subscription_status,
                s.start_date as subscription_start,
                s.end_date as subscription_end,
                s.current_period_end,
                s.domains_allowed,
                s.openings_limit,
                s.custom_places_limit,
                s.current_openings_used,
                s.extra_domains_purchased,
                COUNT(DISTINCT ak.id) as total_api_keys,
                COUNT(DISTINCT CASE WHEN ak.is_active = true THEN ak.id END) as active_api_keys,
                COUNT(DISTINCT ak.domain) as domains_used,
                COUNT(DISTINCT ccp.id) as custom_places_used
            FROM clients c
            LEFT JOIN subscriptions s ON c.id = s.client_id AND s.is_active = true
            LEFT JOIN api_keys ak ON c.id = ak.client_id
            LEFT JOIN client_custom_places ccp ON c.id = ccp.client_id
            WHERE c.id = $1
            GROUP BY 
                c.id, c.name, c.email, c.domain, c.phone, c.addresses, c.is_subscribed, 
                c.created_at, c.updated_at, s.plan_type, s.is_active, s.status, s.start_date, 
                s.end_date, s.current_period_end, s.domains_allowed, s.openings_limit, 
                s.custom_places_limit, s.current_openings_used, s.extra_domains_purchased
        `, [req.user.id]);
       
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const user = result.rows[0];

        // Calculate usage percentages
        const openingsPercentage = user.openings_limit > 0 
            ? Math.round((user.current_openings_used / user.openings_limit) * 100)
            : 0;
        
        const domainsPercentage = user.domains_allowed > 0
            ? Math.round((parseInt(user.domains_used) / user.domains_allowed) * 100)
            : 0;
        
        const customPlacesPercentage = user.custom_places_limit > 0
            ? Math.round((parseInt(user.custom_places_used) / user.custom_places_limit) * 100)
            : 0;
       
        // Return complete user information with limits
        res.json({
            id: user.id,
            name: user.name || user.email.split('@')[0],
            email: user.email,
            domain: user.domain,
            phone: user.phone || null,
            addresses: user.addresses || null,
            is_subscribed: user.is_subscribed || false,

            // Subscription information
            subscription: {
                plan: user.plan || 'Free',
                active: user.subscription_active || false,
                status: user.subscription_status || 'inactive',
                start_date: user.subscription_start,
                end_date: user.subscription_end,
                current_period_end: user.current_period_end
            },

            // Limits and current usage
            limits: {
                domains: {
                    allowed: user.domains_allowed || 1,
                    used: parseInt(user.domains_used) || 0,
                    available: Math.max(0, (user.domains_allowed || 1) - parseInt(user.domains_used || 0)),
                    percentage: domainsPercentage,
                    can_add: parseInt(user.domains_used || 0) < (user.domains_allowed || 1)
                },
                openings: {
                    limit: user.openings_limit || 3000,
                    used: user.current_openings_used || 0,
                    available: Math.max(0, (user.openings_limit || 3000) - (user.current_openings_used || 0)),
                    percentage: openingsPercentage,
                    warning: openingsPercentage >= 80
                },
                custom_places: {
                    limit: user.custom_places_limit === -1 ? 'unlimited' : (user.custom_places_limit || 0),
                    used: parseInt(user.custom_places_used) || 0,
                    available: user.custom_places_limit === -1 
                        ? 'unlimited' 
                        : Math.max(0, (user.custom_places_limit || 0) - parseInt(user.custom_places_used || 0)),
                    percentage: user.custom_places_limit === -1 ? 0 : customPlacesPercentage,
                    can_add: user.custom_places_limit === -1 || parseInt(user.custom_places_used || 0) < (user.custom_places_limit || 0)
                }
            },

            // General statistics
            stats: {
                total_api_keys: parseInt(user.total_api_keys) || 0,
                active_api_keys: parseInt(user.active_api_keys) || 0,
                domains_used: parseInt(user.domains_used) || 0,
                custom_places_count: parseInt(user.custom_places_used) || 0
            },
            
            created_at: user.created_at,
            updated_at: user.updated_at
        });
       
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// Main profile endpoint - /api/profile (used by dashboard contact form)
router.get('/profile', authMiddleware, getUserProfile);

// Alias - /auth/me (compatibility with existing code)
router.get('/auth/me', authMiddleware, getUserProfile);

// Alias - /getProfile (compatibility with existing code)
router.get('/getProfile', authMiddleware, getUserProfile);

// ========================================
// OTHER ENDPOINTS
// ========================================

router.get('/authMidleware', authController.authMiddleware);

router.get("/dashboard", authMiddleware, subscriptionMiddleware, (req, res) => {
  res.render("dashboard", { user: req.user });
});

// IMPORTANTE: Logout ahora requiere autenticación para invalidar tokens (PASO 3)
router.get('/logout', authMiddleware, authController.logout);

// Endpoints de suscripción
router.get("/subscription-status", authMiddleware, authController.getSubscriptionStatus);
router.post("/activate-subscription", authMiddleware, authController.activateSubscription);

// Password change
router.post("/changePassword", authMiddleware, authController.changePassword);

// Account deletion
router.delete("/delete-account", authMiddleware, authController.deleteAccount);

router.get('/loginSignup', (req, res) => {
  res.json({ message: 'Login/Signup route working' });
});

// Password recovery
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

/**
 * GET /api/user/current-plan
 * Get current plan of authenticated user
 */
router.get('/user/current-plan', authMiddleware, async (req, res) => {
    try {
        const clientId = req.user.id;
        
        const result = await pool.query(`
            SELECT 
                COALESCE(s.plan_type, 'Free') as plan_name,
                s.is_active,
                s.current_period_end,
                s.domains_allowed,
                s.openings_limit,
                s.custom_places_limit
            FROM clients c
            LEFT JOIN subscriptions s ON c.id = s.client_id 
                AND s.is_active = true
                AND s.status = 'active'
            WHERE c.id = $1
            LIMIT 1
        `, [clientId]);
        
        if (result.rows.length === 0) {
            return res.json({ 
                planName: 'Free',
                limits: {
                    domains: 0,
                    openings: 0,
                    customPlaces: 0
                }
            });
        }
        
        const planData = result.rows[0];
        const planName = planData.plan_name || 'Free';
        
        res.json({ 
            planName: planName,
            isActive: planData.is_active || false,
            periodEnd: planData.current_period_end || null,
            limits: {
                domains: planData.domains_allowed || 0,
                openings: planData.openings_limit || 0,
                customPlaces: planData.custom_places_limit || 0
            }
        });
        
    } catch (error) {
        console.error('Error getting user plan:', error);
        res.status(500).json({
            error: 'Error getting user plan',
            planName: 'Error'
        });
    }
});

module.exports = router;