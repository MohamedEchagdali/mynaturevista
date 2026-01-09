// anti-scroll.js - Complete scroll blocking
(function() {
    'use strict';

    // State variables
    let scrollPosition = 0;
    let isMiddleMouseDown = false;

    // ========================================
    // 1. BLOCK SCROLL WITH MOUSE WHEEL
    // ========================================
    function preventWheelScroll(e) {
        // Allow scroll on specific elements
        if (e.target.closest('.thumbnail1') ||
            e.target.closest('.dropdown-content') ||
            e.target.closest('#map') ||
            e.target.closest('.scrollable') ||
            e.target.closest('.premium-section') ||
            e.target.closest('[data-custom-places]')) {
            return; // Allow scroll
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    // Block wheel on window and document
    window.addEventListener('wheel', preventWheelScroll, { passive: false, capture: true });
    document.addEventListener('wheel', preventWheelScroll, { passive: false, capture: true });

    // ========================================
    // 2. BLOCK SCROLL WITH MIDDLE MOUSE BUTTON (WHEEL CLICK)
    // ========================================
    function preventMiddleMouseScroll(e) {
        // Detect middle button click (wheel)
        if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            isMiddleMouseDown = true;
            
            // Change cursor temporarily
            document.body.style.cursor = 'not-allowed';
            
            console.log('🚫 Middle mouse button blocked');
            return false;
        }
    }

    function resetMiddleMouse(e) {
        if (e.button === 1) {
            isMiddleMouseDown = false;
            document.body.style.cursor = '';
        }
    }

    // Block middle button mousedown
    document.addEventListener('mousedown', preventMiddleMouseScroll, { passive: false, capture: true });
    document.addEventListener('mouseup', resetMiddleMouse, { passive: false, capture: true });

    // Block movement if middle button is pressed
    document.addEventListener('mousemove', function(e) {
        if (isMiddleMouseDown) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, { passive: false, capture: true });

    // ========================================
    // 3. BLOCK KEYBOARD SCROLL
    // ========================================
    const scrollKeys = {
        37: true, // left arrow
        38: true, // up arrow
        39: true, // right arrow
        40: true, // down arrow
        32: true, // spacebar
        33: true, // page up
        34: true, // page down
        35: true, // end
        36: true, // home
    };

    function preventKeyScroll(e) {
        if (scrollKeys[e.keyCode]) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }

    window.addEventListener('keydown', preventKeyScroll, { passive: false, capture: true });

    // ========================================
    // 4. BLOCK SCROLL BY DRAG SELECTION
    // ========================================
    let isDragging = false;
    let startY = 0;

    function preventDragScroll(e) {
        // Don't track dragging on custom places
        if (e.target.closest('.premium-section') ||
            e.target.closest('[data-custom-places]') ||
            e.target.closest('.premium-link')) {
            return;
        }

        // If dragging to select text
        if (e.buttons === 1) { // Left button pressed
            isDragging = true;
            startY = e.clientY;
        }
    }

    function checkDragScroll(e) {
        // Don't prevent on custom places
        if (e.target.closest('.premium-section') ||
            e.target.closest('[data-custom-places]') ||
            e.target.closest('.premium-link')) {
            return;
        }

        if (isDragging && e.buttons === 1) {
            // Prevent drag from causing scroll
            if (Math.abs(e.clientY - startY) > 50) {
                e.preventDefault();
                e.stopPropagation();

                // Force scroll to position 0
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;

                return false;
            }
        }
    }

    function resetDrag(e) {
        // Reset on custom places immediately
        if (e && (e.target.closest('.premium-section') ||
            e.target.closest('[data-custom-places]') ||
            e.target.closest('.premium-link'))) {
            isDragging = false;
        }
        isDragging = false;
        startY = 0;
    }

    document.addEventListener('mousedown', preventDragScroll, { passive: false });
    document.addEventListener('mousemove', checkDragScroll, { passive: false });
    document.addEventListener('mouseup', resetDrag, { passive: false });

    // ========================================
    // 5. BLOCK TOUCH SCROLL (MOBILE)
    // ========================================
    function preventTouchScroll(e) {
        // Allow scroll on specific elements
        if (e.target.closest('.scrollable') ||
            e.target.closest('.thumbnail1') ||
            e.target.closest('.dropdown-content') ||
            e.target.closest('#map') ||
            e.target.closest('.premium-section') ||
            e.target.closest('[data-custom-places]')) {
            return; // Allow scroll
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    }

    document.addEventListener('touchmove', preventTouchScroll, { passive: false, capture: true });

    // ========================================
    // 6. BLOCK PROGRAMMATIC SCROLL
    // ========================================
    function lockScroll() {
        scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        
        // Force fixed position
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
    }

    // Force position 0 constantly (but allow navigation transitions)
    const scrollInterval = setInterval(() => {
        // Only reset if NOT in transition or navigating
        const isTransitioning = document.querySelector('.slider')?.style.transition?.includes('transform');
        const isNavigating = document.body.classList.contains('navigating');

        if (!isTransitioning && !isNavigating) {
            if (window.pageYOffset !== 0 || document.documentElement.scrollTop !== 0) {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                console.log('🔒 Scroll reset to 0');
            }
        }
    }, 100);

    // ========================================
    // 7. MUTATION OBSERVER TO PREVENT CHANGES
    // ========================================
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'style') {
                const target = mutation.target;
                if (target === document.body || target === document.documentElement) {
                    // Ensure overflow remains hidden
                    if (target.style.overflow !== 'hidden') {
                        target.style.overflow = 'hidden';
                    }
                }
            }
        });
    });

    observer.observe(document.documentElement, { 
        attributes: true, 
        attributeFilter: ['style'] 
    });
    
    observer.observe(document.body, { 
        attributes: true, 
        attributeFilter: ['style'] 
    });

    // ========================================
    // 8. BLOCK SCROLL OF SPECIFIC ELEMENTS
    // ========================================
    function preventElementScroll() {
        const elements = document.querySelectorAll('*:not(.scrollable):not(.dropdown-content):not(#map):not(.thumbnail1)');
        elements.forEach(el => {
            if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
                if (!el.classList.contains('scrollable') &&
                    !el.classList.contains('thumbnail1') &&
                    !el.closest('.dropdown-content') &&
                    !el.closest('.thumbnail1') &&
                    el.id !== 'map') {
                    el.addEventListener('scroll', function() {
                        this.scrollTop = 0;
                        this.scrollLeft = 0;
                    }, { passive: false });
                }
            }
        });
    }

    // Execute on load and when DOM changes
    document.addEventListener('DOMContentLoaded', preventElementScroll);
    setTimeout(preventElementScroll, 1000);

    // ========================================
    // 9. PROTECTION AGAINST window.scrollTo
    // ========================================
    const originalScrollTo = window.scrollTo;
    window.scrollTo = function(x, y) {
        // Allow scroll to position 0,0 (needed for internal navigation)
        if ((x === 0 || x === undefined) && (y === 0 || y === undefined)) {
            return originalScrollTo.call(window, 0, 0);
        }
        // Block other scroll attempts
        return false;
    };

    const originalScrollBy = window.scrollBy;
    window.scrollBy = function() {
        // Block all scrollBy attempts
        return false;
    };

    // ========================================
    // EXCEPTION: Elements that CAN scroll and be clicked
    // ========================================
    document.addEventListener('DOMContentLoaded', function() {
        // Allow scroll in dropdowns, map and thumbnail1
        const scrollableElements = document.querySelectorAll('.dropdown-content, #map, .thumbnail1, .premium-section, [data-custom-places]');

        scrollableElements.forEach(element => {
            element.classList.add('scrollable');

            // Remove block listeners for these elements
            element.addEventListener('wheel', function(e) {
                e.stopPropagation();
            }, { passive: true });
        });

        // 🔥 SPECIAL: Allow clicks on premium links (custom places) - NEVER interfere
        document.addEventListener('click', function(e) {
            const premiumLink = e.target.closest('.premium-link');
            if (premiumLink) {
                // Allow the link to work naturally - don't interfere
                return true;
            }
        }, { capture: false });
    });

    // Cleanup on unload (optional)
    window.addEventListener('beforeunload', function() {
        clearInterval(scrollInterval);
        observer.disconnect();
    });

})();