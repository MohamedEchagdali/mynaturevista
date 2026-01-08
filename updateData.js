import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import "dotenv/config";

// === Absolute paths ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const paths = {
  places: path.join(__dirname, "./public/widget/dataDom/eachplace.json"),
  countries: path.join(__dirname, "./public/widget/dataDom/dataCountry.json"),
};

// === Verify DATABASE_URL ===
if (!process.env.DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL not found in environment variables");
  console.log("Please check your .env file");
  process.exit(1);
}

// === PostgreSQL connection ===
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test connection
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// === Generic UPSERT function ===
async function upsertData(table, keyField, data) {
  let upserted = 0;
  const client = await pool.connect();
  
  try {
    for (const [key, value] of Object.entries(data)) {
      const result = await client.query(
        `
        INSERT INTO ${table} (${keyField}, data, created_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (${keyField})
        DO UPDATE SET data = EXCLUDED.data, created_at = NOW()
        `,
        [key, JSON.stringify(value)]
      );
      
      if (result.rowCount > 0) upserted++;
    }
  } finally {
    client.release();
  }
  
  return upserted;
}

// === Places synchronization ===
async function syncPlaces() {
  if (!fs.existsSync(paths.places)) {
    console.error(`❌ File not found: ${paths.places}`);
    return;
  }

  const jsonData = JSON.parse(fs.readFileSync(paths.places, "utf8"));
  const total = Object.keys(jsonData).length;
  
  console.log(`\n📍 Synchronizing places (${total})...`);
  
  const upserted = await upsertData("natural_places", "name", jsonData);
  
  console.log(`✅ Places inserted/updated: ${upserted}`);
}

// === Countries synchronization ===
async function syncCountries() {
  if (!fs.existsSync(paths.countries)) {
    console.error(`❌ File not found: ${paths.countries}`);
    return;
  }

  const jsonData = JSON.parse(fs.readFileSync(paths.countries, "utf8"));
  const total = Object.keys(jsonData).length;
  
  console.log(`\n🌎 Synchronizing countries (${total})...`);
  
  const upserted = await upsertData("countries", "name", jsonData);
  
  console.log(`✅ Countries inserted/updated: ${upserted}`);
}

// === Main execution ===
async function run() {
  console.log('🔄 Starting synchronization...');
  console.log(`📁 Working directory: ${__dirname}`);
  
  try {
    // Test database connection
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();

    await syncPlaces();
    await syncCountries();
    console.log('\n✅ Synchronization completed successfully');
  } catch (err) {
    console.error("❌ Error during synchronization:", err.message);
    console.error("Stack trace:", err.stack);
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

run();