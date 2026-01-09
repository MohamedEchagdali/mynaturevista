// customPlaces.js - Complete version with domains
// Manages custom places grouped by domain

let currentPlaces = [];
let placesByDomain = {};
let availableDomains = [];
let editingPlaceId = null;
let imageBase64 = null;
let userLimits = null;
let lastModifiedDomain = null;

// Function to get token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Configure headers with authentication
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
    };
}

// Load places and domains on startup
document.addEventListener('DOMContentLoaded', function() {
    loadCustomPlaces();

    // Configure the form
    const form = document.getElementById('placeForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }

    // Configure drag & drop for image
    setupImageDragDrop();

    // Active status toggle
    const activeToggle = document.getElementById('placeActive');
    if (activeToggle) {
        activeToggle.addEventListener('change', function() {
            document.getElementById('statusText').textContent = this.checked ? 'Active' : 'Inactive';
        });
    }
});

// Load available domains (improved version)
async function loadAvailableDomains() {

    try {
        const response = await fetch('/api/custom-places/domains', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to load domains: ${response.status} ${response.statusText}`);
        }

        // Verify the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const textResponse = await response.text();
            console.error('Response is not JSON:', textResponse);
            throw new Error('Server did not return JSON');
        }

        const data = await response.json();
        availableDomains = data.domains || [];

        // Populate the domain selector
        populateDomainSelector();

    } catch (error) {
        console.error('Error loading domains:', error);

        // If it fails, try to open the modal anyway
        availableDomains = [];
        populateDomainSelector();

        showError('Could not load domains. Please check your API keys in settings.');
    }
}

// Populate domain selector in modal
function populateDomainSelector() {
    const domainSelect = document.getElementById('domainSelect');

    if (!domainSelect) {
        console.error('Domain selector not found');
        return;
    }

    // Clear current options (except the first)
    domainSelect.innerHTML = '<option value="">-- Select a domain --</option>';
    
    if (availableDomains.length === 0) {
        domainSelect.innerHTML += '<option value="" disabled>No domains available</option>';
        domainSelect.disabled = true;
        return;
    }

    // Add domains
    availableDomains.forEach(domain => {
        const option = document.createElement('option');
        option.value = domain.id;
        option.textContent = domain.domain;

        // Mark inactive domains
        if (!domain.is_active) {
            option.textContent += ' (Inactive)';
            option.disabled = true;
        }

        domainSelect.appendChild(option);
    });

    domainSelect.disabled = false;
}

// Verify limits and open modal
async function openAddPlaceModal() {

    // Verify limits
    if (!userLimits) {
        console.error('User limits have not been loaded');
        showUpgradeModal('Cannot verify your plan limits. Please reload the page.');
        return;
    }

    if (!userLimits.can_add) {

        const limitText = userLimits.limit === 'unlimited' ? 'unlimited' : userLimits.limit;
        const message = userLimits.limit === 0
            ? 'Your current plan does not include custom places.'
            : `You have reached the limit of ${limitText} custom places for your plan.`;

        showUpgradeModal(message);
        return;
    }

    // Load domains before opening the modal
    await loadAvailableDomains();

    editingPlaceId = null;
    resetForm();
    openModal();
}

// Plan upgrade modal
function showUpgradeModal(message) {
    const currentPlan = userLimits?.plan_type || 'starter';
    const currentLimit = userLimits?.limit;
    
    let upgradeMessage = '';
    let planName = '';
    
    if (currentPlan === 'starter' || currentLimit === 0) {
        planName = 'Starter';
        upgradeMessage = 'Your current plan <strong>does not include</strong> the custom places feature.';
    } else if (currentPlan === 'business' && currentLimit !== 'unlimited') {
        planName = 'Business';
        upgradeMessage = `You have reached the limit of <strong>${currentLimit} custom places</strong> for your plan.`;
    } else {
        planName = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
        upgradeMessage = 'Your current plan does not allow adding more custom places.';
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'upgradeOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
        padding: 1rem;
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 24px;
        max-width: 550px;
        width: 100%;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.4);
        animation: slideInUp 0.4s ease;
        overflow: hidden;
    `;
    
    modal.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 2.5rem 2rem;
            text-align: center;
            position: relative;
        ">
            <button onclick="closeUpgradeModal()" style="
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 1.25rem;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            "
            onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='rotate(90deg)'"
            onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform=''">
                <i class="fas fa-times"></i>
            </button>
            
            <div style="
                width: 90px;
                height: 90px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 1.25rem;
                backdrop-filter: blur(10px);
            ">
                <i class="fas fa-lock" style="font-size: 2.75rem; color: white;"></i>
            </div>
            
            <h2 style="color: white; margin: 0 0 0.5rem 0; font-size: 2rem; font-weight: 700;">
                Feature Not Available
            </h2>
            <p style="color: rgba(255, 255, 255, 0.95); margin: 0; font-size: 1.05rem; line-height: 1.5;">
                Current plan: <strong>${planName}</strong>
            </p>
        </div>
        
        <div style="padding: 2.5rem 2rem;">
            <div style="text-align: center; margin-bottom: 2rem;">
                <p style="font-size: 1.15rem; color: #374151; margin: 0 0 1.5rem 0; line-height: 1.7;">
                    ${upgradeMessage}
                </p>
                
                <div style="
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border-left: 4px solid #f59e0b;
                    padding: 1.25rem;
                    border-radius: 12px;
                    text-align: left;
                ">
                    <div style="display: flex; align-items: start; gap: 1rem;">
                        <i class="fas fa-info-circle" style="
                            color: #d97706;
                            font-size: 1.5rem;
                            margin-top: 0.25rem;
                            flex-shrink: 0;
                        "></i>
                        <div>
                            <h4 style="margin: 0 0 0.5rem 0; color: #92400e; font-size: 1.05rem; font-weight: 700;">
                                What are custom places?
                            </h4>
                            <p style="margin: 0; color: #78350f; font-size: 0.95rem; line-height: 1.6;">
                                Highlight your collaborations, hotels, restaurants or favorite experiences in your widget. 
                                They will appear in the featured list and on the interactive map.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                <button onclick="closeUpgradeModal()" style="
                    background: #f3f4f6;
                    color: #6b7280;
                    border: none;
                    padding: 0.875rem 2rem;
                    border-radius: 10px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    flex: 1;
                    min-width: 140px;
                "
                onmouseover="this.style.background='#e5e7eb'; this.style.color='#374151'"
                onmouseout="this.style.background='#f3f4f6'; this.style.color='#6b7280'">
                    Maybe Later
                </button>
                
                <a href="/dashboard/updatePlan.html" style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    border: none;
                    padding: 0.875rem 2rem;
                    border-radius: 10px;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                    flex: 1;
                    min-width: 140px;
                "
                onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.5)'"
                onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)'">
                    <i class="fas fa-rocket"></i>
                    View Plans
                </a>
            </div>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeUpgradeModal();
        }
    });
}

function closeUpgradeModal() {
    const overlay = document.getElementById('upgradeOverlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            overlay.remove();
            document.body.style.overflow = 'auto';
        }, 300);
    }
}

// ========================================
// MAP OPTIONS TOGGLE
// ========================================
function toggleMapOptions() {
    const showOnMap = document.getElementById('showOnMap').checked;
    const mapOptionsContainer = document.getElementById('mapOptionsContainer');
    const latitude = document.getElementById('placeLatitude');
    const longitude = document.getElementById('placeLongitude');
    
    if (showOnMap) {
        mapOptionsContainer.style.display = 'block';
        latitude.required = true;
        longitude.required = true;
    } else {
        mapOptionsContainer.style.display = 'none';
        latitude.required = false;
        longitude.required = false;
        latitude.value = '';
        longitude.value = '';
        document.getElementById('showAllCountries').checked = false;
        document.getElementById('placeCountry').value = '';
    }
}

function toggleCountrySelector() {
    const showAllCountries = document.getElementById('showAllCountries').checked;
    const countrySelectContainer = document.getElementById('countrySelectContainer');
    const countrySelect = document.getElementById('placeCountry');
    
    if (showAllCountries) {
        countrySelectContainer.style.opacity = '0.5';
        countrySelectContainer.style.pointerEvents = 'none';
        countrySelect.value = '';
        countrySelect.required = false;
    } else {
        countrySelectContainer.style.opacity = '1';
        countrySelectContainer.style.pointerEvents = 'auto';
    }
}

// ========================================
// SETUP DRAG & DROP
// ========================================
function setupImageDragDrop() {
    const uploadArea = document.getElementById('imageUploadArea');
    
    if (!uploadArea) return;
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleImageFile(files[0]);
        }
    });
}

// ========================================
// IMAGE HANDLING
// ========================================
function handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleImageFile(file);
    }
}

function handleImageFile(file) {

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
        showError('Please upload a JPG or PNG image');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showError('Image size must be less than 5MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        imageBase64 = e.target.result;
        const preview = document.getElementById('imagePreview');
        preview.src = imageBase64;
        preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Character counter
function updateCharCounter() {
    const textarea = document.getElementById('placeDescription');
    const counter = document.getElementById('charCounter');
    const current = textarea.value.length;
    counter.textContent = `${current} / 300`;
    
    if (current >= 280) {
        counter.style.color = '#ff6b6b';
    } else {
        counter.style.color = '#888';
    }
}

// Load places (with grouping by domain)
async function loadCustomPlaces() {

    try {
        const response = await fetch('/api/custom-places', {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to load places');
        }

        const data = await response.json();
        currentPlaces = Array.isArray(data.places) ? data.places : [];
        placesByDomain = data.placesByDomain || {};

        // Save limits information
        if (data.limits) {
            userLimits = data.limits;
            updateLimitsDisplay();
        }

        renderPlacesByDomain();

    } catch (error) {
        showError('Failed to load your custom places');
    }
}

// Show limits information
function updateLimitsDisplay() {
    if (!userLimits) return;
    
    const header = document.querySelector('.section-header');
    if (!header) return;
    
    const oldBadge = document.getElementById('limitsBadge');
    if (oldBadge) oldBadge.remove();
    
    const badge = document.createElement('div');
    badge.id = 'limitsBadge';
    badge.style.cssText = `
        background: ${userLimits.can_add ? '#e8f5e9' : '#ffebee'};
        color: ${userLimits.can_add ? '#2e7d32' : '#c62828'};
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `;
    
    const limitText = userLimits.limit === 'unlimited' ? '∞' : userLimits.limit;
    badge.innerHTML = `
        <i class="fas fa-${userLimits.can_add ? 'check-circle' : 'exclamation-triangle'}"></i>
        ${userLimits.current} / ${limitText} places used
    `;
    
    header.appendChild(badge);
}

// Render places grouped by domain (accordion version)
function renderPlacesByDomain() {
    const container = document.getElementById('placesContainer');

    if (!container) {
        return;
    }
    
    if (currentPlaces.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-map-marked-alt"></i>
                <h3>No custom places yet</h3>
                <p>Start by adding your first custom place!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    // Sort domains alphabetically
    const sortedDomains = Object.keys(placesByDomain).sort();
    
    sortedDomains.forEach((domain, index) => {
        const places = placesByDomain[domain];
        
        if (places.length === 0) return;
        
        // Create section for each domain
        const domainSection = document.createElement('div');
        domainSection.className = 'domain-section';
        domainSection.style.cssText = `
            margin-bottom: 1.5rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            overflow: hidden;
            border: 1px solid #e9ecef;
        `;
        
        // Domain header (clickable to collapse/expand)
        const domainHeader = document.createElement('div');
        domainHeader.className = 'domain-header';
        domainHeader.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.25rem 1.5rem;
            cursor: pointer;
            transition: all 0.3s ease;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        `;
        
        // ✅ CREATE HEADER ELEMENTS
        const headerContent = document.createElement('div');
        headerContent.style.cssText = 'display: flex; align-items: center; gap: 1rem;';
        
        headerContent.innerHTML = `
            <div style="
                background: linear-gradient(180deg, #00b894 0%, #00d4aaff 100%);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            ">
                <i class="fas fa-globe"></i>
                ${domain}
            </div>
            <div style="
                background: #fff;
                color: #666;
                padding: 0.4rem 0.9rem;
                border-radius: 20px;
                font-size: 0.85rem;
                font-weight: 600;
                border: 2px solid #e9ecef;
            ">
                ${places.length} ${places.length === 1 ? 'place' : 'places'}
            </div>
        `;
        
        // ✅ CREATE COLLAPSE ICON AS SEPARATE ELEMENT
        const collapseIconContainer = document.createElement('div');
        collapseIconContainer.className = 'collapse-icon';
        collapseIconContainer.style.cssText = `
            color: #667eea;
            font-size: 1.25rem;
            transition: transform 0.3s ease;
        `;
        
        const collapseIcon = document.createElement('i');
        collapseIcon.className = 'fas fa-chevron-down';
        collapseIconContainer.appendChild(collapseIcon);
        
        // Add elements to header
        domainHeader.appendChild(headerContent);
        domainHeader.appendChild(collapseIconContainer);
        
        // Collapsible container for places
        const collapsibleContent = document.createElement('div');
        collapsibleContent.className = 'collapsible-content';
        collapsibleContent.style.cssText = `
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.4s ease-out, padding 0.4s ease-out;
            padding: 0 1.5rem;
        `;
        
        // Places grid
        const grid = document.createElement('div');
        grid.className = 'places-grid';
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 1.5rem;
        `;
        
        places.forEach(place => {
            grid.appendChild(createPlaceCard(place));
        });
        
        collapsibleContent.appendChild(grid);
        
        // ✅ TOGGLE FUNCTION (uses direct reference to icon)
        function toggleCollapse() {
            const isExpanded = collapsibleContent.style.maxHeight && collapsibleContent.style.maxHeight !== '0px';
            
            if (isExpanded) {
                // Collapse
                collapsibleContent.style.maxHeight = '0';
                collapsibleContent.style.paddingTop = '0';
                collapsibleContent.style.paddingBottom = '0';
                collapseIcon.style.transform = 'rotate(0deg)';
                domainHeader.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
            } else {
                // Expand
                collapsibleContent.style.maxHeight = collapsibleContent.scrollHeight + 50 + 'px';
                collapsibleContent.style.paddingTop = '1.5rem';
                collapsibleContent.style.paddingBottom = '1.5rem';
                collapseIcon.style.transform = 'rotate(180deg)';
                domainHeader.style.background = 'linear-gradient(135deg, #e8f0fe 0%, #d2e3fc 100%)';
            }
        }
        
        // ✅ EVENT LISTENER WITH TOGGLE FUNCTION
        domainHeader.addEventListener('click', toggleCollapse);
        
        // Hover effect
        domainHeader.addEventListener('mouseenter', function() {
            if (collapsibleContent.style.maxHeight === '0px' || !collapsibleContent.style.maxHeight) {
                domainHeader.style.background = 'linear-gradient(135deg, #e8f0fe 0%, #d2e3fc 100%)';
            }
        });
        
        domainHeader.addEventListener('mouseleave', function() {
            if (collapsibleContent.style.maxHeight === '0px' || !collapsibleContent.style.maxHeight) {
                domainHeader.style.background = 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)';
            }
        });
        
        domainSection.appendChild(domainHeader);
        domainSection.appendChild(collapsibleContent);
        container.appendChild(domainSection);
        
        // Improved expansion logic
        // If there is a recently modified domain, expand that one
        if (lastModifiedDomain && domain === lastModifiedDomain) {
            setTimeout(() => {
                toggleCollapse();
                // Clear after expanding
                lastModifiedDomain = null;
            }, 100);
        }
        // If there is no modified domain, expand the first one
        else if (!lastModifiedDomain && index === 0) {
            setTimeout(() => {
                toggleCollapse();
            }, 100);
        }
    });
}

// Create place card
function createPlaceCard(place) {
    const card = document.createElement('div');
    card.className = 'place-card';
    card.setAttribute('data-place-id', place.id);
    
    const hasValidCoordinates = place.show_on_map && 
                                 place.latitude !== null && 
                                 place.latitude !== undefined &&
                                 place.longitude !== null && 
                                 place.longitude !== undefined;
    
    let locationBadge = '';
    if (hasValidCoordinates) {
        if (place.show_all_countries) {
            locationBadge = `
                <div class="location-badge all-countries">
                    <i class="fas fa-globe"></i>
                    <span>All Countries (Map)</span>
                </div>
            `;
        } else if (place.country_id) {
            locationBadge = `
                <div class="location-badge specific-country">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${place.country_name || 'Specific Country'} (Map)</span>
                </div>
            `;
        } else {
            locationBadge = `
                <div class="location-badge map-only">
                    <i class="fas fa-map"></i>
                    <span>Map Only (No Country Filter)</span>
                </div>
            `;
        }
    } else {
        if (place.country_id) {
            locationBadge = `
                <div class="location-badge list-country">
                    <i class="fas fa-list"></i>
                    <span>${place.country_name || 'Specific Country'} (List Only)</span>
                </div>
            `;
        } else {
            locationBadge = `
                <div class="location-badge list-all">
                    <i class="fas fa-list-ul"></i>
                    <span>All Countries (List Only)</span>
                </div>
            `;
        }
    }
    
    card.innerHTML = `
        ${hasValidCoordinates ? `
            <div class="map-indicator">
                <i class="fas fa-map-marked-alt"></i>
                On Map
            </div>
        ` : ''}
        
        <div class="place-card-image" style="background-image: url('${place.image_url}');">
            <div class="place-card-status ${place.is_active ? 'active' : 'inactive'}">
                <i class="fas fa-circle"></i>
                ${place.is_active ? 'Active' : 'Inactive'}
            </div>
        </div>
        
        <div class="place-card-content">
            <h3 class="place-card-title">${place.title}</h3>
            <p class="place-card-description">${place.description}</p>
            
            ${locationBadge}
            
            ${hasValidCoordinates ? `
                <div class="coordinates-info">
                    <small>
                        <i class="fas fa-map-pin"></i>
                        Lat: ${parseFloat(place.latitude).toFixed(6)}, 
                        Lon: ${parseFloat(place.longitude).toFixed(6)}
                    </small>
                </div>
            ` : ''}
            
            ${place.price ? `
    <div class="place-card-price">
        <i class="fas fa-tag"></i>
        ${getCurrencySymbol(place.currency || 'EUR')} ${place.price}
    </div>
` : ''}
            
            <div class="place-card-actions">
                <button onclick="editPlace(${place.id})" class="action-btn edit-btn" title="Edit">
                    <i class="fas fa-edit"></i>
                    Edit
                </button>
                <button onclick="togglePlaceStatus(${place.id})" class="action-btn toggle-btn" title="Toggle Status">
                    <i class="fas fa-toggle-${place.is_active ? 'on' : 'off'}"></i>
                    ${place.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onclick="deletePlace(${place.id})" class="action-btn delete-btn" title="Delete">
                    <i class="fas fa-trash"></i>
                    Delete
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Edit place
async function editPlace(placeId) {

    const normalizedId = parseInt(placeId);
    const place = currentPlaces.find(p => p.id === normalizedId);

    if (!place) {
        console.error('Place not found:', normalizedId);
        return;
    }

    // Load domains before opening the modal
    await loadAvailableDomains();
    
    editingPlaceId = placeId;

    // Fill the form
    document.getElementById('placeTitle').value = place.title || '';
    document.getElementById('placeDescription').value = place.description || '';
    document.getElementById('placeLink').value = place.link_url || '';
    document.getElementById('placePrice').value = place.price || '';
    document.getElementById('placeCurrency').value = place.currency || 'EUR';
    document.getElementById('placeCategory').value = place.category || '';
    document.getElementById('placeActive').checked = place.is_active !== false;
    document.getElementById('statusText').textContent = place.is_active ? 'Active' : 'Inactive';

    // Select the domain
    const domainSelect = document.getElementById('domainSelect');
    if (domainSelect && place.api_key_id) {
        domainSelect.value = place.api_key_id;
    }

    // Configure map options
    const showOnMapCheckbox = document.getElementById('showOnMap');
    showOnMapCheckbox.checked = place.show_on_map || false;
    toggleMapOptions();
    
    if (place.show_on_map && place.latitude && place.longitude) {
        document.getElementById('placeLatitude').value = place.latitude;
        document.getElementById('placeLongitude').value = place.longitude;

        const showAllCountriesCheckbox = document.getElementById('showAllCountries');
        showAllCountriesCheckbox.checked = place.show_all_countries || false;
        toggleCountrySelector();

        if (!place.show_all_countries && place.country_id) {
            document.getElementById('placeCountry').value = place.country_id;
        }
    }

    // Show image
    if (place.image_url) {
        imageBase64 = place.image_url;
        const preview = document.getElementById('imagePreview');
        preview.src = place.image_url;
        preview.style.display = 'block';
    }

    updateCharCounter();

    const modalTitle = document.querySelector('#placeModal .modal-header h2');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Edit Custom Place';
    }

    openModal();
}

// Reset form
function resetForm() {
    const form = document.getElementById('placeForm');
    if (form) form.reset();
    
    imageBase64 = null;
    const preview = document.getElementById('imagePreview');
    if (preview) preview.style.display = 'none';
    
    document.getElementById('statusText').textContent = 'Active';
    document.getElementById('charCounter').textContent = '0 / 300';
    document.getElementById('charCounter').style.color = '#888';
    
    document.getElementById('showOnMap').checked = false;
    document.getElementById('showAllCountries').checked = false;
    toggleMapOptions();
    toggleCountrySelector();
    
    const modalTitle = document.querySelector('#placeModal .modal-header h2');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Place';
    }
}

// Submit form
async function handleSubmit(event) {
    event.preventDefault();

    if (!imageBase64) {
        showError('Please upload an image');
        return;
    }

    // Validate that a domain has been selected
    const apiKeyId = document.getElementById('domainSelect').value;
    if (!apiKeyId) {
        showError('Please select a domain');
        return;
    }

    // Capture the domain before sending
    const selectedDomain = availableDomains.find(d => d.id == apiKeyId);
    
    const formData = {
        api_key_id: parseInt(apiKeyId),
        title: document.getElementById('placeTitle').value.trim(),
        description: document.getElementById('placeDescription').value.trim(),
        image_url: imageBase64,
        link_url: document.getElementById('placeLink').value.trim(),
        price: document.getElementById('placePrice').value.trim() || null,
        currency: document.getElementById('placeCurrency').value || 'EUR',
        category: document.getElementById('placeCategory').value.trim() || null,
        is_active: document.getElementById('placeActive').checked,
        show_on_map: document.getElementById('showOnMap').checked
    };
    
    if (formData.show_on_map) {
        const latitude = document.getElementById('placeLatitude').value.trim();
        const longitude = document.getElementById('placeLongitude').value.trim();

        if (!latitude || !longitude) {
            showError('Coordinates are required when showing on map');
            return;
        }

        formData.latitude = parseFloat(latitude);
        formData.longitude = parseFloat(longitude);
        formData.show_all_countries = document.getElementById('showAllCountries').checked;

        if (!formData.show_all_countries) {
            const countryId = document.getElementById('placeCountry').value;
            formData.country_id = countryId || null;
        } else {
            formData.country_id = null;
        }
    } else {
        formData.latitude = null;
        formData.longitude = null;
        formData.show_all_countries = false;

        const countryId = document.getElementById('placeCountry').value;
        formData.country_id = countryId || null;
    }

    try {
        const url = editingPlaceId 
            ? `/api/custom-places/${editingPlaceId}`
            : '/api/custom-places';
        
        const method = editingPlaceId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        }); 
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save place');
        }
        
        const result = await response.json();

        // Save the modified domain
        if (selectedDomain) {
            lastModifiedDomain = selectedDomain.domain;
        }

        closeModal();
        await loadCustomPlaces();

        showSuccess(editingPlaceId ? 'Place updated successfully!' : 'Place added successfully!');

    } catch (error) {
        showError(error.message || 'Failed to save place');
    }
}

// Toggle active/inactive status
async function togglePlaceStatus(placeId) {

    const normalizedId = parseInt(placeId);
    const place = currentPlaces.find(p => p.id === normalizedId);

    if (!place) {
        console.error('Place not found:', normalizedId);
        return;
    }

    // Save the domain before updating
    lastModifiedDomain = place.domain;
    
    try {
        const response = await fetch(`/api/custom-places/${placeId}/toggle`, {
            method: 'PATCH',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to update status');
        }
        
        await loadCustomPlaces();
        showSuccess(`Place ${place.is_active ? 'deactivated' : 'activated'} successfully!`);

    } catch (error) {
        console.error('Error toggling status:', error);
        showError('Failed to update place status');
    }
}

// Delete place
async function deletePlace(placeId) {

    const normalizedId = parseInt(placeId);
    const place = currentPlaces.find(p => p.id === normalizedId);

    if (!place) {
        console.error('Place not found:', normalizedId);
        return;
    }

    if (!confirm(`Are you sure you want to delete "${place.title}"?`)) {
        return;
    }

    // Save the domain before deleting
    lastModifiedDomain = place.domain;
    
    try {
        const response = await fetch(`/api/custom-places/${placeId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete place');
        }
        
        await loadCustomPlaces();
        showSuccess('Place deleted successfully!');

    } catch (error) {
        console.error('Error deleting place:', error);
        showError('Failed to delete place');
    }
}

// Modal functions
function openModal() {
    const modal = document.getElementById('placeModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('placeModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

window.onclick = function(event) {
    const modal = document.getElementById('placeModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Notifications
function showSuccess(message) {
    createNotification(message, 'success');
}

function showError(message) {
    createNotification(message, 'error');
}

function createNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#00b894' : '#ff6b6b'};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
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
    return symbols[currency] || currency;
}
// Expose functions to global scope
window.openAddPlaceModal = openAddPlaceModal;
window.editPlace = editPlace;
window.togglePlaceStatus = togglePlaceStatus;
window.deletePlace = deletePlace;
window.closeModal = closeModal;
window.closeUpgradeModal = closeUpgradeModal;
window.handleImageSelect = handleImageSelect;
window.updateCharCounter = updateCharCounter;
window.toggleMapOptions = toggleMapOptions;
window.toggleCountrySelector = toggleCountrySelector;