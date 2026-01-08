// middlewares/cacheMiddleware.js
const NodeCache = require('node-cache');

const dataCache = new NodeCache({ 
    stdTTL: 3600,
    checkperiod: 300
});

function cacheMiddleware(duration = 3600) {
    return (req, res, next) => {
        //console.log('🚨 CACHEMIDDLEWARE EXECUTED 🚨');
        //console.log('   Method:', req.method);
        //console.log('   URL:', req.url);
        //console.log('   originalUrl:', req.originalUrl);
        
        if (req.method !== 'GET') {
            //console.log(`⏭️  Cache skipped (method ${req.method})`);
            return next();
        }

        const cacheKey = req.originalUrl || req.url;
                
        const cachedData = dataCache.get(cacheKey);
        
        if (cachedData) {
            
            // SET HEADERS BEFORE SENDING
            res.set({
                'X-Data-Cache': 'HIT',
                'Cache-Control': `public, max-age=${duration}`,
                'Content-Type': 'application/json; charset=utf-8'
            });
            
            // Send response
            return res.status(200).json(cachedData);
        }        

        // Intercept res.json
        const originalJson = res.json.bind(res);
        
        // FLAG to avoid double-setting
        let headersSent = false;
        
        res.json = function(data) {
            if (!headersSent) {
                headersSent = true;
                
                // SET HEADERS FIRST
                res.set({
                    'X-Data-Cache': 'MISS',
                    'Cache-Control': `public, max-age=${duration}`
                });
                
                // Save to cache if status is 200
                if (res.statusCode === 200) {
                    //console.log(`💾 Saving to cache: ${cacheKey}`);
                    dataCache.set(cacheKey, data, duration);
                }
            }
            
            return originalJson(data);
        };
        
        next();
    };
}

function clearCache(pattern) {
    if (pattern) {
        const keys = dataCache.keys();
        const matchingKeys = keys.filter(key => key.includes(pattern));
        
        if (matchingKeys.length > 0) {
            dataCache.del(matchingKeys);
            //console.log(`🗑️  Cache cleared: ${matchingKeys.length} keys matching "${pattern}"`);
        } else {
            //console.log(`ℹ️  No cache keys found matching "${pattern}"`);
        }
    } else {
        dataCache.flushAll();
        //console.log('🗑️  All cache cleared');
    }
}

function getCacheStats() {
    const stats = dataCache.getStats();
    return {
        keys: dataCache.keys().length,
        hits: stats.hits || 0,
        misses: stats.misses || 0,
        ksize: stats.ksize || 0,
        vsize: stats.vsize || 0
    };
}

module.exports = { 
    cacheMiddleware, 
    clearCache, 
    dataCache,
    getCacheStats 
};