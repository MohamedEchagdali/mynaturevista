//stripeRoutes.js
const express = require('express'); 
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { pool } = require('../db/config');
const { sendPaymentConfirmationEmail, sendPaymentFailedEmail, sendSubscriptionCancelledEmail } = require('../services/emailService');
const jwt = require('jsonwebtoken');

// PLAN_CONFIG
const PLAN_CONFIG = {
  'starter': {
    price_id: process.env.STRIPE_PRICE_STARTER,
    price: 1900,
    name: 'Starter',
    domains: 1,
    openings: 3000,
    custom_places: 0
  },
  'business': {
    price_id: process.env.STRIPE_PRICE_BUSINESS,
    price: 4900,
    name: 'Business',
    domains: 1,
    openings: 20000,
    custom_places: 100,
    extra_domain_price: 1000
  },
  'enterprise': {
    price_id: process.env.STRIPE_PRICE_ENTERPRISE,
    price: 14900,
    name: 'Enterprise',
    domains: 1,
    openings: 150000,
    custom_places: -1,
    extra_domain_price: 1500
  }
};
// ============================================
// CREAR CHECKOUT SESSION (SUSCRIPCIÓN RECURRENTE)
// ============================================
router.post('/create-checkout-session', async (req, res) => {
  const { plan, user_email, extra_domains } = req.body;
  
  if (!plan || !plan.type) {
    return res.status(400).json({ error: 'Plan no válido' });
  }

  const planConfig = PLAN_CONFIG[plan.type];
  
  if (!planConfig || !planConfig.price_id) {
    console.error('❌ Price ID no configurado para:', plan.type);
    return res.status(400).json({ error: 'Plan no configurado correctamente en Stripe' });
  }

  try {
    let customer = null;

    // 1️⃣ Si hay email de usuario, buscar o crear customer en Stripe
    if (user_email) {
      const clientResult = await pool.query(
        'SELECT stripe_customer_id FROM clients WHERE email = $1',
        [user_email]
      );

      if (clientResult.rows.length > 0 && clientResult.rows[0].stripe_customer_id) {
        // Cliente existente con Stripe ID
        customer = clientResult.rows[0].stripe_customer_id;
      } else {
        // Crear nuevo cliente en Stripe
        const stripeCustomer = await stripe.customers.create({
          email: user_email,
          metadata: {
            source: 'myNaturevista',
            plan_type: plan.type
          }
        });
        
        customer = stripeCustomer.id;

        // Guardar stripe_customer_id en la BD
        if (clientResult.rows.length > 0) {
          await pool.query(
            'UPDATE clients SET stripe_customer_id = $1 WHERE email = $2',
            [customer, user_email]
          );
        }
      }
    }

    // 2️⃣ Configurar línea de items con el Price ID de Stripe
    const lineItems = [
      {
        price: planConfig.price_id, // ✅ CLAVE: Usar Price ID recurrente
        quantity: 1,
      }
    ];

    // 3️⃣ Añadir dominios extra si aplica
    if (extra_domains && extra_domains > 0 && planConfig.extra_domain_price) {
      // Nota: Para dominios extra, deberías crear un Price ID adicional en Stripe
      // Por ahora, lo trataremos como cargo único
      lineItems.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Dominios Adicionales (${extra_domains})`,
            description: `€${planConfig.extra_domain_price / 100} por dominio`,
          },
          unit_amount: planConfig.extra_domain_price,
          recurring: {
            interval: 'month'
          }
        },
        quantity: extra_domains,
      });
    }

    // 4️⃣ Crear Checkout Session en modo SUSCRIPCIÓN
    const sessionConfig = {
      payment_method_types: ['card'],
      mode: 'subscription', // 🔥 CAMBIO CLAVE: De 'payment' a 'subscription'
      line_items: lineItems,
      success_url: `${req.protocol}://${req.get('host')}/dashboard/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/dashboard/payment.html`,
      
      // Metadatos para el webhook
      subscription_data: {
        metadata: {
          plan_type: plan.type,
          plan_name: planConfig.name,
          domains_allowed: planConfig.domains + (extra_domains || 0),
          openings_limit: planConfig.openings,
          custom_places_limit: planConfig.custom_places
        }
      },
      
      metadata: {
        plan_type: plan.type,
        user_email: user_email || '',
        source: 'dashboard_payment'
      }
    };

    // 5️⃣ Asignar customer si existe
    if (customer) {
      sessionConfig.customer = customer;
    } else if (user_email) {
      sessionConfig.customer_email = user_email;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    res.json({ id: session.id });
    
  } catch (err) {
    console.error('❌ Error creando checkout session:', err.message);
    res.status(500).json({ error: 'Error creando sesión de pago: ' + err.message });
  }
});



// ============================================
// HANDLER: Checkout Completado (CON MÁXIMA VALIDACIÓN)
// ============================================
async function handleCheckoutCompleted(session) {

  const clientEmail = session.customer_email || session.metadata?.user_email;
  const subscriptionId = session.subscription;

  // VALIDACIONES INICIALES
  if (!clientEmail) {
    throw new Error('No client email found');
  }

  if (!subscriptionId) {
    throw new Error('No subscription ID found');
  }

  try {

let subscription;
for (let i = 0; i < 3; i++) {
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription && subscription.current_period_end) {
      break;
    } else {
      console.warn(`⚠️ current_period_end vacío en intento ${i + 1}. Reintentando en 2s...`);
      await new Promise(r => setTimeout(r, 2000)); // espera 2 segundos antes de reintentar
    }
  } catch (err) {
    console.error(`❌ Error recuperando suscripción en intento ${i + 1}:`, err.message);
    await new Promise(r => setTimeout(r, 2000));
  }
}

// Si después de 3 intentos sigue sin current_period_end, registrar y salir sin romper
if (!subscription || !subscription.current_period_end) {
  return; // 👈 evita que el proceso crashee
}

    // PASO 2: Convertir timestamp
    const periodEndTimestamp = subscription.current_period_end;
    
    const periodEndDate = new Date(periodEndTimestamp * 1000);
    
    if (isNaN(periodEndDate.getTime())) {
      throw new Error(`Invalid date from timestamp: ${periodEndTimestamp}`);
    }

    // PASO 3: Extraer metadata
    const planType = subscription.metadata?.plan_type || session.metadata?.plan_type || 'starter';
    const domainsAllowed = parseInt(subscription.metadata?.domains_allowed || 1);
    const openingsLimit = parseInt(subscription.metadata?.openings_limit || 3000);
    const customPlacesLimit = parseInt(subscription.metadata?.custom_places_limit || 0);

    // PASO 4: Buscar o crear cliente
    let userResult = await pool.query('SELECT id, email FROM clients WHERE email = $1', [clientEmail]);
    let userId;

    if (userResult.rows.length === 0) {
      const insertResult = await pool.query(
        `INSERT INTO clients (email, name, password, is_subscribed, stripe_customer_id, created_at) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING id, email`,
        [
          clientEmail, 
          clientEmail.split('@')[0], 
          'stripe_' + Date.now(), 
          true, // 🔥 is_subscribed = true
          session.customer
        ]
      );
      userId = insertResult.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
      
      // 🔥 ACTUALIZAR is_subscribed = true
      await pool.query(
        'UPDATE clients SET is_subscribed = $1, stripe_customer_id = $2, updated_at = NOW() WHERE id = $3',
        [true, session.customer, userId]
      );
    }

    // PASO 5: Crear/actualizar suscripción
    const subscriptionQuery = `
      INSERT INTO subscriptions 
      (client_id, plan_type, status, is_active, start_date, current_period_end, next_billing_date,
       domains_allowed, openings_limit, custom_places_limit, current_openings_used,
       stripe_subscription_id, stripe_customer_id, stripe_price_id, auto_renew, cancel_at_period_end,
       created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), $5, $5, $6, $7, $8, 0, $9, $10, $11, true, false, NOW(), NOW())
      ON CONFLICT (client_id) 
      DO UPDATE SET 
        plan_type = $2,
        status = $3,
        is_active = $4,
        current_period_end = $5,
        next_billing_date = $5,
        domains_allowed = $6,
        openings_limit = $7,
        custom_places_limit = $8,
        current_openings_used = 0,
        stripe_subscription_id = $9,
        stripe_customer_id = $10,
        stripe_price_id = $11,
        auto_renew = true,
        cancel_at_period_end = false,
        updated_at = NOW()
    `;

    const subscriptionValues = [
      userId,                               // $1
      planType,                            // $2
      'active',                            // $3
      true,                                // $4
      periodEndDate,                       // $5
      domainsAllowed,                      // $6
      openingsLimit,                       // $7
      customPlacesLimit,                   // $8
      subscriptionId,                      // $9
      session.customer,                    // $10
      subscription.items.data[0].price.id  // $11
    ];

    await pool.query(subscriptionQuery, subscriptionValues);

    // PASO 6: Registrar pago
    const logResult = await pool.query(
      `INSERT INTO payment_logs 
      (user_email, stripe_session_id, subscription_id, plan_id, amount, status, payment_type, created_at, email_sent) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false) 
      RETURNING id`,
      [clientEmail, session.id, subscriptionId, planType, session.amount_total, 'completed', 'subscription']
    );
    const paymentLogId = logResult.rows[0].id;

    // PASO 7: Enviar email
    try {
      await sendPaymentConfirmationEmail(clientEmail, {
        planName: PLAN_CONFIG[planType]?.name || planType,
        amount: session.amount_total,
        sessionId: session.id,
        billingPeriod: 'monthly',
        purchaseDate: new Date().toLocaleDateString('es-ES'),
        nextBillingDate: periodEndDate.toLocaleDateString('es-ES'),
        domainsAllowed,
        openingsLimit,
        customPlacesLimit
      });
      
      await pool.query('UPDATE payment_logs SET email_sent = true, email_sent_at = NOW() WHERE id = $1', [paymentLogId]);
      
    } catch (emailError) {
      await pool.query(
        'UPDATE payment_logs SET email_sent = false, email_error = $1 WHERE id = $2',
        [emailError.message, paymentLogId]
      );
    }


  } catch (error) {
    console.error('❌ === ERROR EN handleCheckoutCompleted ===');
    throw error;
  }
}

// ============================================
// HANDLER: Pago Recurrente Exitoso
// ============================================
async function handleInvoicePaymentSucceeded(invoice) {

  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;

  // 🔥 FIX: Verificar que subscriptionId existe
  if (!subscriptionId) {
    return;
  }

  try {
    // Obtener suscripción completa
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Actualizar fecha de próximo cobro y resetear contador
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
    `, [
      new Date(subscription.current_period_end * 1000), // 🔥 FIX: Convertir timestamp a Date
      subscriptionId
    ]);

    // Registrar pago en logs
    const userResult = await pool.query(
      'SELECT email, name FROM clients WHERE stripe_customer_id = $1',
      [customerId]
    );

    if (userResult.rows.length > 0) {
      const clientEmail = userResult.rows[0].email;

      await pool.query(
        `INSERT INTO payment_logs 
        (user_email, subscription_id, invoice_id, payment_intent_id, plan_id, amount, status, payment_type, created_at, email_sent) 
        VALUES ($1, $2, $3, $4, $5, $6, 'completed', 'recurring', NOW(), false)
        RETURNING id`,
        [
          clientEmail,
          subscriptionId,
          invoice.id,
          invoice.payment_intent,
          subscription.metadata?.plan_type || 'unknown',
          invoice.amount_paid
        ]
      );

      // 🔥 FIX: Enviar email de pago recurrente
      try {
        const { sendRecurringPaymentSuccessEmail } = require('../services/emailService');
        
        await sendRecurringPaymentSuccessEmail(clientEmail, {
          planName: subscription.metadata?.plan_name || 'Plan',
          amount: invoice.amount_paid,
          invoiceId: invoice.id,
          nextBillingDate: new Date(subscription.current_period_end * 1000).toLocaleDateString('es-ES'),
          paymentDate: new Date().toLocaleDateString('es-ES')
        });


      } catch (emailError) {
        console.error('⚠️ Error enviando email de pago recurrente:', emailError);
      }
    }


  } catch (error) {
    console.error('❌ Error procesando pago recurrente:', error);
    throw error;
  }
}

// ============================================
// HANDLER: Pago Fallido
// ============================================
async function handleInvoicePaymentFailed(invoice) {

  const subscriptionId = invoice.subscription;
  const customerId = invoice.customer;

  // Obtener email del cliente
  const userResult = await pool.query(
    'SELECT email FROM clients WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (userResult.rows.length > 0) {
    const clientEmail = userResult.rows[0].email;

    // Registrar intento fallido
    await pool.query(
      `INSERT INTO payment_logs 
      (user_email, subscription_id, invoice_id, plan_id, amount, status, payment_type, failure_reason, retry_count, created_at) 
      VALUES ($1, $2, $3, $4, $5, 'failed', 'recurring', $6, $7, NOW())`,
      [
        clientEmail,
        subscriptionId,
        invoice.id,
        'unknown',
        invoice.amount_due,
        invoice.last_finalization_error?.message || 'Payment failed',
        invoice.attempt_count || 1
      ]
    );

    // Enviar email de notificación
    try {
      await sendPaymentFailedEmail(clientEmail, {
        invoiceId: invoice.id,
        amount: invoice.amount_due,
        retryDate: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toLocaleDateString('es-ES') : 'N/A'
      });
    } catch (emailError) {
      console.error('⚠️ Error enviando email de pago fallido:', emailError);
    }
  }
}

// ============================================
// HANDLER: Suscripción Actualizada
// ============================================
async function handleSubscriptionUpdated(subscription) {

  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  await pool.query(`
    UPDATE subscriptions 
    SET 
      cancel_at_period_end = $1,
      status = $2,
      updated_at = NOW()
    WHERE stripe_subscription_id = $3
  `, [
    cancelAtPeriodEnd,
    subscription.status,
    subscription.id
  ]);
}

// ============================================
// HANDLER: Suscripción Cancelada
// ============================================
async function handleSubscriptionDeleted(subscription) {

  // Actualizar suscripción en BD
  await pool.query(`
    UPDATE subscriptions 
    SET 
      status = 'cancelled',
      is_active = false,
      cancelled_at = NOW(),
      updated_at = NOW()
    WHERE stripe_subscription_id = $1
  `, [subscription.id]);

  // Actualizar cliente
  await pool.query(`
    UPDATE clients 
    SET is_subscribed = false 
    WHERE stripe_customer_id = $1
  `, [subscription.customer]);

  // Enviar email de cancelación
  const userResult = await pool.query(
    'SELECT email FROM clients WHERE stripe_customer_id = $1',
    [subscription.customer]
  );

  if (userResult.rows.length > 0) {
    try {
      await sendSubscriptionCancelledEmail(userResult.rows[0].email, {
        endDate: new Date(subscription.current_period_end * 1000).toLocaleDateString('es-ES')
      });
    } catch (emailError) {
      console.error('⚠️ Error enviando email de cancelación:', emailError);
    }
  }
}

// ============================================
// VERIFICAR PAGO
// ============================================
// ============================================
// VERIFICAR PAGO (para success.html)
// ============================================
router.get('/verify-payment', async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID requerido' });
    }

    // Obtener session de Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    // Buscar log de pago en BD
    const logResult = await pool.query(
      'SELECT * FROM payment_logs WHERE stripe_session_id = $1 ORDER BY created_at DESC LIMIT 1',
      [session_id]
    );

    const planNames = {
      'starter': 'Starter',
      'business': 'Business',
      'enterprise': 'Enterprise'
    };

    const planName = planNames[logResult.rows[0]?.plan_id] || 'Plan';

    res.json({
      success: true,
      planName: planName,
      amount: (session.amount_total / 100).toFixed(2),
      emailSent: logResult.rows[0]?.email_sent || false,
      purchaseDate: logResult.rows[0]?.created_at || new Date()
    });

  } catch (error) {
    console.error('❌ Error verificando pago:', error);
    res.status(500).json({ error: 'Error verificando pago' });
  }
});

// ============================================
// PORTAL DEL CLIENTE (Gestionar Suscripción)
// ============================================
router.post('/create-portal-session', async (req, res) => {
  try {
    const { customer_id } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'Customer ID requerido' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: `${req.protocol}://${req.get('host')}/dashboard/accountSettings.html`,
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error('❌ Error creando portal session:', error);
    res.status(500).json({ error: 'Error creando portal del cliente' });
  }
});
// ============================================
// OBTENER SUSCRIPCIÓN ACTUAL DEL USUARIO
// ============================================
router.get('/subscription/current', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(`
      SELECT 
        s.*,
        c.email,
        c.stripe_customer_id
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      WHERE s.client_id = $1 AND s.is_active = true
    `, [decoded.id]);

    if (result.rows.length === 0) {
      return res.json({ 
        is_active: false,
        message: 'No hay suscripción activa' 
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('❌ Error obteniendo suscripción:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// CANCELAR SUSCRIPCIÓN
// ============================================
router.post('/subscription/cancel', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { subscription_id, reason } = req.body;

    if (!subscription_id) {
      return res.status(400).json({ error: 'subscription_id requerido' });
    }

    // Verificar que la suscripción pertenece al usuario
    const subResult = await pool.query(
      'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 AND client_id = $2',
      [subscription_id, decoded.id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }

    // Cancelar en Stripe (al final del período)
    const subscription = await stripe.subscriptions.update(subscription_id, {
      cancel_at_period_end: true,
      metadata: {
        cancellation_reason: reason || 'user_requested'
      }
    });

    // Actualizar en BD
    await pool.query(`
      UPDATE subscriptions 
      SET 
        cancel_at_period_end = true,
        cancellation_reason = $1,
        updated_at = NOW()
      WHERE stripe_subscription_id = $2
    `, [reason || 'user_requested', subscription_id]);

    res.json({
      success: true,
      message: 'Suscripción cancelada exitosamente',
      end_date: new Date(subscription.current_period_end * 1000)
    });

  } catch (error) {
    console.error('❌ Error cancelando suscripción:', error);
    res.status(500).json({ error: 'Error cancelando suscripción' });
  }
});

// ============================================
// REACTIVAR SUSCRIPCIÓN CANCELADA
// ============================================
router.post('/subscription/reactivate', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const { subscription_id } = req.body;

    if (!subscription_id) {
      return res.status(400).json({ error: 'subscription_id requerido' });
    }

    // Verificar que la suscripción pertenece al usuario
    const subResult = await pool.query(
      'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1 AND client_id = $2',
      [subscription_id, decoded.id]
    );

    if (subResult.rows.length === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }

    // Reactivar en Stripe
    const subscription = await stripe.subscriptions.update(subscription_id, {
      cancel_at_period_end: false
    });

    // Actualizar en BD
    await pool.query(`
      UPDATE subscriptions 
      SET 
        cancel_at_period_end = false,
        cancellation_reason = NULL,
        updated_at = NOW()
      WHERE stripe_subscription_id = $1
    `, [subscription_id]);

    res.json({
      success: true,
      message: 'Suscripción reactivada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error reactivando suscripción:', error);
    res.status(500).json({ error: 'Error reactivando suscripción' });
  }
});
// ============================================
// OBTENER DETALLES DE SUSCRIPCIÓN (para dashboard)
// ============================================
router.get('/subscription/details', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const jwt = require('jsonwebtoken');
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(`
      SELECT 
        s.*,
        c.email,
        c.name
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      WHERE s.client_id = $1
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'No subscription found',
        has_subscription: false
      });
    }

    res.json({
      success: true,
      subscription: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error obteniendo detalles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;








































