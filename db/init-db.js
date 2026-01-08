const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDb() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    // Create database if it doesn't exist
    await pool.query(`CREATE DATABASE ${process.env.DB_DATABASE}`);
    console.log(`Database ${process.env.DB_DATABASE} created.`);
  } catch (err) {
    console.log(`Database ${process.env.DB_DATABASE} already exists.`);
  } finally {
    await pool.end();
  }

  // Connect to the created database
  const dbPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });

  try {
    // Read and execute SQL schema
    const schema = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
    await dbPool.query(schema);
    console.log('✅ Tables created successfully');
  } catch (err) {
    console.error('❌ Error creating tables:', err);
  } finally {
    await dbPool.end();
  }
}

initDb();