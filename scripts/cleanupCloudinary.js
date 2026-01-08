// scripts/cleanupCloudinary.js
// Script para limpiar imágenes huérfanas en Cloudinary

const { pool } = require('../db/config');
const { cloudinary } = require('../config/cloudinary');

/**
 * Encontrar y eliminar imágenes en Cloudinary que no están en la base de datos
 */
async function cleanupOrphanedImages() {
    console.log('🧹 Iniciando limpieza de imágenes huérfanas en Cloudinary...');
    
    try {
        // 1. Obtener todos los public_ids de la base de datos
        const dbResult = await pool.query(`
            SELECT DISTINCT cloudinary_public_id 
            FROM client_custom_places 
            WHERE cloudinary_public_id IS NOT NULL
        `);
        
        const dbPublicIds = new Set(dbResult.rows.map(row => row.cloudinary_public_id));
        console.log(`📊 Imágenes en BD: ${dbPublicIds.size}`);
        
        // 2. Obtener todos los recursos en Cloudinary (carpeta customPlaces)
        let allResources = [];
        let nextCursor = null;
        
        do {
            const options = {
                type: 'upload',
                prefix: 'customPlaces/',
                max_results: 500
            };
            
            if (nextCursor) {
                options.next_cursor = nextCursor;
            }
            
            const result = await cloudinary.api.resources(options);
            allResources = allResources.concat(result.resources);
            nextCursor = result.next_cursor;
            
            console.log(`📦 Cargados ${allResources.length} recursos hasta ahora...`);
            
        } while (nextCursor);
        
        console.log(`☁️ Total de recursos en Cloudinary: ${allResources.length}`);
        
        // 3. Encontrar imágenes huérfanas
        const orphanedImages = allResources.filter(resource => {
            return !dbPublicIds.has(resource.public_id);
        });
        
        console.log(`🔍 Imágenes huérfanas encontradas: ${orphanedImages.length}`);
        
        if (orphanedImages.length === 0) {
            console.log('✅ No hay imágenes huérfanas para limpiar');
            return { deleted: 0, orphaned: [] };
        }
        
        // 4. Mostrar lista de imágenes a eliminar
        console.log('\n📋 Imágenes que serán eliminadas:');
        orphanedImages.forEach((img, index) => {
            console.log(`   ${index + 1}. ${img.public_id} (${(img.bytes / 1024).toFixed(2)} KB)`);
        });
        
        // 5. Eliminar imágenes huérfanas (en lotes de 100)
        const publicIdsToDelete = orphanedImages.map(img => img.public_id);
        const batchSize = 100;
        let deletedCount = 0;
        
        for (let i = 0; i < publicIdsToDelete.length; i += batchSize) {
            const batch = publicIdsToDelete.slice(i, i + batchSize);
            
            try {
                const result = await cloudinary.api.delete_resources(batch);
                deletedCount += Object.keys(result.deleted).length;
                console.log(`🗑️ Eliminado lote ${Math.floor(i / batchSize) + 1}: ${Object.keys(result.deleted).length} imágenes`);
            } catch (error) {
                console.error(`❌ Error eliminando lote:`, error.message);
            }
        }
        
        console.log(`\n✅ Limpieza completada: ${deletedCount} imágenes eliminadas`);
        
        // 6. Calcular espacio liberado
        const bytesFreed = orphanedImages.reduce((sum, img) => sum + img.bytes, 0);
        const mbFreed = (bytesFreed / (1024 * 1024)).toFixed(2);
        console.log(`💾 Espacio liberado: ${mbFreed} MB`);
        
        return {
            deleted: deletedCount,
            orphaned: orphanedImages.map(img => img.public_id),
            spaceSaved: mbFreed
        };
        
    } catch (error) {
        console.error('❌ Error durante la limpieza:', error);
        throw error;
    }
}

/**
 * Eliminar carpeta completa de un cliente cancelado
 */
async function cleanupClientFolder(clientId) {
    try {
        console.log(`🗑️ Eliminando carpeta del cliente ${clientId}...`);
        
        const folder = `customPlaces/client-${clientId}`;
        
        // Obtener todos los recursos
        const resources = await cloudinary.api.resources({
            type: 'upload',
            prefix: folder,
            max_results: 500
        });
        
        if (resources.resources.length === 0) {
            console.log('⚠️ No se encontraron recursos en la carpeta');
            return { deleted: 0 };
        }
        
        // Eliminar recursos
        const publicIds = resources.resources.map(r => r.public_id);
        const result = await cloudinary.api.delete_resources(publicIds);
        
        console.log(`✅ Eliminados ${Object.keys(result.deleted).length} recursos del cliente ${clientId}`);
        
        return result;
        
    } catch (error) {
        console.error('❌ Error eliminando carpeta del cliente:', error);
        throw error;
    }
}

/**
 * Reporte de uso de Cloudinary
 */
async function getCloudinaryUsageReport() {
    try {
        console.log('📊 Generando reporte de uso de Cloudinary...');
        
        // Obtener todos los recursos
        const resources = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'customPlaces/',
            max_results: 500
        });
        
        // Agrupar por cliente
        const byClient = {};
        let totalBytes = 0;
        
        resources.resources.forEach(resource => {
            const match = resource.public_id.match(/customPlaces\/client-(\d+)/);
            if (match) {
                const clientId = match[1];
                if (!byClient[clientId]) {
                    byClient[clientId] = {
                        count: 0,
                        bytes: 0
                    };
                }
                byClient[clientId].count++;
                byClient[clientId].bytes += resource.bytes;
                totalBytes += resource.bytes;
            }
        });
        
        console.log('\n📈 REPORTE DE USO:');
        console.log(`Total de imágenes: ${resources.resources.length}`);
        console.log(`Espacio total: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`\nPor cliente:`);
        
        Object.keys(byClient).forEach(clientId => {
            const data = byClient[clientId];
            const mb = (data.bytes / (1024 * 1024)).toFixed(2);
            console.log(`  Cliente ${clientId}: ${data.count} imágenes (${mb} MB)`);
        });
        
        return {
            totalImages: resources.resources.length,
            totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
            byClient
        };
        
    } catch (error) {
        console.error('❌ Error generando reporte:', error);
        throw error;
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'cleanup':
            cleanupOrphanedImages()
                .then(() => process.exit(0))
                .catch(error => {
                    console.error(error);
                    process.exit(1);
                });
            break;
            
        case 'report':
            getCloudinaryUsageReport()
                .then(() => process.exit(0))
                .catch(error => {
                    console.error(error);
                    process.exit(1);
                });
            break;
            
        case 'delete-client':
            const clientId = process.argv[3];
            if (!clientId) {
                console.error('❌ Debes proporcionar un client ID');
                process.exit(1);
            }
            cleanupClientFolder(clientId)
                .then(() => process.exit(0))
                .catch(error => {
                    console.error(error);
                    process.exit(1);
                });
            break;
            
        default:
            console.log(`
Uso: node cleanupCloudinary.js <comando>

Comandos disponibles:
  cleanup          - Eliminar imágenes huérfanas
  report           - Generar reporte de uso
  delete-client <id> - Eliminar carpeta de un cliente
            `);
            process.exit(0);
    }
}

module.exports = {
    cleanupOrphanedImages,
    cleanupClientFolder,
    getCloudinaryUsageReport
};