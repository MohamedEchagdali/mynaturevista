//index-map.js
import { transformDataUrls } from './cloudinary-helper.js';

// Security: Sanitize HTML to prevent XSS attacks
function sanitizeHTML(dirty) {
    if (!dirty || typeof dirty !== 'string') return '';

    // Use global DOMPurify (loaded in HTML)
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(dirty, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'svg', 'path', 'circle', 'img'],
            ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'target', 'rel', 'src', 'alt', 'style', 'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'd', 'cx', 'cy', 'r'],
            ALLOW_DATA_ATTR: false
        });
    }

    // Fallback: basic HTML escaping
    const div = document.createElement('div');
    div.textContent = dirty;
    return div.innerHTML;
}

export async function fetchAndShowAllPlacesMap() {
    try {
        // 🎨 GET CLIENT'S CUSTOM COLORS
        const styles = getComputedStyle(document.documentElement);
        const primaryColor = styles.getPropertyValue('--theme-primary').trim() || '#ff2b4f';
        const secondaryColor = styles.getPropertyValue('--theme-secondary').trim() || '#f1683a';
        
        // Helper function for gradients
        const getGradient = () => `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`;
        
        // Get API key from URL
        const urlParams = new URLSearchParams(window.location.search);
        const apiKey = urlParams.get('apikey');
        
        // 🚀 Load normal places
        const placesResponse = await fetch('/api/countries/all/places');
        
        if (!placesResponse.ok) {
            throw new Error(`Error loading places: ${placesResponse.status}`);
        }

        const apiResponse = await placesResponse.json();
        const originalPlaces = apiResponse.places || [];

        // 🎯 Transform URLs to Cloudinary
        const allPlaces = transformDataUrls(originalPlaces);

        // 🆕 Load custom places if API key exists
        let customPlaces = [];
        if (apiKey) {
            try {
                const customUrl = `/api/custom-places/widget/${apiKey}/all`;
                
                const customResponse = await fetch(customUrl);
                
                if (customResponse.ok) {
                    const customData = await customResponse.json();
                    
                    customPlaces = transformDataUrls(customData.places || []);
                } else {
                    const errorText = await customResponse.text();
                    console.error('❌ Error response:', errorText);
                }
            } catch (customError) {
                console.error('❌ Error loading custom places:', customError);
            }
        }

        function buildBaseUrl(basePath) {
            return basePath;
        }

        function buildFullUrl(basePath) {
            const params = new URLSearchParams(window.location.search);
            const apiKey = params.get('apikey');
            const name = params.get('name');

            if (apiKey) {
                params.set('apikey', apiKey);
            }
            if (name) {
                params.set('name', name);
            }

            return `${basePath}${basePath.includes('?') ? '&' : '?'}${params.toString()}`;
        }

        // 1. Verify there are places (normal or custom)
        const totalPlaces = allPlaces.length + customPlaces.length;
        
        if (totalPlaces === 0) {
            console.error("❌ No places to show on the map.");
            const mapContainer = document.getElementById("map");
            if (mapContainer) {
                // Sanitize HTML content for security
                mapContainer.innerHTML = sanitizeHTML(`
                    <div style="padding: 60px 40px; text-align: center;
                                background: ${getGradient()};
                                color: white; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
                        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.9;">🗺️</div>
                        <h3 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 600;">No places available</h3>
                        <p style="margin: 0; opacity: 0.9; font-size: 16px;">No natural places have been added to the database yet.</p>
                    </div>
                `);
            }
            return;
        }

        // 2. Initialize the map
        const firstLocation = customPlaces.length > 0 ? customPlaces[0] : allPlaces[0];
        
        const map = L.map('map', {
            zoomControl: false,
            attributionControl: true,
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            boxZoom: true
        }).setView([firstLocation.lat, firstLocation.lng], 2);

        L.control.zoom({
            position: 'topright'
        }).addTo(map);

        // 🎨 3. MODERN MAP TILES - Multiple professional options
        
        // 3. OpenStreetMap layer

 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {

 attribution: '<a href="https://mynaturevista.com/" target="_blank" rel="noopener" style="color: ' + primaryColor + '; font-weight: 600;">myNaturevista</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',

noWrap: true,

 className: 'map-tiles'

 }).addTo(map);

        map.setMinZoom(2);
        map.setMaxZoom(18);

        const bounds = new L.LatLngBounds();

        const markers = L.markerClusterGroup({
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            spiderfyOnMaxZoom: true,
            removeOutsideVisibleBounds: true,
            maxClusterRadius: 80,
            iconCreateFunction: function(cluster) {
                const count = cluster.getChildCount();
                let size = 'small';
                let clusterClass = 'marker-cluster-small';
                
                if (count >= 100) {
                    size = 'large';
                    clusterClass = 'marker-cluster-large';
                } else if (count >= 20) {
                    size = 'medium';
                    clusterClass = 'marker-cluster-medium';
                }
                
                return L.divIcon({
                    html: `<div style="background: ${getGradient()}; 
                                  color: white; border-radius: 50%; width: 40px; height: 40px; 
                                  display: flex; align-items: center; justify-content: center; 
                                  font-weight: bold; font-size: 14px; 
                                  box-shadow: 0 3px 14px rgba(${hexToRgb(primaryColor)}, 0.4);
                                  border: 3px solid white;">
                                ${count}
                           </div>`,
                    className: `marker-cluster ${clusterClass}`,
                    iconSize: L.point(40, 40)
                });
            }
        });

        // Helper to convert hex to rgb
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255,43,79';
        }

        // 6. Get country flags
        const countryFlags = {};
        const uniqueCountries = [...new Set(allPlaces.map(p => p.pais))];
        
        await Promise.all(uniqueCountries.map(async (countryName) => {
            try {
                const countryResponse = await fetch(`/api/countries/${encodeURIComponent(countryName)}`);
                if (countryResponse.ok) {
                    const originalCountryData = await countryResponse.json();
                    const countryData = transformDataUrls(originalCountryData);
                    
                    if (countryData.hero?.[0]?.flag?.[0]?.src) {
                        countryFlags[countryName] = countryData.hero[0].flag[0].src;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Could not load flag for ${countryName}`);
            }
        }));

        // 7. Add NORMAL markers with flags
        let validPlaces = 0;
        let invalidPlaces = 0;

        allPlaces.forEach(place => {
            if (!place.lat || !place.lng || isNaN(place.lat) || isNaN(place.lng)) {
                console.warn(`⚠️ Place without valid coordinates: ${place.titulo || 'Untitled'}`);
                invalidPlaces++;
                return;
            }

            const flagSrc = countryFlags[place.pais] || '/assets/icons/default-marker.png';
            
            const customIcon = L.divIcon({
                html: `
                    <div style="position: relative; width: 40px; height: 40px;">
                        <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); 
                                    width: 36px; height: 36px; border-radius: 50%; 
                                    background: white; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                                    display: flex; align-items: center; justify-content: center;
                                    overflow: hidden; border: 3px solid white;">
                            <img src="${flagSrc}" 
                                 alt="${place.pais}" 
                                 style="width: 100%; height: 100%; object-fit: cover;"
                                 onerror="this.src='/assets/icons/default-marker.png';">
                        </div>
                        <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
                                    width: 0; height: 0; border-left: 6px solid transparent;
                                    border-right: 6px solid transparent; border-top: 8px solid white;
                                    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));"></div>
                    </div>
                `,
                className: 'custom-flag-marker',
                iconSize: [40, 48],
                iconAnchor: [20, 48],
                popupAnchor: [0, -48]
            });

            const marker = L.marker([place.lat, place.lng], { icon: customIcon });
            const placeBaseUrl = `/widget-eachPlace.html?place=${encodeURIComponent(place.href)}`;

            const popupContent = `
                <div style="width: 100%; max-width: 280px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                    <div style="position: relative; margin: -15px -20px 15px -20px; border-radius: 10px 10px 0 0; overflow: hidden; height: 160px;">
                        <img src="${place.imagenes?.[0]?.src || '/assets/placeholder.jpg'}" 
                            alt="${place.imagenes?.[0]?.alt || place.titulo}" 
                            style="width: 100%; height: 100%; object-fit: cover;"
                            onerror="this.style.display='none'; this.parentElement.style.height='0'; this.parentElement.style.margin='0';">
                        <div style="position: absolute; top: 10px; right: 10px; 
                                    background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
                                    padding: 5px 10px; border-radius: 20px; 
                                    display: flex; align-items: center; gap: 6px;
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                            <img src="${flagSrc}" 
                                 alt="${place.pais}" 
                                 style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; border: 2px solid white;"
                                 onerror="this.style.display='none';">
                            <span style="font-size: 11px; font-weight: 600; color: #333;">
                                ${place.pais || 'Unknown'}
                            </span>
                        </div>
                    </div>
                    
                    <div style="padding: 0;">
                        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #1f2937; line-height: 1.3;">
                            ${place.titulo?.replace(/-/g, ' ') || 'Untitled'}
                        </h3>
                        
                        <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #6b7280; 
                                  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; 
                                  overflow: hidden; text-overflow: ellipsis;">
                            ${place.descriptions || 'No description available'}
                        </p>
                        
                        <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 12px; 
                                    padding: 6px 10px; background: #f3f4f6; border-radius: 6px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${primaryColor}" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span style="font-size: 11px; color: #6b7280; font-weight: 500;">
                                ${place.lat.toFixed(4)}°, ${place.lng.toFixed(4)}°
                            </span>
                        </div>
                        
                        <div class="seeMorePlace internal-link"
                             data-base-url="${placeBaseUrl}"
                             style="display: block; text-align: center; padding: 10px 16px; 
                                    background: ${getGradient()};
                                    color: white; cursor: pointer; border-radius: 8px; 
                                    font-weight: 600; font-size: 13px; text-decoration: none;
                                    transition: all 0.3s ease; 
                                    box-shadow: 0 4px 15px rgba(${hexToRgb(primaryColor)}, 0.3);">
                             <span style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                                Explore This Place
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                             </span>
                        </div>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent, {
                maxWidth: 300,
                minWidth: 240,
                className: 'custom-popup',
                closeButton: true,
                autoPan: true,
                autoPanPadding: [50, 50]
            });

            markers.addLayer(marker);
            bounds.extend(marker.getLatLng());
            validPlaces++;
        });

        // 8. Add CUSTOM PLACES markers (golden)
        let validCustomPlaces = 0;
        
        customPlaces.forEach((place, index) => {
            const lat = parseFloat(place.lat);
            const lng = parseFloat(place.lng);
            
            if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
                console.warn(`⚠️ Custom place without valid coordinates: ${place.title}`, place);
                return;
            }

            const customIcon = L.divIcon({
                html: `
                    <div style="position: relative; width: 45px; height: 55px; pointer-events: none;">
                        <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
                                    width: 40px; height: 40px; border-radius: 50%;
                                    background: rgba(255, 215, 0, 0.3);
                                    animation: pulse-gold 2s ease-in-out infinite;">
                        </div>
                        
                        <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
                                    width: 38px; height: 38px; border-radius: 50%;
                                    background: linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%);
                                    box-shadow: 
                                        0 4px 15px rgba(255, 215, 0, 0.6),
                                        0 0 25px rgba(255, 215, 0, 0.4),
                                        inset 0 2px 5px rgba(255, 255, 255, 0.3);
                                    display: flex; align-items: center; justify-content: center;
                                    border: 3px solid white;">
                            <span style="font-size: 22px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));">⭐</span>
                        </div>
                        
                        <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
                                    width: 0; height: 0; 
                                    border-left: 7px solid transparent;
                                    border-right: 7px solid transparent; 
                                    border-top: 10px solid white;
                                    filter: drop-shadow(0 3px 4px rgba(0,0,0,0.25));">
                        </div>
                    </div>
                `,
                className: 'custom-place-marker',
                iconSize: [45, 55],
                iconAnchor: [22, 55],
                popupAnchor: [0, -52]
            });

            const marker = L.marker([lat, lng], { icon: customIcon });

            const popupContent = `
                <div style="width: 100%; max-width: 280px; font-family: 'Inter', sans-serif;">
                    <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%); 
                                padding: 8px 15px; margin: -15px -20px 15px -20px; 
                                border-radius: 10px 10px 0 0; text-align: center;">
                        <span style="font-size: 12px; font-weight: 700; color: #333;">⭐ Featured Place</span>
                    </div>

                    <div style="position: relative; margin: 0 -20px 15px -20px; overflow: hidden; height: 160px;">
                        <img src="${place.image_url || ''}" 
                             alt="${place.title || ''}" 
                             style="width: 100%; height: 100%; object-fit: cover;"
                             onerror="this.style.display='none'; this.parentElement.style.height='80px';">
                        ${place.price ? `<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,184,148,0.95); color: white; padding: 6px 12px; border-radius: 20px; font-weight: 700; font-size: 13px;">$${place.price}</div>` : ''}
                    </div>

                    <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: #1f2937;">${place.title || 'Unnamed Place'}</h3>
                    <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #6b7280;">${place.description || ''}</p>

                    <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 12px; padding: 6px 10px; background: #fff3cd; border-radius: 6px; border: 1px solid #ffd700;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        <span style="font-size: 11px; color: #856404; font-weight: 600;">
                            ${lat.toFixed(4)}°, ${lng.toFixed(4)}°
                        </span>
                    </div>

                    ${place.link_url ? `
                        <a href="${place.link_url}" target="_blank" rel="noopener noreferrer"
                           data-custom-place="true"
                           style="display: block; text-align: center; padding: 10px 16px; background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
                                  color: #333; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none;">
                            Learn More →
                        </a>
                    ` : ''}
                </div>
            `;

            marker.bindPopup(popupContent, {
                maxWidth: 300,
                minWidth: 240,
                className: 'custom-popup custom-place-popup',
                closeButton: true,
                autoPan: true,
                autoPanPadding: [50, 50]
            });

            markers.addLayer(marker);
            bounds.extend(marker.getLatLng());
            validCustomPlaces++;
        });

        map.addLayer(markers);
        
        if (validPlaces > 0 || validCustomPlaces > 0) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 4.5 });
        }

        // 9. CSS Styles 🎨 MODERN MAP STYLING
        const style = document.createElement('style');
        style.textContent = `
            /* 🎨 Modern Map Tiles Styling */
            .leaflet-tile-container {
                filter: brightness(1.02) contrast(1.08) saturate(1.15);
            }
            
            /* Map container enhancements */
            .leaflet-container {
                background: #e5e7eb !important;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
            }
            
            /* Attribution styling */
            .leaflet-control-attribution {
                background: rgba(255, 255, 255, 0.9) !important;
                backdrop-filter: blur(10px);
                border-radius: 8px 0 0 0 !important;
                padding: 4px 8px !important;
                font-size: 11px !important;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
            }
            
            .leaflet-control-attribution a {
                text-decoration: none !important;
            }
            
            /* Zoom controls enhancement */
            .leaflet-control-zoom {
                border: none !important;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
                border-radius: 10px !important;
                overflow: hidden;
            }
            
            .leaflet-control-zoom a {
                background: rgba(255, 255, 255, 0.95) !important;
                backdrop-filter: blur(10px);
                color: #333 !important;
                border: none !important;
                font-size: 20px !important;
                font-weight: 600;
                width: 36px !important;
                height: 36px !important;
                line-height: 36px !important;
                transition: all 0.2s ease !important;
            }
            
            .leaflet-control-zoom a:hover {
                background: white !important;
                color: ${primaryColor} !important;
                transform: scale(1.05);
            }
            
            .leaflet-control-zoom a:first-child {
                border-bottom: 1px solid rgba(0,0,0,0.08) !important;
            }
            
            /* Custom markers */
            .custom-flag-marker {
                transition: all 0.2s ease !important;
                filter: drop-shadow(0 3px 8px rgba(0,0,0,0.25));
            }
            
            .custom-flag-marker:hover {
                filter: drop-shadow(0 5px 15px rgba(0,0,0,0.35));
                transform: translateY(-2px);
            }
            
            .custom-place-marker {
                transition: filter 0.2s ease !important;
                filter: drop-shadow(0 3px 8px rgba(255, 215, 0, 0.4));
            }
            
            .custom-place-marker:hover {
                filter: drop-shadow(0 5px 15px rgba(255, 215, 0, 0.6)) !important;
                cursor: pointer;
            }
            
            @keyframes pulse-gold {
                0%, 100% {
                    transform: scale(1);
                    opacity: 0.6;
                }
                50% {
                    transform: scale(1.3);
                    opacity: 0.2;
                }
            }
            
            /* Popup styling */
            .custom-popup .leaflet-popup-content-wrapper,
            .custom-place-popup .leaflet-popup-content-wrapper {
                padding: 15px 20px;
                border-radius: 16px;
                box-shadow: 0 15px 50px rgba(0, 0, 0, 0.25);
                border: none;
                max-width: 90vw;
                background: white;
            }
            
            .custom-place-popup .leaflet-popup-content-wrapper {
                border: 3px solid #ffd700;
                box-shadow: 0 15px 50px rgba(255, 215, 0, 0.3);
            }
            
            .custom-popup .leaflet-popup-content,
            .custom-place-popup .leaflet-popup-content {
                margin: 0;
                min-width: 280px;
                max-width: 100%;
            }
            
            .leaflet-popup-tip {
                box-shadow: 0 3px 14px rgba(0,0,0,0.15);
            }
            
            .custom-place-popup .leaflet-popup-tip {
                border-top-color: #ffd700 !important;
            }
            
            /* Close button */
            .leaflet-popup-close-button {
                color: #6b7280 !important;
                font-size: 24px !important;
                padding: 4px 8px !important;
                transition: all 0.2s ease;
            }
            
            .leaflet-popup-close-button:hover {
                color: ${primaryColor} !important;
                background: rgba(0,0,0,0.05) !important;
                border-radius: 50%;
            }
            
            @media (max-width: 768px) {
                .custom-popup .leaflet-popup-content-wrapper,
                .custom-place-popup .leaflet-popup-content-wrapper {
                    padding: 12px 15px;
                    max-width: 85vw;
                    border-radius: 12px;
                }
                
                .custom-popup .leaflet-popup-content,
                .custom-place-popup .leaflet-popup-content {
                    min-width: 0;
                    width: 100%;
                }
            }
            
            .seeMorePlace:hover,
            a[data-custom-place="true"]:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(${hexToRgb(primaryColor)}, 0.4) !important;
            }
            
            #map.show {
                animation: slideDown 0.4s ease-out;
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* Marker cluster styling */
            .marker-cluster {
                transition: all 0.2s ease;
            }
            
            .marker-cluster:hover {
                transform: scale(1.1);
            }
        `;
        document.head.appendChild(style);

        // 10. Map controls
        const mapa = document.getElementById("map");
        const mapBtn = document.querySelector(".mapBtn");
        let mapIsOpen = false;

        if (mapa) {
            mapa.classList.remove("show");
            mapIsOpen = false;
        }

        function hideMapOnScroll() {
            if (mapa && mapa.classList.contains("show")) {
                closeMap();
            }
        }

        function openMap() {
            if (!mapa || mapIsOpen) return;
            
            mapa.classList.add("show");
            mapIsOpen = true;
            
            setTimeout(() => {
                if (map) {
                    map.invalidateSize();
                }
            }, 450);
            
            window.addEventListener("scroll", hideMapOnScroll);
            
            setTimeout(() => {
                document.addEventListener('click', handleClickOutside);
            }, 100);
        }

        function closeMap() {
            if (!mapa || !mapIsOpen) return;
            
            mapa.classList.remove("show");
            mapIsOpen = false;
            
            window.removeEventListener("scroll", hideMapOnScroll);
            document.removeEventListener('click', handleClickOutside);
        }

        function handleClickOutside(e) {
    // ✅ SOLO PERMITIR: Clicks dentro del mapa, botón del mapa, o popups
    if (e.target.closest('#map') || 
        e.target.closest('.mapBtn') ||
        e.target.closest('.leaflet-popup') ||
        e.target.closest('.leaflet-container') ||
        e.target.closest('.leaflet-control')) {
        return; // NO cerrar
    }
    
    // 🔥 NUEVA LÓGICA: Cerrar en cualquier otro lugar
    // EXCEPTO si es parte de una transición automática del slider
    
    // Ignorar eventos no confiables (programáticos)
    if (!e.isTrusted) {
        return;
    }
    
    // Ignorar clicks durante transiciones del slider
    const isSliderTransition = 
        e.target.closest('.allSlider.next') ||
        e.target.closest('.allSlider.prev') ||
        e.target.closest('.slider .itemContinents.active');
    
    if (isSliderTransition) {
        return;
    }
    
    // ❌ En cualquier otro caso: CERRAR el mapa
    closeMap();
}

        function toggleMap() {
            if (mapIsOpen) {
                closeMap();
            } else {
                openMap();
            }
        }

        if (mapa && mapBtn) {
            mapBtn.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleMap();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mapIsOpen) {
                closeMap();
            }
        });

        // 11. Internal links
        document.addEventListener("click", (e) => {
            // 🔥 IGNORE PREMIUM LINKS (custom places) - Let them work naturally
            const premiumLink = e.target.closest('.premium-link');
            if (premiumLink) {
                // Let the browser handle external links naturally
                return;
            }

            const internalLink = e.target.closest(".internal-link");
            if (internalLink) {
                e.preventDefault();
                e.stopPropagation();
                const baseUrl = internalLink.dataset.baseUrl;
                if (baseUrl) {
                    const fullUrl = buildFullUrl(baseUrl);
                    window.location.href = fullUrl;
                }
            }
        });

    } catch (error) {
        console.error("❌ Complete error:", error);
        console.error("Stack:", error.stack);
        
        // 🎨 ERROR MESSAGE WITH CLIENT'S COLORS
        const styles = getComputedStyle(document.documentElement);
        const primaryColor = styles.getPropertyValue('--theme-primary').trim() || '#ff2b4f';
        
        const mapContainer = document.getElementById("map");
        if (mapContainer) {
            // Sanitize error message to prevent XSS
            const safeErrorMessage = sanitizeHTML(error.message || 'Unknown error');
            mapContainer.innerHTML = sanitizeHTML(`
                <div style="padding: 60px 40px; text-align: center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                            color: white; border-radius: 15px; box-shadow: 0 10px 40px rgba(239, 68, 68, 0.3);">
                    <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.9;">⚠️</div>
                    <h3 style="margin: 0 0 15px 0; font-size: 24px; font-weight: 600;">Error Loading Map</h3>
                    <p style="margin: 0 0 10px 0; opacity: 0.9; font-size: 16px;">
                        Could not load data from the server.
                    </p>
                    <p style="margin: 0 0 25px 0; font-size: 13px; opacity: 0.7; font-family: 'Courier New', monospace;">
                        ${safeErrorMessage}
                    </p>
                    <button onclick="location.reload()"
                            style="padding: 12px 28px; background: white; color: #ef4444;
                                   border: none; border-radius: 8px; cursor: pointer; font-weight: 600;
                                   font-size: 14px; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                        🔄 Retry Loading
                    </button>
                </div>
            `);
        }
    }
}