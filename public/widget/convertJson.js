const fs = require('fs');
const { Client } = require('pg');

// Cargar variables de entorno
require('dotenv').config();

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
});

async function insertJSONB() {
  try {
    await client.connect();
    console.log('Conexión exitosa');

    // Posibles rutas del archivo - probemos varias
    const possiblePaths = [
      '/widget/dataDom/eachPlace.json',           // Mismo nivel
      '/public//widgetdataDom/eachPlace.json',          // Un nivel arriba
      '/widget/eachPlace.json',                   // Subcarpeta dataDom
      '/public/widget/eachPlace.json',                   // En public
      '/public/widget/dataDom/eachPlace.json'        // Dos niveles arriba
    ];
    
    let filePath = null;
    
    console.log('Buscando archivo en las siguientes rutas:');
    for (const path of possiblePaths) {
      console.log(`  Probando: ${path}`);
      if (fs.existsSync(path)) {
        filePath = path;
        console.log(`  ✓ ¡Encontrado en: ${path}!`);
        break;
      } else {
        console.log(`  ✗ No encontrado`);
      }
    }
    
    if (!filePath) {
      console.log('\n📁 Archivos en el directorio actual:');
      try {
        const files = fs.readdirSync('./');
        files.forEach(file => console.log(`  - ${file}`));
        
        console.log('\n📁 Buscando carpetas public:');
        if (fs.existsSync('./public')) {
          console.log('  ✓ Carpeta ./public existe');
          const publicFiles = fs.readdirSync('./public');
          publicFiles.forEach(file => console.log(`    - public/${file}`));
        } else {
          console.log('  ✗ No hay carpeta ./public');
        }
      } catch (dirError) {
        console.log('Error listando archivos:', dirError.message);
      }
      
      throw new Error(`No se pudo encontrar eachPlace.json en ninguna de las rutas probadas`);
    }

    console.log(`Leyendo archivo JSON desde: ${filePath}`);
    const raw = fs.readFileSync(filePath, 'utf8');
    
    // Verificar que el archivo no esté vacío
    if (!raw.trim()) {
      throw new Error('El archivo eachPlace.json está vacío');
    }

    console.log('Parseando JSON...');
    const lugares = JSON.parse(raw);
    
    // Verificar que hay datos para insertar
    const entries = Object.entries(lugares);
    if (entries.length === 0) {
      console.log('No hay datos para insertar');
      return;
    }

    console.log(`Encontrados ${entries.length} lugares para insertar`);

    // Verificar que la tabla existe y tiene la estructura correcta
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'natural_places'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creando tabla natural_places...');
      await client.query(`
        CREATE TABLE natural_places (
          id SERIAL PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
    }

    // Insertar datos
    let insertedCount = 0;
    let updatedCount = 0;

    for (const [key, value] of entries) {
      try {
        console.log(`Procesando: ${key}`);
        
        const result = await client.query(
          `INSERT INTO natural_places (name, data) 
           VALUES ($1, $2) 
           ON CONFLICT (name) 
           DO UPDATE SET 
             data = EXCLUDED.data,
             created_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
          [key, JSON.stringify(value)] // Asegurar que sea string JSON válido
        );
        
        if (result.rows[0].inserted) {
          insertedCount++;
          console.log(`✓ Insertado: ${key}`);
        } else {
          updatedCount++;
          console.log(`✓ Actualizado: ${key}`);
        }
        
      } catch (itemError) {
        console.error(`Error procesando ${key}:`, itemError.message);
      }
    }

    console.log(`\n=== RESUMEN ===`);
    console.log(`Registros insertados: ${insertedCount}`);
    console.log(`Registros actualizados: ${updatedCount}`);

    // Verificar la inserción
    const countResult = await client.query('SELECT COUNT(*) FROM natural_places');
    console.log(`Total de registros en la tabla: ${countResult.rows[0].count}`);

  } catch (error) {
    console.error('Error principal:', error);
    
    // Información adicional de debugging
    if (error.code) {
      console.error('Código de error PostgreSQL:', error.code);
    }
    if (error.detail) {
      console.error('Detalle del error:', error.detail);
    }
    
  } finally {
    try {
      await client.end();
      console.log('Conexión cerrada');
    } catch (closeError) {
      console.error('Error cerrando conexión:', closeError);
    }
  }
}

// Función auxiliar para verificar la conexión
async function testConnection() {
  try {
    await client.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Test de conexión exitoso:', result.rows[0]);
    await client.end();
  } catch (error) {
    console.error('Error de conexión:', error);
  }
}

// Ejecutar
console.log('Iniciando proceso de inserción...');
insertJSONB();  