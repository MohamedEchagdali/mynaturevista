// routes/contactRoutes.js
const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// 🔥 IMPORTAR SIN DESESTRUCTURAR
const authenticateToken = require('../middlewares/authMiddleware');

router.post('/landing-contact', contactController.submitLandingContact);
router.post('/contact', authenticateToken, contactController.submitDashboardContact);

module.exports = router;