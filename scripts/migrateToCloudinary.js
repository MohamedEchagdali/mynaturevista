// scripts/migrateToCloudinary.js
// Migrar imágenes base64 existentes en PostgreSQL a Cloudinary

const { pool } = require('../db/config');
const { uploadCustomPlaceImage } = require('../config/cloudinary');

async function migrateExistingImages() {
    try {
        // 1. Obtener lugares con imágenes base64
        const result = await pool.query(`
            SELECT 
                ccp.id,
                ccp.client_id,
                ccp.api_key_id,
                ccp.image_url,
                ccp.title,
                ak.domain
            FROM client_custom_places ccp
            INNER JOIN api_keys ak ON ccp.api_key_id = ak.id
            WHERE ccp.image_url LIKE 'data:image%'
            AND ccp.cloudinary_public_id IS NULL
            ORDER BY ccp.id
        `);
        
        const totalPlaces = result.rows.length;
        
        if (totalPlaces === 0) {
            return { success: true, migrated: 0, failed: 0 };
        }
        
        let migratedCount = 0;
        let failedCount = 0;
        const failures = [];
        
        // 2. Migrar cada imagen
        for (let i = 0; i < result.rows.length; i++) {
            const place = result.rows[i];
            const progress = `[${i + 1}/${totalPlaces}]`;
            
            try {
                // Subir a Cloudinary
                const uploaded = await uploadCustomPlaceImage(
                    place.image_url,
                    place.client_id,
                    place.api_key_id,
                    place.id
                );
                
                // Actualizar BD
                await pool.query(`
                    UPDATE client_custom_places
                    SET 
                        image_url = $1, 
                        cloudinary_public_id = $2,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3
                `, [uploaded.url, uploaded.publicId, place.id]);
                
                migratedCount++;
                
                // Pequeña pausa para no saturar Cloudinary
                if (i < result.rows.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
                
            } catch (error) {
                failedCount++;
                const errorMsg = error.message || 'Unknown error';
                console.error(`   ❌ Error: ${errorMsg}\n`);
                
                failures.push({
                    placeId: place.id,
                    title: place.title,
                    error: errorMsg
                });
            }
        }
        // 4. Detalles de fallos
        if (failures.length > 0) {
            console.log('❌ LUGARES CON ERRORES:');
            failures.forEach((failure, index) => {
                console.log(`\n${index + 1}. Lugar #${failure.placeId}: "${failure.title}"`);
                console.log(`   Error: ${failure.error}`);
            });
        }
        
        // 5. Verificación final
        const verifyResult = await pool.query(`
            SELECT COUNT(*) as remaining
            FROM client_custom_places
            WHERE image_url LIKE 'data:image%'
            AND cloudinary_public_id IS NULL
        `);
        
        const remainingCount = parseInt(verifyResult.rows[0].remaining);
        
        if (remainingCount === 0) {
            console.log('🎉 ¡MIGRACIÓN COMPLETADA! Todas las imágenes están en Cloudinary');
        } else {
            console.log(`⚠️ Quedan ${remainingCount} imágenes pendientes de migrar`);
            console.log('   Puedes volver a ejecutar este script para reintentarlo');
        }
        
        return {
            success: failedCount === 0,
            total: totalPlaces,
            migrated: migratedCount,
            failed: failedCount,
            failures: failures,
            remaining: remainingCount
        };
        
    } catch (error) {
        console.error('❌ Error crítico durante la migración:', error);
        throw error;
    }
}

/**
 * Verificar estado de la migración
 */
async function checkMigrationStatus() {
    try {
        const stats = await pool.query(`
            SELECT 
                COUNT(*) FILTER (WHERE cloudinary_public_id IS NOT NULL) as migrated,
                COUNT(*) FILTER (WHERE cloudinary_public_id IS NULL AND image_url LIKE 'data:image%') as pending,
                COUNT(*) as total
            FROM client_custom_places
        `);
        
        const { migrated, pending, total } = stats.rows[0];
        
        if (pending > 0) {
            console.log(`\n⚠️ Hay ${pending} imágenes pendientes de migrar`);
            console.log('   Ejecuta: node scripts/migrateToCloudinary.js migrate');
        } else {
            console.log('\n🎉 ¡Todas las imágenes están en Cloudinary!');
        }
        
        return stats.rows[0];
        
    } catch (error) {
        console.error('❌ Error verificando estado:', error);
        throw error;
    }
}

/**
 * Rollback: restaurar desde Cloudinary si algo sale mal
 * (Solo para testing, no usar en producción)
 */
async function rollbackMigration() {
    console.log('⚠️ ROLLBACK: Volviendo a base64 (solo para testing)\n');
    
    const result = await pool.query(`
        UPDATE client_custom_places
        SET cloudinary_public_id = NULL
        WHERE cloudinary_public_id IS NOT NULL
        RETURNING id
    `);
}

// CLI
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'migrate':
            migrateExistingImages()
                .then(() => {
                    console.log('\n✅ Proceso finalizado');
                    process.exit(0);
                })
                .catch(error => {
                    console.error('\n❌ Proceso fallido:', error);
                    process.exit(1);
                });
            break;
            
        case 'status':
            checkMigrationStatus()
                .then(() => process.exit(0))
                .catch(error => {
                    console.error(error);
                    process.exit(1);
                });
            break;
            
        case 'rollback':
            console.log('⚠️ ADVERTENCIA: Esto es solo para testing');
            console.log('¿Estás seguro? (Ctrl+C para cancelar, Enter para continuar)');
            
            process.stdin.once('data', () => {
                rollbackMigration()
                    .then(() => process.exit(0))
                    .catch(error => {
                        console.error(error);
                        process.exit(1);
                    });
            });
            break;
            
        default:
            process.exit(0);
    }
}

module.exports = {
    migrateExistingImages,
    checkMigrationStatus,
    rollbackMigration
};