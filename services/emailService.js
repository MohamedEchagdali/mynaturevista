// services/emailService.js
const nodemailer = require('nodemailer');
const { escapeHtml, sanitizeModerate } = require('../utils/sanitizer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// ============================================
// 🎉 PAYMENT CONFIRMATION EMAIL
// ============================================
async function sendPaymentConfirmationEmail(clientEmail, paymentData) {
  const { 
    planName, 
    amount, 
    sessionId, 
    billingPeriod,
    purchaseDate,
    nextBillingDate,
    domainsAllowed,
    openingsLimit,
    customPlacesLimit
  } = paymentData;

  const formattedAmount = (amount / 100).toFixed(2);
  const billingText = billingPeriod === 'monthly' ? 'Monthly' : 'Annual';

  // 🔥 1️⃣ CLIENT EMAIL (NEW BEAUTIFUL DESIGN)
  const clientMailOptions = {
    from: `"myNaturevista" <${process.env.EMAIL_USER}>`,
    to: clientEmail,
    subject: '🎉 Your subscription is active! - myNaturevista',
    html: `
      <!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }
    .content { padding: 40px 30px; }
    .success-badge { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .success-badge p { margin: 0; color: #065f46; font-size: 16px; line-height: 1.6; }
    .success-badge strong { color: #047857; }
    .info-section { background: #f9fafb; border-radius: 12px; padding: 25px; margin-bottom: 25px; }
    .info-section h2 { color: #1f2937; font-size: 18px; margin: 0 0 20px 0; display: flex; align-items: center; gap: 8px; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table tr { border-bottom: 1px solid #e5e7eb; }
    .info-table tr:last-child { border-bottom: none; }
    .info-table td { padding: 12px 0; font-size: 15px; }
    .info-table td:first-child { color: #6b7280; font-weight: 500; }
    .info-table td:last-child { text-align: right; color: #1f2937; font-weight: 600; }
    .amount-highlight { color: #10b981 !important; font-size: 20px !important; }
    .features-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0; }
    .features-box h3 { color: #92400e; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center; gap: 8px; }
    .features-list { margin: 0; padding-left: 20px; color: #78350f; line-height: 1.8; }
    .features-list li { margin-bottom: 8px; }
    .cta-button { display: block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-align: center; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 30px 0; transition: transform 0.2s; }
    .cta-button:hover { transform: translateY(-2px); }
    .next-steps { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 25px 0; }
    .next-steps h3 { color: #1e40af; margin: 0 0 15px 0; font-size: 16px; }
    .next-steps ul { margin: 0; padding-left: 20px; color: #1e3a8a; line-height: 1.8; }
    .next-steps ul li { margin-bottom: 8px; }
    .billing-info { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0; }
    .billing-info p { margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6; }
    .billing-info strong { color: #7f1d1d; }
    .support-section { border-top: 2px solid #e5e7eb; padding-top: 25px; margin-top: 30px; }
    .support-section p { color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0; }
    .support-section a { color: #10b981; text-decoration: none; font-weight: 600; }
    .footer { background: #f9fafb; text-align: center; padding: 30px; border-top: 1px solid #e5e7eb; }
    .footer p { margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6; }
    @media only screen and (max-width: 600px) {
      .content { padding: 25px 20px !important; }
      .header { padding: 30px 20px !important; }
      .header h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body>
  <div class="container">

    <!-- HEADER -->
    <div class="header">
      <h1>🎉 Subscription Activated!</h1>
      <p>Welcome to myNaturevista ${escapeHtml(planName)}</p>
    </div>

    <!-- CONTENT -->
    <div class="content">

      <!-- SUCCESS MESSAGE -->
      <div class="success-badge">
        <p>
          ✅ <strong>Your payment has been successfully processed!</strong><br>
          Your subscription is now active and you can start enjoying all premium features immediately.
        </p>
      </div>

      <!-- PLAN DETAILS -->
      <div class="info-section">
        <h2>📋 Your Subscription Details</h2>
        <table class="info-table">
          <tr>
            <td>Plan</td>
            <td>${escapeHtml(planName)}</td>
          </tr>
          <tr>
            <td>Billing period</td>
            <td>${escapeHtml(billingText)}</td>
          </tr>
          <tr>
            <td>Amount paid</td>
            <td class="amount-highlight">€${escapeHtml(formattedAmount)}</td>
          </tr>
          <tr>
            <td>Activation date</td>
            <td>${escapeHtml(purchaseDate)}</td>
          </tr>
          <tr>
            <td>Next billing</td>
            <td>${escapeHtml(nextBillingDate || 'Calculating...')}</td>
          </tr>
          <tr>
            <td>Transaction ID</td>
            <td style="font-size: 11px; color: #9ca3af;">${escapeHtml(sessionId)}</td>
          </tr>
        </table>
      </div>

      <!-- PLAN FEATURES -->
      <div class="features-box">
        <h3>🌟 Your plan includes</h3>
        <ul class="features-list">
          <li><strong>${domainsAllowed}</strong> ${domainsAllowed === 1 ? 'authorized domain' : 'authorized domains'}</li>
          <li>Up to <strong>${openingsLimit.toLocaleString()}</strong> widget openings per month</li>
          <li>${
            customPlacesLimit === -1
              ? '<strong>Unlimited custom places</strong>'
              : customPlacesLimit === 0
                ? 'Access to complete places catalog'
                : ('Up to <strong>' + customPlacesLimit + '</strong> custom places')
          }</li>
          <li>Dashboard with real-time statistics</li>
          <li>CSV data export</li>
          <li>Full GDPR compliance</li>
          <li>${escapeHtml(planName) === 'Enterprise' ? 'Premium' : escapeHtml(planName) === 'Business' ? 'Priority (<24h)' : 'Email'} technical support</li>
        </ul>
      </div>

      <!-- BILLING INFO -->
      <div class="billing-info">
        <p>
          🔄 <strong>Auto-renewal activated</strong><br>
          Your subscription will automatically renew on <strong>${escapeHtml(nextBillingDate || 'next month')}</strong>. You can cancel anytime from your dashboard at no additional cost.
        </p>
      </div>

      <!-- NEXT STEPS -->
      <div class="next-steps">
        <h3>🚀 Next steps</h3>
        <ul>
          <li>Set up your <strong>API keys</strong> in the dashboard</li>
          <li>Install the <strong>widget</strong> on your website</li>
          <li>Customize the appearance to match your brand</li>
          <li>Explore the complete catalog of natural places</li>
          ${ (customPlacesLimit > 0 || customPlacesLimit === -1) ? '<li>Create your own <strong>custom places</strong></li>' : '' }
        </ul>
      </div>

      <!-- CTA BUTTON -->
      <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard/dashboard.html" class="cta-button">
        🎯 Go to Dashboard
      </a>

      <!-- SUPPORT -->
      <div class="support-section">
        <p><strong>Need help?</strong></p>
        <p>
          Our team is ready to assist you. If you have any questions about your subscription,
          widget setup, or any other inquiry, don't hesitate to contact us.
        </p>
        <p>
          📧 Email: <a href="mailto:${process.env.SUPPORT_EMAIL || 'info@mynaturevista.com'}">${process.env.SUPPORT_EMAIL || 'info@mynaturevista.com'}</a><br>
          📚 Documentation: <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard/widgetSettings.html">Installation guide</a>
        </p>
      </div>

    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p>
        This email was automatically generated. Please do not reply directly.<br>
        To manage your subscription, visit your dashboard or contact support.<br><br>
        © ${new Date().getFullYear()} myNaturevista. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
    `
  };

  // 🔥 2️⃣ ADMIN EMAIL
  const adminMailOptions = {
    from: `"myNaturevista Notifications" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER, // 🔥 YOUR ADMIN EMAIL
    subject: `💰 New Payment Received - ${planName} Plan`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .highlight { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
          .footer { background: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 New Payment Received!</h1>
            <p>A new customer has subscribed</p>
          </div>
          <div class="content">
            <div class="highlight">
              <h3 style="margin-top: 0;">🎯 Customer Information</h3>
              <p><strong>Email:</strong> ${clientEmail}</p>
              <p><strong>Plan:</strong> ${planName}</p>
              <p><strong>Amount:</strong> €${(amount / 100).toFixed(2)}</p>
            </div>
            
            <h3>📊 Subscription Details:</h3>
            <ul>
              <li><strong>Session ID:</strong> ${sessionId}</li>
              <li><strong>Billing Period:</strong> ${billingPeriod}</li>
              <li><strong>Purchase Date:</strong> ${purchaseDate}</li>
              <li><strong>Next Billing:</strong> ${nextBillingDate}</li>
            </ul>
            
            <h3>✨ Plan Limits:</h3>
            <ul>
              <li><strong>Domains Allowed:</strong> ${domainsAllowed}</li>
              <li><strong>Monthly Openings:</strong> ${openingsLimit.toLocaleString()}</li>
              <li><strong>Custom Places:</strong> ${customPlacesLimit === -1 ? 'Unlimited ♾️' : customPlacesLimit}</li>
            </ul>
            
            <p><strong>⏰ Timestamp:</strong> ${new Date().toLocaleString('en-US')}</p>
          </div>
          <div class="footer">
            <p>🌿 myNaturevista Admin Notifications</p>
            <p style="font-size: 12px; opacity: 0.8;">This is an automated notification</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    
    const [clientResult, adminResult] = await Promise.allSettled([
      transporter.sendMail(clientMailOptions),
      transporter.sendMail(adminMailOptions)
    ]);

    // Check client email result
    if (clientResult.status === 'fulfilled') {
      console.log('✅ Email sent to:', clientEmail);
    } else {
      console.error('❌ Error sending email to client:', clientResult.reason);
    }

    // Check admin email result
    if (adminResult.status === 'fulfilled') {
      console.log('✅ Email sent to administrator');
    } else {
      console.error('❌ Error sending email to administrator:', adminResult.reason);
    }

    // If at least client email was sent, consider it success
    if (clientResult.status === 'fulfilled') {
      return true;
    } else {
      throw new Error('Failed to send client email');
    }

  } catch (error) {
    console.error('❌ Critical error in sendPaymentConfirmationEmail:', error);
    throw error;
  }
}

// ============================================
// 🔥 RECURRING PAYMENT EMAIL
// ============================================
async function sendRecurringPaymentSuccessEmail(clientEmail, paymentData) {
  const { planName, amount, invoiceId, nextBillingDate, paymentDate } = paymentData;

  const mailOptions = {
    from: `"myNaturevista" <${process.env.EMAIL_USER}>`,
    to: clientEmail,
    subject: `✅ Subscription Renewed - ${planName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #00b894, #ff6b6b); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Subscription Renewed</h1>
          </div>
          <div class="content">
            <p>Your subscription has been successfully renewed!</p>
            
            <h3>📋 Payment Details:</h3>
            <ul>
              <li><strong>Plan:</strong> ${planName}</li>
              <li><strong>Amount:</strong> €${(amount / 100).toFixed(2)}</li>
              <li><strong>Payment Date:</strong> ${paymentDate}</li>
              <li><strong>Next Billing:</strong> ${nextBillingDate}</li>
              <li><strong>Invoice ID:</strong> ${invoiceId}</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Renewal email sent to:', clientEmail);
    return true;
  } catch (error) {
    console.error('❌ Error sending renewal email:', error);
    throw error;
  }
}

// ============================================
// 🔥 PAYMENT FAILED EMAIL
// ============================================
async function sendPaymentFailedEmail(clientEmail, paymentData) {
  const { invoiceId, amount, retryDate } = paymentData;

  const mailOptions = {
    from: `"myNaturevista" <${process.env.EMAIL_USER}>`,
    to: clientEmail,
    subject: `⚠️ Payment Failed - Action Required`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b6b, #ee5a6f); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .warning { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Payment Failed</h1>
          </div>
          <div class="content">
            <div class="warning">
              <p><strong>We couldn't process your payment.</strong></p>
              <p>Please update your payment method to continue your subscription.</p>
            </div>
            
            <h3>Details:</h3>
            <ul>
              <li><strong>Amount:</strong> €${(amount / 100).toFixed(2)}</li>
              <li><strong>Invoice ID:</strong> ${invoiceId}</li>
              <li><strong>Retry Date:</strong> ${retryDate}</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Payment failed email sent to:', clientEmail);
    return true;
  } catch (error) {
    console.error('❌ Error sending payment failed email:', error);
    throw error;
  }
}

// ============================================
// 🔥 SUBSCRIPTION CANCELLED EMAIL
// ============================================
async function sendSubscriptionCancelledEmail(clientEmail, cancellationData) {
  const { endDate } = cancellationData;

  const mailOptions = {
    from: `"myNaturevista" <${process.env.EMAIL_USER}>`,
    to: clientEmail,
    subject: `🛑 Subscription Cancelled`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #6c757d, #5a6268); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛑 Subscription Cancelled</h1>
          </div>
          <div class="content">
            <p>Your subscription has been cancelled.</p>
            <p><strong>Access Until:</strong> ${endDate}</p>
            <p>You can reactivate anytime from your dashboard.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Cancellation email sent to:', clientEmail);
    return true;
  } catch (error) {
    console.error('❌ Error sending cancellation email:', error);
    throw error;
  }
}

// ============================================
// GENERATE ADMIN EMAIL
// ============================================
function generateAdminEmail(isClient, data, clientData) {
  const { name, email, phone, plan, message, subject, priority, source } = data;
  
  if (isClient && clientData) {
    // Email for AUTHENTICATED CLIENT
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;
          }
          .client-badge {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
          }
          .priority-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-left: 10px;
          }
          .priority-high { background: #ef4444; color: white; }
          .priority-medium { background: #f59e0b; color: white; }
          .priority-low { background: #10b981; color: white; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
          .field { 
            margin-bottom: 20px; padding: 15px; background: white;
            border-left: 4px solid #667eea; border-radius: 5px;
          }
          .label { font-weight: bold; color: #667eea; font-size: 12px; text-transform: uppercase; }
          .value { color: #333; font-size: 16px; margin-top: 5px; }
          .client-info {
            background: #e0f2fe;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #0ea5e9;
          }
          .footer { 
            background: #333; color: white; padding: 20px;
            text-align: center; border-radius: 0 0 10px 10px; font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">🔐 Client Support Request</h1>
          <span class="client-badge">AUTHENTICATED CLIENT</span>
          <span class="priority-badge priority-${priority || 'low'}">${(priority || 'low').toUpperCase()} PRIORITY</span>
        </div>
        
        <div class="content">
          <div class="client-info">
            <h3 style="margin: 0 0 15px 0; color: #0284c7;">
              <i>👤</i> Client Information
            </h3>
            <p style="margin: 5px 0;"><strong>Client ID:</strong> ${escapeHtml(String(clientData.id))}</p>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${escapeHtml(clientData.name)}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${escapeHtml(clientData.email)}</p>
            <p style="margin: 5px 0;"><strong>Plan:</strong> ${escapeHtml(clientData.plan_type || 'Free')}</p>
            <p style="margin: 5px 0;"><strong>Member Since:</strong> ${new Date(clientData.created_at).toLocaleDateString()}</p>
            <p style="margin: 5px 0;"><strong>Source:</strong> ${escapeHtml(source || 'Dashboard')}</p>
          </div>

          <div class="field">
            <span class="label">📋 Subject</span>
            <div class="value">${escapeHtml(subject || 'General Support')}</div>
          </div>
          
          <div class="field">
            <span class="label">💬 Message</span>
            <div class="value">${sanitizeModerate(message).replace(/\n/g, '<br>')}</div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e0e0e0; text-align: center;">
            <p style="margin: 0; color: #666;">
              <strong>⏰ Received:</strong> ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">⚡ Client Support System - myNaturevista</p>
        </div>
      </body>
      </html>
    `;
  } else {
    // Email for VISITOR (Landing Page)
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; }
          .header { 
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;
          }
          .visitor-badge {
            display: inline-block;
            background: #f59e0b;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-top: 10px;
          }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; }
          .field { 
            margin-bottom: 20px; padding: 15px; background: white;
            border-left: 4px solid #10b981; border-radius: 5px;
          }
          .label { font-weight: bold; color: #10b981; font-size: 12px; text-transform: uppercase; }
          .value { color: #333; font-size: 16px; margin-top: 5px; }
          .footer { 
            background: #333; color: white; padding: 20px;
            text-align: center; border-radius: 0 0 10px 10px; font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">🌐 New Landing Page Contact</h1>
          <span class="visitor-badge">VISITOR / POTENTIAL CLIENT</span>
        </div>
        
        <div class="content">
          <div class="field">
            <span class="label">👤 Name</span>
            <div class="value">${escapeHtml(name)}</div>
          </div>

          <div class="field">
            <span class="label">📧 Email</span>
            <div class="value"><a href="mailto:${escapeHtml(email)}" style="color: #10b981;">${escapeHtml(email)}</a></div>
          </div>

          ${phone ? `
          <div class="field">
            <span class="label">📱 Phone</span>
            <div class="value">${escapeHtml(phone)}</div>
          </div>
          ` : ''}

          ${plan ? `
          <div class="field">
            <span class="label">💼 Interested Plan</span>
            <div class="value" style="text-transform: capitalize; font-weight: 600;">${escapeHtml(plan)}</div>
          </div>
          ` : ''}
          
          <div class="field">
            <span class="label">💬 Message</span>
            <div class="value">${sanitizeModerate(message).replace(/\n/g, '<br>')}</div>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e0e0e0; text-align: center;">
            <p style="margin: 0; color: #666;">
              <strong>⏰ Received:</strong> ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">🌿 Landing Page Contact System</p>
        </div>
      </body>
      </html>
    `;
  }
}

// ============================================
// GENERATE CLIENT EMAIL
// ============================================
function generateClientEmail(isClient, data, clientData) {
  const { name, email, subject, priority } = data;
  
  if (isClient && clientData) {
    // Email for AUTHENTICATED CLIENT
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 40px 30px; border-radius: 10px 10px 0 0; text-align: center;
          }
          .content { background: white; padding: 40px 30px; border: 1px solid #e0e0e0; }
          .ticket-box {
            background: #f0f4ff;
            border: 2px solid #667eea;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin-top: 20px;
          }
          .footer { 
            background: #f9f9f9; padding: 30px; text-align: center;
            border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 32px;">🎫 Support Ticket Created</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">We're on it!</p>
        </div>
        
        <div class="content">
          <p style="font-size: 16px;">Hi <strong>${name}</strong>,</p>
          
          <p style="font-size: 16px;">
            Thank you for reaching out to our support team. We've received your request and our team is already working on it.
          </p>
          
          <div class="ticket-box">
            <p style="margin: 0 0 10px 0; color: #667eea; font-weight: bold;">
              📋 TICKET DETAILS
            </p>
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject || 'General Support'}</p>
            <p style="margin: 5px 0;"><strong>Priority:</strong> <span style="text-transform: uppercase; color: ${priority === 'high' ? '#ef4444' : priority === 'medium' ? '#f59e0b' : '#10b981'};">${priority || 'low'}</span></p>
            <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #f59e0b;">⏳ In Progress</span></p>
          </div>
          
          <p style="font-size: 16px;">
            <strong>⏰ Expected Response Time:</strong><br>
            ${priority === 'high' ? '2-4 hours' : priority === 'medium' ? '4-8 hours' : '24 hours'}
          </p>
          
          <div style="text-align: center;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard/contact.html" class="button">
              View Dashboard
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
            <strong>Need immediate assistance?</strong>
          </p>
          <p style="margin: 0; font-size: 14px; color: #666;">
            📧 <a href="mailto:info@mynaturevista.com" style="color: #667eea;">info@mynaturevista.com</a>
          </p>
          <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} myNaturevista. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;
  } else {
    // Email for VISITOR
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 40px 30px; border-radius: 10px 10px 0 0; text-align: center;
          }
          .content { background: white; padding: 40px 30px; border: 1px solid #e0e0e0; }
          .highlight-box {
            background: #f0f4ff;
            border-left: 4px solid #667eea;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
          .footer { 
            background: #f9f9f9; padding: 30px; text-align: center;
            border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 32px;">🌿 Thank You!</h1>
          <p style="margin: 15px 0 0 0; font-size: 18px;">We've received your message</p>
        </div>
        
        <div class="content">
          <p style="font-size: 16px;">Hi <strong>${name}</strong>,</p>
          
          <p style="font-size: 16px;">
            Thank you for reaching out to myNaturevista! We're excited to hear from you.
          </p>
          
          <div class="highlight-box">
            <p style="margin: 0; font-size: 15px;">
              <strong>📋 What happens next?</strong><br>
              Our team will review your message and get back to you within <strong>24-48 hours</strong> at: <strong>${email}</strong>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard/loginSignup.html" class="button">
              Create Free Account
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">
            <strong>Questions?</strong>
          </p>
          <p style="margin: 0; font-size: 14px; color: #666;">
            📧 <a href="mailto:info@mynaturevista.com" style="color: #667eea;">info@mynaturevista.com</a>
          </p>
          <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} myNaturevista. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;
  }
}


// ============================================
// EXPORT FUNCTIONS
// ============================================
module.exports = {
  emailTransporter: transporter,
  sendPaymentConfirmationEmail,
  sendRecurringPaymentSuccessEmail,
  sendPaymentFailedEmail,
  generateAdminEmail,
  generateClientEmail,
  sendSubscriptionCancelledEmail
};