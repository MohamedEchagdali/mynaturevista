// controllers/contactController.js info@mynaturevista.com
const transporter = require('../config/email');
const { sanitizeModerate, escapeHtml, sanitizeStrict } = require('../utils/sanitizer');
const { pool } = require('../db/config');

/**
 * Handle contact form submission from landing page
 * No authentication required - open to public visitors
 */
const submitLandingContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        error: 'All fields are required' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Please provide a valid email address' 
      });
    }

    // Length validation
    if (name.length > 100 || subject.length > 200 || message.length > 2000) {
      return res.status(400).json({ 
        error: 'One or more fields exceed maximum length' 
      });
    }

    // Prepare email to admin
    const adminMailOptions = {
      from: `"myNaturevista Landing Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `🌐 New Landing Page Contact - ${escapeHtml(subject)}`,
      html: generateAdminEmail(name, email, subject, message)
    };

    // Prepare confirmation email to visitor
    const visitorMailOptions = {
      from: `"myNaturevista" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🌿 Thank You for Contacting myNaturevista',
      html: generateVisitorEmail(name)
    };

    // Send both emails in parallel
    const [adminResult, visitorResult] = await Promise.allSettled([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(visitorMailOptions)
    ]);

    // Log results
    if (adminResult.status === 'fulfilled') {
      if (process.env.NODE_ENV === 'development') {
        console.log('Admin notification email sent');
      }
    } else {
      console.error('Failed to send admin email:', adminResult.reason);
    }

    if (visitorResult.status === 'fulfilled') {
      if (process.env.NODE_ENV === 'development') {
        console.log('Visitor confirmation email sent to:', email);
      }
    } else {
      console.error('Failed to send visitor email:', visitorResult.reason);
    }

    // Return success if at least admin email was sent
    if (adminResult.status === 'fulfilled') {
      res.status(200).json({ 
        message: 'Thank you for your message! We will get back to you within 24-48 hours.' 
      });
    } else {
      throw new Error('Failed to send notification emails');
    }

  } catch (error) {
    console.error('Error in submitLandingContact:', error);
    res.status(500).json({
      error: 'An error occurred while sending your message. Please try again later.'
    });
  }
};
/**
 * Handle contact form submission from authenticated dashboard users
 * Authentication required via JWT token
 */
const submitDashboardContact = async (req, res) => {
  try {
    const { name, email, subject, priority, message, source } = req.body;

    // req.user comes from authenticateToken middleware
    const userId = req.user.id;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Name, email, subject and message are required' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false,
        error: 'Please provide a valid email address' 
      });
    }

    // Length validation
    if (name.length > 100 || subject.length > 200 || message.length > 2000) {
      return res.status(400).json({ 
        success: false,
        error: 'One or more fields exceed maximum length' 
      });
    }

    const clientDbResult = await pool.query(
      `SELECT c.id, c.name, c.email, c.created_at, s.plan_type 
       FROM clients c 
       LEFT JOIN subscriptions s ON c.id = s.client_id AND s.is_active = true
       WHERE c.id = $1`,
      [userId]
    );

    if (clientDbResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Client not found' 
      });
    }

    const clientData = clientDbResult.rows[0];

    // Prepare email to administrator
    const adminMailOptions = {
      from: `"myNaturevista Dashboard Support" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: `🔐 [CLIENT] ${sanitizeStrict(subject)} - ${sanitizeStrict(name)}`,
      html: generateClientSupportEmail(
        name, 
        email, 
        subject, 
        priority || 'low', 
        message, 
        source || 'dashboard',
        clientData
      )
    };

    // Prepare confirmation email to client
    const clientMailOptions = {
      from: `"myNaturevista Support Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🎫 Support Ticket Received - ${sanitizeStrict(subject)}`,
      html: generateClientConfirmationEmail(name, subject, priority || 'low')
    };

    const [adminResult, clientResult] = await Promise.allSettled([
      transporter.sendMail(adminMailOptions),
      transporter.sendMail(clientMailOptions)
    ]);

    // Log results
    if (adminResult.status === 'fulfilled') {
      if (process.env.NODE_ENV === 'development') {
        console.log('Support ticket notification sent to admin');
      }
    } else {
      console.error('Failed to send admin support email:', adminResult.reason);
    }

    if (clientResult.status === 'fulfilled') {
      if (process.env.NODE_ENV === 'development') {
        console.log('Support confirmation email sent to client:', email);
      }
    } else {
      console.error('Failed to send client confirmation:', clientResult.reason);
    }

    // Save the ticket to the database
    try {
      await pool.query(
        `INSERT INTO contact_messages (client_id, name, email, subject, priority, message, source, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          clientData.id,
          sanitizeStrict(name),
          sanitizeStrict(email),
          sanitizeStrict(subject),
          sanitizeStrict(priority) || 'low',
          sanitizeModerate(message),
          sanitizeStrict(source) || 'dashboard'
        ]
      );
      if (process.env.NODE_ENV === 'development') {
        console.log('Support ticket saved to database');
      }
    } catch (dbError) {
      console.error('Error saving ticket to database:', dbError);
      // Don't block the response if database save fails
    }

    // Return success if at least admin email was sent
    if (adminResult.status === 'fulfilled') {
      res.status(200).json({ 
        success: true,
        message: 'Support ticket created successfully! We\'ll respond within 24 hours.',
        ticketId: Date.now().toString(36)
      });
    } else {
      throw new Error('Failed to send support ticket notification');
    }

  } catch (error) {
    console.error('Error in submitDashboardContact:', error);

    let errorMessage = 'Error sending support ticket. Please try again later.';

    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please contact administrator.';
    } else if (error.code === 'ESOCKET') {
      errorMessage = 'Network error. Please check your connection.';
    }

    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
};
/**
 * Generate email HTML for admin notification (landing page)
 */
function generateAdminEmail(name, email, subject, message) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          max-width: 600px; 
          margin: 0 auto;
          background: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white; 
          padding: 30px; 
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        .visitor-badge {
          display: inline-block;
          background: rgba(255,255,255,0.2);
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          margin-top: 10px;
        }
        .content { 
          padding: 30px;
          background: white;
        }
        .field { 
          margin-bottom: 20px; 
          padding: 15px; 
          background: #f8f9fa;
          border-left: 4px solid #00b894; 
          border-radius: 5px;
        }
        .label { 
          font-weight: 600; 
          color: #00b894; 
          font-size: 12px; 
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .value { 
          color: #2d3436; 
          font-size: 16px; 
          margin-top: 5px;
          word-wrap: break-word;
        }
        .message-box {
          background: white;
          border: 1px solid #e0e0e0;
          padding: 20px;
          border-radius: 8px;
          line-height: 1.6;
        }
        .footer { 
          background: #2d3436; 
          color: white; 
          padding: 20px;
          text-align: center; 
          font-size: 12px;
        }
        .timestamp {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #e0e0e0;
          text-align: center;
          color: #636e72;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌐 New Landing Page Contact</h1>
          <span class="visitor-badge">VISITOR / POTENTIAL CLIENT</span>
        </div>
        
        <div class="content">
          <div class="field">
            <div class="label">👤 Name</div>
            <div class="value">${escapeHtml(name)}</div>
          </div>

          <div class="field">
            <div class="label">📧 Email</div>
            <div class="value">
              <a href="mailto:${escapeHtml(email)}" style="color: #00b894; text-decoration: none;">
                ${escapeHtml(email)}
              </a>
            </div>
          </div>
          
          <div class="field">
            <div class="label">📋 Subject</div>
            <div class="value">${escapeHtml(subject)}</div>
          </div>
          
          <div class="field">
            <div class="label">💬 Message</div>
            <div class="message-box">${sanitizeModerate(message).replace(/\n/g, '<br>')}</div>
          </div>
          
          <div class="timestamp">
            <strong>⏰ Received:</strong> ${new Date().toLocaleString('en-US', { 
              dateStyle: 'full', 
              timeStyle: 'long' 
            })}
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">🌿 myNaturevista Landing Page Contact System</p>
          <p style="margin: 5px 0 0 0; opacity: 0.8;">This is an automated notification</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate email HTML for admin notification (client support ticket)
 */
function generateClientSupportEmail(name, email, subject, priority, message, source, clientData) {
  const priorityColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444'
  };

  const priorityColor = priorityColors[priority] || '#10b981';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          max-width: 600px; 
          margin: 0 auto;
          background: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #ff6b6b 0%, #326359 100%);
          color: white; 
          padding: 30px; 
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        .client-badge {
          display: inline-block;
          background: rgba(255,255,255,0.2);
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          margin-top: 10px;
        }
        .priority-badge {
          display: inline-block;
          background: ${priorityColor};
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: bold;
          margin-left: 10px;
        }
        .content { 
          padding: 30px;
          background: white;
        }
        .field { 
          margin-bottom: 20px; 
          padding: 15px; 
          background: #f8f9fa;
          border-left: 4px solid #326359; 
          border-radius: 5px;
        }
        .label { 
          font-weight: 600; 
          color: #54af9dff; 
          font-size: 12px; 
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .value { 
          color: #2d3436; 
          font-size: 16px; 
          margin-top: 5px;
          word-wrap: break-word;
        }
        .message-box {
          background: white;
          border: 1px solid #e0e0e0;
          padding: 20px;
          border-radius: 8px;
          line-height: 1.6;
        }
        .client-info {
          background: #e8eaf6;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .footer { 
          background: #2d3436; 
          color: white; 
          padding: 20px;
          text-align: center; 
          font-size: 12px;
        }
        .timestamp {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #e0e0e0;
          text-align: center;
          color: #636e72;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Client Support Ticket</h1>
          <span class="client-badge">AUTHENTICATED CLIENT</span>
          <span class="priority-badge">${priority.toUpperCase()} PRIORITY</span>
        </div>
        
        <div class="content">
          <div class="client-info">
            <strong>👤 Client Information:</strong><br>
            📧 Email: ${escapeHtml(clientData.email)}<br>
            📦 Plan: ${escapeHtml(clientData.plan_type || 'Free')}<br>
            📅 Member since: ${new Date(clientData.created_at).toLocaleDateString()}<br>
            🆔 Client ID: ${clientData.id}
          </div>

          <div class="field">
            <div class="label">👤 Name</div>
            <div class="value">${escapeHtml(name)}</div>
          </div>
          
          <div class="field">
            <div class="label">📋 Subject</div>
            <div class="value">${escapeHtml(subject)}</div>
          </div>

          <div class="field">
            <div class="label">📍 Source</div>
            <div class="value">${escapeHtml(source)}</div>
          </div>
          
          <div class="field">
            <div class="label">💬 Message</div>
            <div class="message-box">${sanitizeModerate(message).replace(/\n/g, '<br>')}</div>
          </div>
          
          <div class="timestamp">
            <strong>⏰ Received:</strong> ${new Date().toLocaleString('en-US', { 
              dateStyle: 'full', 
              timeStyle: 'long' 
            })}
          </div>
        </div>
        
        <div class="footer">
          <p style="margin: 0;">🌿 myNaturevista Client Support System</p>
          <p style="margin: 5px 0 0 0; opacity: 0.8;">Reply directly to this email to respond to the client</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate confirmation email HTML for visitor (landing page)
 */
function generateVisitorEmail(name) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 600px; 
          margin: 0 auto;
          background: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white; 
          padding: 40px 30px; 
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content { 
          padding: 40px 30px;
          background: white;
        }
        .content p {
          font-size: 16px;
          line-height: 1.6;
          color: #2d3436;
          margin-bottom: 15px;
        }
        .highlight-box {
          background: #d1f4e0;
          border-left: 4px solid #00b894;
          padding: 20px;
          margin: 25px 0;
          border-radius: 5px;
        }
        .highlight-box p {
          margin: 0;
          font-size: 15px;
          color: #00695c;
        }
        .button {
          display: inline-block;
          padding: 15px 30px;
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          color: white;
          text-decoration: none;
          border-radius: 5px;
          font-weight: 600;
          margin-top: 20px;
        }
        .button:hover {
          opacity: 0.9;
        }
        .center {
          text-align: center;
        }
        .footer { 
          background: #f8f9fa; 
          padding: 30px; 
          text-align: center;
          border-top: 1px solid #e0e0e0;
        }
        .footer p {
          margin: 5px 0;
          font-size: 14px;
          color: #636e72;
        }
        .footer a {
          color: #00b894;
          text-decoration: none;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌿 Thank You!</h1>
          <p>We've received your message</p>
        </div>
        
        <div class="content">
          <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
          
          <p>
            Thank you for reaching out to <strong>myNaturevista</strong>! We're excited to hear from you and appreciate your interest in our platform.
          </p>
          
          <div class="highlight-box">
            <p>
              <strong>📋 What happens next?</strong><br><br>
              Our team will review your message carefully and get back to you within <strong>24-48 hours</strong> with a detailed response.
            </p>
          </div>
          
          <p>
            In the meantime, feel free to explore our features and see how myNaturevista can transform your website with stunning natural places from around the world.
          </p>
          
          <div class="center">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard/loginSignup.html" class="button">
              Create Free Account
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Questions or need immediate assistance?</strong></p>
          <p>
            📧 Email: <a href="mailto:${process.env.SUPPORT_EMAIL || 'info@mynaturevista.com'}">
              ${process.env.SUPPORT_EMAIL || 'info@mynaturevista.com'}
            </a>
          </p>
          <p style="margin-top: 20px; font-size: 12px; color: #95a5a6;">
            © ${new Date().getFullYear()} myNaturevista. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate confirmation email HTML for authenticated client
 */
function generateClientConfirmationEmail(name, subject, priority) {
  const priorityEmoji = {
    low: '🟢',
    medium: '🟡',
    high: '🔴'
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 600px; 
          margin: 0 auto;
          background: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
          background: linear-gradient(135deg, #ff6b6b 0%, #326359 100%);
          color: white; 
          padding: 40px 30px; 
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content { 
          padding: 40px 30px;
          background: white;
        }
        .content p {
          font-size: 16px;
          line-height: 1.6;
          color: #2d3436;
          margin-bottom: 15px;
        }
        .ticket-box {
          background: #e8eaf6;
          border-left: 4px solid #326359;
          padding: 20px;
          margin: 25px 0;
          border-radius: 5px;
        }
        .ticket-box p {
          margin: 8px 0;
          font-size: 15px;
          color: #1c6b5bff;
        }
        .highlight-box {
          background: #fff9db;
          border-left: 4px solid #ffd54f;
          padding: 20px;
          margin: 25px 0;
          border-radius: 5px;
        }
        .highlight-box p {
          margin: 0;
          font-size: 15px;
          color: #f57c00;
        }
        .button {
          display: inline-block;
          padding: 15px 30px;
          background: linear-gradient(135deg, #3f7a6eff 0%, #ff7c7cff 100%);
          color: white;
          text-decoration: none;
          border-radius: 5px;
          font-weight: 600;
          margin-top: 20px;
        }
        .center {
          text-align: center;
        }
        .footer { 
          background: #f8f9fa; 
          padding: 30px; 
          text-align: center;
          border-top: 1px solid #e0e0e0;
        }
        .footer p {
          margin: 5px 0;
          font-size: 14px;
          color: #636e72;
        }
        .footer a {
          color: #f15d5dff;
          text-decoration: none;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎫 Support Ticket Received</h1>
          <p>We're on it!</p>
        </div>
        
        <div class="content">
          <p>Hi <strong>${escapeHtml(name)}</strong>,</p>
          
          <p>
            Thank you for contacting our support team. We've successfully received your support ticket and our team is already reviewing it.
          </p>
          
          <div class="ticket-box">
            <p><strong>📋 Your Ticket Details:</strong></p>
            <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
            <p><strong>Priority:</strong> ${priorityEmoji[priority] || '🟢'} ${priority.charAt(0).toUpperCase() + priority.slice(1)}</p>
            <p><strong>Status:</strong> Open</p>
          </div>
          
          <div class="highlight-box">
            <p>
              <strong>⏰ Response Time:</strong><br><br>
              Based on your ticket priority, our support team will respond within <strong>24 hours</strong>. For high-priority issues, we typically respond much faster!
            </p>
          </div>
          
          <p>
            We'll send all updates and responses to this email address. Please make sure to check your inbox regularly.
          </p>
          
          <div class="center">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/dashboard/dashboard.html" class="button">
              Go to Dashboard
            </a>
          </div>
        </div>
        
        <div class="footer">
          <p><strong>Need to add more information?</strong></p>
          <p>
            Simply reply to this email with additional details about your issue.
          </p>
          <p style="margin-top: 20px; font-size: 12px; color: #95a5a6;">
            © ${new Date().getFullYear()} myNaturevista Support Team. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  submitLandingContact,
  submitDashboardContact
};