// PRECAUTION: RELLENA las variables de entorno antes de ejecutar
const cloudinary = require('cloudinary').v2;
const { Client } = require('pg');
const glob = require('glob');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const pgClient = new Client({ connectionString: process.env.DATABASE_URL });

/**
 * Configuración de eager transformations que quieres pre-generar
 */
const eagerTransformations = [
  { width: 320, height: 180, crop: 'fill' },
  { width: 640, height: 360, crop: 'fill' },
  { width: 1280, height: 720, crop: 'limit' }
];

async function main() {
  await pgClient.connect();

  // Ejemplo: listar recursos en Cloudinary en la carpeta Home/assets
  // (si tienes muchas imágenes, usar paginación)
  const listRes = await cloudinary.api.resources({
    type: 'upload',
    prefix: 'Home/assets',
    max_results: 500
  });

  for (const resource of listRes.resources) {
    const publicId = resource.public_id; // ej: Home/assets/Namibia/sossusvlei/imagenX
    console.log('Procesando', publicId);

    // 1) Generar eager transformations (si no se generaron en upload)
    try {
      await cloudinary.uploader.explicit(publicId, {
        type: 'upload',
        eager: eagerTransformations.map(t => {
          return `${t.width}x${t.height}${t.crop ? ',' + t.crop : ''}`;
        }),
        eager_async: false // si true, es asíncrono; false espera
      });
    } catch (e) {
      console.error('Error al explicit:', e.message);
    }

    // 2) Construir URL optimizada (puedes personalizar la transformación por defecto)
    const optimizedUrl = cloudinary.url(publicId, {
      type: 'upload',
      format: 'auto',
      quality: 'auto',
      secure: true // https
      // puedes agregar defecto de tamaño: width: 800
    });

    // 3) Buscar en la DB y reemplazar rutas locales por optimizedUrl
    // --- Aquí debes adaptar a tu schema: supongamos tabla places con columna data jsonb ---
    // Buscamos todas las entradas donde el JSON contiene el nombre de archivo
    const filename = publicId.split('/').pop(); // nombre base
    const searchPattern = filename; // simplificado, según cómo guardaste src

    // Consulta simple que busca si el JSON contiene el nombre de archivo
    const findQuery = `
      SELECT id, data
      FROM places
      WHERE data::text ILIKE '%' || $1 || '%'
    `;
    const { rows } = await pgClient.query(findQuery, [searchPattern]);

    for (const row of rows) {
      const id = row.id;
      let data = row.data;

      // recorre recursivamente JSON y reemplaza src que coincidan con filename
      function replaceSrc(obj) {
        if (Array.isArray(obj)) {
          return obj.map(replaceSrc);
        } else if (obj && typeof obj === 'object') {
          for (const key of Object.keys(obj)) {
            if (key === 'src' && typeof obj[key] === 'string' && obj[key].includes(filename)) {
              obj[key] = optimizedUrl;
            } else {
              obj[key] = replaceSrc(obj[key]);
            }
          }
          return obj;
        } else {
          return obj;
        }
      }

      const newData = replaceSrc(JSON.parse(JSON.stringify(data))); // deep copy
      // actualizar row
      await pgClient.query('UPDATE places SET data = $1 WHERE id = $2', [newData, id]);
      console.log(`Actualizado registro ${id} con URL ${optimizedUrl}`);
    }
  }

  await pgClient.end();
  console.log('Finalizado.');
}

main().catch(err => {
  console.error(err);
  pgClient.end();
});
