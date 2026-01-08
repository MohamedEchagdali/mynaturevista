// routes/countries.js
const express = require('express');
const { pool } = require('../db/config');
const router = express.Router();

// GET - Listar todos los países (SIN cacheMiddleware aquí)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT name, data->>'headerTitle' as title, 
                    jsonb_array_length(data->'secciones') as num_places
             FROM countries 
             ORDER BY name`
        );
        
        res.json({
            total: result.rows.length,
            countries: result.rows
        });
        
    } catch (error) {
        console.error('❌ Database error (listando países):', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

// GET - Obtener todos los lugares para el mapa
router.get('/all/places', async (req, res) => {
    try {
        
        const result = await pool.query(
            `SELECT name, data FROM countries ORDER BY name`
        );
        
        let allPlaces = [];
        
        result.rows.forEach(row => {
            const country = row.data;
            const countryName = row.name;
            
            if (country && Array.isArray(country.secciones)) {
                country.secciones.forEach(seccion => {
                    allPlaces.push({
                        ...seccion,
                        pais: countryName,
                        paisHeaderTitle: country.headerTitle,
                        paisDescriptionsHead: country.descriptionsHead
                    });
                });
            }
        });
        
        res.json({
            total: allPlaces.length,
            countries: result.rows.length,
            places: allPlaces
        });
        
    } catch (error) {
        console.error('❌ Database error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// GET - Obtener un país específico
router.get('/:country', async (req, res) => {
    const { country } = req.params;
    
    try {
        const result = await pool.query(
            `SELECT data FROM countries WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [country]
        );
        
        if (result.rows.length === 0) {
            
            const availableCountries = await pool.query(
                `SELECT name FROM countries ORDER BY name LIMIT 15`
            );
            
            return res.status(404).json({ 
                error: 'Country not found',
                country: country,
                availableCountries: availableCountries.rows.map(r => r.name)
            });
        }
        res.json(result.rows[0].data);
        
    } catch (error) {
        console.error('❌ Database error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message
        });
    }
});

module.exports = router;