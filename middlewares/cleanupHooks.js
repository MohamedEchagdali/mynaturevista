// middlewares/cleanupHooks.js
// Automatic cleanup hooks
const { deleteCustomPlaceFolder } = require('../config/cloudinary');
const { pool } = require('../db/config');

/**
 * Hook that runs when canceling an additional domain
 * Cleans up all associated Cloudinary images
 */
async function onDomainCancellation(clientId, domainId) {
    console.log(`🧹 Starting cleanup for domain ${domainId} cancellation of client ${clientId}`);
    
    try {
        // 1. Get API key ID from domain
        const apiKeyResult = await pool.query(`
            SELECT id FROM api_keys
            WHERE client_id = $1 
            AND domain = (
                SELECT domain FROM extra_domains WHERE id = $2
            )
        `, [clientId, domainId]);
        
        if (apiKeyResult.rows.length === 0) {
            console.log('⚠️ API key not found for this domain');
            return;
        }
        
        const apiKeyId = apiKeyResult.rows[0].id;
        
        // 2. Delete Cloudinary folder
        await deleteCustomPlaceFolder(clientId, apiKeyId);
        
        // 3. Clean up references in database (optional, as rows are deleted)
        const cleanupResult = await pool.query(`
            UPDATE client_custom_places
            SET cloudinary_public_id = NULL
            WHERE api_key_id = $1
        `, [apiKeyId]);
        
        console.log(`✅ Cleanup completed: ${cleanupResult.rowCount} records updated`);
        
    } catch (error) {
        console.error('❌ Error during domain cleanup:', error);
        // Don't throw error to avoid blocking main process
    }
}

/**
 * Hook that runs when deleting a complete client
 * Cleans up ALL client's Cloudinary folders
 */
async function onClientDeletion(clientId) {
    console.log(`🧹 Starting complete cleanup for client ${clientId}`);
    
    try {
        // 1. Get all client's API keys
        const apiKeysResult = await pool.query(`
            SELECT id FROM api_keys WHERE client_id = $1
        `, [clientId]);
        
        // 2. Delete each domain folder
        for (const apiKey of apiKeysResult.rows) {
            try {
                await deleteCustomPlaceFolder(clientId, apiKey.id);
            } catch (error) {
                console.error(`⚠️ Error deleting domain folder ${apiKey.id}:`, error.message);
            }
        }
        
        console.log(`✅ Client cleanup completed`);
        
    } catch (error) {
        console.error('❌ Error during client cleanup:', error);
    }
}

/**
 * Hook that runs when deleting a custom place
 * Deletes its image from Cloudinary
 */
async function onCustomPlaceDeletion(placeId, cloudinaryPublicId) {
    if (!cloudinaryPublicId) {
        console.log(`⚠️ Place ${placeId} has no image in Cloudinary`);
        return;
    }
    
    console.log(`🗑️ Deleting image from Cloudinary: ${cloudinaryPublicId}`);
    
    try {
        const { deleteCustomPlaceImage } = require('../config/cloudinary');
        await deleteCustomPlaceImage(cloudinaryPublicId);
        console.log(`✅ Image deleted from Cloudinary`);
    } catch (error) {
        console.error('❌ Error deleting image:', error);
    }
}

module.exports = {
    onDomainCancellation,
    onClientDeletion,
    onCustomPlaceDeletion
};