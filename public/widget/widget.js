// widget.js - With native Google Translate button - Responsive version
(function () {
  'use strict';

  const script = document.currentScript;

  const config = {
    apiKey: script.dataset.apiKey || '',
    customName: script.dataset.name || 'myNaturevista',
    primaryColor: script.dataset.primaryColor || null,
    secondaryColor: script.dataset.secondaryColor || null,
    fontFamily: script.dataset.fontFamily || 'Arial, sans-serif',
    fontSize: script.dataset.fontSize || '14',
    serverUrl: script.dataset.serverUrl || 'http://localhost:3000/',
    debug: script.dataset.debug === 'true',
    autoOpen: script.dataset.autoOpen === 'true'
  };

  if (!config.apiKey) {
    console.error('NatureWidget: API key required.');
    return;
  }

  // Security: Sanitize text to prevent XSS attacks
  function sanitizeText(text) {
    if (!text || typeof text !== 'string') return '';

    // Use global sanitizeText if available (from sanitizer.js)
    if (typeof window.sanitizeText === 'function') {
      return window.sanitizeText(text);
    }

    // Fallback: basic HTML escaping
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function isValidColor(color) {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3}|[A-Fa-f0-9]{8})$/.test(color);
  }

  function normalizeColor(color) {
    if (!isValidColor(color)) return null;
    return color.length === 9 ? color.substring(0, 7) : color;
  }

  function hexToRgba(hex, alpha = 1) {
    if (!hex) return null;
    if (hex.length === 9) {
      const alphaHex = hex.substring(7, 9);
      alpha = parseInt(alphaHex, 16) / 255;
      hex = hex.substring(0, 7);
    }
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function generateColorVariations(primaryColor, secondaryColor) {
    if (!isValidColor(primaryColor) || !isValidColor(secondaryColor)) {
      return null;
    }

    const normalizedPrimary = normalizeColor(primaryColor);
    const normalizedSecondary = normalizeColor(secondaryColor);
    const primaryAlpha = primaryColor.length === 9 ? parseInt(primaryColor.substring(7, 9), 16) / 255 : 1;
    const secondaryAlpha = secondaryColor.length === 9 ? parseInt(secondaryColor.substring(7, 9), 16) / 255 : 1;

    return {
      primary: normalizedPrimary,
      secondary: normalizedSecondary,
      primaryWithAlpha: hexToRgba(primaryColor),
      secondaryWithAlpha: hexToRgba(secondaryColor),
      heroColor: normalizedPrimary,
      heroOpacity: hexToRgba(normalizedPrimary, Math.min(0.565, primaryAlpha)),
      gradientStart: normalizedSecondary,
      gradientEnd: normalizedPrimary,
      thirdColor: hexToRgba(normalizedPrimary, Math.min(0.843, primaryAlpha)),
      continentColor: normalizedSecondary,
      continentOpacity: hexToRgba(normalizedSecondary, Math.min(0.396, secondaryAlpha)),
      wrapContinentColor: hexToRgba(normalizedPrimary, Math.min(0.449, primaryAlpha)),
      mainBlack: '#000000',
      mainBlackTransparent: 'rgba(0, 0, 0, 0.514)',
      mainWhite: '#ffffff',
      originalAlpha: { primary: primaryAlpha, secondary: secondaryAlpha }
    };
  }

  function getResponsiveDimensions() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    let width, height, borderRadius;
    
    if (screenWidth <= 480) {
      width = `min(98vw, ${screenWidth * 0.98}px)`;
      height = `min(95vh, ${screenHeight * 0.95}px)`;
      borderRadius = '8px';
    } else if (screenWidth <= 768) {
      width = `min(95vw, ${screenWidth * 0.95}px)`;
      height = `min(90vh, ${screenHeight * 0.90}px)`;
      borderRadius = '10px';
    } else if (screenWidth <= 1400) {
      width = `min(90vw, ${screenWidth * 0.90}px)`;
      height = `min(90vh, ${screenHeight * 0.90}px)`;
      borderRadius = '12px';
    } else {
      width = `min(85vw, 1400px)`;
      height = `min(85vh, 900px)`;
      borderRadius = '12px';
    }
    
    const maxWidth = screenWidth * 0.98;
    const maxHeight = screenHeight * 0.98;
    
    return { width, height, borderRadius, maxWidth, maxHeight };
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function lightenColor(hex, percent) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent / 100));
    const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent / 100));
    const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent / 100));
    return rgbToHex(r, g, b);
  }

  function darkenColor(hex, percent) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const r = Math.max(0, Math.floor(rgb.r * (1 - percent / 100)));
    const g = Math.max(0, Math.floor(rgb.g * (1 - percent / 100)));
    const b = Math.max(0, Math.floor(rgb.b * (1 - percent / 100)));
    return rgbToHex(r, g, b);
  }

  function preInjectCSS() {
    // 🔥 LEER LOS COLORES DE LOS PARÁMETROS DEL SCRIPT, NO USAR DEFAULTS HARDCODEADOS
    let colorVariations = generateColorVariations(config.primaryColor, config.secondaryColor);
    
    // Solo usar defaults si NO se proporcionaron colores en absoluto
    if (!colorVariations && !config.primaryColor && !config.secondaryColor) {
      console.log('⚠️ No custom colors provided, using defaults');
      colorVariations = {
        primary: '#ff2b4f',
        secondary: '#f1683a',
        primaryWithAlpha: '#ff2f5290',
        secondaryWithAlpha: '#fc7188',
        heroColor: '#ff0e36',
        heroOpacity: '#ff7c92d7',
        gradientStart: '#fc7188',
        gradientEnd: '#ff0e36',
        thirdColor: '#fc7188',
        continentColor: '#f1683a',
        continentOpacity: '#f1683a65',
        wrapContinentColor: '#ff6d3c50',
        mainBlack: '#000000',
        mainBlackTransparent: 'rgba(0, 0, 0, 0.514)',
        mainWhite: '#ffffff',
        originalAlpha: { primary: 1, secondary: 1 }
      };
    } else if (!colorVariations) {
      // Si generateColorVariations falló pero SÍ hay colores, hay un error de formato
      console.error('❌ Invalid color format. Please use hex colors like #FF5733');
      // Intentar usar los colores directamente aunque no sean válidos
      colorVariations = {
        primary: config.primaryColor || '#ff2b4f',
        secondary: config.secondaryColor || '#f1683a',
        primaryWithAlpha: config.primaryColor || '#ff2f5290',
        secondaryWithAlpha: config.secondaryColor || '#fc7188',
        heroColor: config.primaryColor || '#ff0e36',
        heroOpacity: hexToRgba(config.primaryColor || '#ff0e36', 0.565),
        gradientStart: config.secondaryColor || '#fc7188',
        gradientEnd: config.primaryColor || '#ff0e36',
        thirdColor: hexToRgba(config.primaryColor || '#ff0e36', 0.843),
        continentColor: config.secondaryColor || '#f1683a',
        continentOpacity: hexToRgba(config.secondaryColor || '#f1683a', 0.396),
        wrapContinentColor: hexToRgba(config.primaryColor || '#ff0e36', 0.449),
        mainBlack: '#000000',
        mainBlackTransparent: 'rgba(0, 0, 0, 0.514)',
        mainWhite: '#ffffff',
        originalAlpha: { primary: 1, secondary: 1 }
      };
    }

    const customCSS = `
      :root {
        --hero-color: ${colorVariations.heroColor};
        --fourth-color: ${colorVariations.heroOpacity};
        --gradient-start: ${colorVariations.gradientStart};
        --gradient-end: ${colorVariations.gradientEnd};
        --third-color: ${colorVariations.thirdColor};
        --continentSection-color: ${colorVariations.continentColor};
        --continentSection-opacity-color: ${colorVariations.continentOpacity};
        --wrap-continent-color: ${colorVariations.wrapContinentColor};
        --main-black: ${colorVariations.mainBlack};
        --main-black-transparent: ${colorVariations.mainBlackTransparent};
        --main-white: ${colorVariations.mainWhite};
        --primary-color: ${colorVariations.primary};
        --secondary-color: ${colorVariations.secondary};
        --primary-with-alpha: ${colorVariations.primaryWithAlpha};
        --secondary-with-alpha: ${colorVariations.secondaryWithAlpha};
        --font-family: ${config.fontFamily};
        --font-size: ${config.fontSize}px;
        --theme-primary: ${colorVariations.primary};
        --theme-secondary: ${colorVariations.secondary};
        --theme-primary-light: ${lightenColor(colorVariations.primary, 20)};
        --theme-primary-dark: ${darkenColor(colorVariations.primary, 20)};
        --theme-secondary-light: ${lightenColor(colorVariations.secondary, 20)};
        --theme-secondary-dark: ${darkenColor(colorVariations.secondary, 20)};
        --text-on-primary: #ffffff;
        --text-on-secondary: #ffffff;
        --gradient-primary: linear-gradient(135deg, ${colorVariations.primary}, ${darkenColor(colorVariations.primary, 20)});
        --gradient-secondary: linear-gradient(135deg, ${colorVariations.secondary}, ${darkenColor(colorVariations.secondary, 20)});
        --gradient-mixed: linear-gradient(135deg, ${colorVariations.secondary}, ${colorVariations.primary});
        --primary-hover: ${darkenColor(colorVariations.primary, 20)};
        --secondary-hover: ${darkenColor(colorVariations.secondary, 20)};
        --shadow-primary: 0 4px 15px ${hexToRgba(colorVariations.primary, 0.3)};
        --shadow-secondary: 0 4px 15px ${hexToRgba(colorVariations.secondary, 0.3)};
        --glow-primary: 0 0 20px ${hexToRgba(colorVariations.primary, 0.3)};
        --glow-secondary: 0 0 20px ${hexToRgba(colorVariations.secondary, 0.3)};
        --overlay-primary: ${hexToRgba(colorVariations.primary, 0.8)};
        --overlay-secondary: ${hexToRgba(colorVariations.secondary, 0.8)};
        --main-grey: grey;
      }

      /* Responsive translate button */
      #widget-translate-button {
        position: fixed;
        top: 10px;
        right: 70px;
        z-index: 100002;
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid ${normalizeColor(config.primaryColor) || '#000'};
        border-radius: 50%;
        width: 40px;
        height: 40px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        font-size: 20px;
        display: none;
        align-items: center;
        justify-content: center;
      }

      #widget-translate-button:hover {
        background-color: rgba(255, 255, 255, 1);
        transform: scale(1.1);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }

      /* Mobile responsive styles */
      @media (max-width: 768px) {
        #widget-translate-button {
          top: 10px !important;
          right: 55px !important;
        }
        
        #widget-close-button {
          top: 10px !important;
          right: 10px !important;
        }
        
        #widget-brand-label {
          font-size: 1.2rem !important;
          padding: 6px 12px !important;
          top: 10px !important;
          left: 10px !important;
          transform: none !important;
        }
      }

      #widget-opening-loader,
      #widget-opening-loader *,
      #nature-widget-container,
      #nature-widget-container * {
        font-family: var(--font-family) !important;
        font-size: var(--font-size) !important;
      }
      
      /* Opening loader with faster animation */
      #widget-opening-loader {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.48);
        display: flex; 
        align-items: center; 
        justify-content: center;
        z-index: 9999999;
        backdrop-filter: blur(5px);
        opacity: 1;
        transition: opacity 0.3s ease;
      }

      #widget-opening-loader .opening-loader-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        padding: 3rem;
        background: linear-gradient(135deg, var(--theme-primary) 0%, var(--theme-secondary) 100%);
        border-radius: 50%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 40px ${hexToRgba(colorVariations.primary, 0.4)};
        z-index: 10000000;
        width: min(300px, 80vw);
        height: min(300px, 80vw);
        max-width: 95%;
        max-height: 95%;
        overflow: hidden;
        animation: loaderPulse 2s ease-in-out infinite;
      }

      @keyframes loaderPulse {
        0%, 100% {
          transform: translate(-50%, -50%) scale(1);
          box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 40px ${hexToRgba(colorVariations.primary, 0.4)};
        }
        50% {
          transform: translate(-50%, -50%) scale(1.05);
          box-shadow: 0 25px 70px rgba(0,0,0,0.4), 0 0 60px ${hexToRgba(colorVariations.primary, 0.6)};
        }
      }
      
      #widget-opening-loader .opening-logo {
        font-size: 2rem;
        font-weight: 800;
        color: var(--main-white);
        text-shadow: 0 3px 15px rgba(0, 0, 0, 0.5);
        letter-spacing: 2px;
        animation: logoFloat 3s ease-in-out infinite;
      }

      @keyframes logoFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      
      #widget-opening-loader .spinner {
        width: 50px;
        height: 50px;
        border: 4px solid rgba(255, 255, 255, 0.2);
        border-top: 4px solid var(--main-white);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      #widget-opening-loader .opening-percentage {
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--main-white);
        background: rgba(0, 0, 0, 0.3);
        padding: 8px 20px;
        border-radius: 30px;
        animation: percentagePulse 1.5s ease-in-out infinite;
      }

      @keyframes percentagePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      
      /* Floating particles outside widget and loader - with custom colors */
      .widget-background-particles {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
        z-index: 99998;
      }
      
      .widget-bg-particle {
        position: absolute;
        border-radius: 50%;
        animation: floatBgParticle 8s ease-in-out infinite;
        opacity: 0.7;
        box-shadow: 0 0 10px currentColor;
      }
      
      @keyframes floatBgParticle {
        0% {
          transform: translateY(100vh) translateX(0) rotate(0deg) scale(1);
          opacity: 0;
        }
        10% {
          opacity: 0.7;
        }
        90% {
          opacity: 0.7;
        }
        100% {
          transform: translateY(-100px) translateX(100px) rotate(360deg) scale(0.5);
          opacity: 0;
        }
      }

      /* Modal particles - outside widget when open */
      .modal-particles {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
        z-index: 99999;
      }
      
      .modal-particle {
        position: absolute;
        border-radius: 50%;
        animation: floatModalParticle 6s ease-in-out infinite;
        box-shadow: 0 0 15px currentColor;
      }
      
      @keyframes floatModalParticle {
        0% {
          transform: translateY(100vh) translateX(-50px) rotate(0deg);
          opacity: 0;
        }
        50% {
          transform: translateY(50vh) translateX(25px) rotate(180deg);
          opacity: 0.8;
        }
        100% {
          transform: translateY(-10vh) translateX(100px) rotate(360deg);
          opacity: 0;
        }
      }

      /* Loader particles */
      .loader-particles {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: hidden;
        z-index: 1;
      }
      
      .loader-particle {
        position: absolute;
        border-radius: 50%;
        animation: floatLoaderParticle 4s ease-in-out infinite;
      }
      
      @keyframes floatLoaderParticle {
        0% {
          transform: translate(0, 0) rotate(0deg);
          opacity: 0;
        }
        50% {
          opacity: 1;
        }
        100% {
          transform: translate(var(--tx), var(--ty)) rotate(360deg);
          opacity: 0;
        }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = 'nature-widget-theme-preload';
    styleElement.innerHTML = customCSS;
    document.head.appendChild(styleElement);
    
    return { colorVariations, customCSS };
  }

  function updateLoaderDimensions() {
    const openingLoader = document.getElementById('widget-opening-loader');
    if (!openingLoader) return;
    const container = openingLoader.querySelector('.opening-loader-container');
    if (!container) return;
    
    const size = Math.min(window.innerWidth * 0.8, window.innerHeight * 0.8, 300);
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;
  }

  function createOpeningLoader() {
    let openingLoader = document.getElementById('widget-opening-loader');
    if (!openingLoader) {
      openingLoader = document.createElement('div');
      openingLoader.id = 'widget-opening-loader';
      // Sanitize customName to prevent XSS
      const safeCustomName = sanitizeText(config.customName);
      openingLoader.innerHTML = `
        <div class="opening-loader-container">
          <div class="loader-particles"></div>
          <div class="opening-logo">${safeCustomName}</div>
          <div class="spinner"></div>
          <div class="opening-percentage">0%</div>
        </div>
      `;
      document.body.appendChild(openingLoader);
      
      const loaderParticles = openingLoader.querySelector('.loader-particles');
      for (let i = 0; i < 15; i++) {
        const particle = document.createElement('div');
        particle.className = 'loader-particle';
        const size = 3 + Math.random() * 5;
        const startX = Math.random() * 100;
        const startY = Math.random() * 100;
        const tx = (Math.random() - 0.5) * 200;
        const ty = (Math.random() - 0.5) * 200;
        
        particle.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background: ${Math.random() > 0.5 ? '#fff' : 'rgba(255,255,255,0.5)'};
          left: ${startX}%;
          top: ${startY}%;
          --tx: ${tx}px;
          --ty: ${ty}px;
          animation-delay: ${Math.random() * 4}s;
        `;
        loaderParticles.appendChild(particle);
      }
      
      updateLoaderDimensions();
      const resizeHandler = () => updateLoaderDimensions();
      window.addEventListener('resize', resizeHandler);
      openingLoader._resizeHandler = resizeHandler;
    }
    return openingLoader;
  }

  function updateOpeningProgress(percentage) {
    const openingLoader = document.getElementById('widget-opening-loader');
    if (openingLoader) {
      const percentageElement = openingLoader.querySelector('.opening-percentage');
      if (percentageElement) {
        percentageElement.textContent = `${Math.round(percentage)}%`;
      }
    }
  }

  function hideOpeningLoader() {
    const openingLoader = document.getElementById('widget-opening-loader');
    if (openingLoader) {
      if (openingLoader._resizeHandler) {
        window.removeEventListener('resize', openingLoader._resizeHandler);
      }
      openingLoader.style.opacity = '0';
      setTimeout(() => {
        if (openingLoader.parentNode) {
          openingLoader.parentNode.removeChild(openingLoader);
        }
      }, 300);
    }
  }

  function createBackgroundParticles(colors) {
    let bgParticlesContainer = document.getElementById('widget-bg-particles');
    if (!bgParticlesContainer) {
      bgParticlesContainer = document.createElement('div');
      bgParticlesContainer.id = 'widget-bg-particles';
      bgParticlesContainer.className = 'widget-background-particles';
      
      const particleColors = [
        colors.primary,
        colors.secondary,
        hexToRgba(colors.primary, 0.7),
        hexToRgba(colors.secondary, 0.7),
        lightenColor(colors.primary, 30),
        lightenColor(colors.secondary, 30)
      ];
      
      for (let i = 0; i < 35; i++) {
        const particle = document.createElement('div');
        particle.className = 'widget-bg-particle';
        const size = 4 + Math.random() * 10;
        const color = particleColors[Math.floor(Math.random() * particleColors.length)];
        
        particle.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          background: ${color};
          color: ${color};
          left: ${Math.random() * 100}%;
          top: ${100 + Math.random() * 10}%;
          animation-delay: ${Math.random() * 8}s;
          animation-duration: ${6 + Math.random() * 4}s;
        `;
        bgParticlesContainer.appendChild(particle);
      }
      
      document.body.appendChild(bgParticlesContainer);
    }
    return bgParticlesContainer;
  }

  function removeBackgroundParticles() {
    const bgParticles = document.getElementById('widget-bg-particles');
    if (bgParticles && bgParticles.parentNode) {
      bgParticles.parentNode.removeChild(bgParticles);
    }
  }

  function createModalParticles(colors) {
    const modalParticles = document.createElement('div');
    modalParticles.className = 'modal-particles';
    modalParticles.id = 'widget-modal-particles';
    
    const particleColors = [
      colors.primary,
      colors.secondary,
      hexToRgba(colors.primary, 0.8),
      hexToRgba(colors.secondary, 0.8),
      lightenColor(colors.primary, 20),
      lightenColor(colors.secondary, 20)
    ];
    
    for (let i = 0; i < 40; i++) {
      const particle = document.createElement('div');
      particle.className = 'modal-particle';
      const size = 5 + Math.random() * 12;
      const color = particleColors[Math.floor(Math.random() * particleColors.length)];
      
      particle.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        color: ${color};
        left: ${Math.random() * 100}%;
        top: ${Math.random() * 100}%;
        animation-delay: ${Math.random() * 6}s;
        animation-duration: ${5 + Math.random() * 3}s;
      `;
      modalParticles.appendChild(particle);
    }
    
    document.body.appendChild(modalParticles);
    return modalParticles;
  }

  function removeModalParticles() {
    const modalParticles = document.getElementById('widget-modal-particles');
    if (modalParticles && modalParticles.parentNode) {
      modalParticles.parentNode.removeChild(modalParticles);
    }
  }

  window.openNatureWidget = function (event) {
    if (event && event.preventDefault) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const { colorVariations } = preInjectCSS();
    const openingLoader = createOpeningLoader();
    createBackgroundParticles(colorVariations);
    
    let openingProgress = 0;
    const openingInterval = setInterval(() => {
        openingProgress += 5;
        updateOpeningProgress(openingProgress);
        if (openingProgress >= 100) {
            clearInterval(openingInterval);
            createModal(colorVariations);
        }
    }, 100);

    function createModal(colors) {
        if (document.getElementById('nature-widget-container')) return;

        const modal = document.createElement('div');
        modal.id = 'nature-widget-container';
        modal.style.cssText = `
            position: fixed; 
            top: 0; 
            left: 0; 
            width: 100vw; 
            height: 100vh;
            background: rgba(0,0,0,0.48); 
            z-index: 99999;
            display: flex; 
            align-items: center; 
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease-in-out;
        `;

        const modalParticlesContainer = createModalParticles(colors);

        // 🆕 TRANSLATE BUTTON - Responsive positioning
        const translateButton = document.createElement('button');
        translateButton.id = 'widget-translate-button';
        translateButton.innerHTML = '🌐';
        translateButton.title = 'Translate';
        document.body.appendChild(translateButton);

        translateButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                    type: 'toggle-translate'
                }, '*');
            }
        });

        const iframe = document.createElement('iframe');
        iframe.id = "myWidgetIframe";
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');

        const params = new URLSearchParams({
            apikey: config.apiKey,
            name: config.customName,
            fontFamily: config.fontFamily,
            fontSize: config.fontSize,
            ...(config.primaryColor && { primaryColor: config.primaryColor }),
            ...(config.secondaryColor && { secondaryColor: config.secondaryColor }),
            _t: Date.now()
        });

        const baseUrl = config.serverUrl.endsWith('/') ? config.serverUrl.slice(0, -1) : config.serverUrl;
        iframe.src = `${baseUrl}/widget.html?${params.toString()}`;

        let criticalImagesLoaded = false;
        let iframeScriptInjected = false;

        const readyListener = (e) => {
            if (e.data && e.data.type === 'hero-images-ready') {
                criticalImagesLoaded = true;
                checkReadyToShow();
            }
        };
        window.addEventListener('message', readyListener);

        iframe.addEventListener('load', function handleIframeLoad() {
            try {
                const script = iframe.contentDocument.createElement('script');
                script.textContent = `
                    (function() {
                        window.IS_WIDGET_IFRAME = true;
                        
                        window.buildNavigationUrl = function(page, params = {}) {
                            const url = new URL(page, window.location.origin);
                            const currentParams = new URLSearchParams(window.location.search);
                            const apiKey = currentParams.get('apikey');
                            
                            if (apiKey) {
                                url.searchParams.set('apikey', apiKey);
                            }
                            
                            url.searchParams.set('action', 'navigate');
                            url.searchParams.set('internal', 'true');
                            
                            Object.keys(params).forEach(key => {
                                url.searchParams.set(key, params[key]);
                            });
                            
                            return url.toString();
                        };
                        
                        function waitForHeroImages() {
                            const heroImage = document.querySelector('.itemContinents.active img');
                            const thumbnailImage = document.querySelector('.thumbnail1 .itemContinents.active img');
                            
                            let imagesToLoad = 0;
                            let imagesLoaded = 0;
                            
                            function checkComplete() {
                                imagesLoaded++;
                                if (imagesLoaded === imagesToLoad) {
                                    window.parent.postMessage({ type: 'hero-images-ready' }, '*');
                                }
                            }
                            
                            if (heroImage && !heroImage.complete) {
                                imagesToLoad++;
                                heroImage.addEventListener('load', checkComplete);
                                heroImage.addEventListener('error', checkComplete);
                            } else if (heroImage) {
                                imagesToLoad++;
                                imagesLoaded++;
                            }
                            
                            if (thumbnailImage && !thumbnailImage.complete) {
                                imagesToLoad++;
                                thumbnailImage.addEventListener('load', checkComplete);
                                thumbnailImage.addEventListener('error', checkComplete);
                            } else if (thumbnailImage) {
                                imagesToLoad++;
                                imagesLoaded++;
                            }
                            
                            if (imagesLoaded === imagesToLoad || imagesToLoad === 0) {
                                window.parent.postMessage({ type: 'hero-images-ready' }, '*');
                            }
                        }
                        
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', waitForHeroImages);
                        } else {
                            waitForHeroImages();
                        }
                        
                    })();
                `;
                iframe.contentDocument.head.appendChild(script);
                iframeScriptInjected = true;
                checkReadyToShow();

            } catch (error) {
                console.error('Could not inject navigation helpers:', error);
                setTimeout(() => {
                    showWidget();
                }, 600);
            }
            
            iframe.removeEventListener('load', handleIframeLoad);
        });

        function checkReadyToShow() {
            if (criticalImagesLoaded && iframeScriptInjected) {
                showWidget();
                window.removeEventListener('message', readyListener);
            }
        }

        function showWidget() {
            hideOpeningLoader();
            iframe.style.opacity = '1';
            modal.style.opacity = '1';
            translateButton.style.display = 'flex';
        }


        // Responsive styles - Redesigned for mobile
        function applyResponsiveStyles(preserveOpacity = false) {
            const currentOpacity = preserveOpacity ? iframe.style.opacity : '0';
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // Mobile: 96% width, positioned below header area
                iframe.style.cssText = `
                    position: fixed;
                    top: 60px;
                    left: 2vw;
                    width: 96vw;
                    height: calc(100vh - 70px);
                    border: none;
                    border-radius: 12px;
                    background: white;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    opacity: ${currentOpacity};
                    transition: opacity 0.5s ease-in-out;
                    z-index: 100000;
                `;
            } else {
                // Desktop: centered with margins
                iframe.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 85vw;
                    height: 85vh;
                    border: none;
                    border-radius: 20px;
                    background: white;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    opacity: ${currentOpacity};
                    transition: opacity 0.5s ease-in-out;
                    z-index: 100000;
                `;
            }
        }
        
        applyResponsiveStyles(false);
        const resizeHandler = () => {
            applyResponsiveStyles(true);
            updateButtonPositions();
            updateBrandLabelStyles();
        };
        window.addEventListener('resize', resizeHandler);
        modal.appendChild(iframe);


        // Brand label - Responsive sizing and positioning
        const brandLabel = document.createElement('div');
        brandLabel.id = 'widget-brand-label';
        brandLabel.textContent = '🌿 myNaturevista';
        
        function updateBrandLabelStyles() {
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                brandLabel.style.cssText = `
                    position: fixed;
                    top: 10px;
                    left: 10px;
                    z-index: 100001;
                    font-family: ${config.fontFamily};
                    font-size: 1.2rem;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    padding: 6px 12px;
                    border-radius: 8px;
                    color: transparent;
                    -webkit-background-clip: text;
                    background-clip: text;
                    text-fill-color: transparent;
                    -webkit-text-fill-color: transparent;
                    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
                    background-color: rgba(255, 255, 255, 0.4);
                    backdrop-filter: blur(8px) saturate(180%);
                    -webkit-backdrop-filter: blur(8px) saturate(180%);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    pointer-events: none;
                    max-width: calc(100vw - 120px);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;
            } else {
                brandLabel.style.cssText = `
                    position: fixed;
                    top: 1%;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 100001;
                    font-family: ${config.fontFamily};
                    font-size: 2.2rem;
                    font-weight: 800;
                    letter-spacing: 1px;
                    padding: 10px 28px;
                    border-radius: 14px;
                    color: transparent;
                    -webkit-background-clip: text;
                    background-clip: text;
                    text-fill-color: transparent;
                    -webkit-text-fill-color: transparent;
                    text-shadow: 0 3px 10px rgba(0, 0, 0, 0.86);
                    background-color: rgba(255, 255, 255, 0.51);
                    backdrop-filter: blur(10px) saturate(180%);
                    -webkit-backdrop-filter: blur(10px) saturate(180%);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
                    pointer-events: none;
                `;
            }
        }
        
        updateBrandLabelStyles();
        modal.appendChild(brandLabel);

        // Close button - Responsive positioning
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.id = 'widget-close-button';
        closeButton.innerHTML = '✕';
        
        function updateButtonPositions() {
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // Mobile: top right corner
                closeButton.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(255,255,255,0.95);
                    border: 2px solid ${normalizeColor(config.primaryColor) || '#000'};
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                    font-size: 18px;
                    font-weight: bold;
                    transition: all 0.2s ease;
                    z-index: 100002;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                
                // Update translate button position for mobile
                translateButton.style.top = '10px';
                translateButton.style.right = '55px';
            } else {
                // Desktop: top right corner
                closeButton.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(255,255,255,0.9);
                    border: 2px solid ${normalizeColor(config.primaryColor) || '#000'};
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                    font-size: 18px;
                    transition: all 0.2s ease;
                    z-index: 100002;
                `;
                
                // Update translate button position for desktop
                translateButton.style.top = '10px';
                translateButton.style.right = '70px';
            }
        }
        
        updateButtonPositions();
        
        closeButton.onmouseover = () => {
            closeButton.style.background = 'rgba(255,255,255,1)';
            closeButton.style.transform = 'scale(1.1)';
        };
        closeButton.onmouseout = () => {
            closeButton.style.background = 'rgba(255,255,255,0.9)';
            closeButton.style.transform = 'scale(1)';
        };
        
        const closeModal = () => {
            const injectedStyle = document.getElementById('nature-widget-theme-preload');
            if (injectedStyle) injectedStyle.remove();
            
            if (translateButton && translateButton.parentNode) {
                translateButton.parentNode.removeChild(translateButton);
            }
            
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'hide-translate' }, '*');
            }
            
            removeBackgroundParticles();
            removeModalParticles();
            window.removeEventListener('resize', resizeHandler);
            window.removeEventListener('message', readyListener);
            modal.remove();
            document.removeEventListener('keydown', handleKeyPress);
        };

        closeButton.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
        modal.appendChild(closeButton);

        const handleKeyPress = (e) => { if (e.key === 'Escape') closeModal(); };
        document.addEventListener('keydown', handleKeyPress);

        document.body.appendChild(modal);
    }
  };

  if (config.autoOpen) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => window.openNatureWidget());
    } else {
      window.openNatureWidget();
    }
  }

  window.natureWidget = {
    open: window.openNatureWidget,
    config: config,
    updateOpeningProgress: updateOpeningProgress
  };

})();