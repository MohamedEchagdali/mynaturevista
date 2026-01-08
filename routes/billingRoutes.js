// routes/billingRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/config');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Directorio para cachear PDFs
const PDF_CACHE_DIR = path.join(__dirname, '../cache/invoices');

/**
 * Middleware para verificar autenticación
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Rate limiter específico para descargas de PDF
 * Límite: 20 descargas por usuario cada 15 minutos
 */
const pdfDownloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // Máximo 20 descargas por ventana
  message: { 
    error: 'Too many invoice downloads',
    message: 'You have exceeded the download limit. Please try again in 15 minutes.',
    retry_after: 15 
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Usar el userId del token JWT como identificador
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  },
  // Solo aplicar a usuarios autenticados
  skip: (req) => !req.user,
  handler: (req, res) => {
    console.warn(`⚠️ PDF Rate limit exceeded - User: ${req.user?.id} - IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many downloads',
      message: 'Download limit reached. Please try again in 15 minutes.',
      retry_after: 900
    });
  }
});

/**
 * Asegurar que existe el directorio de caché
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(PDF_CACHE_DIR, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('❌ Error creating cache directory:', error);
    }
  }
}

/**
 * Generar hash único para el caché del PDF
 */
function getPdfCacheKey(paymentId, userId) {
  return crypto
    .createHash('sha256')
    .update(`${paymentId}-${userId}`)
    .digest('hex');
}

// ============================================
// OBTENER HISTORIAL DE PAGOS
// ============================================
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, status } = req.query;

    // Construir query con filtros opcionales
    let query = `
      SELECT 
        pl.id,
        pl.user_email,
        pl.stripe_session_id,
        pl.subscription_id,
        pl.invoice_id,
        pl.payment_intent_id,
        pl.plan_id,
        pl.amount,
        pl.status,
        pl.payment_type,
        pl.failure_reason,
        pl.retry_count,
        pl.email_sent,
        pl.email_sent_at,
        pl.created_at,
        pl.download_count,
        pl.last_download_at,
        s.plan_type,
        s.current_period_end,
        s.next_billing_date,
        c.name as client_name
      FROM payment_logs pl
      JOIN clients c ON pl.user_email = c.email
      LEFT JOIN subscriptions s ON pl.subscription_id = s.stripe_subscription_id
      WHERE c.id = $1
    `;

    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND pl.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY pl.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Obtener total de registros
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM payment_logs pl JOIN clients c ON pl.user_email = c.email WHERE c.id = $1',
      [userId]
    );

    const payments = result.rows.map(payment => ({
      id: payment.id,
      invoice_number: `INV-${payment.id.toString().padStart(6, '0')}`,
      date: payment.created_at,
      plan_name: getPlanName(payment.plan_id),
      amount: (payment.amount / 100).toFixed(2),
      currency: 'EUR',
      status: payment.status,
      payment_type: getPaymentTypeLabel(payment.payment_type),
      invoice_id: payment.invoice_id,
      session_id: payment.stripe_session_id,
      subscription_id: payment.subscription_id,
      email_sent: payment.email_sent,
      download_count: payment.download_count || 0,
      last_download_at: payment.last_download_at,
      can_download: payment.status === 'completed'
    }));

    res.json({
      success: true,
      payments,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + parseInt(limit)) < parseInt(countResult.rows[0].count)
      }
    });

  } catch (error) {
    console.error('❌ Error getting history:', error);
    res.status(500).json({ error: 'Error getting payment history' });
  }
});

// ============================================
// OBTENER RESUMEN DE FACTURACIÓN
// ============================================
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Obtener suscripción activa
    const subscriptionResult = await pool.query(`
      SELECT 
        s.*,
        c.email,
        c.name
      FROM subscriptions s
      JOIN clients c ON s.client_id = c.id
      WHERE s.client_id = $1
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [userId]);

    // Obtener estadísticas de pagos
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_paid,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments
      FROM payment_logs pl
      JOIN clients c ON pl.user_email = c.email
      WHERE c.id = $1
    `, [userId]);

    // Obtener próximo pago
    const subscription = subscriptionResult.rows[0];
    let nextPayment = null;

    if (subscription && subscription.is_active && !subscription.cancel_at_period_end) {
      const planPrices = {
        'starter': 1900,
        'business': 4900,
        'enterprise': 14900
      };

      nextPayment = {
        date: subscription.next_billing_date,
        amount: (planPrices[subscription.plan_type] || 0) / 100,
        plan: getPlanName(subscription.plan_type)
      };
    }

    // Obtener dominios extra activos
    const extraDomainsResult = await pool.query(`
      SELECT COUNT(*) as count, SUM(monthly_price) as total_monthly
      FROM extra_domains
      WHERE client_id = $1 AND status = 'active'
    `, [userId]);

    const stats = statsResult.rows[0];
    const extraDomains = extraDomainsResult.rows[0];

    res.json({
      success: true,
      summary: {
        current_plan: subscription ? {
          name: getPlanName(subscription.plan_type),
          status: subscription.status,
          is_active: subscription.is_active,
          current_period_end: subscription.current_period_end,
          cancel_at_period_end: subscription.cancel_at_period_end,
          domains_allowed: subscription.domains_allowed,
          openings_limit: subscription.openings_limit,
          current_openings_used: subscription.current_openings_used,
          custom_places_limit: subscription.custom_places_limit
        } : null,
        extra_domains: {
          count: parseInt(extraDomains.count || 0),
          monthly_cost: (extraDomains.total_monthly || 0) / 100
        },
        next_payment: nextPayment,
        statistics: {
          total_payments: parseInt(stats.total_payments),
          total_paid: (stats.total_paid / 100).toFixed(2),
          successful_payments: parseInt(stats.successful_payments),
          failed_payments: parseInt(stats.failed_payments)
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting summary:', error);
    res.status(500).json({ error: 'Error getting billing summary' });
  }
});

// ============================================
// GENERAR PDF DE FACTURA (CON PROTECCIONES)
// ============================================
router.get('/invoice/:payment_id/pdf', verifyToken, pdfDownloadLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const paymentId = req.params.payment_id;

    // 1. VERIFICAR PAGO Y LÍMITES EN DB
    const paymentResult = await pool.query(`
      SELECT 
        pl.*,
        c.id as client_id,
        c.name as client_name,
        c.email as client_email,
        s.plan_type,
        s.domains_allowed,
        s.openings_limit,
        s.custom_places_limit,
        COALESCE(pl.download_count, 0) as download_count,
        pl.last_download_at
      FROM payment_logs pl
      JOIN clients c ON pl.user_email = c.email
      LEFT JOIN subscriptions s ON pl.subscription_id = s.stripe_subscription_id
      WHERE pl.id = $1 AND c.id = $2
    `, [paymentId, userId]);

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const payment = paymentResult.rows[0];

    if (payment.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Invalid invoice status',
        message: 'Only completed payments can be downloaded' 
      });
    }

    // Límite de 100 descargas por factura
    if (payment.download_count >= 100) {
      console.warn(`⚠️ Download limit exceeded - Invoice: ${paymentId} - Count: ${payment.download_count}`);
      return res.status(429).json({ 
        error: 'Download limit exceeded',
        message: 'This invoice has reached its download limit (100). Please contact support if you need assistance.'
      });
    }

    // ⭐ INCREMENTAR CONTADOR ANTES DE SERVIR EL PDF
    await pool.query(`
      UPDATE payment_logs 
      SET download_count = COALESCE(download_count, 0) + 1,
          last_download_at = NOW()
      WHERE id = $1
    `, [paymentId]);

    // 2. INTENTAR SERVIR DESDE CACHÉ
    await ensureCacheDir();
    const cacheKey = getPdfCacheKey(paymentId, userId);
    const cachedPdfPath = path.join(PDF_CACHE_DIR, `${cacheKey}.pdf`);

    try {
      const stats = await fs.stat(cachedPdfPath);
      const cacheAge = Date.now() - stats.mtime.getTime();
      const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000; // 30 días

      if (cacheAge < MAX_CACHE_AGE) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${paymentId}.pdf`);
        res.setHeader('X-Cache-Status', 'HIT');
        res.setHeader('X-Download-Count', payment.download_count + 1);
        
        const fileStream = require('fs').createReadStream(cachedPdfPath);
        return fileStream.pipe(res);
      } else {
        await fs.unlink(cachedPdfPath).catch(() => {});
      }
    } catch (error) {
      console.log('📄 Cache not found, generating new PDF');
    }

    // 3. GENERAR PDF Y CACHEAR
    const doc = new PDFDocument({ 
      margin: 50, 
      size: 'A4',
      bufferPages: true
    });

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${paymentId}.pdf`);
    res.setHeader('X-Cache-Status', 'MISS');
    res.setHeader('X-Download-Count', payment.download_count + 1);

    // Escribir a caché y response simultáneamente
    const writeStream = require('fs').createWriteStream(cachedPdfPath);
    
    writeStream.on('error', (error) => {
      console.error('❌ Error writing PDF to cache:', error);
    });

    doc.pipe(writeStream);
    doc.pipe(res);

    // ===== HEADER CON LOGO Y COMPAÑÍA =====
    doc.fontSize(24)
       .fillColor('#00b894')
       .font('Helvetica-Bold')
       .text('myNaturevista', 50, 50);
    
    doc.fontSize(9)
       .fillColor('#666666')
       .font('Helvetica')
       .text('Transform Your Website with Natural Beauty', 50, 80)
       .text('info@mynaturevista.com | www.mynaturevista.com', 50, 93);

    // Línea separadora elegante
    doc.moveTo(50, 115)
       .lineTo(545, 115)
       .lineWidth(2)
       .strokeColor('#00b894')
       .stroke();

    // ===== TÍTULO INVOICE Y DETALLES =====
    doc.fontSize(20)
       .fillColor('#2d3436')
       .font('Helvetica-Bold')
       .text('INVOICE', 400, 135);

    // Box con información de factura
    doc.roundedRect(380, 165, 165, 70, 5)
       .fillAndStroke('#f8f9fa', '#e2e8f0')
       .lineWidth(1);

    doc.fontSize(9)
       .fillColor('#636e72')
       .font('Helvetica')
       .text('Invoice Number:', 390, 175)
       .text('Date:', 390, 195)
       .text('Status:', 390, 215);

    doc.fontSize(10)
       .fillColor('#2d3436')
       .font('Helvetica-Bold')
       .text(`INV-${payment.id.toString().padStart(6, '0')}`, 470, 175)
       .text(new Date(payment.created_at).toLocaleDateString('en-US', {
         year: 'numeric',
         month: 'short', 
         day: 'numeric'
       }), 470, 195);

    // Badge de status
    const statusColor = payment.status === 'completed' ? '#00b894' : '#fdcb6e';
    doc.roundedRect(467, 212, 70, 18, 3)
       .fillAndStroke(statusColor, statusColor);
    
    doc.fontSize(9)
       .fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .text(payment.status.toUpperCase(), 467, 216, { 
         width: 70, 
         align: 'center' 
       });

    // ===== INFORMACIÓN DEL CLIENTE =====
    doc.fontSize(11)
       .fillColor('#2d3436')
       .font('Helvetica-Bold')
       .text('Bill To:', 50, 165);

    doc.fontSize(10)
       .fillColor('#2d3436')
       .font('Helvetica-Bold')
       .text(payment.client_name || 'Client', 50, 190);
    
    doc.fontSize(9)
       .fillColor('#636e72')
       .font('Helvetica')
       .text(payment.client_email, 50, 207);

    // ===== TABLA DE DETALLES =====
    const tableTop = 280;
    
    doc.fontSize(12)
       .fillColor('#2d3436')
       .font('Helvetica-Bold')
       .text('Invoice Details', 50, tableTop - 25);

    // Cabecera de la tabla con gradiente simulado
    doc.rect(50, tableTop, 495, 35)
       .fillAndStroke('#00b894', '#00b894');

    doc.fontSize(10)
       .fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .text('DESCRIPTION', 60, tableTop + 12)
       .text('QUANTITY', 320, tableTop + 12)
       .text('UNIT PRICE', 400, tableTop + 12)
       .text('AMOUNT', 485, tableTop + 12, { align: 'right' });

    // Fila de datos con altura dinámica
    const rowTop = tableTop + 35;
    const rowHeight = 50; // Altura aumentada para textos largos
    
    doc.rect(50, rowTop, 495, rowHeight)
       .fillAndStroke('#ffffff', '#e2e8f0')
       .lineWidth(1);

    // Descripción con wrap
    doc.fontSize(9)
       .fillColor('#2d3436')
       .font('Helvetica')
       .text(getPaymentDescription(payment), 60, rowTop + 10, { 
         width: 240,
         align: 'left',
         lineGap: 3
       });

    // Plan name debajo de la descripción
    doc.fontSize(8)
       .fillColor('#636e72')
       .font('Helvetica')
       .text(getPlanName(payment.plan_id), 60, rowTop + 30, {
         width: 240
       });

    // Cantidad
    doc.fontSize(9)
       .fillColor('#2d3436')
       .font('Helvetica')
       .text('1', 320, rowTop + 18, { width: 60, align: 'center' });

    // Precio unitario
    doc.fontSize(9)
       .fillColor('#2d3436')
       .text(`€${(payment.amount / 100).toFixed(2)}`, 400, rowTop + 18, { 
         width: 70, 
         align: 'right' 
       });

    // Total del item
    doc.fontSize(10)
       .fillColor('#2d3436')
       .font('Helvetica-Bold')
       .text(`€${(payment.amount / 100).toFixed(2)}`, 470, rowTop + 18, { 
         width: 70, 
         align: 'right' 
       });

    // ===== INFORMACIÓN DE CARACTERÍSTICAS DEL PLAN =====
    if (payment.plan_type) {
      const featuresTop = rowTop + rowHeight + 30;
      
      // Box con características
      doc.roundedRect(50, featuresTop, 240, 90, 5)
         .fillAndStroke('#f8f9fa', '#e2e8f0')
         .lineWidth(1);

      doc.fontSize(10)
         .fillColor('#2d3436')
         .font('Helvetica-Bold')
         .text('Plan Features', 65, featuresTop + 15);

      doc.fontSize(9)
         .fillColor('#636e72')
         .font('Helvetica')
         .text(`✓ Allowed domains: ${payment.domains_allowed || 1}`, 65, featuresTop + 38)
         .text(`✓ Monthly openings: ${(payment.openings_limit || 0).toLocaleString('en-US')}`, 65, featuresTop + 55)
         .text(`✓ Custom places: ${payment.custom_places_limit === -1 ? 'Unlimited' : (payment.custom_places_limit || 0)}`, 65, featuresTop + 72);
    }

    // ===== SECCIÓN DE TOTALES =====
    const totalsTop = 620;
    
    // Línea separadora
    doc.moveTo(320, totalsTop)
       .lineTo(545, totalsTop)
       .strokeColor('#e2e8f0')
       .lineWidth(1)
       .stroke();

    // Subtotal
    doc.fontSize(10)
       .fillColor('#636e72')
       .font('Helvetica')
       .text('Subtotal:', 380, totalsTop + 15, { width: 80, align: 'right' });
    
    doc.fontSize(10)
       .fillColor('#2d3436')
       .text(`€${(payment.amount / 100).toFixed(2)}`, 470, totalsTop + 15, { 
         width: 70, 
         align: 'right' 
       });

    // IVA (0% para servicios digitales B2B)
    doc.fontSize(9)
       .fillColor('#636e72')
       .font('Helvetica')
       .text('VAT (0%):', 380, totalsTop + 35, { width: 80, align: 'right' });
    
    doc.fontSize(9)
       .fillColor('#2d3436')
       .text('€0.00', 470, totalsTop + 35, { width: 70, align: 'right' });

    // Línea separadora antes del total
    doc.moveTo(380, totalsTop + 55)
       .lineTo(545, totalsTop + 55)
       .strokeColor('#00b894')
       .lineWidth(2)
       .stroke();

    // TOTAL destacado
    doc.fontSize(12)
       .fillColor('#2d3436')
       .font('Helvetica-Bold')
       .text('TOTAL:', 380, totalsTop + 68, { width: 80, align: 'right' });

    doc.fontSize(16)
       .fillColor('#00b894')
       .font('Helvetica-Bold')
       .text(`€${(payment.amount / 100).toFixed(2)}`, 470, totalsTop + 65, { 
         width: 70, 
         align: 'right' 
       });

    // ===== NOTAS Y TÉRMINOS =====
    const notesTop = 720;
    
    doc.fontSize(8)
       .fillColor('#636e72')
       .font('Helvetica')
       .text('Payment Terms: Due upon receipt | All prices in EUR', 50, notesTop, {
         width: 495,
         align: 'left'
       });

    // ===== FOOTER PROFESIONAL =====
    doc.moveTo(50, 760)
       .lineTo(545, 760)
       .strokeColor('#e2e8f0')
       .lineWidth(1)
       .stroke();

    doc.fontSize(8)
       .fillColor('#95a5a6')
       .font('Helvetica')
       .text('Thank you for your business!', 50, 770, { 
         width: 495, 
         align: 'center' 
       })
       .text('For questions about this invoice, contact info@mynaturevista.com', 50, 783, { 
         width: 495, 
         align: 'center' 
       });

    // Finalizar PDF
    doc.end();

  } catch (error) {
    console.error('❌ Error generating PDF:', error);
    console.error('Error details:', error.stack);
    
    // Limpiar archivo de caché si hubo error
    try {
      const cacheKey = getPdfCacheKey(req.params.payment_id, req.user.id);
      const cachedPdfPath = path.join(PDF_CACHE_DIR, `${cacheKey}.pdf`);
      await fs.unlink(cachedPdfPath);
    } catch {}
    
    res.status(500).json({ error: 'Error generating invoice PDF' });
  }
});

// ============================================
// OBTENER FACTURAS PENDIENTES O FALLIDAS
// ============================================
router.get('/pending', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        pl.*,
        c.name as client_name
      FROM payment_logs pl
      JOIN clients c ON pl.user_email = c.email
      WHERE c.id = $1 AND pl.status IN ('pending', 'failed')
      ORDER BY pl.created_at DESC
    `, [userId]);

    const pendingPayments = result.rows.map(payment => ({
      id: payment.id,
      date: payment.created_at,
      plan: getPlanName(payment.plan_id),
      amount: (payment.amount / 100).toFixed(2),
      status: payment.status,
      failure_reason: payment.failure_reason,
      retry_count: payment.retry_count
    }));

    res.json({
      success: true,
      pending_payments: pendingPayments
    });

  } catch (error) {
    console.error('❌ Error getting pending payments:', error);
    res.status(500).json({ error: 'Error getting pending payments' });
  }
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================
function getPlanName(planId) {
  const plans = {
    'starter': 'Starter',
    'business': 'Business',
    'enterprise': 'Enterprise',
    'additional_domain_starter': 'Additional Domain (Starter)',
    'additional_domain_business': 'Additional Domain (Business)',
    'additional_domain_enterprise': 'Additional Domain (Enterprise)'
  };
  return plans[planId] || planId;
}

function getPaymentTypeLabel(type) {
  const types = {
    'subscription': 'Subscription',
    'recurring': 'Recurring Payment',
    'additional_domain': 'Additional Domain',
    'domain_reactivation': 'Domain Reactivation',
    'upgrade': 'Plan Upgrade'
  };
  return types[type] || type;
}

function getPaymentDescription(payment) {
  if (payment.payment_type === 'subscription') {
    return `New subscription - ${getPlanName(payment.plan_id)} Plan`;
  } else if (payment.payment_type === 'recurring') {
    return `Monthly renewal - ${getPlanName(payment.plan_id)} Plan`;
  } else if (payment.payment_type === 'additional_domain') {
    return `Additional domain purchase`;
  } else if (payment.payment_type === 'domain_reactivation') {
    return `Domain reactivation`;
  }
  return `Payment - ${getPlanName(payment.plan_id)}`;
}

module.exports = router;