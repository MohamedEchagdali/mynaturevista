// config/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Subir imagen a Cloudinary con estructura: customPlaces/client-{id}/domain-{id}/
 */
async function uploadCustomPlaceImage(imageBase64, clientId, apiKeyId, placeId = null) {
    try {
        // Estructura de carpetas: customPlaces/client-123/domain-456/
        const folder = `customPlaces/client-${clientId}/domain-${apiKeyId}`;
        
        const publicId = placeId 
            ? `place-${placeId}-${Date.now()}`
            : `place-temp-${Date.now()}`;
        
        const result = await cloudinary.uploader.upload(imageBase64, {
            folder: folder,
            public_id: publicId,
            resource_type: 'image',
            transformation: [
                { width: 800, height: 600, crop: 'fill', gravity: 'auto' },
                { quality: 'auto:good' },
                { fetch_format: 'auto' }
            ],
            tags: [`client-${clientId}`, `domain-${apiKeyId}`]
        });
        
        return {
            url: result.secure_url,
            publicId: result.public_id
        };
        
    } catch (error) {
        throw new Error('Failed to upload image to Cloudinary');
    }
}

/**
 * Eliminar imagen de Cloudinary
 */
async function deleteCustomPlaceImage(publicId) {
    try {
        if (!publicId) {
            return;
        }
        
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
        
    } catch (error) {
        console.error('❌ Error eliminando imagen:', error);
        // No lanzar error para no bloquear otras operaciones
        return null;
    }
}

/**
 * Eliminar carpeta completa de un dominio cuando se cancela
 */
async function deleteCustomPlaceFolder(clientId, apiKeyId) {
    try {
        const folder = `customPlaces/client-${clientId}/domain-${apiKeyId}`;
        
        // Obtener todos los recursos en la carpeta
        const resources = await cloudinary.api.resources({
            type: 'upload',
            prefix: folder,
            max_results: 500
        });
        
        // Eliminar cada recurso
        if (resources.resources && resources.resources.length > 0) {
            const publicIds = resources.resources.map(r => r.public_id);
            const result = await cloudinary.api.delete_resources(publicIds);
            return result;
        } else {
            return { deleted: [] };
        }
        
    } catch (error) {
        console.error('❌ Error eliminando carpeta:', error);
        throw error;
    }
}

/**
 * Actualizar imagen (eliminar la vieja y subir la nueva)
 */
async function updateCustomPlaceImage(oldPublicId, newImageBase64, clientId, apiKeyId, placeId) {
    try {
        // Subir nueva imagen
        const uploadResult = await uploadCustomPlaceImage(newImageBase64, clientId, apiKeyId, placeId);
        
        // Eliminar imagen vieja (no bloqueante)
        if (oldPublicId) {
            deleteCustomPlaceImage(oldPublicId).catch(err => {
                console.error('⚠️ Error eliminando imagen vieja:', err);
            });
        }
        
        return uploadResult;
        
    } catch (error) {
        console.error('❌ Error actualizando imagen:', error);
        throw error;
    }
}

module.exports = {
    cloudinary,
    uploadCustomPlaceImage,
    deleteCustomPlaceImage,
    deleteCustomPlaceFolder,
    updateCustomPlaceImage
};