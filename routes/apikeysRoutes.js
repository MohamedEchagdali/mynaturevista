//routes/apikeysRoutes.js
const express = require('express');
const crypto = require('crypto');
const pool = require('../db/config');
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

// Generar API key segura
function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// 🔥 Función para obtener dominios adicionales usando la tabla CORRECTA: extra_domains
async function getExtraDomainsCount(clientId) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM extra_domains WHERE client_id = $1 AND status = $2',
      [clientId, 'active']
    );
    return parseInt(result.rows[0]?.count || 0);
  } catch (error) {
    console.error('Error obteniendo dominios extra:', error);
    return 0;
  }
}

// Middleware para verificar API key
const verifyApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key requerida' });
    }

    const result = await pool.query(
      'SELECT ak.*, c.email FROM api_keys ak JOIN clients c ON ak.client_id = c.id WHERE ak.api_key = $1 AND ak.is_active = true',
      [apiKey]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'API key inválida o inactiva' });
    }

    req.apiKeyData = result.rows[0];
    next();
  } catch (error) {
    console.error('Error verificando API key:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Obtener API keys del usuario actual
router.get('/my-keys', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, api_key, is_active, created_at, domain, description, allowed_origins 
       FROM api_keys 
       WHERE client_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    // Contar dominios únicos
    const uniqueDomains = new Set(result.rows.map(key => key.domain));
    const domainsUsed = uniqueDomains.size;
    
    // Obtener límite del plan base
    const domainsAllowed = req.user.subscription_limits?.domains_allowed || 1;
    
    // 🔥 Contar dominios EXTRA activos (tabla correcta: extra_domains)
    const extraDomainsCount = await getExtraDomainsCount(req.user.id);
    const totalAllowed = domainsAllowed + extraDomainsCount;


    const keys = result.rows.map(key => ({
      ...key,
      api_key_masked: key.api_key.replace(/(.{4})(.*)(.{4})/, '$1' + '•'.repeat(key.api_key.length - 8) + '$3'),
      api_key_display: key.is_active ? key.api_key : key.api_key_masked,
      allowed_origins: Array.isArray(key.allowed_origins) ? key.allowed_origins : []
    }));

    res.json({
      success: true,
      keys: keys,
      limits: {
        domains_used: domainsUsed,
        domains_allowed: totalAllowed, // Total incluyendo extra
        domains_base: domainsAllowed,
        domains_extra: extraDomainsCount,
        can_add_domain: domainsUsed < totalAllowed
      }
    });
  } catch (error) {
    console.error('Error obteniendo API keys:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  }
});

// Obtener API key activa actual
router.get('/current', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, api_key, is_active, created_at, domain, description, allowed_origins 
       FROM api_keys 
       WHERE client_id = $1 AND is_active = true 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        currentKey: null
      });
    }

    const key = result.rows[0];
    key.allowed_origins = Array.isArray(key.allowed_origins) ? key.allowed_origins : [];

    res.json({
      success: true,
      currentKey: key
    });
  } catch (error) {
    console.error('Error obteniendo API key actual:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// 🔥 GENERAR NUEVA API KEY - USA TABLA extra_domains
router.post('/generate', authMiddleware, async (req, res) => {
  const client = pool;
  
  try {
    await client.query('BEGIN');
    
    const { description, domain } = req.body;
    
    // 1️⃣ Obtener el dominio del usuario desde la BD
    let targetDomain = domain;
    
    if (!targetDomain) {
      const clientResult = await client.query(
        'SELECT domain FROM clients WHERE id = $1',
        [req.user.id]
      );

      if (clientResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      targetDomain = clientResult.rows[0].domain;
    }

    if (!targetDomain || targetDomain.trim() === '') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Se requiere un dominio válido' });
    }

    const cleanDomain = targetDomain.trim().replace(/^(https?:\/\/)?(www\.)?/, '');

    // 2️⃣ VERIFICAR LÍMITE DE DOMINIOS - USA extra_domains
    const domainsResult = await client.query(
      'SELECT DISTINCT domain FROM api_keys WHERE client_id = $1',
      [req.user.id]
    );

    const currentDomains = domainsResult.rows.map(row => row.domain);
    const isNewDomain = !currentDomains.includes(cleanDomain);
    
    // ✅ Solo bloquear si es un NUEVO dominio y se alcanzó el límite
    if (isNewDomain) {
      const domainsAllowed = req.user.subscription_limits?.domains_allowed || 1;
      
      // 🔥 Contar dominios EXTRA activos (tabla correcta)
      const extraDomainsCount = await getExtraDomainsCount(req.user.id);
      const totalAllowed = domainsAllowed + extraDomainsCount;
      
      
      if (currentDomains.length >= totalAllowed) {
        await client.query('ROLLBACK');
        return res.status(403).json({ 
          error: 'Límite de dominios alcanzado',
          message: `Tu plan permite ${domainsAllowed} dominio(s)${extraDomainsCount > 0 ? ` + ${extraDomainsCount} extra = ${totalAllowed} total` : ''}. Ya tienes: ${currentDomains.join(', ')}`,
          current_domains: currentDomains,
          domains_allowed: domainsAllowed,
          domains_extra: extraDomainsCount,
          total_allowed: totalAllowed,
          limit_reached: true
        });
      }
    }

    // 3️⃣ Desactivar claves anteriores del mismo dominio
    await client.query(
      'UPDATE api_keys SET is_active = false WHERE client_id = $1 AND domain = $2 AND is_active = true',
      [req.user.id, cleanDomain]
    );

    // 4️⃣ Generar nueva API key
    const newApiKey = generateApiKey();
    
    // Construir allowed_origins
    const allowedOrigins = [
      `https://${cleanDomain}`,
      `https://www.${cleanDomain}`,
      `http://${cleanDomain}`,      // ⚠️ Solo si necesitas HTTP (no recomendado en producción)
      `http://www.${cleanDomain}`   // ⚠️ Solo si necesitas HTTP
    ];
    /*3. VALIDACIÓN:
   - El middleware domainValidationMiddleware ya valida subdominios
   - No necesitas wildcards si solo tienes www.ejemplo.com 
    🌟 OPCIONAL: Si quieres permitir TODOS los subdominios automáticamente
    allowedOrigins.push(`https://*.${cleanDomain}`);
    allowedOrigins.push(`http://*.${cleanDomain}`);
    
    console.log('✅ Allowed origins generados:', allowedOrigins);*/
    
    const result = await client.query(
      `INSERT INTO api_keys (client_id, api_key, domain, description, is_active, allowed_origins) 
       VALUES ($1, $2, $3, $4, true, $5) 
       RETURNING id, api_key, is_active, created_at, domain, description, allowed_origins`,
      [req.user.id, newApiKey, cleanDomain, description?.trim() || null, allowedOrigins]
    );

    await client.query('COMMIT');

    const apiKey = result.rows[0];
    apiKey.allowed_origins = Array.isArray(apiKey.allowed_origins) ? apiKey.allowed_origins : [];

    res.json({
      success: true,
      message: isNewDomain 
        ? '✅ Nueva API key generada para nuevo dominio'
        : '✅ API key regenerada para dominio existente',
      apiKey: apiKey,
      limits: req.user.subscription_limits,
      is_new_domain: isNewDomain
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error generando API key:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: error.message 
    });
  } 
});

// Revocar API key específica
router.post('/revoke/:keyId', authMiddleware, async (req, res) => {
  try {
    const { keyId } = req.params;
    
    const result = await pool.query(
      'UPDATE api_keys SET is_active = false WHERE id = $1 AND client_id = $2 RETURNING *',
      [keyId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key no encontrada' });
    }

    res.json({
      success: true,
      message: 'API key revocada exitosamente'
    });

  } catch (error) {
    console.error('Error revocando API key:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint protegido de ejemplo
router.get('/protected-service', verifyApiKey, async (req, res) => {
  res.json({
    success: true,
    message: 'Acceso autorizado a tu servicio',
    user: {
      email: req.apiKeyData.email,
      apiKeyId: req.apiKeyData.id
    },
    data: {
      timestamp: new Date().toISOString(),
      service: 'Tu servicio API'
    }
  });
});

// Verificar estado de API key
router.get('/verify', verifyApiKey, (req, res) => {
  res.json({
    success: true,
    valid: true,
    apiKey: {
      id: req.apiKeyData.id,
      created_at: req.apiKeyData.created_at,
      domain: req.apiKeyData.domain
    }
  });
});

module.exports = router;