// Get the "country" parameter from the URL
const urlParams = new URLSearchParams(window.location.search);
const country = urlParams.get('country');
const apiKey = urlParams.get('apikey');
import { transformDataUrls, convertDOMImagesToCloudinary } from './cloudinary-helper.js';

// Security: Sanitize HTML to prevent XSS attacks
function sanitizeHTML(dirty) {
    if (!dirty || typeof dirty !== 'string') return '';

    // Use global DOMPurify (loaded in HTML)
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(dirty, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'img', 'svg', 'path'],
            ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'target', 'rel', 'src', 'alt', 'style', 'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'd', 'cx', 'cy', 'r'],
            ALLOW_DATA_ATTR: false
        });
    }

    // Fallback: basic HTML escaping
    const div = document.createElement('div');
    div.textContent = dirty;
    return div.innerHTML;
}

function getCurrencySymbol(currency) {
    const symbols = {
        'EUR': '€',
        'USD': '$',
        'GBP': '£',
        'JPY': '¥',
        'CAD': 'C$',
        'AUD': 'A$',
        'CHF': 'CHF',
        'CNY': '¥',
        'INR': '₹',
        'BRL': 'R$',
        'MXN': '$',
        'ZAR': 'R',
        'AED': 'د.إ',
        'SAR': '﷼',
        'MAD': 'د.م.',
        'EGP': 'E£'
    };
    return symbols[currency] || currency || '$';
}
// Function to build widget URLs with API key
function buildWidgetUrl(page, params = {}) {
    const url = new URL(page, window.location.origin);
    if (apiKey) {
        url.searchParams.set('apikey', apiKey);
    }
    
    // Always mark as internal navigation
    url.searchParams.set('action', 'navigate');
    url.searchParams.set('internal', 'true');
    
    Object.keys(params).forEach(key => {
        url.searchParams.set(key, params[key]);
    });
    
    return url.toString();
}

// Helper function for navigation within iframe
function navigateInWidget(targetUrl) {
    try {
        const iframe = window.parent.document.getElementById("myWidgetIframe");

        if (iframe) {
            iframe.src = targetUrl;
        } else {
            window.location.href = targetUrl;
        }
    } catch (error) {
        window.location.href = targetUrl;
    }
}

// Back arrow link
const homeLink = document.getElementById('home-link');
if (homeLink) {
    homeLink.removeAttribute('href');
    homeLink.style.cursor = 'pointer';
    homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        const targetUrl = buildWidgetUrl('/widget.html');
        navigateInWidget(targetUrl);
    });
}

// Earth icon link
const homeLinkEarth = document.getElementById('home-linkEarth');
if (homeLinkEarth) {
    homeLinkEarth.removeAttribute('href');
    homeLinkEarth.style.cursor = 'pointer';
    homeLinkEarth.addEventListener('click', (e) => {
        e.preventDefault();
        const targetUrl = buildWidgetUrl('/widget.html');
        navigateInWidget(targetUrl);
    });
}

// Navigation to places
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

        let targetUrl = internalLink.dataset.url;

        // Ensure navigation parameters
        const urlObj = new URL(targetUrl);
        if (!urlObj.searchParams.has('action')) {
            urlObj.searchParams.set('action', 'navigate');
            urlObj.searchParams.set('internal', 'true');
        }

        navigateInWidget(urlObj.toString());
    }
});
// Load custom places function
async function loadCustomPlaces(countryName) {
    if (!apiKey) {
        return [];
    }
    
    try {
        const response = await fetch(`/api/custom-places/widget/${apiKey}?country=${encodeURIComponent(countryName)}`);
        
        if (!response.ok) {
            return [];
        }
        
        const data = await response.json();
        return data.places || [];
    } catch (error) {
        console.error('Error loading custom places:', error);
        return [];
    }
}

// Render custom places on the map
function addCustomPlacesToMap(map, customPlaces, countryFlag, countryDisplayName) {
    if (!customPlaces || customPlaces.length === 0) {
        return;
    }

    // Filter and normalize valid coordinates
    const placesWithCoordinates = customPlaces
        .map(place => {
            // Convertir posibles strings a números
            const lat = parseFloat(place.lat ?? place.latitude);
            const lng = parseFloat(place.lng ?? place.longitude);
            return { ...place, lat, lng };
        })
        .filter(place => 
            place.show_on_map &&
            !isNaN(place.lat) &&
            !isNaN(place.lng)
        );

    placesWithCoordinates.forEach(place => {
        // Premium gold marker - Enhanced style
        const customIcon = L.divIcon({
            html: `
                <div style="position: relative; width: 45px; height: 55px; pointer-events: none;">
                    <!-- Animated background pulse -->
                    <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
                                width: 40px; height: 40px; border-radius: 50%;
                                background: rgba(255, 215, 0, 0.3);
                                animation: pulse-gold 2s ease-in-out infinite;">
                    </div>
                    
                    <!-- Main circle with golden gradient -->
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
                    
                    <!-- Marker tip with shadow -->
                    <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
                                width: 0; height: 0; 
                                border-left: 7px solid transparent;
                                border-right: 7px solid transparent; 
                                border-top: 10px solid white;
                                filter: drop-shadow(0 3px 4px rgba(0,0,0,0.25));">
                    </div>
                </div>
                
                <style>
                    @keyframes pulse-gold {
                        0%, 100% {
                            transform: translateX(-50%) scale(1);
                            opacity: 0.5;
                        }
                        50% {
                            transform: translateX(-50%) scale(1.3);
                            opacity: 0.2;
                        }
                    }
                </style>
            `,
            className: 'custom-place-marker',
            iconSize: [45, 55],
            iconAnchor: [22, 55], // Ancla en la punta del marcador
            popupAnchor: [0, -52]
        });

        // Create marker
        const marker = L.marker([place.lat, place.lng], { icon: customIcon }).addTo(map);

        // Popup content - Sanitized for XSS protection
        const safeImageUrl = sanitizeHTML(place.image_url || '');
        const safeTitle = sanitizeHTML(place.title || 'Unnamed Place');
        const safeDescription = sanitizeHTML(place.description || '');
        const safeLinkUrl = place.link_url ? sanitizeHTML(place.link_url) : '';
        const safePrice = place.price ? sanitizeHTML(String(place.price)) : '';
        const safeCurrency = place.currency ? getCurrencySymbol(place.currency) : '';

        const popupContent = `
            <div style="width: 100%; max-width: 280px; font-family: 'Inter', sans-serif;">
                <div style="background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
                            padding: 8px 15px; margin: -15px -20px 15px -20px;
                            border-radius: 10px 10px 0 0; text-align: center;">
                    <span style="font-size: 12px; font-weight: 700; color: #333;">⭐ Featured Place</span>
                </div>

                <div style="position: relative; margin: 0 -20px 15px -20px; overflow: hidden; height: 160px;">
                    <img src="${safeImageUrl}"
                         alt="${safeTitle}"
                         style="width: 100%; height: 100%; object-fit: cover;"
                         onerror="this.style.display='none'; this.parentElement.style.height='80px';">
                    ${safePrice ? `<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,184,148,0.95); color: white; padding: 6px 12px; border-radius: 20px; font-weight: 700; font-size: 13px;">${safeCurrency}${safePrice}</div>` : ''}
                </div>

                <h3 style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: #1f2937;">${safeTitle}</h3>
                <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #6b7280;">${safeDescription}</p>

                <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 12px; padding: 6px 10px; background: #fff3cd; border-radius: 6px; border: 1px solid #ffd700;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span style="font-size: 11px; color: #856404; font-weight: 600;">
                        ${place.lat.toFixed(4)}°, ${place.lng.toFixed(4)}°
                    </span>
                </div>

                ${safeLinkUrl ? `
                    <a href="${safeLinkUrl}"
                       target="_blank"
                       rel="noopener noreferrer"
                       style="width: 100%; display: block; text-align: center; padding: 10px 16px; background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
                              color: #333; border-radius: 8px; font-weight: 700; font-size: 13px; text-decoration: none; transition: all 0.2s ease;">
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

    });
}

// En widget-eachCountry.js (country.js), reemplaza la función addCustomPlacesToList:

function addCustomPlacesToList(customPlaces, containerElement) {
    if (!customPlaces || customPlaces.length === 0) {
        return;
    }

    // Inject specific styles for custom places
    const styleId = 'custom-places-styles';
    if (!document.getElementById(styleId)) {
        const styleSheet = document.createElement('style');
        styleSheet.id = styleId;
        
        // 🎨 GET CLIENT'S CUSTOM COLORS
        const styles = getComputedStyle(document.documentElement);
        const primaryColor = styles.getPropertyValue('--theme-primary').trim() || '#667eea';
        const secondaryColor = styles.getPropertyValue('--theme-secondary').trim() || '#764ba2';
        
        // Helper to convert hex to rgb
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '102,126,234';
        }
        
        const primaryRgb = hexToRgb(primaryColor);
        const secondaryRgb = hexToRgb(secondaryColor);
        
        styleSheet.textContent = `
            .premium-section {
                margin: 40px 0;
                padding: 50px 30px;
                background: transparent;
                backdrop-filter: blur(15px);
                -webkit-backdrop-filter: blur(15px);
                border-radius: 30px;
                border: 2px solid rgba(${primaryRgb}, 0.25);
                box-shadow:
                    0 20px 60px rgba(${primaryRgb}, 0.12),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                position: relative;
                overflow: hidden;
                pointer-events: auto !important;
            }

            .premium-section::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(
                    circle,
                    rgba(${primaryRgb}, 0.06) 0%,
                    rgba(${secondaryRgb}, 0.03) 50%,
                    transparent 70%
                );
                animation: premiumGlow 15s ease-in-out infinite;
                pointer-events: none;
            }

            @keyframes premiumGlow {
                0%, 100% { transform: translate(0, 0) rotate(0deg); }
                33% { transform: translate(10%, 10%) rotate(120deg); }
                66% { transform: translate(-10%, 5%) rotate(240deg); }
            }

            .premium-header {
                text-align: center;
                margin-bottom: 40px;
                position: relative;
                z-index: 2;
            }

            .premium-subtitle {
                font-size: 15px;
                color: rgba(${primaryRgb}, 1);
                margin: 0;
                letter-spacing: 1.5px;
                font-weight: 600;
                text-transform: uppercase;
                text-shadow: 0 2px 4px rgb(255, 255, 255);
            }

            .premium-grid {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 35px;
                position: relative;
                z-index: 2;
                pointer-events: auto !important;
            }

            .premium-item {
                width: 340px;
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                border-radius: 24px;
                overflow: hidden;
                box-shadow:
                    0 20px 50px rgba(0, 0, 0, 0.15),
                    0 0 0 2px rgba(${primaryRgb}, 0.3),
                    0 0 30px rgba(${primaryRgb}, 0.15);
                transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
                pointer-events: auto !important;
            }

            .premium-item:hover {
                transform: translateY(-15px);  /* 🔥 ELIMINADO scale(1.02) */
                box-shadow:
                    0 35px 70px rgba(0, 0, 0, 0.25),
                    0 0 0 3px rgba(${primaryRgb}, 0.5),
                    0 0 50px rgba(${primaryRgb}, 0.3);
}

            .premium-image-wrap {
                position: relative;
                width: 100%;
                height: 220px;
                overflow: hidden;
            }

            .premium-image-wrap img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transition: transform 0.6s ease;
            }

            .premium-item:hover .premium-image-wrap img {
                transform: scale(1.1);
            }

            .premium-image-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 100px;
                background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
                pointer-events: none;
            }

            .premium-price {
                position: absolute;
                top: 15px;
                right: 15px;
                background: linear-gradient(135deg, rgba(${primaryRgb}, 1) 0%, rgba(${secondaryRgb}, 1) 100%);
                color: white;
                padding: 10px 20px;
                border-radius: 30px;
                font-weight: 900;
                font-size: 16px;
                box-shadow: 0 6px 20px rgba(${primaryRgb}, 0.4);
                z-index: 5;
            }

            .premium-content {
                padding: 30px;
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                pointer-events: auto !important;
            }

            .premium-category {
                display: inline-block;
                background: linear-gradient(135deg, rgba(${primaryRgb}, 1) 0%, rgba(${secondaryRgb}, 1) 100%);
                color: white;
                padding: 6px 18px;
                border-radius: 20px;
                font-size: 11px;
                font-weight: 700;
                margin-bottom: 15px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .premium-title {
                font-size: 20px;
                font-weight: 800;
                color: #1a1a2e;
                margin: 0 0 12px 0;
                line-height: 1.3;
            }

            .premium-desc {
                font-size: 14px;
                color: #666;
                line-height: 1.7;
                margin: 0 0 20px 0;
                display: -webkit-box;
                -webkit-line-clamp: 3;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            .premium-link {
                display: block;
                width: 100%;
                text-align: center;
                background: linear-gradient(135deg, rgba(${primaryRgb}, 1) 0%, rgba(${secondaryRgb}, 1) 100%);
                color: white !important;
                font-weight: 900;
                font-size: 14px;
                padding: 16px 25px;
                border: none;
                border-radius: 14px;
                text-decoration: none !important;
                text-transform: uppercase;
                letter-spacing: 2px;
                box-shadow: 0 8px 25px rgba(${primaryRgb}, 0.35);
                transition: all 0.3s ease;
                cursor: pointer !important;
                pointer-events: auto !important;
                user-select: none;
                -webkit-user-select: none;
                position: relative;
                z-index: 100000;
                font-family: inherit;
                outline: none;
            }

            .premium-link:hover {
                transform: scale(1.05);
                box-shadow: 0 12px 35px rgba(${primaryRgb}, 0.5);
            }

            .premium-link:active {
                transform: scale(0.98);
            }

            @media (max-width: 768px) {
                .premium-section {
                    padding: 30px 15px;
                    margin: 20px 0;
                }
                .premium-item {
                    width: 100%;
                    max-width: 340px;
                }
            }
        `;
        document.head.appendChild(styleSheet);
    }

    // Create premium section
    const premiumSection = document.createElement('div');
    premiumSection.className = 'premium-section';
    premiumSection.setAttribute('data-custom-places', 'true'); // Marca para identificar

    // Header simplificado
    const header = document.createElement('div');
    header.className = 'premium-header';
    header.innerHTML = `
        <p class="premium-subtitle">✨ Special Places</p>
    `;
    premiumSection.appendChild(header);

    // Grid de items
    const grid = document.createElement('div');
    grid.className = 'premium-grid';

    customPlaces.forEach(place => {
        const item = document.createElement('div');
        item.className = 'premium-item';

        const imageWrap = document.createElement('div');
        imageWrap.className = 'premium-image-wrap';

        const img = document.createElement('img');
        img.src = place.image_url;
        img.alt = place.title;
        img.loading = 'lazy';
        img.setAttribute('data-pin-nopin', 'true');
        imageWrap.appendChild(img);

        const overlay = document.createElement('div');
        overlay.className = 'premium-image-overlay';
        imageWrap.appendChild(overlay);

        if (place.price) {
            const price = document.createElement('div');
            price.className = 'premium-price';
            price.textContent = getCurrencySymbol(place.currency) + place.price;
            imageWrap.appendChild(price);
        }

        item.appendChild(imageWrap);

        const content = document.createElement('div');
        content.className = 'premium-content';

        if (place.category) {
            const category = document.createElement('span');
            category.className = 'premium-category';
            category.textContent = place.category;
            content.appendChild(category);
        }

        const title = document.createElement('h3');
        title.className = 'premium-title';
        title.textContent = place.title;
        content.appendChild(title);

        const desc = document.createElement('p');
        desc.className = 'premium-desc';
        desc.textContent = place.description;
        content.appendChild(desc);

        // 🔥 PURE <A> TAG - Works naturally
        const link = document.createElement('a');
        link.className = 'premium-link';
        link.href = place.link_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Learn More →';

        content.appendChild(link);

        item.appendChild(content);
        grid.appendChild(item);
    });

    premiumSection.appendChild(grid);

    // 🔥 ASEGURAR QUE SE INSERTE AL FINAL
    // Esperar a que todos los elementos normales estén renderizados
    setTimeout(() => {
        // Remover si ya existe (para evitar duplicados)
        const existing = containerElement.querySelector('[data-custom-places="true"]');
        if (existing) {
            existing.remove();
        }
        
        // Insertar al final
        containerElement.appendChild(premiumSection);
    }, 100);
}

// Load country and places
if (country) {
    fetch(`/api/countries/${encodeURIComponent(country)}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error loading country data: ${response.status}`);
            }
            return response.json();
        })
       .then(async (originalCountry) => {
    const selectedCountry = transformDataUrls(originalCountry);

    if (!selectedCountry) {
        throw new Error('Country not found');
    }

            // Update title and metadata
            document.title = selectedCountry.headerTitle;
            //document.contentType = selectedCountry.descriptions;

            // Flag
            const flagElement = document.querySelector('#flag');
            if (selectedCountry.hero && selectedCountry.hero[0]?.flag?.[0]) {
                flagElement.src = selectedCountry.hero[0].flag[0].src;
                flagElement.alt = selectedCountry.hero[0].flag[0].alt;
            }

            // Hero description
            const descriptionHero = document.querySelector('.descriptionsHead');
            if (descriptionHero) {
                descriptionHero.textContent = selectedCountry.descriptionsHead || '';
            }

            // Hero title
            const heroTitleElement = document.querySelector('.heroTitle');
            if (heroTitleElement && selectedCountry.hero?.[0]) {
                heroTitleElement.textContent = selectedCountry.hero[0].texto;
            }

            // Load custom places first (before rendering)
            const customPlaces = await loadCustomPlaces(country);

            // Render sections/places
            const containerElement = document.querySelector('.container');
            if (containerElement) {
                containerElement.innerHTML = '';
// Render normal places
                if (selectedCountry.secciones && Array.isArray(selectedCountry.secciones)) {
                    selectedCountry.secciones.forEach(section => {
                        const cardElement = document.createElement('div');
                        cardElement.className = 'card';

                        // Image
                        const imgBoxElement = document.createElement('div');
                        imgBoxElement.className = 'imgBx';
                        const imgElement = document.createElement('img');
                        imgElement.src = section.imagenes?.[0]?.src || '';
                        imgElement.alt = section.imagenes?.[0]?.alt || '';
                        imgElement.loading = "lazy";
                        imgElement.setAttribute("data-pin-nopin", "true");
                        imgBoxElement.appendChild(imgElement);

                        // Content
                        const contentElement = document.createElement('div');
                        contentElement.className = 'content';
                        
                        const titleElement = document.createElement('h2');
                        titleElement.textContent = section.titulo?.replace(/-/g, ' ') || '';
                        
                        const descriptionElement = document.createElement('p');
                        descriptionElement.textContent = section.descriptions || '';

                        // Internal link
                        const linkElement = document.createElement('div');
                        linkElement.classList.add("seeMorePlace", "internal-link");
                        linkElement.dataset.url = buildWidgetUrl('/widget-eachPlace.html', { 
                            place: section.href 
                        });
                        linkElement.textContent = 'SEE MORE';

                        contentElement.appendChild(titleElement);
                        contentElement.appendChild(descriptionElement);
                        contentElement.appendChild(linkElement);

                        cardElement.appendChild(imgBoxElement);
                        cardElement.appendChild(contentElement);

                        containerElement.appendChild(cardElement);
                    });
                }
                // Add custom places to the list
                if (customPlaces.length > 0) {
                    addCustomPlacesToList(customPlaces, containerElement);
                }

                
            }

            // Enhanced map with flags
            // Enhanced map with flags
if (selectedCountry.secciones && selectedCountry.secciones.length > 0) {
    const firstLocation = selectedCountry.secciones[0];

    // 🎨 GET CLIENT'S CUSTOM COLORS
    const styles = getComputedStyle(document.documentElement);
    const primaryColor = styles.getPropertyValue('--theme-primary').trim() || '#667eea';
    const secondaryColor = styles.getPropertyValue('--theme-secondary').trim() || '#764ba2';
    
    // Helper function for gradients
    const getGradient = () => `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`;
    
    // Helper to convert hex to rgb
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '102,126,234';
    }

    // Get country flag
    const countryFlag = selectedCountry.hero?.[0]?.flag?.[0]?.src || '/assets/icons/default-marker.png';
    const countryDisplayName = selectedCountry.hero?.[0]?.texto || country;

    // 🔥 VARIABLES PARA INICIALIZACIÓN LAZY DEL MAPA
    let map = null;
    let mapInitialized = false;

    // 🔥 FUNCIÓN PARA INICIALIZAR EL MAPA (SE LLAMA SOLO UNA VEZ)
    function initializeMap() {
        if (mapInitialized) return map;

        // Initialize map with custom controls
        map = L.map('map', {
            zoomControl: false
        }).setView([firstLocation.lat, firstLocation.lng], 6);

        // Add zoom control (top right)
        L.control.zoom({
            position: 'topright'
        }).addTo(map);

        // Map layer with enhanced style
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '<a href="https://mynaturevista.com/" target="_blank" rel="noopener" style="color: ' + primaryColor + '; font-weight: 600;">myNaturevista</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
            noWrap: true,
            className: 'map-tiles'
        }).addTo(map);
        
        map.setMinZoom(2);
        map.setMaxZoom(18);

        let userLocationMarker = null;

        // Function to show user location
        function showUserLocation() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        const userLat = position.coords.latitude;
                        const userLng = position.coords.longitude;
                        const accuracy = position.coords.accuracy;
                        
                        if (userLocationMarker) {
                            map.removeLayer(userLocationMarker);
                        }
                        
                        const userLocationIcon = L.divIcon({
                            html: `
                                <div style="
                                    background: #4285f4;
                                    border: 3px solid white;
                                    border-radius: 50%;
                                    width: 18px;
                                    height: 18px;
                                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                                    position: relative;
                                ">
                                    <div style="
                                        position: absolute;
                                        top: -6px;
                                        left: -6px;
                                        width: 30px;
                                        height: 30px;
                                        background: rgba(66, 133, 244, 0.2);
                                        border-radius: 50%;
                                        animation: pulse 2s infinite;
                                    "></div>
                                </div>
                            `,
                            className: 'user-location-marker',
                            iconSize: [18, 18],
                            iconAnchor: [9, 9]
                        });
                        
                        userLocationMarker = L.marker([userLat, userLng], {
                            icon: userLocationIcon
                        }).addTo(map);
                        
                        const userPopupContent = `
                            <div style="text-align: center; padding: 8px;">
                                <h4 style="margin: 5px 0; color: #4285f4; font-size: 14px;">📍 Your Location</h4>
                                <p style="font-size: 11px; margin: 3px 0;">
                                    Accuracy: ~${Math.round(accuracy)}m
                                </p>
                            </div>
                        `;
                        
                        userLocationMarker.bindPopup(userPopupContent);
                        map.setView([userLat, userLng], 10);
                        userLocationMarker.openPopup();
                    }, 
                    function(error) {
                        let errorMessage = '';
                        switch(error.code) {
                            case error.PERMISSION_DENIED:
                                errorMessage = "Location access denied.";
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errorMessage = "Location unavailable.";
                                break;
                            case error.TIMEOUT:
                                errorMessage = "Request timeout.";
                                break;
                            default:
                                errorMessage = "Error getting location.";
                                break;
                        }
                        console.error(errorMessage);
                    },
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 300000
                    }
                );
            } else {
                console.error("Geolocation is not supported by this browser.");
            }
        }

        // Custom location control
        const LocationControl = L.Control.extend({
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                
                container.style.backgroundColor = 'white';
                container.style.border = '2px solid rgba(0,0,0,0.2)';
                container.style.borderRadius = '6px';
                container.style.width = '34px';
                container.style.height = '34px';
                container.style.cursor = 'pointer';
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.justifyContent = 'center';
                container.style.fontSize = '18px';
                container.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
                container.innerHTML = '📍';
                container.title = 'Show my location';
                
                container.onmouseover = function() {
                    this.style.backgroundColor = '#f4f4f4';
                    this.style.transform = 'scale(1.05)';
                }
                container.onmouseout = function() {
                    this.style.backgroundColor = 'white';
                    this.style.transform = 'scale(1)';
                }
                
                container.onclick = function(e) {
                    L.DomEvent.stopPropagation(e);
                    showUserLocation();
                }
                
                return container;
            }
        });
        
        new LocationControl({ position: 'topright' }).addTo(map);

        const bounds = new L.LatLngBounds();

        // Add markers with flags for each normal place
        selectedCountry.secciones.forEach(place => {
            if (place.lat && place.lng) {
                // Create custom icon with country flag
                const customIcon = L.divIcon({
                    html: `
                        <div style="position: relative; width: 40px; height: 40px;">
                            <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); 
                                        width: 36px; height: 36px; border-radius: 50%; 
                                        background: white; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                                        display: flex; align-items: center; justify-content: center;
                                        overflow: hidden; border: 3px solid white;">
                                <img src="${countryFlag}" 
                                     alt="${country}" 
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

                const marker = L.marker([place.lat, place.lng], { icon: customIcon }).addTo(map);

                // Enhanced and responsive popup - Sanitized for XSS protection
                const safeImageSrc = sanitizeHTML(place.imagenes?.[0]?.src || '');
                const safeImageAlt = sanitizeHTML(place.imagenes?.[0]?.alt || '');
                const safeTitulo = sanitizeHTML(place.titulo?.replace(/-/g, ' ') || '');
                const safeDescriptions = sanitizeHTML(place.descriptions || 'No description available');
                const safeCountryFlag = sanitizeHTML(countryFlag);
                const safeCountry = sanitizeHTML(country);
                const safeCountryDisplayName = sanitizeHTML(countryDisplayName);

                const popupContent = `
                    <div style="width: 100%; max-width: 280px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                        <div style="position: relative; margin: -15px -20px 15px -20px; border-radius: 10px 10px 0 0; overflow: hidden; height: 160px;">
                            <img src="${safeImageSrc}"
                                alt="${safeImageAlt}"
                                style="width: 100%; height: 100%; object-fit: cover;"
                                onerror="this.style.display='none'; this.parentElement.style.height='0'; this.parentElement.style.margin='0';">
                            <div style="position: absolute; top: 10px; right: 10px;
                                        background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
                                        padding: 5px 10px; border-radius: 20px;
                                        display: flex; align-items: center; gap: 6px;
                                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                                <img src="${safeCountryFlag}"
                                     alt="${safeCountry}"
                                     style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover; border: 2px solid white;"
                                     onerror="this.style.display='none';">
                                <span style="font-size: 11px; font-weight: 600; color: #333;">
                                    ${safeCountryDisplayName}
                                </span>
                            </div>
                        </div>
                        <div style="padding: 0;">
                            <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 700; color: #1f2937; line-height: 1.3;">
                                ${safeTitulo}
                            </h3>
                            <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.5; color: #6b7280;
                                      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
                                      overflow: hidden; text-overflow: ellipsis;">
                                ${safeDescriptions}
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
                                 data-url="${buildWidgetUrl('/widget-eachPlace.html', { place: place.href })}"
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

                bounds.extend(marker.getLatLng());
            }
        });

        // Add custom places to map
        if (customPlaces && customPlaces.length > 0) {
            addCustomPlacesToMap(map, customPlaces, countryFlag, countryDisplayName);
        }

        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 4.5});

        // Add custom CSS styles (solo una vez)
        if (!document.getElementById('map-custom-styles')) {
            const mapStyle = document.createElement('style');
            mapStyle.id = 'map-custom-styles';
            mapStyle.textContent = `
                .leaflet-tile-container {
                    filter: brightness(1.02) contrast(1.08) saturate(1.15);
                }
                .leaflet-container {
                    background: #e5e7eb !important;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
                }
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
                .custom-flag-marker, .custom-place-marker {
                    transition: all 0.2s ease !important;
                    filter: drop-shadow(0 3px 8px rgba(0,0,0,0.25));
                }
                .custom-flag-marker:hover {
                    filter: drop-shadow(0 5px 15px rgba(0,0,0,0.35));
                    transform: translateY(-2px);
                }
                .custom-place-marker {
                    filter: drop-shadow(0 3px 8px rgba(255, 215, 0, 0.4));
                }
                .custom-place-marker:hover {
                    filter: drop-shadow(0 5px 15px rgba(255, 215, 0, 0.6)) !important;
                    cursor: pointer;
                }
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
                .custom-popup .leaflet-popup-tip,
                .custom-place-popup .leaflet-popup-tip {
                    box-shadow: 0 3px 14px rgba(0,0,0,0.15);
                }
                .custom-place-popup .leaflet-popup-tip {
                    border-top-color: #ffd700 !important;
                }
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
                @media (max-width: 480px) {
                    .custom-popup .leaflet-popup-content-wrapper,
                    .custom-place-popup .leaflet-popup-content-wrapper {
                        padding: 10px 12px;
                        max-width: 90vw;
                    }
                }
                .seeMorePlace:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(${hexToRgb(primaryColor)}, 0.4) !important;
                }
                .map-tiles {
                    filter: brightness(1.02) contrast(1.08) saturate(1.15);
                }
            `;
            document.head.appendChild(mapStyle);
        }

        mapInitialized = true;
        return map;
    }

    // 🔥 CONTROL DEL BOTÓN - INICIALIZA EL MAPA SOLO AL PRIMER CLIC
    const mapa = document.getElementById("map");
    const mapBtn = document.querySelector(".mapBtn");
    const descriptionCountry = document.querySelector(".descriptionsHead");
    const container = document.querySelector(".container");

    if (mapa && mapBtn) {
        // Asegurar estado inicial cerrado
        mapa.classList.remove("show");
        if (descriptionCountry) descriptionCountry.style.display = "block";
        if (container) container.classList.remove("moved");

        mapBtn.addEventListener("click", function() {
            if (!mapa.classList.contains("show")) {
                // ✅ ABRIR MAPA
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // 🔥 INICIALIZAR MAPA SOLO EN EL PRIMER CLIC
                        if (!mapInitialized) {
                            initializeMap();
                        }

                        mapa.classList.add("show");
                        if (descriptionCountry) descriptionCountry.style.display = "none";
                        if (container) container.classList.add("moved");

                        // Forzar resize de Leaflet después de la transición
                        setTimeout(() => {
                            if (map && map.invalidateSize) {
                                map.invalidateSize();
                            }

                            // Scroll suave al centro del mapa
                            setTimeout(() => {
                                mapa.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 150);
                        }, 1000);
                    });
                });
            } else {
                // ✅ CERRAR MAPA
                mapa.classList.remove("show");
                if (container) container.classList.remove("moved");
                
                // Mostrar descripción después de que termine la animación
                if (descriptionCountry) {
                    setTimeout(() => {
                        descriptionCountry.style.display = "block";
                    }, 1000);
                }
            }
        });
    }

            }
        })
        .catch(error => {
            console.error('Error loading country data. Please try again.', error);
        });
} else {
    console.error('Country not specified in the URL. Please specify a country, e.g., ?country=EEUU');
}

document.addEventListener("DOMContentLoaded", () => {
    convertDOMImagesToCloudinary();
    // CSS styles for marker animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            100% { transform: scale(2.5); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // Button hover effect
    let buttons = document.querySelectorAll('.closeBtn');
    buttons.forEach(button => {
        let text = button.textContent;
        button.innerHTML = '';

        for(let char of text){
            let span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char;
            button.appendChild(span);
        }
        let spans = button.querySelectorAll('span');

        button.addEventListener('mouseenter', () =>{
            spans.forEach((span,index) => {
                setTimeout(() =>{
                    span.classList.add('hover');
                }, index * 50)
            })
        })

        button.addEventListener('mouseleave', () =>{
            spans.forEach((span,index) => {
                setTimeout(() =>{
                    span.classList.remove('hover');
                }, index * 50)
            })
        })
    })

    // Video background
    const video = document.getElementById('background-video');
    const toggleInput = document.getElementById('toggle');
    
    if (toggleInput && video) {
        toggleInput.addEventListener('change', () => {
            if (toggleInput.checked) {
                video.play();
            } else {
                video.pause();
            }
        });
    }
});

// Global handling of internal links
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
        const targetUrl = internalLink.dataset.url;
        if (targetUrl) {
            window.location.href = targetUrl;
        }
    }
});