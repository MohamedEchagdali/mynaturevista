// routes/places.js
const express = require('express');
const { pool } = require('../db/config');
const { cacheMiddleware } = require('../middlewares/cacheMiddleware');
const router = express.Router();

// 1. Get all places
router.get('/',
    cacheMiddleware(3600),
    async (req, res) => {
        try {
            const result = await pool.query('SELECT name, data FROM natural_places ORDER BY created_at');

            const places = {};
            result.rows.forEach(row => {
                places[row.name] = row.data;
            });

            res.json(places);
        } catch (error) {
            console.error('Error getting places:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// 2. Get specific place
router.get('/:placeName',
    cacheMiddleware(3600),
    async (req, res) => {
        try {
            const { placeName } = req.params;
            
            const result = await pool.query(
                'SELECT name, data FROM natural_places WHERE name = $1',
                [placeName]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: `Place "${placeName}" not found` });
            }

            res.json({
                name: result.rows[0].name,
                data: result.rows[0].data
            });
        } catch (error) {
            console.error('Error getting specific place:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// 3. Search places
router.get('/search',
    cacheMiddleware(1800),
    async (req, res) => {
        try {
            const { activity, state, country } = req.query;

            if (!activity && !state && !country) {
                return res.status(400).json({ error: 'At least one search criteria is required' });
            }

            let query = 'SELECT name, data FROM natural_places WHERE ';
            let conditions = [];
            let params = [];
            let paramCount = 1;
            
            if (activity) {
                conditions.push(`data::text ILIKE $${paramCount}`);
                params.push(`%${activity}%`);
                paramCount++;
            }
            
            if (state) {
                conditions.push(`data::text ILIKE $${paramCount}`);
                params.push(`%${state}%`);
                paramCount++;
            }
            
            if (country) {
                conditions.push(`data::text ILIKE $${paramCount}`);
                params.push(`%${country}%`);
                paramCount++;
            }
            
            query += conditions.join(' AND ') + ' ORDER BY created_at';
            
            const result = await pool.query(query, params);
            
            const places = {};
            result.rows.forEach(row => {
                places[row.name] = row.data;
            });


            res.json(places);
        } catch (error) {
            console.error('Error in search:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// 4. Create or update place (without cache - with tracking)
router.post('/',
    async (req, res) => {
        const { name, data } = req.body;
        if (!name || !data) {
            return res.status(400).json({ error: 'Missing required fields: name and data' });
        }
        try {
            await pool.query(
                `INSERT INTO natural_places (name, data)
                 VALUES ($1, $2)
                 ON CONFLICT (name) DO UPDATE SET
                    data = EXCLUDED.data,
                    updated_at = CURRENT_TIMESTAMP`,
                [name, data]
            );

            // Clear cache after modification
            const { clearCache } = require('../middlewares/cacheMiddleware');
            clearCache('/api/places');

            res.status(200).json({
                message: 'Place saved successfully',
                name: name
            });
        } catch (error) {
            console.error('Error saving place:', error);
            res.status(500).json({ error: 'Error saving to database' });
        }
    }
);

module.exports = router;