// routes/domains.js
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../db/config');
const authMiddleware = require('../middlewares/authMiddleware');
const { subscriptionMiddleware } = require('../middlewares/subscriptionMiddleware');

const router = express.Router();

/**
 * Get all user domains (base + additional)
 * Clear separation between base domain and additional domains
 */
router.get('/all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get client's base domain (from registration)
    const clientResult = await pool.query(
      'SELECT domain FROM clients WHERE id = $1',
      [userId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Client not found',
        success: false
      });
    }

    const baseDomain = clientResult.rows[0].domain;

    // Get active additional domains (only paid ones)
    const extraDomainsResult = await pool.query(
      `SELECT 
        id,
        domain,
        stripe_subscription_id,
        status,
        monthly_price,
        created_at,
        next_billing_date
       FROM extra_domains 
       WHERE client_id = $1 
       AND status = 'active'
       ORDER BY created_at DESC`,
      [userId]
    );

    const extraDomains = extraDomainsResult.rows.map(row => ({
      id: row.id,
      domain: row.domain,
      stripe_subscription_id: row.stripe_subscription_id,
      status: row.status,
      monthly_price: row.monthly_price,
      price_eur: (row.monthly_price / 100).toFixed(2),
      created_at: row.created_at,
      next_billing_date: row.next_billing_date,
      is_extra: true
    }));

    res.json({
      success: true,
      baseDomain: baseDomain,
      extraDomains: extraDomains,
      totalDomains: 1 + extraDomains.length,
      breakdown: {
        base: 1,
        extra: extraDomains.length
      }
    });

  } catch (error) {
    console.error('Error getting domains:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      success: false
    });
  }
});

/**
 * Create payment session for additional domain
 */
router.post('/purchase', authMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { domain } = req.body;
    const userId = req.user.id;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Clean domain
    const cleanDomain = domain.trim().replace(/^(https?:\/\/)?(www\.)?/, '');

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(cleanDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    // Verify user has valid plan (Business or Enterprise)
    const planType = req.user.plan_type;

    if (planType !== 'business' && planType !== 'enterprise') {
      return res.status(403).json({
        error: 'Upgrade required',
        message: 'Only Business and Enterprise plans can add additional domains'
      });
    }

    // Determine price based on plan
    let domainPrice = 1000; // 10€ for Business
    if (planType === 'enterprise') {
      domainPrice = 1500; // 15€ for Enterprise
    }

    // Check if domain exists in extra_domains (may be cancelled)
    const existingExtraDomain = await pool.query(
  'SELECT id, status FROM extra_domains WHERE client_id = $1 AND domain = $2',
  [userId, cleanDomain]
);

    // If exists and is cancelled, allow reactivation (don't block)
    if (existingExtraDomain.rows.length > 0) {
      const domainStatus = existingExtraDomain.rows[0].status;

      if (domainStatus === 'active') {
        return res.status(400).json({
          error: 'Domain already exists',
          message: 'This domain is already active in your account'
        });
      }
    }

    // Verify it's not the base domain
    const clientResult = await pool.query(
      'SELECT domain FROM clients WHERE id = $1',
      [userId]
    );

    if (clientResult.rows.length > 0 && clientResult.rows[0].domain === cleanDomain) {
      return res.status(400).json({
        error: 'Cannot purchase base domain',
        message: 'This is your base domain, already included in your plan'
      });
    }

    // Get client information
    const client = await pool.query(
      'SELECT email, stripe_customer_id FROM clients WHERE id = $1',
      [userId]
    );

    if (client.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const clientData = client.rows[0];

    // Create Stripe customer if doesn't exist
    let customerId = clientData.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: clientData.email,
        metadata: {
          user_id: userId.toString()
        }
      });

      customerId = customer.id;

      // Update in database
      await pool.query(
        'UPDATE clients SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, userId]
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Additional Domain - ${cleanDomain}`,
              description: `API access for additional domain (${planType.charAt(0).toUpperCase() + planType.slice(1)} Plan)`,
              metadata: {
                type: 'additional_domain',
                domain: cleanDomain
              }
            },
            recurring: {
              interval: 'month'
            },
            unit_amount: domainPrice
          },
          quantity: 1
        }
      ],
      metadata: {
        user_id: userId.toString(),
        user_email: clientData.email,
        purchase_type: 'additional_domain',
        domain: cleanDomain,
        plan_type: planType,
        domain_price: domainPrice.toString()
      },
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/apiAccess.html?domain_added=success&domain=${encodeURIComponent(cleanDomain)}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/addDomain.html?canceled=true`
    });

    // If domain existed as cancelled, prepare for reactivation
    if (existingExtraDomain.rows.length > 0 && existingExtraDomain.rows[0].status === 'cancelled') {
      // Stripe webhook will handle updating status to 'active'
    }

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      domain: cleanDomain,
      price: domainPrice / 100 // Convert to euros
    });

  } catch (error) {
    console.error('Error processing domain purchase:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error processing domain purchase'
    });
  }
});

/**
 * Verify domain purchase status
 */
router.get('/verify-purchase/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      res.json({
        success: true,
        status: 'completed',
        domain: session.metadata.domain
      });
    } else {
      res.json({
        success: false,
        status: session.payment_status
      });
    }

  } catch (error) {
    console.error('Error verifying purchase:', error);
    res.status(500).json({ error: 'Error verifying purchase' });
  }
});

/**
 * Get user's additional domains
 */
router.get('/additional', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        ed.id,
        ed.domain,
        ed.stripe_subscription_id,
        ed.status,
        ed.monthly_price,
        ed.created_at,
        ed.next_billing_date
       FROM extra_domains ed
       WHERE ed.client_id = $1 AND ed.status = 'active'
       ORDER BY ed.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      domains: result.rows
    });

  } catch (error) {
    console.error('Error getting additional domains:', error);
    res.status(500).json({ error: 'Error getting domains' });
  }
});

/**
 * Cancel additional domain
 */
router.post('/cancel/:domainId', authMiddleware, async (req, res) => {
  try {
    const { domainId } = req.params;
    const userId = req.user.id;

    // Get domain information
    const domainResult = await pool.query(
      'SELECT stripe_subscription_id, domain FROM extra_domains WHERE id = $1 AND client_id = $2',
      [domainId, userId]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const domain = domainResult.rows[0];

    // Cancel subscription in Stripe
    if (domain.stripe_subscription_id) {
      await stripe.subscriptions.cancel(domain.stripe_subscription_id);
    }

    // Update in database
    await pool.query(
      'UPDATE extra_domains SET status = $1, updated_at = NOW() WHERE id = $2',
      ['cancelled', domainId]
    );

    // Deactivate associated API keys
    await pool.query(
      'UPDATE api_keys SET is_active = false WHERE client_id = $1 AND domain = $2',
      [userId, domain.domain]
    );

    res.json({
      success: true,
      message: 'Additional domain cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling domain:', error);
    res.status(500).json({ error: 'Error cancelling domain' });
  }
});

module.exports = router;