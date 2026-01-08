//authController.js 
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool, query } = require("../db/config");
const { emailTransporter } = require('../services/emailService');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

exports.login = async (req, res) => {
    const { email, password, recaptchaTokenV3, "g-recaptcha-response": recaptchaTokenV2 } = req.body;

    try {
        let humanVerified = false;

        // If we receive v3, verify score
        if (recaptchaTokenV3) {
            const verifyV3 = await fetch(
                `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_V3}&response=${recaptchaTokenV3}`, 
                { method: "POST" }
            );
            const dataV3 = await verifyV3.json();

            if (dataV3.success && dataV3.score >= 0.5) {
                humanVerified = true;
            }
        }

        // If v3 didn't pass but v2 exists, verify it
        if (!humanVerified && recaptchaTokenV2) {
            const verifyV2 = await fetch(
                `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_V2}&response=${recaptchaTokenV2}`, 
                { method: "POST" }
            );
            const dataV2 = await verifyV2.json();

            if (dataV2.success) {
                humanVerified = true;
            }
        }

        // If still not verified, request v2 from frontend
        if (!humanVerified) {
            return res.status(403).json({ 
                requireCaptchaV2: true, 
                message: "We need to verify that you're human" 
            });
        }

        // Email and password validation
        const result = await pool.query("SELECT * FROM clients WHERE email = $1", [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ message: "Incorrect email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect email or password" });
        }

        // PASO 3: Include token_version for server-side invalidation
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                tokenVersion: user.token_version || 0
            },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Return subscription information in response
        res.json({ 
            token, 
            message: "Login successful",
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                is_subscribed: user.is_subscribed
            }
        });

    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ message: "Error logging in" });
    }
};


exports.signup = async (req, res) => {

    const { name, email, password, phone, addresses, domain } = req.body;

    if (!name || !email || !password || !domain) {
        return res.status(400).json({ message: "Required fields are missing" });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if user already exists
        const userExists = await client.query(
            "SELECT 1 FROM clients WHERE email = $1", 
            [email]
        );
        if (userExists.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "The email is already registered" });
        }

        // Check if domain already exists
        const domainExists = await client.query(
            "SELECT 1 FROM clients WHERE domain = $1", 
            [domain]
        );
        if (domainExists.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                message: "The domain is already registered by another customer" 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        const phoneValue = phone && phone.toString().trim() !== '' 
            ? phone.toString().trim() 
            : null;
        const addressesValue = addresses && addresses.toString().trim() !== '' 
            ? addresses.toString().trim() 
            : null;

        // Insert client with token_version initialized to 0
        const insertClientQuery = `
            INSERT INTO clients (name, email, domain, password, phone, addresses, is_subscribed, token_version)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
            RETURNING id, email, name, domain, phone, addresses, is_subscribed, token_version, created_at
        `;
        const insertClientValues = [
            name,
            email,
            domain,
            hashedPassword,
            phoneValue,
            addressesValue,
            false
        ];
        const newClient = await client.query(insertClientQuery, insertClientValues);
        const clientData = newClient.rows[0];

        await client.query('COMMIT');

        // Create JWT token with token_version (PASO 3)
        const token = jwt.sign(
            {
                userId: clientData.id,
                email: clientData.email,
                tokenVersion: clientData.token_version || 0
            },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        const response = {
            token,
            message: "User created successfully",
            user: {
                id: clientData.id,
                name: clientData.name,
                email: clientData.email,
                domain: clientData.domain,
                phone: clientData.phone,
                addresses: clientData.addresses,
                is_subscribed: clientData.is_subscribed,
                created_at: clientData.created_at
            }
        };
        res.status(201).json(response);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Signup error:', err.message);
        res.status(500).json({
            message: "Server error while creating user"
        });
    } finally {
        client.release();
    }
};

exports.authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (process.env.NODE_ENV === 'development') {
                console.log('Invalid token:', err.message);
            }
            return res.status(403).json({ error: 'Invalid token' });
        }

        req.user = {
            id: decoded.userId || decoded.id, // Support both old and new tokens during migration
            email: decoded.email
        };
        next();
    });
}

exports.logout = async (req, res) => {
    // PASO 3: Real server-side logout by incrementing token_version
    // This invalidates ALL previous tokens for this user
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }

        // Increment token_version to invalidate all existing tokens
        await pool.query(
            'UPDATE clients SET token_version = token_version + 1 WHERE id = $1',
            [userId]
        );

        res.status(200).json({
            message: "Logout successful. All tokens have been invalidated."
        });

    } catch (err) {
        console.error('Logout error:', err.message);
        res.status(500).json({ message: "Error during logout" });
    }
};

exports.getProfile = async (req, res) => {
    const userId = req.user.id; // comes from token
    try {
        const result = await pool.query(
            `SELECT id, name, email, domain, phone, addresses, is_subscribed 
             FROM clients 
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error loading profile:', err.message);
        res.status(500).json({ message: "Error loading profile" });
    }
};

// Get subscription status
exports.getSubscriptionStatus = async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      "SELECT id, email, is_subscribed FROM clients WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];    
    res.json({
      user_id: user.id,
      email: user.email,
      is_subscribed: user.is_subscribed
    });
  } catch (err) {
    console.error('Error verifying subscription:', err.message);
    res.status(500).json({ message: "Error verifying subscription" });
  }
};

exports.activateSubscription = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(
            "UPDATE clients SET is_subscribed = true WHERE id = $1 RETURNING id, email, is_subscribed",
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            message: "Subscription activated successfully",
            user: result.rows[0]
        });
    } catch (err) {
        console.error('Error activating subscription:', err.message);
        res.status(500).json({ message: "Error activating subscription" });
    }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const result = await pool.query("SELECT * FROM clients WHERE id = $1", [userId]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE clients SET password = $1 WHERE id = $2", [hashedPassword, userId]);

    res.status(200).json({ message: "Password updated successfully." });
  } catch (err) {
    console.error('Error changing password:', err.message);
    res.status(500).json({ message: "Error changing password." });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // Check if the user exists
    const userResult = await pool.query('SELECT id, email FROM clients WHERE email = $1', [normalizedEmail]);
    if (userResult.rows.length === 0) {
      // Do not reveal whether the email exists for security reasons
      return res.status(200).json({ message: 'If the email is registered, you will receive a recovery link.' });
    }

    const user = userResult.rows[0];

    // Generate a unique token (UUID or hash)
    const resetToken = crypto.randomBytes(32).toString('hex'); // 64 hex characters
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Save token in the database
    await pool.query(
      `INSERT INTO password_reset_tokens (client_id, token, expires_at) 
       VALUES ($1, $2, $3)`,
      [user.id, resetToken, expiresAt]
    );

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'Reset your password - myNaturvista',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Forgot your password?</h2>
          <p>We received a request to reset the password for your myNaturvista account.</p>
          <p>Click the button below to create a new password:</p>
          <a href="${resetUrl}" 
             style="display: inline-block; padding: 12px 24px; background: #00b894; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">
             Reset Password
          </a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this change, please ignore this email.</p>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'If the email is registered, you will receive a recovery link.'
    });

  } catch (error) {
    console.error('Error in forgot password:', error.message);
    res.status(500).json({ error: 'Internal error processing the request.' });
  }
};


exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Token and password (min. 6 characters) are required.' });
  }

  try {
    // Find unused and unexpired token
    const tokenResult = await pool.query(
      `SELECT * FROM password_reset_tokens 
       WHERE token = $1 AND used = false AND expires_at > NOW()`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    const { client_id } = tokenResult.rows[0];

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await pool.query('UPDATE clients SET password = $1 WHERE id = $2', [hashedPassword, client_id]);

    // Mark token as used (or delete it)
    await pool.query('UPDATE password_reset_tokens SET used = true WHERE token = $1', [token]);

    res.status(200).json({ message: 'Password updated successfully.' });

  } catch (error) {
    console.error('Error resetting password:', error.message);
    res.status(500).json({ error: 'Error resetting password.' });
  }
};

exports.deleteAccount = async (req, res) => {
  const userId = req.user.id;
  const { feedback, timestamp, confirmationText } = req.body;

  if (process.env.NODE_ENV === 'development') {
    console.log('Starting account deletion for userId:', userId);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Save feedback if exists
    if (feedback) {
      await client.query(
        `INSERT INTO account_deletion_feedback
         (client_id, leave_reason, rating, improvements, specific_feedback, additional_comments, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          feedback.leaveReason || null,
          feedback.rating || null,
          feedback.improvements ? JSON.stringify(feedback.improvements) : null,
          feedback.specificFeedback || null,
          feedback.additionalComments || null
        ]
      );
      if (process.env.NODE_ENV === 'development') {
        console.log('Feedback saved');
      }
    }

    // Delete related records in correct order

    // Delete custom places
    await client.query('DELETE FROM custom_places WHERE client_id = $1', [userId]);
    if (process.env.NODE_ENV === 'development') {
      console.log('Custom places deleted');
    }

    // Delete API keys
    await client.query('DELETE FROM api_keys WHERE client_id = $1', [userId]);
    if (process.env.NODE_ENV === 'development') {
      console.log('API keys deleted');
    }

    // Delete extra domains
    await client.query('DELETE FROM extra_domains WHERE client_id = $1', [userId]);
    if (process.env.NODE_ENV === 'development') {
      console.log('Extra domains deleted');
    }

    // Delete GDPR requests
    await client.query('DELETE FROM gdpr_requests WHERE user_id = $1', [userId]);
    if (process.env.NODE_ENV === 'development') {
      console.log('GDPR requests deleted');
    }

    // Delete password reset tokens
    await client.query('DELETE FROM password_reset_tokens WHERE client_id = $1', [userId]);
    if (process.env.NODE_ENV === 'development') {
      console.log('Password reset tokens deleted');
    }

    // Delete subscriptions
    await client.query('DELETE FROM subscriptions WHERE client_id = $1', [userId]);
    if (process.env.NODE_ENV === 'development') {
      console.log('Subscriptions deleted');
    }

    // Finally delete the client
    const result = await client.query(
      'DELETE FROM clients WHERE id = $1 RETURNING *',
      [userId]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "User not found or already deleted." });
    }

    await client.query('COMMIT');
    if (process.env.NODE_ENV === 'development') {
      console.log('Account deleted successfully');
    }

    // Invalidate token
    res.clearCookie("token");

    res.status(200).json({
      message: "Your account has been deleted successfully.",
      deletedUser: {
        email: result.rows[0].email,
        deletedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting account:', error);
    res.status(500).json({
      error: "An error occurred while deleting your account.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
};