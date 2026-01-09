// index-slider.js
export function initMainSlider() {
    const items = document.querySelectorAll('.slider .continentsList .itemContinentsHero');
    const next = document.getElementById('next1');
    const prev = document.getElementById('prev1');
    const thumbnails = document.querySelectorAll('.thumbnail1 .itemContinents');
    const toggleBtn = document.getElementById('toggleBtnContinent');
    const pauseBtn = document.querySelector('.pauseBtn');
    const playBtn = document.querySelector('.playBtn');

    let countItem = items.length;
    let itemActive = 0;
    let paused = false;
    let autoSlideTimeout = null;
    const AUTO_SLIDE_TIME = 3500;

    function showSlider() {
        items.forEach(item => item.classList.remove('active'));
        thumbnails.forEach(item => item.classList.remove('active'));
        items[itemActive].classList.add('active');
        thumbnails[itemActive].classList.add('active');
    }

    function stopAutoSlide() {
        if (autoSlideTimeout) {
            clearTimeout(autoSlideTimeout);
            autoSlideTimeout = null;
        }
    }

    function startAutoSlide() {
        stopAutoSlide();
        if (!paused) {
            autoSlideTimeout = setTimeout(() => {
                nextSlide();
                startAutoSlide();
            }, AUTO_SLIDE_TIME);
        }
    }

    function pauseSliderDefinitive() {
        paused = true;
        stopAutoSlide();
        if (pauseBtn) pauseBtn.classList.add("opacityZero");
        if (playBtn) playBtn.classList.add("opacityOne");
    }

    function playSlider() {
        paused = false;
        if (pauseBtn) pauseBtn.classList.remove("opacityZero");
        if (playBtn) playBtn.classList.remove("opacityOne");
        startAutoSlide();
    }

    function nextSlide() {
        itemActive = (itemActive + 1) % countItem;
        showSlider();
    }

    function prevSlide() {
        itemActive = (itemActive - 1 + countItem) % countItem;
        showSlider();
    }

    paused = false;
    if (pauseBtn) pauseBtn.classList.remove("opacityZero");
    if (playBtn) playBtn.classList.remove("opacityOne");
    showSlider();
    startAutoSlide();

    next.addEventListener('click', () => {
        nextSlide();
        pauseSliderDefinitive();
    });
    prev.addEventListener('click', () => {
        prevSlide();
        pauseSliderDefinitive();
    });
    thumbnails.forEach((thumbnail, index) => {
        thumbnail.addEventListener('click', () => {
            itemActive = index;
            showSlider();
            pauseSliderDefinitive();
        });
    });
    toggleBtn.addEventListener('click', () => {
        if (paused) {
            playSlider();
        } else {
            pauseSliderDefinitive();
        }
    });
}


function isAnyDropdownOpen(section = document) {
    const dropdowns = section.querySelectorAll('.dropdown-content');
    return Array.from(dropdowns).some(content => {
        return content.style.display === "block" && content.offsetParent !== null; 
    });
}

export function initSliders() { 
    const allSections = document.querySelectorAll('.allSlider');

    allSections.forEach(section => {
        const nextDom = section.querySelector('.next');
        const prevDom = section.querySelector('.prev');
        const listItemsDom = section.querySelector('.list');
        const thumbnailDom = section.querySelector('.thumbnail2');
        const toggleButton = section.querySelector('.togglePlayPause');
        const allSliderDom = section;
        const timeRunning = 400;
        const timeAutoNext = 3500;
        let runTimeOut;
        let runAutoRun;
        let isPaused = true; 

        const thumbnailOrder = [...thumbnailDom.querySelectorAll('.thumbnail2 .item')];
        const firstThumbnail = thumbnailOrder.shift();
        thumbnailOrder.push(firstThumbnail);
        thumbnailDom.appendChild(firstThumbnail);

        const pause = section.querySelector(".pause");
        const play = section.querySelector(".play");
        if (pause) pause.style.display = "none";
        if (play) play.style.display = "block";

        function isAnyDropdownOpenInSection() {
            return isAnyDropdownOpen(section);
        }

        function showSlider2(type) {
            const itemSlider = [...section.querySelectorAll('.list .item')];
            
            if (type === 'next') {
                const firstItem = itemSlider.shift();
                listItemsDom.appendChild(firstItem);
                const thumbnailToMove = thumbnailOrder.shift();
                thumbnailOrder.push(thumbnailToMove);
                thumbnailDom.appendChild(thumbnailToMove);
                allSliderDom.classList.add('next');
            } else {
                const lastItem = itemSlider.pop();
                listItemsDom.prepend(lastItem);
                const thumbnailToMove = thumbnailOrder.pop();
                thumbnailOrder.unshift(thumbnailToMove);
                thumbnailDom.prepend(thumbnailToMove);
                allSliderDom.classList.add('prev');
            }
 
            clearTimeout(runTimeOut);
            runTimeOut = setTimeout(() => {
                allSliderDom.classList.remove('next');
                allSliderDom.classList.remove('prev');
            }, timeRunning);

            if (!isPaused) {
                clearTimeout(runAutoRun);
                runAutoRun = setTimeout(() => {
                    if (!isPaused && !isAnyDropdownOpenInSection()) {
                        nextDom.click();
                    } else {
                    }
                }, timeAutoNext);
            }
        }

        nextDom.onclick = () => {
            showSlider2('next');
        };
        prevDom.onclick = () => {
            showSlider2('prev');
        };

        function pauseSectionSlider() {
            isPaused = true;
            clearTimeout(runAutoRun);
            const pause = section.querySelector(".pause");
            const play = section.querySelector(".play");
            if (pause) pause.style.display = "none";
            if (play) play.style.display = "block";
        }

        function resumeSectionSlider() {
            isPaused = false;
            const pause = section.querySelector(".pause");
            const play = section.querySelector(".play");
            if (play) play.style.display = "none";
            if (pause) pause.style.display = "block";
            
            if (!isAnyDropdownOpenInSection()) {
                clearTimeout(runAutoRun);
                runAutoRun = setTimeout(() => {
                    if (!isPaused && !isAnyDropdownOpenInSection()) {
                        nextDom.click();
                    }
                }, timeAutoNext);
            }
        }

        toggleButton.addEventListener("click", () => {
            if (isPaused) {
                resumeSectionSlider();
            } else {
                pauseSectionSlider();
            }
        });

        const dropdowns = section.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            const dropdownContent = dropdown.querySelector('.dropdown-content');
            if (!dropdownContent) return;
            dropdownContent.style.display = "none";

            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        const isVisible = dropdownContent.style.display === 'block';
                        if (isVisible) {
                            pauseSectionSlider();
                        }
                    }
                });
            });

            observer.observe(dropdownContent, {
                attributes: true,
                attributeFilter: ['style']
            });
        });

    });
}

