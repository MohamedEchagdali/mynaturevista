const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Email configuration
const { emailTransporter } = require('../services/emailService');

// Main controller for data request
exports.submitDataRequest = async (req, res) => {
  try {
    const { email, reason } = req.body;
    const userId = req.user.id;

    // Basic validation
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Verify that the email matches the authenticated user
    if (normalizedEmail !== req.user.email.toLowerCase()) {
      return res.status(403).json({
        error: 'Email must match your registered account email'
      });
    }

    const requestId = crypto.randomUUID();

    // Save the request to the database
    const insertQuery = `
      INSERT INTO gdpr_requests (id, user_id, email, reason, status, created_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, 'pending', NOW(), $5, $6)
    `;
    
    await pool.query(insertQuery, [
      requestId,
      userId,
      normalizedEmail,
      reason,
      req.ip,
      req.get('User-Agent')
    ]);

    // Process the request asynchronously
    processDataRequest(req.user, requestId).catch(error => {
      console.error('Error processing GDPR request:', error);
    });

    res.status(200).json({
      message: 'Data request submitted successfully. You will receive an email with your data within 30 days.',
      requestId: requestId
    });

  } catch (error) {
    console.error('GDPR Data Request Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Controller to get request status
exports.getRequestStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT id, status, created_at, completed_at, reason
      FROM gdpr_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      requests: result.rows
    });

  } catch (error) {
    console.error('Error fetching request status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Function to process data request (asynchronous)
async function processDataRequest(user, requestId) {
  try {
    // Update status to "processing"
    await pool.query(
      'UPDATE gdpr_requests SET status = $1 WHERE id = $2',
      ['processing', requestId]
    );

    // Collect all user data
    const userData = await collectUserData(user.id);

    // Generate file with data
    const dataExport = {
      request_id: requestId,
      generated_at: new Date().toISOString(),
      user_information: {
        basic_info: {
          id: user.id,
          email: user.email,
          username: user.username || user.name,
          created_at: user.created_at
        },
        ...userData
      },
      gdpr_compliance: {
        legal_basis: 'Processing based on contract performance and legitimate interests',
        data_sources: [
          'clients',
          'subscriptions',
          'api_keys',
          'places',
          'api_usage',
          'widget_usage',
          'payment_logs',
          'gdpr_requests',
          'password_reset_tokens'
        ],
        retention_policy: 'Data is retained as per our Privacy Policy. Personal data is stored while your account is active and for legal compliance purposes.',
        data_recipients: 'Your data may be shared with payment processors, email service providers, and hosting services as necessary to provide our services.',
        automated_decision_making: 'No automated decision-making or profiling is performed on your data.',
        international_transfers: 'Your data may be transferred to and processed in countries outside the EU with adequate protection measures.',
        contact_info: 'info@mynaturevista.com',
        data_protection_officer: 'For data protection inquiries, contact: info@mynaturevista.com',
        your_rights: [
          'Right to access - You can request a copy of your personal data (Article 15)',
          'Right to rectification - You can request correction of inaccurate data (Article 16)',
          'Right to erasure - You can request deletion of your data (Article 17)',
          'Right to restriction - You can request restriction of processing (Article 18)',
          'Right to data portability - You can request data in a portable format (Article 20)',
          'Right to object - You can object to processing of your data (Article 21)',
          'Right to withdraw consent - You can withdraw consent at any time',
          'Right to lodge a complaint - You can file a complaint with a supervisory authority'
        ],
        data_categories: {
          identity_data: ['Name', 'Email', 'User ID'],
          contact_data: ['Email', 'Phone', 'Addresses'],
          account_data: ['Username', 'API Keys', 'Domain'],
          usage_data: ['API Usage Logs', 'Widget Usage', 'Activity Logs'],
          financial_data: ['Payment Logs', 'Subscription Information'],
          technical_data: ['IP Addresses', 'Browser Information', 'Device Information']
        }
      }
    };

    // Send email with data
    await sendDataEmail(user.email, dataExport, requestId);

    // Update status to "completed"
    await pool.query(
      'UPDATE gdpr_requests SET status = $1, completed_at = NOW() WHERE id = $2',
      ['completed', requestId]
    );

  } catch (error) {
    console.error('Error processing data request:', error);

    // Mark as error
    await pool.query(
      'UPDATE gdpr_requests SET status = $1, error_message = $2 WHERE id = $3',
      ['error', error.message, requestId]
    );
  }
}

// Function to collect user data
async function collectUserData(userId) {
  const data = {};

  // 1. Basic client data
  try {
    const clientResult = await pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [userId]
    );
    if (clientResult.rows.length > 0) {
      data.client_profile = clientResult.rows[0];
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.log('clients table:', error.message);
    }
    data.client_profile = null;
  }

  // 2. API Keys
  try {
    const apiKeysResult = await pool.query(
      'SELECT * FROM api_keys WHERE client_id = $1',
      [userId]
    );
    data.api_keys = apiKeysResult.rows;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.log('api_keys table:', error.message);
    }
    data.api_keys = [];
  }

  // 3. Subscriptions
  try {
    const subscriptionsResult = await pool.query(
      'SELECT * FROM subscriptions WHERE client_id = $1',
      [userId]
    );
    data.subscriptions = subscriptionsResult.rows;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.log('subscriptions table:', error.message);
    }
    data.subscriptions = [];
  }

  // 4. Custom places
  try {
    const customPlacesResult = await pool.query(
      'SELECT * FROM client_custom_places WHERE client_id = $1',
      [userId]
    );
    data.custom_places = customPlacesResult.rows;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.log('client_custom_places table:', error.message);
    }
    data.custom_places = [];
  }

  // 5. API usage
  try {
    const apiUsageResult = await pool.query(
      `SELECT * FROM api_usage
       WHERE client_id = $1
       ORDER BY created_at DESC
       LIMIT 1000`,
      [userId]
    );
    data.api_usage_logs = {
      total_records: apiUsageResult.rows.length,
      records: apiUsageResult.rows
    };
  } catch (error) {
    try {
      // Try with timestamp instead of created_at
      const apiUsageResult = await pool.query(
        `SELECT * FROM api_usage
         WHERE client_id = $1
         ORDER BY timestamp DESC
         LIMIT 1000`,
        [userId]
      );
      data.api_usage_logs = {
        total_records: apiUsageResult.rows.length,
        records: apiUsageResult.rows
      };
    } catch (error2) {
      if (process.env.NODE_ENV === 'development') {
        console.log('api_usage table:', error2.message);
      }
      data.api_usage_logs = { records: [] };
    }
  }

  // 6. Widget usage
  try {
    const widgetUsageResult = await pool.query(
      `SELECT * FROM widget_usage
       WHERE client_id = $1
       ORDER BY created_at DESC
       LIMIT 1000`,
      [userId]
    );
    data.widget_usage_logs = {
      total_records: widgetUsageResult.rows.length,
      records: widgetUsageResult.rows
    };
  } catch (error) {
    try {
      // Try with timestamp instead of created_at
      const widgetUsageResult = await pool.query(
        `SELECT * FROM widget_usage
         WHERE client_id = $1
         ORDER BY timestamp DESC
         LIMIT 1000`,
        [userId]
      );
      data.widget_usage_logs = {
        total_records: widgetUsageResult.rows.length,
        records: widgetUsageResult.rows
      };
    } catch (error2) {
      if (process.env.NODE_ENV === 'development') {
        console.log('widget_usage table:', error2.message);
      }
      data.widget_usage_logs = { records: [] };
    }
  }

  // 7. Payment logs (search by client email)
  try {
    // First get the client email
    const clientEmail = data.client_profile?.email;

    if (clientEmail) {
      // Search by email instead of client_id
      const paymentLogsResult = await pool.query(
        'SELECT * FROM payment_logs WHERE client_email = $1 ORDER BY created_at DESC',
        [clientEmail]
      );
      data.payment_logs = paymentLogsResult.rows;
    } else {
      // If no email, fetch all payment_logs (less recommended)
      if (process.env.NODE_ENV === 'development') {
        console.log('No client email found, fetching all payment logs');
      }
      const paymentLogsResult = await pool.query(
        'SELECT * FROM payment_logs ORDER BY created_at DESC LIMIT 100'
      );
      data.payment_logs = paymentLogsResult.rows;
    }
  } catch (error) {
    // If fails with client_email, try with stripe_customer_id
    try {
      const stripeCustomerId = data.subscriptions?.[0]?.stripe_customer_id;
      if (stripeCustomerId) {
        const paymentLogsResult = await pool.query(
          'SELECT * FROM payment_logs WHERE stripe_customer_id = $1 ORDER BY created_at DESC',
          [stripeCustomerId]
        );
        data.payment_logs = paymentLogsResult.rows;
      } else {
        throw new Error('No stripe_customer_id found');
      }
    } catch (error2) {
      if (process.env.NODE_ENV === 'development') {
        console.log('payment_logs table:', error2.message);
      }
      data.payment_logs = [];
    }
  }

  // 8. GDPR history
  try {
    const gdprHistoryResult = await pool.query(
      'SELECT * FROM gdpr_requests WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    data.gdpr_requests_history = gdprHistoryResult.rows;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.log('gdpr_requests table:', error.message);
    }
    data.gdpr_requests_history = [];
  }

  // 9. Password reset tokens
  try {
    const passwordResetResult = await pool.query(
      'SELECT id, created_at, expires_at, used_at FROM password_reset_tokens WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    data.password_reset_tokens = passwordResetResult.rows;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.log('password_reset_tokens table:', error.message);
    }
    data.password_reset_tokens = [];
  }

  // 10. Aggregated statistics
  data.statistics = {
    total_api_calls: data.api_usage_logs?.records?.length || 0,
    total_widget_uses: data.widget_usage_logs?.records?.length || 0,
    total_payments: data.payment_logs?.length || 0,
    active_subscriptions: data.subscriptions?.filter(s => s.is_active)?.length || 0,
    active_api_keys: data.api_keys?.filter(k => k.is_active)?.length || 0,
    registered_custom_places: data.custom_places?.length || 0
  };

  return data;
}

// Function to send professional and attractive email
async function sendDataEmail(email, dataExport, requestId) {
  try {
    const emailContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Personal Data Export</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7fa; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #ff6b6b 0%, #326359 100%); padding: 40px 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">🔒 Your Data Export is Ready</h1>
                    <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">GDPR Compliance - Article 15</p>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #3e635bff; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hello,
                    </p>
                    
                    <p style="color: #3e635bff; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      As requested, we've prepared a complete export of all personal data we have stored about you in our system. This includes your account information, usage history, and all related data.
                    </p>
                    
                    <!-- Info Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-left: 4px solid #64d1b9ff; border-radius: 8px; margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color: #6b7280; font-size: 14px; padding: 5px 0;">
                                <strong style="color: #374151;">Request ID:</strong> ${requestId}
                              </td>
                            </tr>
                            <tr>
                              <td style="color: #6b7280; font-size: 14px; padding: 5px 0;">
                                <strong style="color: #374151;">Generated:</strong> ${new Date().toLocaleString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                            </tr>
                            <tr>
                              <td style="color: #6b7280; font-size: 14px; padding: 5px 0;">
                                <strong style="color: #374151;">Format:</strong> JSON (machine-readable & portable)
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                    
                    <h2 style="color: #374151; font-size: 20px; margin: 0 0 15px 0; font-weight: 600;">📦 What's Included</h2>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #10b981; font-size: 18px; margin-right: 10px;">✓</span>
                          <span style="color: #374151; font-size: 15px;">Account & Profile Information</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #10b981; font-size: 18px; margin-right: 10px;">✓</span>
                          <span style="color: #374151; font-size: 15px;">API Keys & Domain Configuration</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #10b981; font-size: 18px; margin-right: 10px;">✓</span>
                          <span style="color: #374151; font-size: 15px;">Subscription & Payment History</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #10b981; font-size: 18px; margin-right: 10px;">✓</span>
                          <span style="color: #374151; font-size: 15px;">API Usage Logs & Widget Activity</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #10b981; font-size: 18px; margin-right: 10px;">✓</span>
                          <span style="color: #374151; font-size: 15px;">Registered Places & Locations</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #10b981; font-size: 18px; margin-right: 10px;">✓</span>
                          <span style="color: #374151; font-size: 15px;">GDPR Request History</span>
                        </td>
                      </tr>
                    </table>
                    
                    <h2 style="color: #374151; font-size: 20px; margin: 0 0 15px 0; font-weight: 600;">⚖️ Your GDPR Rights</h2>
                    
                    <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 15px 0;">
                      You have the following rights regarding your personal data:
                    </p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong style="color: #374151; font-size: 15px; display: block; margin-bottom: 5px;">📝 Right to Rectification</strong>
                          <span style="color: #6b7280; font-size: 14px;">Request correction of inaccurate personal data</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong style="color: #374151; font-size: 15px; display: block; margin-bottom: 5px;">🗑️ Right to Erasure</strong>
                          <span style="color: #6b7280; font-size: 14px;">Request deletion of your personal data</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong style="color: #374151; font-size: 15px; display: block; margin-bottom: 5px;">🔄 Right to Data Portability</strong>
                          <span style="color: #6b7280; font-size: 14px;">Transfer your data to another service provider</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                          <strong style="color: #374151; font-size: 15px; display: block; margin-bottom: 5px;">🚫 Right to Object</strong>
                          <span style="color: #6b7280; font-size: 14px;">Object to the processing of your data</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0;">
                          <strong style="color: #374151; font-size: 15px; display: block; margin-bottom: 5px;">⚠️ Right to Restrict Processing</strong>
                          <span style="color: #6b7280; font-size: 14px;">Request limitation of data processing</span>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- CTA Box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ff6b6b 0%, #326359 100%); border-radius: 8px; margin-bottom: 30px;">
                      <tr>
                        <td style="padding: 25px; text-align: center;">
                          <p style="color: #ffffff; font-size: 16px; margin: 0 0 15px 0; font-weight: 500;">
                            Need to exercise any of these rights?
                          </p>
                          <p style="color: #e0e7ff; font-size: 14px; margin: 0;">
                            Contact our Data Protection Team at<br>
                            <strong style="color: #ffffff; font-size: 16px;">info@mynaturevista.com</strong>
                          </p>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                      If you have any questions about this data export or our data protection practices, please don't hesitate to reach out. We're here to help.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0 0 10px 0;">
                      This data export was generated automatically in compliance with<br>
                      <strong>GDPR Article 15 (Right of Access)</strong>
                    </p>
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                      Request processed on ${new Date().toLocaleString()}
                    </p>
                    <p style="color: #374151; font-size: 13px; margin: 15px 0 0 0; font-weight: 500;">
                      Your Privacy Team 🛡️
                    </p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"Your Privacy Team" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🔒 Your Personal Data Export - Request ${requestId.substring(0, 8)}`,
      html: emailContent,
      attachments: [{
        filename: `gdpr-data-export-${requestId}.json`,
        content: JSON.stringify(dataExport, null, 2),
        contentType: 'application/json'
      }]
    };

    await emailTransporter.sendMail(mailOptions);
        
  } catch (error) {
    console.error('Error sending GDPR email:', error);
    throw error;
  }
}