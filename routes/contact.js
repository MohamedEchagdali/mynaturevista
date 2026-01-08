// routes/contact.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/config');
const { transporter, generateAdminEmail, generateClientEmail } = require('../services/emailService');
const { sanitizeStrict, sanitizeModerate } = require('../utils/sanitizer');


const router = express.Router();

router.post('/', async (req, res) => {

  // Sanitize input data
  const rawData = req.body;
  const name = sanitizeStrict(rawData.name);
  const email = sanitizeStrict(rawData.email); // Email validated later with regex
  const phone = sanitizeStrict(rawData.phone);
  const plan = sanitizeStrict(rawData.plan);
  const message = sanitizeModerate(rawData.message);
  const subject = sanitizeStrict(rawData.subject);
  const priority = sanitizeStrict(rawData.priority);
  const source = sanitizeStrict(rawData.source);

  const authHeader = req.headers['authorization'];
  
  let isAuthenticatedClient = false;
  let clientData = null;
  let userType = 'visitor';
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      isAuthenticatedClient = true;
      userType = 'client';
      
      try {
        const clientResult = await pool.query(
          `SELECT c.id, c.name, c.email, c.created_at, s.plan_type 
           FROM clients c 
           LEFT JOIN subscriptions s ON c.id = s.client_id AND s.is_active = true
           WHERE c.id = $1`,
          [decoded.id]
        );
        
        if (clientResult.rows.length > 0) {
          clientData = clientResult.rows[0];
        }
      } catch (dbError) {
        console.error('Error getting client data:', dbError);
      }
    } catch (jwtError) {
      console.log('Invalid or expired token:', jwtError.message);
      isAuthenticatedClient = false;
    }
  }

  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Name, email and message are required' 
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid email format' 
    });
  }

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Environment variables EMAIL_USER or EMAIL_PASS not configured');
    return res.status(500).json({
      success: false,
      error: 'Email service not configured'
    });
  }

  try {
    // Email to administrator
    const adminMailOptions = {
      from: `"myNaturevista Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: email,
      subject: isAuthenticatedClient 
        ? `🔐 [CLIENT] ${subject || 'Support Request'} - ${name}`
        : `🌐 [VISITOR] New Contact from ${name}`,
      html: generateAdminEmail(
        isAuthenticatedClient,
        { name, email, phone, plan, message, subject, priority, source },
        clientData
      )
    };

    await transporter.sendMail(adminMailOptions);

    // Email to user/client
    const clientMailOptions = {
      from: `"myNaturevista Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: isAuthenticatedClient 
        ? `🎫 Support Ticket Received - ${subject || 'Your Request'}`
        : '🌿 Thank you for contacting myNaturevista',
      html: generateClientEmail(
        isAuthenticatedClient,
        { name, email, subject, priority },
        clientData
      )
    };

    await transporter.sendMail(clientMailOptions);

    // Save to database if authenticated client
    if (isAuthenticatedClient && clientData) {
      try {
        await pool.query(
          `INSERT INTO contact_messages (client_id, name, email, subject, priority, message, source, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [clientData.id, name, email, subject || 'General', priority || 'low', message, source || 'dashboard']
        );
      } catch (dbError) {
        console.error('Error saving message to database:', dbError);
      }
    }

    res.status(200).json({
      success: true,
      message: isAuthenticatedClient
        ? 'Support ticket created successfully! We\'ll respond within 24 hours.'
        : 'Thank you for your message! We will get back to you soon.',
      ticketId: isAuthenticatedClient ? Date.now().toString(36) : undefined
    });

  } catch (error) {
    console.error('Error sending emails:', error);

    let errorMessage = 'Error sending email. Please try again later.';
    
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
});

module.exports = router;