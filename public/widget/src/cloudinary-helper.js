/**
 * Cloudinary Image & Video Helper
 * Transforma rutas locales a URLs de Cloudinary manteniendo la estructura completa de carpetas
 */

// Configuración de Cloudinary
const CLOUDINARY_CONFIG = {
  cloud_name: 'drprd4k9o',
  folder_prefix: 'Home', // Prefix raíz en Cloudinary
  default_transformations: {
    quality: 'auto',
    format: 'auto'
  }
};

// Extensiones soportadas
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv'];

/**
 * Detecta si una ruta es un video
 * @param {string} path - Ruta del archivo
 * @returns {boolean}
 */
function isVideo(path) {
  if (!path || typeof path !== 'string') return false;
  const ext = path.toLowerCase().match(/\.[^.]+$/)?.[0];
  return VIDEO_EXTENSIONS.includes(ext);
}

/**
 * Transforma una ruta local de asset a URL de Cloudinary
 * @param {string} localPath - Ruta local (ej: "./assets/images/EEUU/Acadia.jpg" o "./assets/videos/intro.mp4")
 * @param {object} transformations - Transformaciones opcionales (width, height, crop, etc.)
 * @returns {string} URL de Cloudinary o ruta original si no es un asset
 */
export function getCloudinaryUrl(localPath, transformations = {}) {
  if (!localPath || typeof localPath !== 'string') {
    return localPath;
  }

  // Solo transformar rutas que sean assets
  if (!localPath.includes('assets')) {
    return localPath;
  }

  // Normalizar la ruta: quitar "./" o "/"
  let normalizedPath = localPath
    .replace(/^\.\//, '')
    .replace(/^\//, '');

  // Si no empieza con "assets", no es una ruta que queremos transformar
  if (!normalizedPath.startsWith('assets')) {
    return localPath;
  }

  // 🔧 CLAVE: Construir el public_id manteniendo la estructura COMPLETA
  // Ejemplo: "assets/images/EEUU/Acadia.jpg" -> "Home/assets/images/EEUU/Acadia"
  // Ejemplo: "assets/videos/intro.mp4" -> "Home/assets/videos/intro"
  const publicId = `${CLOUDINARY_CONFIG.folder_prefix}/${normalizedPath.replace(/\.[^/.]+$/, '')}`;

  // Detectar el tipo de recurso (video o imagen)
  const resourceType = isVideo(localPath) ? 'video' : 'image';

  // Construir parámetros de transformación
  const transformParams = {
    ...CLOUDINARY_CONFIG.default_transformations,
    ...transformations
  };

  // Construir parámetros SIN duplicados
  const transformString = Object.entries(transformParams)
    .filter(([_, value]) => value !== undefined && value !== null)
    .reduce((acc, [key, value]) => {
      const paramMap = {
        quality: 'q',
        format: 'f',
        fetch_format: 'f',
        width: 'w',
        height: 'h',
        crop: 'c'
      };
      const paramName = paramMap[key] || key;
      const paramValue = `${paramName}_${value}`;
      
      // Evitar duplicados (ej: f_auto aparece dos veces)
      if (!acc.includes(paramValue)) {
        acc.push(paramValue);
      }
      return acc;
    }, [])
    .join(',');

  // Construir URL de Cloudinary (cambiar el tipo de recurso según sea imagen o video)
  const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloud_name}/${resourceType}/upload/${transformString ? transformString + '/' : ''}${publicId}`;

  return cloudinaryUrl;
}

/**
 * Transforma recursivamente todas las URLs de imágenes y videos en un objeto de datos
 * @param {any} data - Objeto con datos que pueden contener rutas de imágenes/videos
 * @param {object} transformations - Transformaciones opcionales
 * @returns {any} Objeto con URLs transformadas
 */
export function transformDataUrls(data, transformations = {}) {
  if (Array.isArray(data)) {
    return data.map(item => transformDataUrls(item, transformations));
  } else if (data && typeof data === 'object') {
    const transformed = {};
    for (const [key, value] of Object.entries(data)) {
      // Transformar campos que suelen contener URLs de imágenes o videos
      if (['src', 'image', 'url', 'flag', 'icon', 'video', 'videoUrl', 'thumbnail'].includes(key) && typeof value === 'string') {
        transformed[key] = getCloudinaryUrl(value, transformations);
      } else {
        transformed[key] = transformDataUrls(value, transformations);
      }
    }
    return transformed;
  }
  return data;
}

/**
 * Obtiene URL de Cloudinary con transformaciones responsive
 * @param {string} localPath - Ruta local
 * @param {number} width - Ancho deseado
 * @param {number} height - Alto deseado (opcional)
 * @param {string} crop - Modo de recorte (fill, fit, limit, scale, etc.)
 * @returns {string} URL de Cloudinary optimizada
 */
export function getResponsiveUrl(localPath, width, height = null, crop = 'limit') {
  const transformations = {
    width,
    crop
  };

  if (height) {
    transformations.height = height;
  }

  return getCloudinaryUrl(localPath, transformations);
}

/**
 * Genera URLs para srcset responsive
 * @param {string} localPath - Ruta local
 * @param {array} widths - Array de anchos (ej: [320, 640, 1280])
 * @returns {string} String de srcset
 */
export function generateSrcset(localPath, widths = [320, 640, 1280, 1920]) {
  return widths
    .map(width => `${getResponsiveUrl(localPath, width)} ${width}w`)
    .join(', ');
}

// Presets comunes de transformaciones
export const CLOUDINARY_PRESETS = {
  thumbnail: { width: 320, height: 180, crop: 'fill' },
  card: { width: 640, height: 360, crop: 'fill' },
  hero: { width: 1920, height: 1080, crop: 'limit' },
  flag: { width: 120, height: 80, crop: 'fill' }
};

/**
 * Convierte todas las imágenes y videos del DOM a URLs de Cloudinary
 * Útil para contenido hardcodeado en el HTML
 */
export function convertDOMImagesToCloudinary() {
  // Convertir imágenes
  const images = document.querySelectorAll('img[src*="assets"]');
  images.forEach(img => {
    const originalSrc = img.getAttribute('src');
    const cloudinaryUrl = getCloudinaryUrl(originalSrc);
    
    if (cloudinaryUrl !== originalSrc) {
      img.setAttribute('src', cloudinaryUrl); 
    }
  });
  
  // Convertir videos
  const videos = document.querySelectorAll('video source[src*="assets"], video[src*="assets"]');
  videos.forEach(video => {
    const originalSrc = video.getAttribute('src');
    const cloudinaryUrl = getCloudinaryUrl(originalSrc);
    
    if (cloudinaryUrl !== originalSrc) {
      video.setAttribute('src', cloudinaryUrl); 
    }
  });
   
}

/**
 * 🆕 Verificar si una URL de Cloudinary existe (útil para debugging)
 * @param {string} cloudinaryUrl - URL de Cloudinary
 * @returns {Promise<boolean>} True si la imagen existe
 */
export async function verifyCloudinaryImage(cloudinaryUrl) {
  try {
    const response = await fetch(cloudinaryUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * 🆕 Helper para debug: muestra la transformación de una ruta
 * @param {string} localPath - Ruta local
 */
export function debugCloudinaryTransform(localPath) {
  console.group(`🔍 Debug: ${localPath}`);
  console.log('Original:', localPath);
  console.log('Cloudinary URL:', getCloudinaryUrl(localPath));
  console.log('Con transformaciones:', getCloudinaryUrl(localPath, { width: 800, height: 600, crop: 'fill' }));
  console.log('Es video:', isVideo(localPath));
  console.groupEnd();
}

/**
 * 🎥 Obtener URL de video con transformaciones específicas para video
 * @param {string} localPath - Ruta local del video
 * @param {object} options - Opciones: width, height, quality, format
 * @returns {string} URL de Cloudinary optimizada para video
 */
export function getVideoUrl(localPath, options = {}) {
  const { width, height, quality = 'auto', format = 'mp4' } = options;
  
  const transformations = {
    quality,
    format
  };
  
  if (width) transformations.width = width;
  if (height) transformations.height = height;
  
  return getCloudinaryUrl(localPath, transformations);
}

/**
 * 🎥 Generar thumbnail de video (frame específico)
 * @param {string} localPath - Ruta local del video
 * @param {object} options - width, height, time (segundos en el video)
 * @returns {string} URL del thumbnail
 */
export function getVideoThumbnail(localPath, options = {}) {
  const { width = 640, height = 360, time = 0 } = options;
  
  if (!isVideo(localPath)) {
    console.warn('⚠️ getVideoThumbnail: la ruta no parece ser un video');
    return localPath;
  }
  
  // Para thumbnails de video, necesitamos usar el formato de imagen
  const normalizedPath = localPath
    .replace(/^\.\//, '')
    .replace(/^\//, '');
  
  const publicId = `${CLOUDINARY_CONFIG.folder_prefix}/${normalizedPath.replace(/\.[^/.]+$/, '')}`;
  
  // Construcción especial para thumbnail de video
  const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloud_name}/video/upload/w_${width},h_${height},c_fill,so_${time},f_jpg/${publicId}.jpg`;
  
  return cloudinaryUrl;
}