// eachPlace-loadData.js
// Dynamic content loading based on the 'place' parameter in the URL
import { transformDataUrls, convertDOMImagesToCloudinary } from './cloudinary-helper.js';

// Helper function to sanitize HTML using DOMPurify
function sanitizeHTML(dirty) {
    if (!dirty || typeof dirty !== 'string') return '';

    // Verify that DOMPurify is available
    if (typeof DOMPurify === 'undefined') {
        console.error('DOMPurify is not loaded.');
        // Fallback: basic escape
        const div = document.createElement('div');
        div.textContent = dirty;
        return div.innerHTML;
    }

    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a', 'span', 'div', 'h1', 'h2', 'h3', 'h4'],
        ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'target', 'rel'],
        ALLOW_DATA_ATTR: false
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const place = urlParams.get("place");

    if (place) {
        // Get data dynamically from the database API
        fetch(`/api/places/${encodeURIComponent(place)}`)
            .then(response => {
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error(`Place "${place}" not found in database`);
                    }
                    throw new Error(`Error loading place data: ${response.status}`);
                }
                return response.json();
            })
            .then(apiResponse => {
                const originalPlace = apiResponse.data;
                
                if (!originalPlace) {
                    throw new Error(`Place data not found for "${place}"`);
                }

                // Transform URLs to Cloudinary
                const selectedPlace = transformDataUrls(originalPlace);

                // Truncate slider paragraphs if they exceed character limit 
                function truncateSlideParagraphs() {
                    const paragraphs = document.querySelectorAll(".slide-paragraph");
                    paragraphs.forEach(paragraph => {
                        const text = paragraph.textContent.trim();
                        if (text.length > 250) {
                            const truncated = text.substring(0, 250) + "...";
                            paragraph.textContent = truncated;
                        }
                    });
                }

                // Update page title
                document.title = selectedPlace.pageTitle || place;

                // Update the first slide (Photos)
                const firstSlide = document.querySelector(".first-slide");
                
                // Find the first available image in wrapImg
                const firstImage = selectedPlace.sections.find(s => s.type === "wrapImg");
                if (firstImage && firstSlide) {
                    const slideImages = firstSlide.querySelector(".slide-bg-img");
                    const slideImagesContainer = firstSlide.querySelector(".slide-images");
                    
                    if (slideImages) {
                        // Mostrar fondo con gradiente mientras carga
                        slideImagesContainer.style.background = `linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%)`;
                        
                        // Estrategia de carga progresiva
                        const loadImage = (url, callback, errorCallback) => {
                            const img = new Image();
                            img.onload = () => callback(img);
                            img.onerror = () => {
                                console.warn('Error loading image:', url);
                                if (errorCallback) errorCallback();
                            };
                            img.src = url;
                        };
                        
                        // 1. Cargar thumbnail primero (opcional)
                        const thumbnailUrl = firstImage.src.replace(
                            '/upload/', 
                            '/upload/w_100,q_20,e_blur:800/'
                        );
                        
                        loadImage(thumbnailUrl, 
                            // Success callback para thumbnail
                            (thumb) => {
                                slideImages.src = thumbnailUrl;
                                slideImages.style.filter = 'blur(15px) brightness(0.9)';
                                slideImages.style.opacity = '1';
                                
                                // 2. Cargar imagen completa
                                loadImage(firstImage.src, 
                                    // Success callback para imagen completa
                                    (full) => {
                                        slideImages.src = firstImage.src;
                                        slideImages.style.filter = 'blur(0) brightness(1)';
                                        slideImages.style.transition = 'filter 0.8s ease, opacity 1.5s linear';
                                        
                                        // Remover background después de la transición
                                        setTimeout(() => {
                                            slideImagesContainer.style.background = 'transparent';
                                        }, 1500);
                                    },
                                    // Error callback para imagen completa
                                    () => {
                                        slideImagesContainer.style.background = 'transparent';
                                    }
                                );
                            },
                            // Error callback para thumbnail
                            () => {
                                // Si el thumbnail falla, cargar directamente la imagen completa
                                loadImage(firstImage.src, 
                                    (full) => {
                                        slideImages.src = firstImage.src;
                                        slideImages.style.opacity = '1';
                                        slideImagesContainer.style.background = 'transparent';
                                    },
                                    () => {
                                        slideImagesContainer.style.background = 'transparent';
                                    }
                                );
                            }
                        );
                    }
                }

                // Update place name
                const slidePlaceName = firstSlide ? firstSlide.querySelector(".slide-placeName") : null;
                const titleSection = selectedPlace.sections.find(s => s.type === "h1");
                if (slidePlaceName && titleSection) {
                    slidePlaceName.textContent = titleSection.content;
                }

                // Update intro paragraph
                const slideParagraph = firstSlide ? firstSlide.querySelector(".slide-paragraph") : null;
                const introSection = selectedPlace.sections.find(s => s.type === "intro");
                if (slideParagraph && introSection) {
                    slideParagraph.innerHTML = sanitizeHTML(`${introSection.content}<span class="paragraph-anchor-tag">See More</span>`);
                }

                // Display intro in the info-card
                const infoCardParagraph = document.querySelector('.info-card .card-paragraph');
                if (infoCardParagraph && introSection) {
                    infoCardParagraph.innerHTML = sanitizeHTML(introSection.content);
                }

                // Add wrapImg images to the gallery
                const imageWrapper = firstSlide ? firstSlide.querySelector(".image-wrapper") : null;
                if (imageWrapper) {
                    imageWrapper.innerHTML = "";
                    selectedPlace.sections.filter(s => s.type === "wrapImg").forEach(img => {
                        const a = document.createElement("a");
                        a.href = img.url || img.src;
                        a.target = "_blank";

                        const imgElement = document.createElement("img");
                        imgElement.src = img.src;
                        imgElement.alt = img.alt || "Image";
                        
                        imgElement.setAttribute("data-pin-nopin", "true");

                        a.appendChild(imgElement);
                        imageWrapper.appendChild(a);
                    });
                }

                // Add second linkSearch if available
                const linkSearchData2 = selectedPlace.sections.find(s => s.type === "linkSearch");
                if (linkSearchData2 && linkSearchData2.src) {
                    const linkContainer2 = document.querySelector(".link-search-container-2");
                    if (linkContainer2) {
                        linkContainer2.innerHTML = "";
                        const linkElement = document.createElement("a");
                        linkElement.href = linkSearchData2.src;
                        linkElement.target = "_blank";
                        linkElement.textContent = "Place images - Google";
                        linkElement.classList.add("btn", "btn-primary");
                        linkContainer2.appendChild(linkElement);
                    }
                }

                // Function to update the other sections (Geography, History, Activities, etc.)
                const updateSlideContent = (sectionType, slideSelector) => {
                    const slide = document.querySelector(slideSelector);
                    const sectionData = selectedPlace.sections.find(s => s.type === sectionType);

                    if (slide && sectionData) {
                        const slidePlaceNameElement = slide.querySelector(".slide-placeName");
                        const slideParagraphElement = slide.querySelector(".slide-paragraph");
                        const cardParagraphElement = slide.querySelector(".card-paragraph");

                        if (slidePlaceNameElement) {
                            slidePlaceNameElement.textContent = titleSection ? titleSection.content : "";
                        }
                        
                        const fullContent = sectionData.content + (sectionData.list ? sectionData.list.join("") : "");

                        if (slideParagraphElement) {
                            slideParagraphElement.innerHTML = sanitizeHTML(fullContent);
                        }

                        if (cardParagraphElement) {
                            cardParagraphElement.innerHTML = sanitizeHTML(fullContent);
                        }
                    }
                };

                // Update all slides with their respective content (SIN tocar las imágenes)
                updateSlideContent("activities", ".slide:nth-child(2)");
                updateSlideContent("tips", ".slide:nth-child(3)");
                updateSlideContent("geography", ".slide:nth-child(4)");
                updateSlideContent("conservation", ".slide:nth-child(5)");
                updateSlideContent("history", ".slide:nth-child(6)");
                updateSlideContent("conclusion", ".slide:nth-child(7)");
                
                // 🔧 IMPORTANTE: Convertir las imágenes del DOM DESPUÉS de cargar todo
                // Esto asegura que las imágenes hardcodeadas en el HTML se conviertan a Cloudinary
                convertDOMImagesToCloudinary();
                
                // Truncate paragraphs after all content is loaded
                truncateSlideParagraphs();

                // Enhanced map with professional design
                const lat = selectedPlace.lat;
                const lng = selectedPlace.lng;
                let title;

                if (selectedPlace.sections && Array.isArray(selectedPlace.sections)) {
                    const h1Section = selectedPlace.sections.find(section => section.type === "h1");
                    if (h1Section && h1Section.content) {
                        title = h1Section.content;
                    }
                }

                const mapBtn = document.querySelector(".mapBtn");
                const mapDiv = document.getElementById("map");
                let mapInstance = null;
                let mapInitialized = false;
                let userLocationMarker = null;

                // Reusable function to show the map and update slides
                function showMapAndSlides() {
                    // Show the map
                    if (mapDiv) {
                        mapDiv.classList.add("show");
                    }

                    // Activate conclusion section (slide 7)
                    const allSlides = document.querySelectorAll('.slide');
                    allSlides.forEach(slide => slide.classList.remove('active'));
                    const conclusionSlide = document.querySelector('.slide:nth-child(7)');
                    if (conclusionSlide) {
                        conclusionSlide.classList.add('active');
                        // Simulate click on conclusion info button
                        const watchContentBtn = conclusionSlide.querySelector('.watch-info-btn');
                        if (watchContentBtn && document.activeElement !== watchContentBtn) {
                            watchContentBtn.click();
                        }
                    }

                    // Update slider indicators
                    const slideBtns = document.querySelectorAll(".slide-btn");
                    const slideIndicatorBars = document.querySelectorAll(".indicator-bar");
                    slideBtns.forEach(btn => btn.classList.remove('active'));
                    slideIndicatorBars.forEach(bar => bar.classList.remove('active'));
                    if (slideBtns[6]) slideBtns[6].classList.add('active');
                    if (slideIndicatorBars[6]) slideIndicatorBars[6].classList.add('active');

                    // Initialize the map only once
                    if (!mapInitialized && mapDiv && lat && lng) {
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
                        mapInstance = L.map('map', {
                            zoomControl: false
                        }).setView([lat, lng], 10);

                        // Add zoom control (top right)
                        L.control.zoom({
                            position: 'topright'
                        }).addTo(mapInstance);

                        // Map layer with enhanced style
                        // Map layer with enhanced style
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '<a href="https://mynaturevista.com/" target="_blank" rel="noopener" style="color: ' + primaryColor + '; font-weight: 600;">myNaturevista</a> | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    noWrap: true,
    className: 'map-tiles'
}).addTo(mapInstance);

                        mapInstance.setMinZoom(2);
                        mapInstance.setMaxZoom(18);

// Create custom icon for place marker
const placeIcon = L.divIcon({
    html: `
        <div style="position: relative; width: 44px; height: 44px;">
            <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); 
                        width: 40px; height: 40px; border-radius: 50%; 
                        background: ${getGradient()};
                        box-shadow: 0 4px 15px rgba(${hexToRgb(primaryColor)}, 0.4);
                        display: flex; align-items: center; justify-content: center;
                        overflow: hidden; border: 3px solid white;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
            </div>
            <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
                        width: 0; height: 0; border-left: 6px solid transparent;
                        border-right: 6px solid transparent; border-top: 8px solid white;
                        filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));"></div>
        </div>
    `,
    className: 'custom-place-marker',
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -52]
});

                        // Add place marker with enhanced popup
                        const placeMarker = L.marker([lat, lng], { icon: placeIcon }).addTo(mapInstance);
                        
                        const placePopupContent = `
    <div style="width: 100%; max-width: 260px; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="padding: 0;">
            <h3 style="margin: 0 0 10px 0; font-size: 17px; font-weight: 700; color: #1f2937; line-height: 1.3;">
                📍 ${title || place}
            </h3>
            
            <div style="display: flex; align-items: center; gap: 5px; margin-bottom: 10px; 
                        padding: 8px 12px; background: ${getGradient()};
                        border-radius: 8px; color: white; box-shadow: 0 4px 15px rgba(${hexToRgb(primaryColor)}, 0.3);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span style="font-size: 12px; font-weight: 500;">
                    ${lat.toFixed(4)}°, ${lng.toFixed(4)}°
                </span>
            </div>
            
            <p style="margin: 0; font-size: 13px; color: #6b7280; text-align: center;">
                This is your destination
            </p>
        </div>
    </div>
`;
                        
                        placeMarker.bindPopup(placePopupContent, {
                            maxWidth: 280,
                            className: 'custom-popup',
                            closeButton: true
                        }).openPopup();

                        // Function to get and show user location
                        function showUserLocation() {
                            if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                    function(position) {
                                        const userLat = position.coords.latitude;
                                        const userLng = position.coords.longitude;
                                        const accuracy = position.coords.accuracy;
                                        
                                        // Remove previous marker if it exists
                                        if (userLocationMarker) {
                                            mapInstance.removeLayer(userLocationMarker);
                                        }
                                        
                                        // Create custom icon for user location
                                        const userLocationIcon = L.divIcon({
                                            html: `
                                                <div style="
                                                    background: #4285f4;
                                                    border: 3px solid white;
                                                    border-radius: 50%;
                                                    width: 20px;
                                                    height: 20px;
                                                    box-shadow: 0 3px 10px rgba(66, 133, 244, 0.5);
                                                    position: relative;
                                                ">
                                                    <div style="
                                                        position: absolute;
                                                        top: -7px;
                                                        left: -7px;
                                                        width: 34px;
                                                        height: 34px;
                                                        background: rgba(66, 133, 244, 0.2);
                                                        border-radius: 50%;
                                                        animation: pulse 2s infinite;
                                                    "></div>
                                                </div>
                                            `,
                                            className: 'user-location-marker',
                                            iconSize: [20, 20],
                                            iconAnchor: [10, 10]
                                        });
                                        
                                        // Add user location marker
                                        userLocationMarker = L.marker([userLat, userLng], {
                                            icon: userLocationIcon
                                        }).addTo(mapInstance);
                                        
                                        // User location popup
                                        const userPopupContent = `
                                            <div style="text-align: center; padding: 10px;">
                                                <h4 style="margin: 0 0 8px 0; color: #4285f4; font-size: 15px; font-weight: 600;">
                                                    📍 Your Location
                                                </h4>
                                                <p style="font-size: 12px; margin: 0 0 5px 0; color: #6b7280;">
                                                    Accuracy: ~${Math.round(accuracy)}m
                                                </p>
                                                <div style="margin-top: 10px; padding: 6px 10px; background: #f3f4f6; border-radius: 6px;">
                                                    <span style="font-size: 11px; color: #4b5563; font-weight: 500;">
                                                        ${userLat.toFixed(4)}°, ${userLng.toFixed(4)}°
                                                    </span>
                                                </div>
                                            </div>
                                        `;
                                        
                                        userLocationMarker.bindPopup(userPopupContent);
                                        
                                        // Adjust view to show both markers
                                        const bounds = L.latLngBounds([
                                            [lat, lng],
                                            [userLat, userLng]
                                        ]);
                                        mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
                                        
                                        // Show popup automatically
                                        setTimeout(() => {
                                            userLocationMarker.openPopup();
                                        }, 500);
                                        
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


                        // Create custom location button
                        const LocationControl = L.Control.extend({
                            onAdd: function(map) {
                                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
                                
                                container.style.backgroundColor = 'white';
                                container.style.border = '2px solid rgba(0,0,0,0.2)';
                                container.style.borderRadius = '8px';
                                container.style.width = '38px';
                                container.style.height = '38px';
                                container.style.cursor = 'pointer';
                                container.style.display = 'flex';
                                container.style.alignItems = 'center';
                                container.style.justifyContent = 'center';
                                container.style.fontSize = '20px';
                                container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                                container.style.transition = 'all 0.3s ease';
                                container.innerHTML = '📍';
                                container.title = 'Show my location';
                                
                                container.onmouseover = function() {
    this.style.backgroundColor = '#f0f4ff';
    this.style.transform = 'scale(1.05)';
    this.style.boxShadow = `0 4px 12px rgba(${hexToRgb(primaryColor)}, 0.3)`;
}
                                container.onmouseout = function() {
                                    this.style.backgroundColor = 'white';
                                    this.style.transform = 'scale(1)';
                                    this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                                }
                                
                                container.onclick = function(e) {
                                    L.DomEvent.stopPropagation(e);
                                    showUserLocation();
                                }
                                
                                return container;
                            }
                        });
                        
                        // Add location control to the map
                        new LocationControl({ position: 'topright' }).addTo(mapInstance);

                        // Add custom CSS styles
                        const mapStyle = document.createElement('style');
mapStyle.textContent = `
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
    
    /* Place marker styles */
    .custom-place-marker {
        transition: all 0.2s ease !important;
        filter: drop-shadow(0 3px 8px rgba(${hexToRgb(primaryColor)}, 0.3));
    }
    
    .custom-place-marker:hover {
        filter: drop-shadow(0 5px 15px rgba(${hexToRgb(primaryColor)}, 0.4));
        transform: translateY(-2px);
    }
    
    /* User location marker */
    .user-location-marker {
        transition: all 0.2s ease;
    }
    
    /* Popup styling */
    .custom-popup .leaflet-popup-content-wrapper {
        padding: 15px 20px;
        border-radius: 16px;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.25);
        border: none;
        max-width: 90vw;
        background: white;
    }
    
    .custom-popup .leaflet-popup-content {
        margin: 0;
        max-width: 100%;
    }
    
    .custom-popup .leaflet-popup-tip {
        box-shadow: 0 3px 14px rgba(0,0,0,0.15);
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
    
    /* Responsive for small screens */
    @media (max-width: 768px) {
        .custom-popup .leaflet-popup-content-wrapper {
            padding: 12px 15px;
            max-width: 85vw;
            border-radius: 12px;
        }
        
        .custom-popup .leaflet-popup-content {
            width: 100%;
        }
    }
    
    @media (max-width: 480px) {
        .custom-popup .leaflet-popup-content-wrapper {
            padding: 10px 12px;
            max-width: 90vw;
        }
    }
    
    /* Pulse animation for user location */
    @keyframes pulse {
        0% { 
            transform: scale(1); 
            opacity: 1; 
        }
        100% { 
            transform: scale(2.5); 
            opacity: 0; 
        }
    }
    
    /* Map tiles enhanced style */
    .map-tiles {
        filter: brightness(1.02) contrast(1.08) saturate(1.15);
    }
    
    /* Location button enhancement */
    .leaflet-control-custom {
        transition: all 0.3s ease !important;
    }
    
    .leaflet-control-custom:hover {
        box-shadow: 0 4px 15px rgba(${hexToRgb(primaryColor)}, 0.3) !important;
    }
    
    /* Map container animation */
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
`;
document.head.appendChild(mapStyle);

                        mapInitialized = true;
                    }
                }

                // Assign function to both buttons: .mapBtn and conclusion .watch-info-btn
                if (mapBtn && mapDiv && lat && lng) {
                    mapBtn.addEventListener("click", showMapAndSlides);
                }

                // Assign ONLY to the .watch-info-btn of the conclusion slide (slide 7)
                const conclusionSlide = document.querySelector('.slide:nth-child(7)');
                if (conclusionSlide) {
                    const conclusionWatchInfoBtn = conclusionSlide.querySelector('.watch-info-btn');
                    if (conclusionWatchInfoBtn) {
                        conclusionWatchInfoBtn.addEventListener("click", showMapAndSlides);
                    }
                }

            })
            .catch(error => {
                console.error("Error loading place data from database:", error);
                
                // Show user-friendly error message
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.innerHTML = `
                    <div style="text-align: center; padding: 20px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 5px; margin: 20px;">
                        <h3>Error Loading Place</h3>
                        <p>Sorry, we couldn't load the information for "${place}".</p>
                        <p>Error: ${error.message}</p>
                        <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                            Try Again
                        </button>
                    </div>
                `;
                
                // Insert error message at the top of the page
                const firstSlide = document.querySelector(".first-slide") || document.body;
                if (firstSlide.parentNode) {
                    firstSlide.parentNode.insertBefore(errorDiv, firstSlide);
                } else {
                    document.body.appendChild(errorDiv);
                }
            });
    } else {
        console.warn("No 'place' parameter found in URL");
        
        // Show error when no place parameter is provided
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; border-radius: 5px; margin: 20px;">
                <h3>No Place Specified</h3>
                <p>Please specify a place using the 'place' parameter in the URL.</p>
                <p>Example: ?place=YourPlaceName</p>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
});

// Optional function to preload all places for faster navigation
function preloadPlacesData() {
    fetch('/api/places')
        .then(response => response.json())
        .then(data => {
            // Store in sessionStorage for quick access if needed
            sessionStorage.setItem('allPlaces', JSON.stringify(data));
        })
        .catch(error => {
            console.warn('Failed to preload places:', error);
        });
}

// Optional: Call preload function if you want to cache all places
// preloadPlacesData();

