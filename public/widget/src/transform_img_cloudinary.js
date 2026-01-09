import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
console.log("🔑 Cloudinary configurado correctamente:", cloudinary.config().cloud_name);
// Definimos las mismas transformaciones que en el preset
const eagerTransformations = [
  { width: 320, height: 180, crop: 'fill' },
  { width: 640, height: 360, crop: 'fill' },
  { width: 1280, height: 720, crop: 'limit' }
];

// Procesa todas las imágenes en tu carpeta Home/assets
(async () => {
  const res = await cloudinary.api.resources({
    type: 'upload',
    prefix: 'Home/assets',
    max_results: 500
  });

  for (const img of res.resources) {
    console.log('Generando transformaciones para:', img.public_id);
    await cloudinary.uploader.explicit(img.public_id, {
      type: 'upload',
      eager: eagerTransformations
    });
  }

  console.log('✅ Todas las imágenes tienen ya sus versiones eager generadas.');
})();
