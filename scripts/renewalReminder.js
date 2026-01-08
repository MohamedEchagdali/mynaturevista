// scripts/renewalReminder.js
const { pool } = require('../db/config');
const { sendRenewalReminderEmail } = require('../services/emailService');

/**
 * Script para enviar recordatorios de renovación
 * Envía emails 3 días antes de la fecha de renovación
 */
async function sendRenewalReminders() {

  try {
    // Obtener suscripciones que se renuevan en 3 días
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    const result = await pool.query(`
      SELECT 
        c.email,
        c.name,
        s.plan_type,
        s.next_billing_date,
        s.stripe_subscription_id
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      WHERE 
        s.is_active = true 
        AND s.cancel_at_period_end = false
        AND s.auto_renew = true
        AND s.next_billing_date BETWEEN $1 AND $2
        AND NOT EXISTS (
          SELECT 1 FROM renewal_reminders 
          WHERE subscription_id = s.stripe_subscription_id 
          AND sent_at > NOW() - INTERVAL '7 days'
        )
    `, [twoDaysFromNow, threeDaysFromNow]);

    for (const subscription of result.rows) {
      try {
        const planPrices = {
          'starter': 1900,
          'business': 4900,
          'enterprise': 14900
        };

        await sendRenewalReminderEmail(subscription.email, {
          planName: capitalizeFirstLetter(subscription.plan_type),
          amount: planPrices[subscription.plan_type] || 0,
          renewalDate: formatDate(subscription.next_billing_date)
        });

        // Registrar que se envió el recordatorio
        await pool.query(`
          INSERT INTO renewal_reminders (subscription_id, sent_at)
          VALUES ($1, NOW())
          ON CONFLICT (subscription_id) DO UPDATE SET sent_at = NOW()
        `, [subscription.stripe_subscription_id]);

      } catch (emailError) {
        console.error(`❌ Error enviando a ${subscription.email}:`, emailError);
      }
    }

  } catch (error) {
    console.error('❌ Error en proceso de recordatorios:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Ejecutar
sendRenewalReminders();