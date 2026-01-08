// routes/accountDeletionRoutes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/config');
const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token
 */
function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (process.env.NODE_ENV === 'development') {
      console.log('Authorization header:', authHeader ? 'Present' : 'Missing');
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No authorization token provided'
      });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (process.env.NODE_ENV === 'development') {
      console.log('Token decoded:', { id: decoded.id, email: decoded.email });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      isAdmin: decoded.isAdmin || false
    };

    next();
  } catch (error) {
    console.error('Error verifying token:', error.message);
    return res.status(401).json({
      error: 'Invalid or expired token'
    });
  }
}

/**
 * DELETE /api/delete-account
 * Endpoint to delete user account with mandatory feedback
 */
router.delete('/delete-account', verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const userId = req.user.id;
    const { feedback, confirmationText, timestamp } = req.body;

    console.log('Starting account deletion for userId:', userId);

    // Validations
    
    if (!confirmationText || confirmationText.trim().toUpperCase() !== 'DELETE ACCOUNT') {
      return res.status(400).json({
        error: 'Confirmation text is incorrect. Please type "DELETE ACCOUNT" exactly.'
      });
    }

    if (!feedback || typeof feedback !== 'object') {
      return res.status(400).json({
        error: 'Feedback is required before deleting your account.'
      });
    }

    const requiredFields = ['leaveReason', 'rating'];
    const missingFields = requiredFields.filter(field => !feedback[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Please complete all required fields: ${missingFields.join(', ')}`
      });
    }

    if (feedback.rating < 1 || feedback.rating > 5) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5 stars.'
      });
    }

    // Get user data
    const userResult = await client.query(
  `SELECT 
     c.id, 
     c.name, 
     c.email, 
     c.domain, 
     c.created_at,
     s.plan_type as plan,
     (SELECT COUNT(*) FROM api_keys WHERE client_id = c.id) as api_keys_count,
     (SELECT COUNT(*) FROM client_custom_places WHERE client_id = c.id) as custom_places_count,
     (SELECT COUNT(*) FROM widget_usage WHERE client_id = c.id AND is_opening = true) as total_opens
   FROM clients c
   LEFT JOIN subscriptions s ON c.id = s.client_id AND s.is_active = true
   WHERE c.id = $1`,
  [userId]
);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found.'
      });
    }

    const userData = userResult.rows[0];
    console.log('User data:', userData);

    // Begin transaction
    await client.query('BEGIN');

    // Save feedback
    
    const feedbackData = {
      userId: userId,
      userEmail: userData.email || 'unknown',
      userName: userData.name || 'unknown',
      userPlan: userData.plan || 'Starter',
      domainUsed: userData.domain || 'unknown',
      
      leaveReason: feedback.leaveReason,
      rating: feedback.rating,
      improvements: feedback.improvements || [],
      specificFeedback: feedback.specificFeedback || '',
      additionalComments: feedback.additionalComments || '',
      
      deletionDate: timestamp || new Date().toISOString(),
      accountCreatedDate: userData.created_at || 'unknown',
      
      widgetOpens: parseInt(userData.total_opens) || 0,
      customPlaces: parseInt(userData.custom_places_count) || 0,
      apiKeysGenerated: parseInt(userData.api_keys_count) || 0
    };

    let feedbackId = null;

    // Save feedback to database
    try {
      const feedbackResult = await client.query(
        `INSERT INTO account_deletion_feedback (
          client_id, user_email, user_name, user_plan, domain_used,
          leave_reason, rating, improvements, specific_feedback, additional_comments,
          deletion_date, account_created_date, widget_opens, custom_places, api_keys_generated,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          userId,
          feedbackData.userEmail,
          feedbackData.userName,
          feedbackData.userPlan,
          feedbackData.domainUsed,
          feedbackData.leaveReason,
          feedbackData.rating,
          JSON.stringify(feedbackData.improvements),
          feedbackData.specificFeedback,
          feedbackData.additionalComments,
          feedbackData.deletionDate,
          feedbackData.accountCreatedDate,
          feedbackData.widgetOpens,
          feedbackData.customPlaces,
          feedbackData.apiKeysGenerated
        ]
      );
      feedbackId = feedbackResult.rows[0].id;
      console.log('Feedback saved with ID:', feedbackId);
    } catch (insertError) {
      console.error('Error inserting feedback:', insertError.message);
      console.error('Error details:', insertError);
      throw insertError;
    }

    // Delete user data in correct order
    console.log('Deleting related data...');

    // 1. Delete widget usage
    await client.query('DELETE FROM widget_usage WHERE client_id = $1', [userId]);
    console.log('Widget usage deleted');

    // 2. Delete custom places
    await client.query('DELETE FROM client_custom_places WHERE client_id = $1', [userId]);
    console.log('Custom places deleted');

    // 3. Delete API keys
    await client.query('DELETE FROM api_keys WHERE client_id = $1', [userId]);
    console.log('API keys deleted');

    // 4. Delete extra domains
    await client.query('DELETE FROM extra_domains WHERE client_id = $1', [userId]);
    console.log('Extra domains deleted');

    // 5. Delete GDPR requests
    await client.query('DELETE FROM gdpr_requests WHERE user_id = $1', [userId]);
    console.log('GDPR requests deleted');

    // 6. Delete password reset tokens
    await client.query('DELETE FROM password_reset_tokens WHERE client_id = $1', [userId]);
    console.log('Password reset tokens deleted');

    // 7. Delete subscriptions
    await client.query('DELETE FROM subscriptions WHERE client_id = $1', [userId]);
    console.log('Subscriptions deleted');

    // 8. Finally delete the client
    const deleteResult = await client.query('DELETE FROM clients WHERE id = $1 RETURNING email', [userId]);
    console.log('Client deleted:', deleteResult.rows[0]?.email);

    // Commit transaction
    await client.query('COMMIT');
    console.log('Transaction completed successfully');

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully. We appreciate your feedback.',
      feedbackId: feedbackId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in account deletion:', error);
    console.error('Stack trace:', error.stack);

    return res.status(500).json({
      error: 'An error occurred while deleting your account. Please contact support.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/deletion-feedback
 * Endpoint for administrators to view deletion feedback
 */
router.get('/admin/deletion-feedback', verifyToken, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.'
      });
    }

    const { startDate, endDate, limit = 50 } = req.query;

    let query = `
      SELECT * FROM account_deletion_feedback
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (startDate) {
      query += ` AND deletion_date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      query += ` AND deletion_date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    query += ` ORDER BY deletion_date DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    // Calculate statistics
    const stats = calculateDeletionStats(result.rows);

    return res.status(200).json({
      success: true,
      total: result.rows.length,
      feedback: result.rows,
      statistics: stats
    });

  } catch (error) {
    console.error('Error getting feedback:', error);
    return res.status(500).json({
      error: 'Error retrieving deletion feedback.'
    });
  }
});

/**
 * Helper function to calculate statistics
 */
function calculateDeletionStats(feedbackList) {
  if (feedbackList.length === 0) {
    return {
      averageRating: 0,
      topReasons: [],
      topImprovements: [],
      planDistribution: {}
    };
  }

  const totalRating = feedbackList.reduce((sum, fb) => sum + (fb.rating || 0), 0);
  const averageRating = (totalRating / feedbackList.length).toFixed(2);

  const reasonCounts = {};
  feedbackList.forEach(fb => {
    const reason = fb.leave_reason || 'not_specified';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  });
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  const improvementCounts = {};
  feedbackList.forEach(fb => {
    let improvements = fb.improvements;
    if (typeof improvements === 'string') {
      try {
        improvements = JSON.parse(improvements);
      } catch (e) {
        improvements = [];
      }
    }
    if (Array.isArray(improvements)) {
      improvements.forEach(imp => {
        improvementCounts[imp] = (improvementCounts[imp] || 0) + 1;
      });
    }
  });
  const topImprovements = Object.entries(improvementCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([improvement, count]) => ({ improvement, count }));

  const planCounts = {};
  feedbackList.forEach(fb => {
    const plan = fb.user_plan || 'Unknown';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
  });

  return {
    averageRating: parseFloat(averageRating),
    topReasons,
    topImprovements,
    planDistribution: planCounts
  };
}

module.exports = router;