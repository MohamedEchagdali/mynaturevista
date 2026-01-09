// eachPlace.js
// Limit slider paragraph text characters and add "..." + read more button with a link.
document.addEventListener("DOMContentLoaded", function() {

// Get params from URL
const urlParams = new URLSearchParams(window.location.search);
const place = urlParams.get('place');

// Function to securely get API key
function getApiKey() {
  // First try to get from secure variable
  if (window.SECURE_API_KEY) {
    return window.SECURE_API_KEY;
  }
  // Fallback to URL (for compatibility)
  return urlParams.get('apikey') || '';
}

// Function to build base URL (without visible API key)
function buildBaseUrl(page, params = {}) {
  const url = new URL(page, window.location.origin);
  Object.keys(params).forEach(key => {
    url.searchParams.set(key, params[key]);
  });
  return url.toString();
}

// Function to build complete URL (with API key) - only for navigation
function buildFullUrl(page, params = {}) {
  const url = new URL(page, window.location.origin);
  const apiKey = getApiKey();
  if (apiKey) {
    url.searchParams.set("apikey", apiKey);
  }
  Object.keys(params).forEach(key => {
    url.searchParams.set(key, params[key]);
  });
  return url.toString();
}

// Helper function to build widget URLs with navigation
function buildWidgetUrl(page, params = {}) {
    const url = new URL(page, window.location.origin);
    const apiKey = getApiKey();
    if (apiKey) {
        url.searchParams.set("apikey", apiKey);
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

// Navigation links (back arrow)
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
// Resolve the country this place belongs to using the database API
if (place) {

  // Get all countries from the API
  fetch('/api/countries')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Error loading countries: ${response.status}`);
      }
      return response.json();
    })
    .then(apiResponse => {
      // API returns { total: X, countries: [...] }
      const countries = apiResponse.countries || [];
      let countryFound = null;

      // Find the country that contains this place
      // We need to make individual requests for each country to get sections
      const fetchPromises = countries.map(country => 
        fetch(`/api/countries/${encodeURIComponent(country.name)}`)
          .then(res => res.json())
          .then(countryData => {
            if (countryData.secciones && Array.isArray(countryData.secciones)) {
              const match = countryData.secciones.find(sec => sec.href === place);
              if (match) {
                return country.name;
              }
            }
            return null;
          })
          .catch(err => {
            console.warn(`Error loading data from ${country.name}:`, err);
            return null;
          })
      );

      // Wait for all requests to complete
      return Promise.all(fetchPromises);
    })
    .then(results => {
      // Filter null results and get the first country found
      const countryFound = results.find(result => result !== null);

      if (countryFound) {
        const homeLink = document.getElementById("home-link");
        if (homeLink) {
          // Build the link with country + apikey
          const targetUrl = buildWidgetUrl("/widget-country.html", {
            country: countryFound
          });
          // Prevent external anchor behavior
          homeLink.removeAttribute("href");
          homeLink.style.cursor = "pointer";
          homeLink.addEventListener("click", (e) => {
            e.preventDefault();
            navigateInWidget(targetUrl);
          });
        }
      } else {
        console.error(`Country not found for place: ${place}`);
      }
    })
    .catch(err => {
      console.error("Error loading countries from database:", err);
    });
}




  // Wait for DOM to be ready
document.querySelectorAll('.slide-info-modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        // If click did NOT occur inside info-card, close modal
        if (!e.target.closest('.info-card')) {
            this.classList.remove('active');
            // Find modal content and remove its active class
            const modalContent = this.querySelector('.info-modal-content');
            if (modalContent) modalContent.classList.remove('active');
        }
    });
});

    // Limit slider paragraph text.
    const slideParagraphs = document.querySelectorAll(".slide-paragraph");

    slideParagraphs.forEach((slideParagraph) => {
        const textLimit = 100;
        const fullText = slideParagraph.innerText;
        const aTag = slideParagraph.querySelector(".paragraph-anchor-tag");
        
        if(slideParagraph.innerText.length > textLimit){
            slideParagraph.innerHTML = fullText.substring(0, textLimit) + "... " + aTag.innerHTML;
        }
    });

// Load first slide
    const firstSlide = document.querySelector(".first-slide");
    const firstSlideBtn = document.querySelector(".first-slide-btn");
    const firstIndicatorBar = document.querySelector(".first-indicator-bar");

    setTimeout(() => {
        firstSlide.classList.add("active");
    }, 300);

    firstSlideBtn.classList.add("active");
    firstIndicatorBar.classList.add("active");

// Javascript for slider
const slider = document.querySelector(".slider");
const slides = slider.querySelectorAll(".slide");
const numberOfSlides = slides.length;
const slideBtns = document.querySelectorAll(".slide-btn");
const slideIndicatorBars = document.querySelectorAll(".indicator-bar");
var slideNumber = 0;

// Slider auto-play
var playSlider;

var repeater = () => {
    playSlider = setInterval(function() {
        slides.forEach((slide) => {
            slide.classList.remove("active");
        });
    
        slideBtns.forEach((slideBtn) => {
            slideBtn.classList.remove("active");
        });
    
        slideIndicatorBars.forEach((slideIndicatorBar) => {
            slideIndicatorBar.classList.remove("active");
        });
    
        slideNumber++;
    
        if(slideNumber > (numberOfSlides - 1)){
            slideNumber = 0;
        }
    
        slides[slideNumber].classList.add("active");
        slideBtns[slideNumber].classList.add("active");
        slideIndicatorBars[slideNumber].classList.add("active");
    }, 8500);
}
repeater();

// Slider next/prev buttons navigation.
const nextBtn = document.querySelector(".next-btn");
const prevBtn = document.querySelector(".prev-btn");

// Slider next button navigation.
nextBtn.addEventListener("click", () => {
    slides.forEach((slide) => {
        slide.classList.remove("active");
    });

    slideBtns.forEach((slideBtn) => {
        slideBtn.classList.remove("active");
    });

    slideIndicatorBars.forEach((slideIndicatorBar) => {
        slideIndicatorBar.classList.remove("active");
    });

    slideNumber++;

    if(slideNumber > (numberOfSlides - 1)){
        slideNumber = 0;
    }

    slides[slideNumber].classList.add("active");
    slideBtns[slideNumber].classList.add("active");
    slideIndicatorBars[slideNumber].classList.add("active");

    clearInterval(playSlider);
    repeater();
});

// Slider previous button navigation.
prevBtn.addEventListener("click", () => {
    slides.forEach((slide) => {
        slide.classList.remove("active");
    });

    slideBtns.forEach((slideBtn) => {
        slideBtn.classList.remove("active");
    });

    slideIndicatorBars.forEach((slideIndicatorBar) => {
        slideIndicatorBar.classList.remove("active");
    });

    slideNumber--;

    if(slideNumber < 0){
        slideNumber = numberOfSlides - 1;
    }

    slides[slideNumber].classList.add("active");
    slideBtns[slideNumber].classList.add("active");
    slideIndicatorBars[slideNumber].classList.add("active");

    clearInterval(playSlider);
    repeater();
});

// Slider pagination.
var slideBtnNav = function(slideBtnClick){
    slides.forEach((slide) => {
        slide.classList.remove("active");
    });

    slideBtns.forEach((slideBtn) => {
        slideBtn.classList.remove("active");
    });

    slideIndicatorBars.forEach((slideIndicatorBar) => {
        slideIndicatorBar.classList.remove("active");
    });

    slides[slideBtnClick].classList.add("active");
    slideBtns[slideBtnClick].classList.add("active");
    slideIndicatorBars[slideBtnClick].classList.add("active");
}

slideBtns.forEach((slideBtn, i) => {
    slideBtn.addEventListener("click", () => {
        slideBtnNav(i);
        clearInterval(playSlider);
        repeater();
        slideNumber = i;
    });
});

// Javascript for video modals.
slides.forEach((slide, i) => {
    let watchContentBtn = slide.querySelector(".watch-info-btn");
    let slideContentModal = slide.querySelector(".slide-info-modal");
    let modalContent = slide.querySelector(".info-modal-content");
    let closeBtn = slide.querySelector(".info-close-btn");
    //let animalVideo = slide.querySelector(".animal-video");

    // Open video modals on click watch video button
    watchContentBtn.addEventListener("click", () => {
        slideContentModal.classList.add("active");

        setTimeout(() => {
            modalContent.classList.add("active");
        }, 300);

        // Play animal video on click watch video button
        //animalVideo.play();

        // Stop slider auto-play on click watch video button
        if(slideContentModal.classList.contains("active")){
            clearInterval(playSlider);
        }
    });

    // Reset current slide autoplay time on mouseover the slide video modal.
    slideContentModal.addEventListener("mouseover", () => {
        clearInterval(playSlider);
    });

    // Close video modals on click video modals close button
    const videoClose = function(closeBtnClick){
        // Restart the current slide indicator bar on click the video close button
        slideIndicatorBars.forEach((slideIndicatorBar) => {
            slideIndicatorBar.classList.remove("active");
        });
        
        setTimeout(() => {
            slideIndicatorBars[closeBtnClick].classList.add("active");
        }, 0);
    }

    closeBtn.addEventListener("click", () => {
        slideContentModal.classList.remove("active");
        modalContent.classList.remove("active");

        slideIndicatorBars.forEach((slideIndicatorBar) => {
            slideIndicatorBar.classList.remove("active");
        });

        // Pause animal video on click video close button
        //animalVideo.pause();

        clearInterval(playSlider);
        repeater();
        videoClose(i);
    });
});
});