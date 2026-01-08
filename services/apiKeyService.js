// services/apiKeyService.js
const { pool } = require('../db/config');

async function validateApiKey(apiKey, origin) {
    try {
        const result = await pool.query(
            'SELECT allowed_origins, is_active FROM api_keys WHERE api_key = $1',
            [apiKey]
        );
        
        if (result.rows.length === 0) {
            return { valid: false, reason: 'API key inválida' };
        }
        
        const keyData = result.rows[0];
        
        if (!keyData.is_active) {
            return { valid: false, reason: 'API key inactiva' };
        }
        
        // Parsear allowed_origins
        let allowedOrigins = [];
        
        if (keyData.allowed_origins) {
            if (Array.isArray(keyData.allowed_origins)) {
                allowedOrigins = keyData.allowed_origins;
            } else if (typeof keyData.allowed_origins === 'string') {
                try {
                    const jsonString = keyData.allowed_origins
                        .replace(/^\{/, '[')
                        .replace(/\}$/, ']');
                    allowedOrigins = JSON.parse(jsonString);
                } catch (parseError) {
                    console.log('   ❌ Error parse:', parseError.message);
                }
            }
        }
        
        // Permitir localhost en desarrollo
        if (process.env.NODE_ENV !== 'production') {
            const normalizedOrigin = origin ? origin.toLowerCase().trim() : '';
            const isLocalhost = normalizedOrigin.includes('localhost') || 
                            normalizedOrigin.includes('127.0.0.1') ||
                            !normalizedOrigin;
            
            if (isLocalhost) {
                return { valid: true };
            }
        }
        
        // Normalizar y comparar
        const normalizedOrigin = origin ? origin.toLowerCase().trim() : '';
        const normalizedAllowed = allowedOrigins.map(o => o.toLowerCase().trim());
        
        const isExactMatch = normalizedAllowed.includes(normalizedOrigin);
        
        if (isExactMatch) {
            return { valid: true };
        }
        
        // Verificar subdominios
        const isSubdomainAllowed = normalizedAllowed.some(allowed => {
            try {
                const originUrl = new URL(normalizedOrigin);
                const allowedUrl = new URL(allowed);
                
                if (originUrl.hostname.endsWith(`.${allowedUrl.hostname}`)) {
                    return true;
                }
            } catch (error) {}
            return false;
        });
        
        if (isSubdomainAllowed) {
            return { valid: true };
        }
        return { valid: false, reason: 'Origen no autorizado' };
        
    } catch (error) {
        return { valid: false, reason: 'Error interno' };
    }
}

module.exports = { validateApiKey };