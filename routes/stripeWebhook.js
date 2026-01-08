// routes/stripeWebhook.js - VERSIÓN ACTUALIZADA CON DOMINIOS ADICIONALES 
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../db/config');
const { sendPaymentConfirmationEmail, sendRecurringPaymentSuccessEmail, sendPaymentFailedEmail, sendSubscriptionCancelledEmail } = require('../services/emailService');

const PLAN_CONFIG = {
  'starter': { price_id: process.env.STRIPE_PRICE_STARTER, price: 1900, name: 'Starter', domains: 1, openings: 3000, custom_places: 0 },
  'business': { price_id: process.env.STRIPE_PRICE_BUSINESS, price: 4900, name: 'Business', domains: 1, openings: 20000, custom_places: 100, extra_domain_price: 1000 },
  'enterprise': { price_id: process.env.STRIPE_PRICE_ENTERPRISE, price: 14900, name: 'Enterprise', domains: 1, openings: 150000, custom_places: -1, extra_domain_price: 1500 }
};

// ============================================
// WEBHOOK HANDLER
// ============================================
module.exports = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
    }
    
    return res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Error procesando webhook:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).send('Error');
  }
};

// ============================================
// HANDLER: Checkout Completado (CON DOMINIOS ADICIONALES)
// ============================================
async function handleCheckoutCompleted(session) {

  const clientEmail = session.customer_email || session.metadata?.user_email;
  const subscriptionId = session.subscription;
  const purchaseType = session.metadata?.purchase_type || 'subscription';

  if (!clientEmail || !subscriptionId) {
    console.error('❌ Faltan datos:', { clientEmail, subscriptionId });
    throw new Error('Missing email or subscription');
  }

  // 🆕 VERIFICAR SI ES COMPRA DE DOMINIO ADICIONAL
  if (purchaseType === 'additional_domain') {
    return await handleAdditionalDomainPurchase(session);
  }

  // PROCESAR SUSCRIPCIÓN NORMAL (CÓDIGO EXISTENTE)
  try {
    let subscription;
    let periodEndDate;
    
    try {
      
      subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'customer', 'default_payment_method']
      });
      
      if (subscription.current_period_end) {
        periodEndDate = new Date(subscription.current_period_end * 1000);
      } else {
        const billingInterval = subscription.items?.data[0]?.plan?.interval || 'month';
        const daysToAdd = billingInterval === 'year' ? 365 : 30;
        
        periodEndDate = new Date((subscription.created + (daysToAdd * 24 * 60 * 60)) * 1000);
        console.warn(`⚠️ Usando fecha calculada (created + ${daysToAdd} días):`, periodEndDate.toISOString());
      }
      
    } catch (err) {
      console.error('❌ Error obteniendo suscripción:', err.message);
      
      periodEndDate = new Date();
      periodEndDate.setDate(periodEndDate.getDate() + 30);
      console.warn('⚠️ Usando fecha de emergencia (hoy + 30 días):', periodEndDate.toISOString());
    }

    const planType = subscription?.metadata?.plan_type || session.metadata?.plan_type || 'starter';
    const domainsAllowed = parseInt(subscription?.metadata?.domains_allowed || 1);
    const openingsLimit = parseInt(subscription?.metadata?.openings_limit || 3000);
    const customPlacesLimit = parseInt(subscription?.metadata?.custom_places_limit || 0);

    let userResult = await pool.query('SELECT id FROM clients WHERE email = $1', [clientEmail]);
    let userId;

    if (userResult.rows.length === 0) {
      const insertResult = await pool.query(
        'INSERT INTO clients (email, name, password, is_subscribed, stripe_customer_id, created_at) VALUES ($1, $2, $3, true, $4, NOW()) RETURNING id',
        [clientEmail, clientEmail.split('@')[0], 'stripe_' + Date.now(), session.customer]
      );
      userId = insertResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
      await pool.query('UPDATE clients SET is_subscribed = true, stripe_customer_id = $1, updated_at = NOW() WHERE id = $2', [session.customer, userId]);
    }

    const priceId = subscription?.items?.data[0]?.price?.id || 'unknown';
    
    await pool.query(`
      INSERT INTO subscriptions (client_id, plan_type, status, is_active, start_date, current_period_end, next_billing_date,
        domains_allowed, openings_limit, custom_places_limit, current_openings_used, stripe_subscription_id, stripe_customer_id, 
        stripe_price_id, auto_renew, cancel_at_period_end, created_at, updated_at)
      VALUES ($1, $2, 'active', true, NOW(), $3, $3, $4, $5, $6, 0, $7, $8, $9, true, false, NOW(), NOW())
      ON CONFLICT (client_id) DO UPDATE SET 
        plan_type = $2, 
        status = 'active', 
        is_active = true, 
        current_period_end = $3,
        next_billing_date = $3, 
        domains_allowed = $4, 
        openings_limit = $5, 
        custom_places_limit = $6, 
        stripe_subscription_id = $7,
        stripe_customer_id = $8, 
        stripe_price_id = $9, 
        updated_at = NOW()
    `, [userId, planType, periodEndDate, domainsAllowed, openingsLimit, customPlacesLimit, subscriptionId, session.customer, priceId]);

    const logResult = await pool.query(
      'INSERT INTO payment_logs (user_email, stripe_session_id, subscription_id, plan_id, amount, status, payment_type, created_at, email_sent) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false) RETURNING id',
      [clientEmail, session.id, subscriptionId, planType, session.amount_total, 'completed', 'subscription']
    );

    const paymentLogId = logResult.rows[0].id;

    sendPaymentConfirmationEmail(clientEmail, {
      planName: PLAN_CONFIG[planType]?.name || planType,
      amount: session.amount_total,
      sessionId: session.id,
      billingPeriod: 'monthly',
      purchaseDate: new Date().toLocaleDateString('es-ES'),
      nextBillingDate: periodEndDate.toLocaleDateString('es-ES'),
      domainsAllowed, 
      openingsLimit, 
      customPlacesLimit
    }).then(() => {
      pool.query('UPDATE payment_logs SET email_sent = true, email_sent_at = NOW() WHERE id = $1', [paymentLogId]);
    }).catch(emailError => {
      console.error('⚠️ Error enviando email:', emailError.message);
      pool.query('UPDATE payment_logs SET email_sent = false, email_error = $1 WHERE id = $2', [emailError.message, paymentLogId]);
    });

    return true;

  } catch (error) {
    console.error('❌ Error en handleCheckoutCompleted:', error.message);
    throw error;
  }
}

// ============================================
// 🆕 HANDLER: Compra de Dominio Adicional
// ============================================
async function handleAdditionalDomainPurchase(session) {
  
  try {
    const domain = session.metadata.domain;
    const userId = parseInt(session.metadata.user_id);
    const userEmail = session.metadata.user_email;
    const planType = session.metadata.plan_type;
    const domainPrice = parseInt(session.metadata.domain_price);
    const subscriptionId = session.subscription;

    if (!domain || !userId) {
      throw new Error('Faltan datos del dominio o usuario');
    }

    // Obtener información de la suscripción
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice']
    });

    let periodEndDate;
    if (subscription.current_period_end) {
      periodEndDate = new Date(subscription.current_period_end * 1000);
    } else {
      periodEndDate = new Date();
      periodEndDate.setMonth(periodEndDate.getMonth() + 1);
    }

    // 🔥 Verificar si el dominio existe (puede estar cancelado)
    const existingDomain = await pool.query(
      'SELECT id, status FROM extra_domains WHERE client_id = $1 AND domain = $2',
      [userId, domain]
    );

    let extraDomainId;

    if (existingDomain.rows.length > 0) {
      // REACTIVAR dominio cancelado
      extraDomainId = existingDomain.rows[0].id;
      
      await pool.query(`
        UPDATE extra_domains 
        SET 
          status = 'active', 
          stripe_subscription_id = $1,
          monthly_price = $2,
          next_billing_date = $3,
          updated_at = NOW()
        WHERE id = $4
      `, [subscriptionId, domainPrice, periodEndDate, extraDomainId]);
      
      // Reactivar API keys asociadas si las había
      await pool.query(
        'UPDATE api_keys SET is_active = true WHERE client_id = $1 AND domain = $2',
        [userId, domain]
      );
      
    } else {
      // CREAR nuevo dominio
      const domainResult = await pool.query(`
        INSERT INTO extra_domains (
          client_id, 
          domain, 
          stripe_subscription_id, 
          status, 
          monthly_price, 
          next_billing_date,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, 'active', $4, $5, NOW(), NOW())
        RETURNING id
      `, [userId, domain, subscriptionId, domainPrice, periodEndDate]);

      extraDomainId = domainResult.rows[0].id;
    }

    // 2️⃣ Incrementar contador en suscripciones (solo para nuevos)
    if (existingDomain.rows.length === 0) {
      await pool.query(`
        UPDATE subscriptions 
        SET extra_domains_purchased = extra_domains_purchased + 1,
            updated_at = NOW()
        WHERE client_id = $1
      `, [userId]);
    }

    // 3️⃣ Registrar log de pago
    await pool.query(
      'INSERT INTO payment_logs (user_email, stripe_session_id, subscription_id, plan_id, amount, status, payment_type, created_at, email_sent) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false)',
      [userEmail, session.id, subscriptionId, `additional_domain_${planType}`, session.amount_total, 'completed', existingDomain.rows.length > 0 ? 'domain_reactivation' : 'additional_domain']
    );
    return true;

  } catch (error) {
    console.error('❌ Error procesando dominio adicional:', error);
    throw error;
  }
}

// ============================================
// HANDLER: Pago Recurrente (MEJORADO)
// ============================================
async function handleInvoicePaymentSucceeded(invoice) {
  
  if (!invoice.subscription) {
    return;
  }
  
  try {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    
    const isFirst = (Date.now() / 1000) - subscription.created < 120;
    
    if (isFirst) {
      return;
    }
    
    // 🆕 Verificar si es renovación de dominio adicional
    const metadata = subscription.metadata || {};
    
    if (metadata.purchase_type === 'additional_domain') {
      
      if (subscription.current_period_end) {
        const periodEndDate = new Date(subscription.current_period_end * 1000);
        
        await pool.query(`
          UPDATE extra_domains 
          SET 
            next_billing_date = $1,
            updated_at = NOW()
          WHERE stripe_subscription_id = $2
        `, [periodEndDate, invoice.subscription]);
      }
      
      return;
    }
    
    // Actualizar suscripción principal
    if (subscription.current_period_end) {
      const periodEndDate = new Date(subscription.current_period_end * 1000);
      
      await pool.query(`
        UPDATE subscriptions 
        SET 
          current_period_end = $1,
          next_billing_date = $1,
          current_openings_used = 0,
          status = 'active',
          is_active = true,
          updated_at = NOW()
        WHERE stripe_subscription_id = $2
      `, [periodEndDate, invoice.subscription]);
    }
    
  } catch (error) {
    console.error('❌ Error procesando pago recurrente:', error);
  }
}

async function handleInvoicePaymentFailed(invoice) {
  console.log('❌ Pago fallido:', invoice.id);
}

async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Suscripción actualizada:', subscription.id);
}

async function handleSubscriptionDeleted(subscription) {
  // 🆕 Si es un dominio adicional, marcarlo como cancelado
  try {
    const metadata = subscription.metadata || {};
    
    if (metadata.purchase_type === 'additional_domain') {
      await pool.query(`
        UPDATE extra_domains 
        SET 
          status = 'cancelled',
          updated_at = NOW()
        WHERE stripe_subscription_id = $1
      `, [subscription.id]);
    }
  } catch (error) {
    console.error('❌ Error cancelando dominio adicional:', error);
  }
}