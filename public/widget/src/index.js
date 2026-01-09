// index.js
import { initSliders, initMainSlider } from './index-slider.js';
import { addEventListeners } from './index-events.js';
import { fetchAndShowAllPlacesMap } from './index-map.js';
import { loadData } from './index-data.js';
import { initNavigation } from './navigation.js';

document.addEventListener('DOMContentLoaded', async () => {
    addEventListeners();

    await loadData();

    initMainSlider();
    initSliders();

    // Initialize navigation after sections exist
    initNavigation();

    fetchAndShowAllPlacesMap();
});