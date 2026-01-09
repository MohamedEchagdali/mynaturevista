//clientPreferences.js
(function() {
    'use strict';

    // Configuration persistence between pages
    const CONFIG_KEY = 'nature-widget-config';
    
    // 🔥 NUEVA VARIABLE: Indica si la configuración del servidor ya se cargó
    let serverConfigLoaded = false;
    let serverConfig = null;
    
    // Save configuration in iframe memory
    function saveConfig(config) {
        if (window.parent && window.parent !== window) {
            // Save in parent window
            if (!window.parent.widgetCustomConfig) {
                window.parent.widgetCustomConfig = {};
            }
            Object.assign(window.parent.widgetCustomConfig, config);
        }
        
        // Also save in iframe global variable
        window.currentWidgetConfig = config;
    }
    
    // Get persistent configuration
    function getSavedConfig() {
        // 🔥 PRIMERO: Intentar obtener desde el servidor (prioridad máxima)
        if (serverConfig) {
            return serverConfig;
        }
        
        // First try to get from parent
        if (window.parent && window.parent !== window && window.parent.widgetCustomConfig) {
            return window.parent.widgetCustomConfig;
        }
        
        // Then from global variable
        if (window.currentWidgetConfig) {
            return window.currentWidgetConfig;
        }
        
        return null;
    }

    // Get parameters with persistence
    function getParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const savedConfig = getSavedConfig();
        
        // Prioridad:
        // 1. Configuración del servidor (serverConfig)
        // 2. Configuración guardada en memoria (savedConfig)
        // 3. Parámetros URL
        // 4. Valores por defecto
        
        return {
            name: (savedConfig && savedConfig.name) || 
                  (savedConfig && savedConfig.clientName) || 
                  urlParams.get('name') || 
                  'myNaturevista',
            primaryColor: (savedConfig && savedConfig.primaryColor) || 
                          urlParams.get('primaryColor') || 
                          '#ff2b4f',
            secondaryColor: (savedConfig && savedConfig.secondaryColor) || 
                            urlParams.get('secondaryColor') || 
                            '#f1683a',
            fontFamily: (savedConfig && savedConfig.fontFamily) || 
                        urlParams.get('fontFamily') || 
                        'Poppins, sans-serif'
        };
    }

    // Validate hex color
    function isValidHex(color) {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    }

    // Convert hex to RGB
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // Adjust color brightness
    function adjustBrightness(hex, percent) {
        const rgb = hexToRgb(hex);
        if (!rgb) return hex;

        const adjust = (value) => Math.max(0, Math.min(255, Math.round(value + (255 * percent / 100))));
        return "#" + ((1 << 24) + (adjust(rgb.r) << 16) + (adjust(rgb.g) << 8) + adjust(rgb.b)).toString(16).slice(1);
    }

    // Convert to RGBA
    function toRgba(hex, alpha) {
        const rgb = hexToRgb(hex);
        return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : `rgba(255, 43, 79, ${alpha})`;
    }

    // Load font from Google Fonts
    function loadFont(fontFamily) {
        const fontName = fontFamily.split(',')[0].trim().replace(/['"]/g, '');
        
        if (document.querySelector(`link[href*="${fontName.replace(/\s+/g, '+')}"]`)) {
            return;
        }

        const fonts = {
            'Roboto': 'Roboto:wght@300;400;500;700&display=swap',
            'Open Sans': 'Open+Sans:wght@300;400;600;700&display=swap',
            'Lato': 'Lato:wght@300;400;700&display=swap',
            'Montserrat': 'Montserrat:wght@300;400;500;600;700&display=swap',
            'Poppins': 'Poppins:wght@300;400;500;600;700&display=swap',
            'Inter': 'Inter:wght@300;400;500;600;700&display=swap',
            'Nunito': 'Nunito:wght@300;400;600;700&display=swap'
        };

        if (fonts[fontName]) {
            if (!document.querySelector('link[href="https://fonts.googleapis.com"]')) {
                const preconnect1 = document.createElement('link');
                preconnect1.rel = 'preconnect';
                preconnect1.href = 'https://fonts.googleapis.com';
                document.head.appendChild(preconnect1);

                const preconnect2 = document.createElement('link');
                preconnect2.rel = 'preconnect';
                preconnect2.href = 'https://fonts.gstatic.com';
                preconnect2.crossOrigin = 'anonymous';
                document.head.appendChild(preconnect2);
            }

            const fontLink = document.createElement('link');
            fontLink.href = `https://fonts.googleapis.com/css2?family=${fonts[fontName]}`;
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }
    }

    // Main customization function
    function applyCustomization() {
        const config = getParams();
        
        console.log('🎨 Applying customization with config:', config);
        
        // Save current configuration
        saveConfig(config);
        
        // Validate colors
        const primary = isValidHex(config.primaryColor) ? config.primaryColor : '#ff2b4f';
        const secondary = isValidHex(config.secondaryColor) ? config.secondaryColor : '#f1683a';

        // Calculate variations
        const primaryLight = adjustBrightness(primary, 20);
        const primaryDark = adjustBrightness(primary, -20);
        const secondaryLight = adjustBrightness(secondary, 20);
        const secondaryDark = adjustBrightness(secondary, -20);

        // Update name
        const nameEl = document.getElementById('customName');
        if (nameEl && config.name !== 'myNaturevista') {
            nameEl.textContent = config.name + ' ';
            document.title = `${config.name} - Nature Explorer`;
        }

        // Load font
        loadFont(config.fontFamily);

        // Remove previous styles
        const prevStyles = document.getElementById('universal-custom-styles');
        if (prevStyles) prevStyles.remove();

        // Apply custom styles
        const style = document.createElement('style');
        style.id = 'universal-custom-styles';
        style.textContent = `
:root {
    /* Base colors */
    --theme-primary: ${primary} !important;
    --theme-secondary: ${secondary} !important;
    --theme-primary-light: ${primaryLight} !important;
    --theme-primary-dark: ${primaryDark} !important;
    --theme-secondary-light: ${secondaryLight} !important;
    --theme-secondary-dark: ${secondaryDark} !important;

    /* Accessible text colors */
    --text-on-primary: #ffffff !important;
    --text-on-secondary: #ffffff !important;

    /* Gradients */
    --gradient-primary: linear-gradient(135deg, ${primary}, ${primaryDark}) !important;
    --gradient-secondary: linear-gradient(135deg, ${secondary}, ${secondaryDark}) !important;
    --gradient-mixed: linear-gradient(135deg, ${secondary}, ${primary}) !important;

    /* Interactive states */
    --primary-hover: ${primaryDark} !important;
    --secondary-hover: ${secondaryDark} !important;

    /* Shadows and effects */
    --shadow-primary: 0 4px 15px ${toRgba(primary, 0.3)} !important;
    --shadow-secondary: 0 4px 15px ${toRgba(secondary, 0.3)} !important;
    --glow-primary: 0 0 20px ${toRgba(primary, 0.3)} !important;
    --glow-secondary: 0 0 20px ${toRgba(secondary, 0.3)} !important;

    /* Overlays */
    --overlay-primary: ${toRgba(primary, 0.8)} !important;
    --overlay-secondary: ${toRgba(secondary, 0.8)} !important;

    /* Compatibility with existing variables */
    --hero-color: ${primary} !important;
    --fourth-color: ${toRgba(primary, 0.565)} !important;
    --gradient-start: ${secondary} !important;
    --gradient-end: ${primary} !important;
    --third-color: ${toRgba(primary, 0.843)} !important;
    --continentSection-color: ${secondary} !important;
    --continentSection-opacity-color: ${toRgba(secondary, 0.396)} !important;
    --wrap-continent-color: ${toRgba(primary, 0.47)} !important;

    /* Variables for main widget */
    --first-color: #fff !important;
    --white-transparent: #ffffff7b !important;
    --second-color: ${primary} !important;
    --third-color: #000 !important;
    --black-transparent: #00000073 !important;
    --orange-color: ${secondary} !important;
    --hover-red-color: ${primaryLight} !important;

    /* Variables for country.html */
    --main-color: ${primary} !important;
    --secondary-color: ${secondary} !important;
    --secondary-opacity-color: ${toRgba(secondary, 0.396)} !important;

    /* Common main colors */
    --main-black: #000000 !important;
    --main-black-transparent: rgba(0, 0, 0, 0.514) !important;
    --main-white: #ffffff !important;
    --main-white-transparent: rgba(255, 255, 255, 0.445) !important;
    --main-grey: grey !important;
}

/* Global font */
body, * {
    font-family: ${config.fontFamily} !important;
}
`;

        document.head.appendChild(style); 
    }

    // 🔥 NUEVA FUNCIÓN: Recibir configuración del servidor
    window.setServerConfiguration = function(config) {
        console.log('📥 Server configuration received:', config);
        serverConfigLoaded = true;
        serverConfig = {
            name: config.clientName || config.name,
            clientName: config.clientName || config.name,
            primaryColor: config.primaryColor,
            secondaryColor: config.secondaryColor,
            fontFamily: config.fontFamily || 'Poppins, sans-serif'
        };
        
        // Guardar configuración
        saveConfig(serverConfig);
        
        // Aplicar inmediatamente
        applyCustomization();
    };

    // Event listener for parent messages
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'nature-widget-config') {
            const config = event.data.config; 
            
            // Save new configuration
            const newConfig = {
                name: config.name || config.customName,
                primaryColor: config.primaryColor,
                secondaryColor: config.secondaryColor,
                fontFamily: config.fontFamily
            };
            
            saveConfig(newConfig);
            
            // Apply immediately
            if (config.name || config.customName) {
                const nameEl = document.getElementById('customName');
                if (nameEl) {
                    nameEl.textContent = config.name || config.customName;
                }
            }
            
            if (config.fontFamily) {
                loadFont(config.fontFamily);
            }
            
            applyCustomization();
        }
    });

    // Notify parent that we're ready
    function notifyReady() {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'nature-widget-ready' }, '*');
        }
    }

    // Initialize - ESPERAR 500ms para dar tiempo al fetch del servidor
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Si después de 500ms no hay configuración del servidor, aplicar defaults
            setTimeout(() => {
                if (!serverConfigLoaded) {
                    console.log('⏱️ No server config loaded, applying defaults');
                    applyCustomization();
                }
            }, 500);
            
            setTimeout(notifyReady, 600);
        });
    } else {
        setTimeout(() => {
            if (!serverConfigLoaded) {
                console.log('⏱️ No server config loaded, applying defaults');
                applyCustomization();
            }
        }, 500);
        
        setTimeout(notifyReady, 600);
    }

    // Public API with persistence
    window.updateWidgetCustomization = function(newConfig) {
        console.log('Updating configuration:', newConfig);
        
        // Save new configuration
        saveConfig(newConfig);
        
        // Apply changes immediately
        if (newConfig.name || newConfig.customName) {
            const nameEl = document.getElementById('customName');
            if (nameEl) {
                nameEl.textContent = newConfig.name || newConfig.customName;
            }
        }
        
        if (newConfig.fontFamily) {
            loadFont(newConfig.fontFamily);
        }
        
        // Replicate configuration to all iframe pages
        applyCustomization();
        
        // Communicate change to parent for synchronization
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'nature-widget-config-update',
                config: newConfig
            }, '*');
        }
    };

})();