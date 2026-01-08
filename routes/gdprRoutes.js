const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const rateLimit = require('express-rate-limit');
const gdprController = require('../controllers/gdprController');


router.get("/getProfile", authMiddleware, authController.getProfile);

// Rate limiting para prevenir spam
const gdprLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 3, // máximo 3 solicitudes por usuario
  keyGenerator: (req, res) => req.user.id, // usar ID de usuario autenticado
  message: { error: 'Too many GDPR requests. Please try again tomorrow.' }
});


// Ruta para solicitar datos GDPR (requiere autenticación)
router.post('/data-request', authMiddleware, gdprLimiter, gdprController.submitDataRequest);

// Opcional: Ruta para ver el estado de solicitudes anteriores
router.get('/request-status', authMiddleware, gdprController.getRequestStatus);



module.exports = router;
