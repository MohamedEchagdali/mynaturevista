// config/database.js - Unified PostgreSQL configuration
const { Pool } = require('pg');
require('dotenv').config();

// ========================================
// CONNECTION POOL CONFIGURATION
// ========================================
const poolConfig = {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    // Additional recommended configurations
    max: 20, // Maximum number of connections in pool
    idleTimeoutMillis: 30000, // Wait time before closing inactive connection
    connectionTimeoutMillis: 10000, // Maximum wait time to get connection (10 seconds)
};

const pool = new Pool(poolConfig);

// ========================================
// INITIAL CONNECTION TEST
// ========================================
// Test database connection on startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        // Errors should ALWAYS be logged, even in production
        console.error('❌ Error connecting to PostgreSQL:', err.message);
        if (process.env.NODE_ENV !== 'production') {
            console.error('🔧 Check your environment variables in .env');
            console.error('Full error:', err);
        }
        // Optional: exit the process if DB connection fails
        // process.exit(1);
    } else {
        // Success logs only in development
        if (process.env.NODE_ENV !== 'production') {
            console.log('✅ PostgreSQL connection established successfully');
            console.log('📅 Server time:', res.rows[0].now);
        }
    }
});

// ========================================
// QUERY FUNCTION WITH DEBUG AND LOGGING
// ========================================
const query = (text, params) => {
    const start = Date.now();
    
    // Log only in development
    if (process.env.NODE_ENV === 'development') {
        console.log('🔍 EXECUTING QUERY:', { 
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            params: params 
        });
    }
    
    return pool.query(text, params)
        .then(res => {
            const duration = Date.now() - start;
            
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ QUERY RESULT:', { 
                    rowCount: res.rowCount,
                    duration: `${duration}ms`
                });
            }
            
            return res;
        })
        .catch(err => {
            const duration = Date.now() - start;
            
            console.error('❌ QUERY ERROR:', {
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                params,
                error: err.message,
                duration: `${duration}ms`
            });
            
            throw err;
        });
};

// ========================================
// TRANSACTION FUNCTION
// ========================================
const transaction = async (callback) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Transaction error:', err.message);
        throw err;
    } finally {
        client.release();
    }
};

// ========================================
// CLEAN SHUTDOWN HANDLING
// ========================================
const closePool = async () => {
    try {
        await pool.end();
        console.log('✅ Database pool closed successfully');
    } catch (err) {
        console.error('❌ Error closing pool:', err.message);
    }
};

// Listen for shutdown signals
process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, closing database connections...');
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, closing database connections...');
    await closePool();
    process.exit(0);
});

// ========================================
// POOL ERROR HANDLING
// ========================================
pool.on('error', (err, client) => {
    console.error('❌ Unexpected error on idle PostgreSQL client:', err.message);
});

pool.on('connect', () => {
    if (process.env.NODE_ENV === 'development') {
        console.log('🔗 New connection established to pool');
    }
});

pool.on('remove', () => {
    if (process.env.NODE_ENV === 'development') {
        console.log('🔌 Connection removed from pool');
    }
});

// ========================================
// EXPORT MODULES
// ========================================
module.exports = {
    pool,           // Connection pool (for direct use)
    query,          // Query function with logging
    transaction,    // Function for transactions
    closePool       // Function to manually close the pool
};