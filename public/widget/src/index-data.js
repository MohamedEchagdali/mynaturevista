// index-data.js
import { initSliders } from './index-slider.js';
import { transformDataUrls, convertDOMImagesToCloudinary } from './cloudinary-helper.js';

// Security: Sanitize HTML to prevent XSS attacks
function sanitizeHTML(dirty) {
    if (!dirty || typeof dirty !== 'string') return '';

    // Use global DOMPurify (loaded in HTML)
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(dirty, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a', 'span', 'div', 'h1', 'h2', 'h3', 'button', 'svg', 'path'],
            ALLOWED_ATTR: ['href', 'title', 'class', 'id', 'target', 'rel', 'viewBox', 'xmlns', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd'],
            ALLOW_DATA_ATTR: false
        });
    }

    // Fallback: basic HTML escaping
    const div = document.createElement('div');
    div.textContent = dirty;
    return div.innerHTML;
}

// Function to get API key from URL parameters
function getApiKey() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('apikey') || '';
}

// Function to build URLs with internal navigation
function buildWidgetUrl(baseUrl, apiKey) {
    if (window.buildNavigationUrl) {
        return window.buildNavigationUrl(baseUrl);
    }
    
    const url = new URL(baseUrl, window.location.origin);
    if (apiKey) {
        url.searchParams.set('apikey', apiKey);
    }
    
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.has('action') || window.IS_WIDGET_IFRAME) {
        url.searchParams.set('action', 'navigate');
        url.searchParams.set('internal', 'true');
    }
    
    return url.toString();
}



function isAnyDropdownOpen(section = document) {
  const dropdowns = section.querySelectorAll('.dropdown-content');
  return Array.from(dropdowns).some(content => {
    return content.style.display === "block" && content.offsetParent !== null;
  });
}

function pauseAllSliders() {
  document.querySelectorAll('.allSlider').forEach(section => {
    const toggleButton = section.querySelector('.togglePlayPause');
    const pauseIcon = section.querySelector('.pause');
    if (toggleButton && pauseIcon && pauseIcon.style.display !== 'none') {
      toggleButton.click();
    }
  });
}

function resumeAllSliders() {
  document.querySelectorAll('.allSlider').forEach(section => {
    const toggleButton = section.querySelector('.togglePlayPause');
    const playIcon = section.querySelector('.play');
    if (toggleButton && playIcon && playIcon.style.display !== 'none') {
      toggleButton.click();
    }
  });
}

function closeAllDropdowns(exceptDropdown = null) {
  let hadOpenDropdowns = false;
  document.querySelectorAll('.dropdown').forEach(dropdown => {
    if (dropdown !== exceptDropdown) {
      const content = dropdown.querySelector('.dropdown-content');
      if (content && content.style.display === 'block') {
        content.style.display = "none";
        dropdown.classList.remove('open');
        hadOpenDropdowns = true;
      }
    }
  });
  return hadOpenDropdowns;
}

function notifyContentLoaded() {
  document.dispatchEvent(new CustomEvent('contentLoaded'));
  
  if (window.widgetTranslate && window.widgetTranslate.isLoaded()) {
    setTimeout(() => {
      window.widgetTranslate.forceRetranslate();
    }, 500);
  }
}

// 🎯 ADVANCED LAZY LOADING SYSTEM
class AdvancedImageLoader {
  constructor() {
    this.observer = null;
    this.loadedImages = new Set();
    this.loadingQueue = [];
    this.isProcessing = false;
    this.priorityImages = new Set();
  }

  init() {
    // Intersection Observer for viewport detection
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          // Add to priority queue if entering viewport
          this.priorityImages.add(img);
          this.loadImage(img);
        }
      });
    }, {
      root: null,
      rootMargin: '200px', // Start loading 200px before viewport
      threshold: 0.01
    });

    // Listen for slider changes to preload next images
    document.addEventListener('sliderChange', (e) => {
      this.preloadNextImages(e.detail.nextIndex);
    });
  }

  loadImage(img) {
    if (this.loadedImages.has(img)) return;
    
    const src = img.dataset.src;
    if (!src) return;
    
    // Add loading class
    img.classList.add('loading');
    
    // Create temporary image to preload
    const tempImg = new Image();
    
    tempImg.onload = () => {
      img.src = src;
      img.classList.remove('loading');
      img.classList.add('loaded');
      this.loadedImages.add(img);
      this.observer.unobserve(img);
    };
    
    tempImg.onerror = () => {
      //console.warn('⚠️ Failed to load image:', src);
      img.classList.remove('loading');
      img.classList.add('error');
    };
    
    tempImg.src = src;
  }

  loadImmediate(img) {
    this.priorityImages.add(img);
    this.loadImage(img);
  }

  observe(img) {
    if (this.observer) {
      this.observer.observe(img);
    }
  }

  // Preload next 2 images when slider changes
  preloadNextImages(currentIndex) {
    const sliders = document.querySelectorAll('.allSlider');
    sliders.forEach(slider => {
      const items = slider.querySelectorAll('.list .item');
      const nextIndices = [currentIndex + 1, currentIndex + 2];
      
      nextIndices.forEach(index => {
        if (items[index]) {
          const img = items[index].querySelector('img.lazy-load');
          if (img && !this.loadedImages.has(img)) {
            this.loadImmediate(img);
          }
        }
      });
    });
  }

  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

export async function loadData() {
  const allSections = document.getElementById('allSections');
  const currentApiKey = getApiKey();

  // Initialize advanced loader
  const imageLoader = new AdvancedImageLoader();
  imageLoader.init();

// 🎯 CREATE LOADING PLACEHOLDER
const createPlaceholder = () => {
  // Obtener colores del cliente desde las variables CSS
  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue('--theme-primary').trim() || '#ff2b4f';
  const secondary = styles.getPropertyValue('--theme-secondary').trim() || '#f1683a';
  
  // Convertir hex a RGB para el SVG
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '255,43,79';
    return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
  };
  
  const primaryRgb = hexToRgb(primary);
  const secondaryRgb = hexToRgb(secondary);
  
  const svg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='0%25'%3E%3Cstop offset='0%25' style='stop-color:rgba(${primaryRgb},0.3);stop-opacity:1'/%3E%3Cstop offset='50%25' style='stop-color:rgba(${secondaryRgb},0.4);stop-opacity:1'/%3E%3Cstop offset='100%25' style='stop-color:rgba(${primaryRgb},0.3);stop-opacity:1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='16' height='9' fill='url(%23grad)'/%3E%3C/svg%3E`;
  
  return svg;
};

  try {
    const response = await fetch('/widget/dataDom/continents.json');
    if (!response.ok) {
      throw new Error(`There was an issue loading the data: ${response.statusText}`);
    }

    const originalData = await response.json();
    
    // Transform URLs to Cloudinary
    const data = transformDataUrls(originalData);

    //console.log('📊 Loading data: 7 continents with', data.continents.reduce((acc, c) => acc + c.countries.length, 0), 'countries');

    data.continents.forEach((continent, continentIndex) => {
      const slider = document.createElement('div');
      slider.classList.add('allSlider');
      slider.id = `allSlider${continent.code}`;
      slider.dataset.continentIndex = continentIndex;

      const list = document.createElement('div');
      list.classList.add('list');
      slider.appendChild(list);

      const thumbnail = document.createElement('div');
      thumbnail.classList.add('thumbnail2');

      const arrows = document.createElement('div');
      arrows.classList.add('arrows2');
      const prevButton = document.createElement('button');
      prevButton.classList.add('prev');
      prevButton.textContent = '<';
      const playPauseButton = document.createElement('button');
      playPauseButton.classList.add('togglePlayPause');

      const pauseIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      pauseIcon.classList.add('pause');
      pauseIcon.setAttribute('width', '24');
      pauseIcon.setAttribute('height', '24');
      pauseIcon.innerHTML = '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 6H8a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1Zm7 0h-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1Z"/>';

      const playIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      playIcon.classList.add('play');
      playIcon.setAttribute('width', '24');
      playIcon.setAttribute('height', '24');
      playIcon.innerHTML = '<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 18V6l8 6-8 6Z"/>';

      playPauseButton.appendChild(pauseIcon);
      playPauseButton.appendChild(playIcon);
      playIcon.style.display = 'none';

      const nextButton = document.createElement('button');
      nextButton.classList.add('next');
      nextButton.textContent = '>';

      arrows.appendChild(prevButton);
      arrows.appendChild(playPauseButton);
      arrows.appendChild(nextButton);
      slider.appendChild(arrows);

      const timeDiv = document.createElement('div');
      timeDiv.classList.add('time');
      slider.appendChild(timeDiv);

      continent.countries.forEach((country, index, array) => {
        const item = document.createElement('div');
        item.classList.add('item');
        item.dataset.countryIndex = index;

        // 🎯 CRITICAL: Load ONLY first image of EACH continent immediately
        // All others: lazy load with placeholder
        const img = document.createElement('img');
        img.setAttribute("data-pin-nopin", "true");
        img.alt = country.name;

        const isFirstOfContinent = index === 0;

        if (isFirstOfContinent) {
          // ✅ Load first image of each continent immediately
          img.src = country.image;
          img.classList.add('priority-load', 'loaded');
          //console.log('✅ Loading priority image:', continent.name, '-', country.name);
        } else {
          // ⏳ ALL other images: lazy load
          img.dataset.src = country.image;
          img.src = createPlaceholder();
          img.classList.add('lazy-load');
          imageLoader.observe(img);
        }
        
        item.appendChild(img);

        const content2 = document.createElement('div');
        content2.classList.add('content2');

        const discoverDiv = document.createElement('div');
        discoverDiv.classList.add('continentName');
        discoverDiv.textContent = continent.name;
        content2.appendChild(discoverDiv);

        const topicDiv = document.createElement('div');
        topicDiv.classList.add('topic');
        topicDiv.textContent = "Natural place in";
        content2.appendChild(topicDiv);

        const wrapCountryDiv = document.createElement('div');
        wrapCountryDiv.classList.add('wrapCountry');

        const countryDiv = document.createElement('div');
        countryDiv.classList.add('country');
        countryDiv.textContent = country.name;
        wrapCountryDiv.appendChild(countryDiv);

        const discoverCountryDiv = document.createElement('div');
        discoverCountryDiv.classList.add('discoverCountry');

        const discoverButton = document.createElement('div');
        discoverButton.classList.add('internal-link');
        discoverButton.dataset.url = buildWidgetUrl(country.url || "#", currentApiKey);
        // Sanitize HTML content for security
        discoverButton.innerHTML = sanitizeHTML(`
            <button class="animated-button">
                <svg viewBox="0 0 24 24" class="arr-2" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"></path>
                </svg>
                <span class="texto"> Discover </span>
                <span class="circle"></span>
                <svg viewBox="0 0 24 24" class="arr-1" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"></path>
                </svg>
            </button>
        `);
        discoverCountryDiv.appendChild(discoverButton);
        wrapCountryDiv.appendChild(discoverCountryDiv);

        const flagImg = document.createElement('img');
        flagImg.id = "flagHero";
        flagImg.src = country.flag; // Flags are small, load immediately
        flagImg.alt = country.name + " flag";
        countryDiv.appendChild(flagImg);

        content2.appendChild(wrapCountryDiv);

        //const textDiv = document.createElement('div');
        //textDiv.classList.add('text');
        //textDiv.textContent = country.description;
        //content2.appendChild(textDiv);

        // DROPDOWN
        const dropdown = document.createElement('div');
        dropdown.classList.add('dropdown');
        const dropdownSpan = document.createElement('span');
        dropdownSpan.textContent = "Country List";
        dropdown.appendChild(dropdownSpan);

        const dropdownContent = document.createElement('div');
        dropdownContent.classList.add('dropdown-content');
        dropdownContent.style.display = "none";

        continent.countries.forEach(dropdownCountry => {
          const selectCountryDiv = document.createElement('div');
          selectCountryDiv.classList.add('selectCountry');

          const countryLink = document.createElement('div');
          countryLink.classList.add('internal-link');
          countryLink.dataset.url = buildWidgetUrl(dropdownCountry.url || "#", currentApiKey);

          countryLink.style.display = 'flex';
          countryLink.style.alignItems = 'center';
            countryLink.style.gap = '12px';
        
          countryLink.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const url = countryLink.dataset.url;

            const iframe = window.parent.document.getElementById("myWidgetIframe");
            if (iframe) {
              iframe.src = url;
              
              iframe.addEventListener('load', function onIframeLoad() {
                setTimeout(() => {
                  notifyContentLoaded();
                }, 800);
                iframe.removeEventListener('load', onIframeLoad);
              });
            }
          });

          const countryFlag = document.createElement('img');
          countryFlag.src = dropdownCountry.flag;
          countryFlag.alt = `${dropdownCountry.name} Flag`;
          countryLink.appendChild(countryFlag);

          const countryNameSpan = document.createElement('span');
          countryNameSpan.textContent = dropdownCountry.name;
          countryLink.appendChild(countryNameSpan);

          selectCountryDiv.appendChild(countryLink);
          dropdownContent.appendChild(selectCountryDiv);
        });

        dropdown.appendChild(dropdownContent);
        content2.appendChild(dropdown);
        item.appendChild(content2);
        list.appendChild(item);

        dropdown.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          const isCurrentlyHidden = dropdownContent.style.display === "none";
          if (isCurrentlyHidden) {
            closeAllDropdowns(dropdown);
            pauseAllSliders();
            dropdownContent.style.display = "block";
            dropdown.classList.add('open');
            
            setTimeout(() => {
              notifyContentLoaded();
            }, 300);
          } else {
            dropdownContent.style.display = "none";
            dropdown.classList.remove('open');
            if (!isAnyDropdownOpen()) {
              //console.log('No more open dropdowns');
            }
          }
        });

        dropdownContent.addEventListener("click", (e) => {
          e.stopPropagation();
        });

        // THUMBNAIL - also lazy load
        const thumbnailItem = document.createElement('div');
        thumbnailItem.classList.add('item');
        const prevCountryIndex = (index - 1 + array.length) % array.length;
        const prevCountry = array[prevCountryIndex];
        
        const thumbnailImg = document.createElement('img');
        thumbnailImg.setAttribute("data-pin-nopin", "true");
        thumbnailImg.alt = prevCountry.name;
        
        // Thumbnails: lazy load for all except first of each continent
        if (isFirstOfContinent) {
          thumbnailImg.src = prevCountry.image;
          thumbnailImg.classList.add('priority-load', 'loaded');
        } else {
          thumbnailImg.dataset.src = prevCountry.image;
          thumbnailImg.src = createPlaceholder();
          thumbnailImg.classList.add('lazy-load');
          imageLoader.observe(thumbnailImg);
        }
        
        thumbnailItem.appendChild(thumbnailImg);

        const thumbnailContent2 = document.createElement('div');
        thumbnailContent2.classList.add('content2');
        const thumbnailFlagDiv = document.createElement('div');
        thumbnailFlagDiv.classList.add('flag');
        const thumbnailFlagImg = document.createElement('img');
        thumbnailFlagImg.src = prevCountry.flag;
        thumbnailFlagImg.alt = prevCountry.name + " flag";
        thumbnailFlagDiv.appendChild(thumbnailFlagImg);
        thumbnailContent2.appendChild(thumbnailFlagDiv);

        const thumbnailTitleDiv = document.createElement('div');
        thumbnailTitleDiv.classList.add('title');
        thumbnailTitleDiv.textContent = prevCountry.name;
        thumbnailContent2.appendChild(thumbnailTitleDiv);
        thumbnailItem.appendChild(thumbnailContent2);

        thumbnail.appendChild(thumbnailItem);
      });

      slider.appendChild(thumbnail);
      allSections.appendChild(slider);
    });

    // Global event listeners
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        closeAllDropdowns();
      }
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllDropdowns();
      }
    });

document.addEventListener("click", (e) => {
    // 🔥 IGNORE PREMIUM LINKS (custom places) - Let them work naturally
    const premiumLink = e.target.closest('.premium-link');
    if (premiumLink) {
        // Let the browser handle external links naturally
        return;
    }

    const link = e.target.closest(".internal-link");
    if (link) {
        e.preventDefault();
        e.stopPropagation();

        // ✅ Intentar obtener URL de cualquier data attribute
        let targetUrl = link.dataset.url || link.dataset.baseUrl;

        if (!targetUrl || targetUrl.trim() === '') {
            console.warn('⚠️ Internal link without valid URL:', link);
            return;
        }
        
        try {
            // Construir URL completa con parámetros actuales
            const params = new URLSearchParams(window.location.search);
            const urlObj = new URL(targetUrl, window.location.origin);
            
            // Copiar parámetros de la URL actual (apikey, name, etc.)
            params.forEach((value, key) => {
                if (!urlObj.searchParams.has(key)) {
                    urlObj.searchParams.set(key, value);
                }
            });
            
            // Agregar parámetros de navegación interna
            if (!urlObj.searchParams.has('action')) {
                urlObj.searchParams.set('action', 'navigate');
                urlObj.searchParams.set('internal', 'true');
            }
            
            const finalUrl = urlObj.toString();
            
            const iframe = window.parent.document.getElementById("myWidgetIframe"); 
            if (iframe) {
                //console.log('🔗 Navigating internally to:', finalUrl);
                iframe.src = finalUrl;
                
                iframe.addEventListener('load', function onIframeLoad() {
                    setTimeout(() => {
                        notifyContentLoaded();
                    }, 800);
                    iframe.removeEventListener('load', onIframeLoad);
                });
            } else {
                // Si no hay iframe (navegación directa)
                window.location.href = finalUrl;
            }
        } catch (error) {
            console.error('❌ Error creating URL:', error, 'Link:', targetUrl);
        }
    }
});

    // Initialize sliders FIRST
    initSliders();
    
    // Then notify content loaded and convert images
    setTimeout(() => {
      notifyContentLoaded();
      convertDOMImagesToCloudinary();
      //console.log('✅ Widget loaded - First image of each continent loaded');
    }, 500);
    
  } catch (error) {
    console.error('There was an issue loading the data:', error);
  }
}