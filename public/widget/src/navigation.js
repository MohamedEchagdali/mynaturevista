// navigation.js
let isInitialized = false;
let currentIndex = 0;
let isTransitioning = false;

export function initNavigation() {
  console.log('🏁 initNavigation called');

  if (isInitialized) {
    console.warn('⚠️ initNavigation already initialized, skipping...');
    return;
  }

  const continents = document.getElementById('continents');
  const allSections = document.getElementById('allSections');

  if (!continents || !allSections) {
    console.error('❌ Element not found');
    return;
  }

  isInitialized = true;
  console.log('📌 currentIndex initialized to 0');

  function getSections() {
    return [
      continents,
      ...document.querySelectorAll('.allSlider')
    ];
  }

  function showSection(index) {
    const sections = getSections();
    console.log('🚀 showSection called with index:', index);
    console.log('📊 Total sections:', sections.length);
    console.log('🔄 Current index:', currentIndex);
    console.log('⏳ Is transitioning:', isTransitioning);
    console.trace('📞 Called from:');

    if (index < 0) index = 0;
    if (index > sections.length - 1) index = sections.length - 1;
    if (index === currentIndex || isTransitioning) {
      console.warn('⚠️ Navigation blocked - same index or transitioning');
      return;
    }

    isTransitioning = true;
    document.body.classList.add('navigating');
    const previousIndex = currentIndex;
    currentIndex = index;

    console.log('✅ Navigation proceeding from', previousIndex, 'to', index);

    const heroOffset = index === 0 ? '0' : '-100vh';

    continents.style.transition = 'transform 0.6s ease';
    continents.style.transform = `translateY(${heroOffset})`;

    // Pause/Resume hero slider
    const toggleBtnContinent = document.getElementById('toggleBtnContinent');
    if (index !== 0) {
      // Pause hero slider when navigating away
      const pauseBtn = document.querySelector('.pauseBtn');
      if (pauseBtn && !pauseBtn.classList.contains('opacityZero')) {
        toggleBtnContinent?.click();
        console.log('⏸️ Hero slider paused');
      }
    } else if (index === 0) {
      // Resume hero slider when returning to hero
      const playBtn = document.querySelector('.playBtn');
      if (playBtn && playBtn.classList.contains('opacityOne')) {
        toggleBtnContinent?.click();
        console.log('▶️ Hero slider resumed');
      }
    }

    const gtElement = document.getElementById('google_translate_element');
    if (gtElement && index !== 0) {
      gtElement.style.display = 'none';
    } else if (gtElement && index === 0) {
      if (gtElement.querySelector('.goog-te-combo')) {
        gtElement.style.display = 'block';
      }
    }

    const allSliders = document.querySelectorAll('.allSlider');

    if (index === 0) {
      setTimeout(() => {
        allSliders.forEach((slider) => {
          slider.style.opacity = '0';
          slider.style.visibility = 'hidden';
          slider.style.zIndex = '300';
        });
      }, 600); 
    } else {
      allSliders.forEach((slider, i) => {
        if (i === index - 1) {
          slider.style.opacity = '1';
          slider.style.visibility = 'visible';
          slider.style.zIndex = '310';
        } else {
          slider.style.opacity = '0';
          slider.style.visibility = 'hidden';
          slider.style.zIndex = '300';
        }
      });
    }

    setTimeout(() => {
      isTransitioning = false;
      document.body.classList.remove('navigating');
      console.log('⏱️ Transition complete. Current index is now:', currentIndex);
      console.log('🎬 Hero offset:', continents.style.transform);
    }, 600);
  }

  window.navigateToSection = function(targetId) {
    const sections = getSections();
    const targetIndex = sections.findIndex(sec => sec?.id === targetId);
    if (targetIndex !== -1) {
      showSection(targetIndex);
    }
  };

  window.goToHero = function() {
    showSection(0);
  };

  function preventAllScroll(e) {
    const map = document.getElementById('map');
    if (map && map.classList.contains('show')) {
      if (e.target.closest('#map') || e.target.closest('.leaflet-container')) {
        return;
      }
    }

    const thumbnail1 = e.target.closest('.thumbnail1');
    if (thumbnail1) {
      return; 
    }

    const dropdown = e.target.closest('.dropdown-content');
    if (dropdown && dropdown.style.display === 'block') {
      const canScrollDown = dropdown.scrollTop < (dropdown.scrollHeight - dropdown.clientHeight);
      const canScrollUp = dropdown.scrollTop > 0;

      if (e.type === 'wheel' || e.type === 'touchmove') {
        const isScrollingDown = e.deltaY > 0 ||
          (e.touches && e.touches[0].clientY < e.changedTouches?.[0]?.clientY);

        if ((isScrollingDown && canScrollDown) || (!isScrollingDown && canScrollUp)) {
          return;
        }
      }
    }

    e.preventDefault();
    e.stopPropagation();
  }

  window.addEventListener('wheel', preventAllScroll, {passive: false, capture: true});
  window.addEventListener('touchmove', preventAllScroll, {passive: false, capture: true});

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.closest('.dropdown-content') ||
        e.target.closest('#map')) {
      return;
    }

    const keys = [32, 33, 34, 35, 36, 37, 38, 39, 40];
    if (keys.includes(e.keyCode)) e.preventDefault();
  }, {passive: false});

  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"], button[data-target], .continentButton');
    if (!link) return;

    const href = link.getAttribute('href');
    const dataTarget = link.getAttribute('data-target');

    let hash = null;
    if (href && href.startsWith('#')) {
      hash = href.replace('#', '');
    } else if (dataTarget && dataTarget.startsWith('#')) {
      hash = dataTarget.replace('#', '');
    }

    if (!hash) return;

    console.log('🎯 Click detected on:', link);
    console.log('📍 Navigating to hash:', hash);

    e.preventDefault();
    e.stopPropagation();

    const sections = getSections();
    console.log('📋 Available sections:', sections.map(s => s?.id || 'continents'));
    const targetIndex = sections.findIndex(sec => sec?.id === hash);
    console.log('🔍 Target index:', targetIndex);

    if (targetIndex !== -1) {
      showSection(targetIndex);
    } else {
      console.error('❌ Section not found:', hash);
    }
  });

  window.addEventListener('keydown', e => {
    if (e.target.closest('.dropdown-content') || e.target.closest('#map')) return;

    if (e.key === 'ArrowDown') showSection(currentIndex + 1);
    if (e.key === 'ArrowUp') showSection(currentIndex - 1);
  });

  document.getElementById('customName')?.addEventListener('click', () => {
    showSection(0);
  });

  const earthButton = document.querySelector('.earth-button');
  if (earthButton) {
    earthButton.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(0);
    });
  }
}
