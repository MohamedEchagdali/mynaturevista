// customPlacesRoutes.js - VERSIÓN CON CLOUDINARY
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { checkCustomPlacesLimit, subscriptionMiddleware } = require('../middlewares/subscriptionMiddleware');
const { pool } = require('../db/config');
const multer = require('multer');
const { uploadCustomPlaceImage, deleteCustomPlaceImage, updateCustomPlaceImage, deleteCustomPlaceFolder } = require('../config/cloudinary');
const { sanitizeStrict, sanitizeModerate, sanitizeUrl } = require('../utils/sanitizer');

// Configurar multer
const upload = multer({
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});
// ========================================
// GET - Obtener todos los lugares del cliente (AGRUPADOS POR DOMINIO)
// ========================================
router.get('/', authMiddleware, subscriptionMiddleware, async (req, res) => {
    try {
        const clientId = req.user.id;
        
        // JOIN con api_keys para obtener el dominio y con countries para el país
        const result = await pool.query(`
            SELECT 
                ccp.*,
                c.name as country_name,
                ak.domain as domain,
                ak.id as api_key_id,
                ak.api_key as api_key
            FROM client_custom_places ccp
            INNER JOIN api_keys ak ON ccp.api_key_id = ak.id
            LEFT JOIN countries c ON ccp.country_id = c.id
            WHERE ak.client_id = $1 
            ORDER BY ak.domain, ccp.created_at DESC
        `, [clientId]);
        
        const customPlacesLimit = req.user.subscription_limits?.custom_places_limit || 0;
        const currentCount = result.rows.length;
        
        // Agrupar por dominio para mejor visualización
        const placesByDomain = result.rows.reduce((acc, place) => {
            if (!acc[place.domain]) {
                acc[place.domain] = [];
            }
            acc[place.domain].push(place);
            return acc;
        }, {});
        
        res.json({
            places: result.rows,
            placesByDomain: placesByDomain,
            total: currentCount,
            limits: {
                current: currentCount,
                limit: customPlacesLimit === -1 ? 'unlimited' : customPlacesLimit,
                can_add: customPlacesLimit === -1 || currentCount < customPlacesLimit,
                plan_type: req.user.plan_type
            }
        });
        
    } catch (error) {
        console.error('Error fetching custom places:', error);
        res.status(500).json({ error: 'Failed to fetch custom places' });
    }
});

// ========================================
// GET - Obtener API keys del cliente (para el selector de dominio)
// ========================================
router.get('/domains', authMiddleware, subscriptionMiddleware, async (req, res) => {
    try {
        const clientId = req.user.id;
        
        const result = await pool.query(`
            SELECT id, domain, api_key, is_active, created_at
            FROM api_keys
            WHERE client_id = $1
            ORDER BY created_at ASC
        `, [clientId]);
        
        res.json({
            domains: result.rows
        });
        
    } catch (error) {
        console.error('Error fetching domains:', error);
        res.status(500).json({ error: 'Failed to fetch domains' });
    }
});

// ========================================
// POST - Crear nuevo lugar con Cloudinary
// ========================================
// ========================================
// POST - Crear nuevo lugar con Cloudinary Y DOMAIN
// ========================================
router.post('/', authMiddleware, subscriptionMiddleware, checkCustomPlacesLimit, upload.none(), async (req, res) => {
    try {
        const clientId = req.user.id;

        // Extraer y sanitizar datos del usuario
        const rawData = req.body;

        const api_key_id = rawData.api_key_id;
        const title = sanitizeStrict(rawData.title);
        const description = sanitizeModerate(rawData.description);
        const image_url = rawData.image_url; // Se maneja después con Cloudinary
        const link_url = sanitizeUrl(rawData.link_url);
        const price = rawData.price;
        const currency = sanitizeStrict(rawData.currency) || 'EUR';
        const category = sanitizeStrict(rawData.category);
        const is_active = rawData.is_active;
        const show_on_map = rawData.show_on_map;
        const latitude = rawData.latitude;
        const longitude = rawData.longitude;
        const country_id = rawData.country_id;
        const show_all_countries = rawData.show_all_countries;

        // Validar que api_key_id sea proporcionado
        if (!api_key_id) {
            return res.status(400).json({ error: 'Domain (api_key_id) is required' });
        }
        
        // 🔥 VERIFICAR y OBTENER EL DOMINIO de la API key
        // Esto funciona tanto para dominio base como adicional
        // porque ambos están en la tabla api_keys
        const keyCheck = await pool.query(
            'SELECT id, domain FROM api_keys WHERE id = $1 AND client_id = $2 AND is_active = true',
            [api_key_id, clientId]
        );
        
        if (keyCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Invalid domain selection or inactive API key' });
        }

        const domain = keyCheck.rows[0].domain; // 🔥 OBTENER DOMINIO (base o adicional)
        
        console.log('✅ Creating custom place for domain:', domain);
        
        // Validaciones básicas
        if (!title || !description || !image_url || !link_url) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (description.length > 300) {
            return res.status(400).json({ error: 'Description must be 300 characters or less' });
        }
        
        // Validar URL
        try {
            new URL(link_url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        
        // Validar coordenadas SOLO si show_on_map está activo
        if (show_on_map) {
            if (!latitude || !longitude) {
                return res.status(400).json({ error: 'Coordinates are required when showing on map' });
            }
            
            const lat = parseFloat(latitude);
            const lon = parseFloat(longitude);
            
            if (isNaN(lat) || isNaN(lon)) {
                return res.status(400).json({ error: 'Invalid coordinate format' });
            }
            
            if (lat < -90 || lat > 90) {
                return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
            }
            
            if (lon < -180 || lon > 180) {
                return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
            }
        }
        
        // 🆕 SUBIR IMAGEN A CLOUDINARY
        let cloudinaryUrl = null;
        let cloudinaryPublicId = null;
        
        if (image_url.startsWith('data:image/')) {
            try {
                console.log('☁️ Subiendo imagen a Cloudinary para dominio:', domain);
                const uploadResult = await uploadCustomPlaceImage(image_url, clientId, api_key_id, null);
                cloudinaryUrl = uploadResult.url;
                cloudinaryPublicId = uploadResult.publicId;
            } catch (imageError) {
                console.error('❌ Error subiendo imagen a Cloudinary:', imageError);
                return res.status(400).json({ error: 'Failed to upload image' });
            }
        } else {
            // Si no es base64, usar la URL directamente (por si ya es de Cloudinary)
            cloudinaryUrl = image_url;
        }
        
        // Lógica para guardar datos
        const showOnMapBool = show_on_map === true || show_on_map === 'true';
        const showAllCountriesBool = show_all_countries === true || show_all_countries === 'true';
        
        let finalLatitude = null;
        let finalLongitude = null;
        let finalCountryId = null;
        let finalShowAllCountries = false;
        
        if (showOnMapBool) {
            finalLatitude = parseFloat(latitude);
            finalLongitude = parseFloat(longitude);
            
            if (showAllCountriesBool) {
                finalShowAllCountries = true;
                finalCountryId = null;
            } else if (country_id) {
                finalShowAllCountries = false;
                finalCountryId = parseInt(country_id);
            } else {
                finalShowAllCountries = false;
                finalCountryId = null;
            }
        } else {
            finalLatitude = null;
            finalLongitude = null;
            finalShowAllCountries = false;
            
            if (country_id && country_id !== '' && country_id !== 'null') {
                finalCountryId = parseInt(country_id);
            } else {
                finalCountryId = null;
            }
        }
        
        // 🔥 GUARDAR CON URL DE CLOUDINARY, PUBLIC_ID Y DOMAIN
        const result = await pool.query(`
            INSERT INTO client_custom_places 
            (client_id, api_key_id, domain, title, description, image_url, cloudinary_public_id, 
             link_url, price, currency, category, is_active, 
             show_on_map, latitude, longitude, country_id, show_all_countries)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `, [
            clientId,           // $1
            api_key_id,         // $2
            domain,             // $3 🔥 DOMAIN (obtido de api_keys)
            title.trim(),       // $4
            description.trim(), // $5
            cloudinaryUrl,      // $6
            cloudinaryPublicId, // $7
            link_url.trim(),    // $8
            price || null,      // $9
            currency,           // $10
            category || null,   // $11
            is_active !== false,// $12
            showOnMapBool,      // $13
            finalLatitude,      // $14
            finalLongitude,     // $15
            finalCountryId,     // $16
            finalShowAllCountries // $17
        ]);
        
        console.log('✅ Custom place created successfully for domain:', domain);
        
        res.status(201).json({
            message: 'Place created successfully',
            place: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Error creating place:', error);
        res.status(500).json({ 
            error: 'Failed to create place',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ========================================
// PUT - Actualizar lugar existente con Cloudinary
// ========================================
// ========================================
// PUT - Actualizar lugar existente con Cloudinary Y DOMAIN
// ========================================
router.put('/:placeId', authMiddleware, subscriptionMiddleware, upload.none(), async (req, res) => {
    try {
        const clientId = req.user.id;
        const placeId = req.params.placeId;

        // Extraer y sanitizar datos del usuario
        const rawData = req.body;

        const api_key_id = rawData.api_key_id;
        const title = sanitizeStrict(rawData.title);
        const description = sanitizeModerate(rawData.description);
        const image_url = rawData.image_url;
        const link_url = sanitizeUrl(rawData.link_url);
        const price = rawData.price;
        const currency = sanitizeStrict(rawData.currency) || 'EUR';
        const category = sanitizeStrict(rawData.category);
        const is_active = rawData.is_active;
        const show_on_map = rawData.show_on_map;
        const latitude = rawData.latitude;
        const longitude = rawData.longitude;
        const country_id = rawData.country_id;
        const show_all_countries = rawData.show_all_countries;
        
        // Verificar que el lugar pertenece a una API key del cliente
        const existingPlace = await pool.query(`
            SELECT ccp.*, ak.client_id, ak.domain as current_domain
            FROM client_custom_places ccp
            INNER JOIN api_keys ak ON ccp.api_key_id = ak.id
            WHERE ccp.id = $1 AND ak.client_id = $2
        `, [placeId, clientId]);
        
        if (existingPlace.rows.length === 0) {
            return res.status(404).json({ error: 'Place not found' });
        }
        
        const currentPlace = existingPlace.rows[0];
        
        console.log('📝 Updating place:', placeId, 'Current domain:', currentPlace.current_domain);
        
        // 🔥 Si se proporciona un nuevo api_key_id, verificar y obtener el nuevo dominio
        let newDomain = currentPlace.domain; // Por defecto, mantener el dominio actual
        
        if (api_key_id && api_key_id !== currentPlace.api_key_id) {
            const keyCheck = await pool.query(
                'SELECT id, domain FROM api_keys WHERE id = $1 AND client_id = $2 AND is_active = true',
                [api_key_id, clientId]
            );
            
            if (keyCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Invalid domain selection or inactive API key' });
            }
            
            newDomain = keyCheck.rows[0].domain; // 🔥 NUEVO DOMINIO
            console.log('🔄 Changing domain from', currentPlace.domain, 'to', newDomain);
        }
        
        // Validaciones
        if (!title || !description || !image_url || !link_url) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        if (description.length > 300) {
            return res.status(400).json({ error: 'Description must be 300 characters or less' });
        }
        
        try {
            new URL(link_url);
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        
        if (show_on_map && (!latitude || !longitude)) {
            return res.status(400).json({ error: 'Coordinates required when showing on map' });
        }
        
        // 🆕 ACTUALIZAR IMAGEN EN CLOUDINARY SI ES NUEVA
        let finalImageUrl = image_url;
        let finalPublicId = currentPlace.cloudinary_public_id;
        
        if (image_url.startsWith('data:image/')) {
            try {
                console.log('☁️ Actualizando imagen en Cloudinary...');
                const uploadResult = await updateCustomPlaceImage(
                    currentPlace.cloudinary_public_id,
                    image_url,
                    clientId,
                    api_key_id || currentPlace.api_key_id,
                    placeId
                );
                finalImageUrl = uploadResult.url;
                finalPublicId = uploadResult.publicId;
            } catch (imageError) {
                console.error('❌ Error actualizando imagen:', imageError);
                return res.status(400).json({ error: 'Failed to update image' });
            }
        }
        
        // Lógica de valores finales
        const showOnMapBool = show_on_map === true || show_on_map === 'true';
        const showAllCountriesBool = show_all_countries === true || show_all_countries === 'true';
        
        let finalLatitude = null;
        let finalLongitude = null;
        let finalCountryId = null;
        let finalShowAllCountries = false;
        
        if (showOnMapBool) {
            finalLatitude = parseFloat(latitude);
            finalLongitude = parseFloat(longitude);
            
            if (showAllCountriesBool) {
                finalShowAllCountries = true;
                finalCountryId = null;
            } else if (country_id) {
                finalShowAllCountries = false;
                finalCountryId = parseInt(country_id);
            } else {
                finalShowAllCountries = false;
                finalCountryId = null;
            }
        } else {
            finalLatitude = null;
            finalLongitude = null;
            finalShowAllCountries = false;
            
            if (country_id && country_id !== '' && country_id !== 'null') {
                finalCountryId = parseInt(country_id);
            } else {
                finalCountryId = null;
            }
        }
        
        // 🔥 PREPARAR QUERY SEGÚN SI CAMBIÓ EL API_KEY_ID (y por tanto el dominio)
        let updateQuery;
        let updateParams;
        
        if (api_key_id && api_key_id !== currentPlace.api_key_id) {
            // Se cambió el dominio/API key
            updateQuery = `
                UPDATE client_custom_places 
                SET api_key_id = $1, 
                    domain = $2, 
                    title = $3, 
                    description = $4, 
                    image_url = $5, 
                    cloudinary_public_id = $6, 
                    link_url = $7, 
                    price = $8, 
                    currency = $9, 
                    category = $10, 
                    is_active = $11, 
                    show_on_map = $12, 
                    latitude = $13, 
                    longitude = $14, 
                    country_id = $15, 
                    show_all_countries = $16,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $17
                RETURNING *`;
            
            updateParams = [
                api_key_id,         // $1
                newDomain,          // $2 🔥 NUEVO DOMAIN
                title.trim(),       // $3
                description.trim(), // $4
                finalImageUrl,      // $5
                finalPublicId,      // $6
                link_url.trim(),    // $7
                price || null,      // $8
                currency,           // $9
                category || null,   // $10
                is_active !== false,// $11
                showOnMapBool,      // $12
                finalLatitude,      // $13
                finalLongitude,     // $14
                finalCountryId,     // $15
                finalShowAllCountries, // $16
                placeId             // $17
            ];
        } else {
            // No se cambió el dominio, solo actualizar otros campos
            updateQuery = `
                UPDATE client_custom_places 
                SET title = $1, 
                    description = $2, 
                    image_url = $3, 
                    cloudinary_public_id = $4, 
                    link_url = $5, 
                    price = $6, 
                    currency = $7, 
                    category = $8, 
                    is_active = $9, 
                    show_on_map = $10, 
                    latitude = $11, 
                    longitude = $12, 
                    country_id = $13, 
                    show_all_countries = $14,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $15
                RETURNING *`;
            
            updateParams = [
                title.trim(),       // $1
                description.trim(), // $2
                finalImageUrl,      // $3
                finalPublicId,      // $4
                link_url.trim(),    // $5
                price || null,      // $6
                currency,           // $7
                category || null,   // $8
                is_active !== false,// $9
                showOnMapBool,      // $10
                finalLatitude,      // $11
                finalLongitude,     // $12
                finalCountryId,     // $13
                finalShowAllCountries, // $14
                placeId             // $15
            ];
        }
        
        const result = await pool.query(updateQuery, updateParams);
        
        console.log('✅ Custom place updated successfully. Domain:', newDomain);
        
        res.json({
            message: 'Place updated successfully',
            place: result.rows[0]
        });
        
    } catch (error) {
        console.error('❌ Error updating custom place:', error);
        res.status(500).json({ 
            error: 'Failed to update custom place',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ========================================
// PATCH - Alternar estado activo/inactivo
// ========================================
router.patch('/:placeId/toggle', authMiddleware, subscriptionMiddleware, async (req, res) => {
    try {
        const clientId = req.user.id;
        const placeId = req.params.placeId;
        
        const result = await pool.query(`
            UPDATE client_custom_places ccp
            SET is_active = NOT ccp.is_active, 
                updated_at = CURRENT_TIMESTAMP
            FROM api_keys ak
            WHERE ccp.api_key_id = ak.id 
            AND ccp.id = $1 
            AND ak.client_id = $2
            RETURNING ccp.*
        `, [placeId, clientId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Place not found' });
        }
        
        res.json({
            message: 'Status updated successfully',
            place: result.rows[0]
        });
        
    } catch (error) {
        console.error('Error toggling place status:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// ========================================
// DELETE - Eliminar lugar y su imagen de Cloudinary
// ========================================
router.delete('/:placeId', authMiddleware, subscriptionMiddleware, async (req, res) => {
    try {
        const clientId = req.user.id;
        const placeId = req.params.placeId;
        
        // Obtener información del lugar antes de eliminarlo
        const placeResult = await pool.query(`
            SELECT ccp.cloudinary_public_id
            FROM client_custom_places ccp
            INNER JOIN api_keys ak ON ccp.api_key_id = ak.id
            WHERE ccp.id = $1 AND ak.client_id = $2
        `, [placeId, clientId]);
        
        if (placeResult.rows.length === 0) {
            return res.status(404).json({ error: 'Place not found' });
        }
        
        const cloudinaryPublicId = placeResult.rows[0].cloudinary_public_id;
        
        // 🆕 ELIMINAR IMAGEN DE CLOUDINARY (no bloqueante)
        if (cloudinaryPublicId) {
            deleteCustomPlaceImage(cloudinaryPublicId).catch(err => {
                console.error('⚠️ Error eliminando imagen de Cloudinary:', err);
            });
        }
        
        // Eliminar de la base de datos
        const result = await pool.query(`
            DELETE FROM client_custom_places ccp
            USING api_keys ak
            WHERE ccp.api_key_id = ak.id
            AND ccp.id = $1 
            AND ak.client_id = $2
            RETURNING ccp.id
        `, [placeId, clientId]);
        
        res.json({ message: 'Place deleted successfully' });
        
    } catch (error) {
        console.error('Error deleting custom place:', error);
        res.status(500).json({ error: 'Failed to delete place' });
    }
});

// ========================================
// GET - Obtener lugares para el widget público
// ========================================
router.get('/widget/:apiKey', async (req, res) => {
    try {
        const apiKey = req.params.apiKey;
        const countryName = req.query.country;
        
        // Obtener api_key_id desde la API key
        const keyResult = await pool.query(
            'SELECT id FROM api_keys WHERE api_key = $1 AND is_active = true',
            [apiKey]
        );
        
        if (keyResult.rows.length === 0) {
            return res.status(403).json({ error: 'Invalid API key' });
        }
        
        const apiKeyId = keyResult.rows[0].id;
        
        let query;
        let params;
        
        if (countryName) {
            const countryResult = await pool.query(
                'SELECT id FROM countries WHERE name = $1',
                [countryName]
            );
            
            if (countryResult.rows.length === 0) {
                query = `
                    SELECT id, title, description, image_url, link_url, price,currency, category,
                           show_on_map, latitude, longitude
                    FROM client_custom_places 
                    WHERE api_key_id = $1 
                    AND is_active = true
                    AND country_id IS NULL
                    ORDER BY created_at DESC
                `;
                params = [apiKeyId];
            } else {
                const countryId = countryResult.rows[0].id;
                query = `
                    SELECT id, title, description, image_url, link_url, price,currency, category,
                        show_on_map, latitude, longitude, country_id, show_all_countries
                    FROM client_custom_places 
                    WHERE api_key_id = $1 
                    AND is_active = true
                    AND (
                        (show_on_map = true AND show_all_countries = true) OR
                        (show_on_map = true AND country_id = $2) OR
                        (show_on_map = false AND country_id = $2) OR
                        (show_on_map = false AND country_id IS NULL)
                    )
                    ORDER BY 
                        CASE 
                            WHEN show_on_map = true AND country_id = $2 THEN 1
                            WHEN show_on_map = true AND show_all_countries = true THEN 2
                            WHEN show_on_map = false AND country_id = $2 THEN 3
                            ELSE 4
                        END,
                        created_at DESC
                `;
                params = [apiKeyId, countryId];
            }
        } else {
            query = `
                SELECT id, title, description, image_url, link_url, price, currency, category,
                    show_on_map, latitude, longitude
                FROM client_custom_places 
                WHERE api_key_id = $1 
                AND is_active = true
                AND country_id IS NULL
                ORDER BY created_at DESC
            `;
            params = [apiKeyId];
        }
        
        const placesResult = await pool.query(query, params);
        
        res.json({
            places: placesResult.rows,
            total: placesResult.rows.length,
            country: countryName || 'global'
        });
        
    } catch (error) {
        console.error('Error fetching widget places:', error);
        res.status(500).json({ error: 'Failed to fetch places' });
    }
});

// ========================================
// 🆕 GET - Obtener TODOS los lugares activos para el mapa global del widget
// ========================================
router.get('/widget/:apiKey/all', async (req, res) => {
    try {
        const apiKey = req.params.apiKey;
        // Verificar API key
        const keyResult = await pool.query(
            'SELECT id FROM api_keys WHERE api_key = $1 AND is_active = true',
            [apiKey]
        );
        
        if (keyResult.rows.length === 0) {
            return res.status(403).json({ error: 'Invalid API key' });
        }
        
        const apiKeyId = keyResult.rows[0].id;
        
        // Obtener TODOS los lugares activos con información del país
        const query = `
            SELECT 
                ccp.id, 
                ccp.title, 
                ccp.description, 
                ccp.image_url, 
                ccp.link_url, 
                ccp.price, 
                ccp.currency, 
                ccp.category,
                ccp.show_on_map, 
                ccp.latitude as lat, 
                ccp.longitude as lng,
                ccp.country_id,
                ccp.show_all_countries,
                c.name as country_name
            FROM client_custom_places ccp
            LEFT JOIN countries c ON ccp.country_id = c.id
            WHERE ccp.api_key_id = $1 
            AND ccp.is_active = true
            AND ccp.show_on_map = true
            AND ccp.latitude IS NOT NULL
            AND ccp.longitude IS NOT NULL
            ORDER BY ccp.created_at DESC
        `;
        
        const placesResult = await pool.query(query, [apiKeyId]);
        
        res.json({
            places: placesResult.rows,
            total: placesResult.rows.length
        });
        
    } catch (error) {
        console.error('❌ Error fetching all widget places:', error);
        res.status(500).json({ error: 'Failed to fetch places' });
    }
});
module.exports = router;