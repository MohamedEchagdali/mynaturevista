export function addEventListeners() {
    // Animación de closeBtn (lo de tu código original)
    let button = document.querySelectorAll('.closeBtn');
    button.forEach(button => {
        let text = button.textContent;
        button.innerHTML = '';
    
        for (let char of text) {
            let span = document.createElement('span');
            span.textContent = char === ' ' ? '\u00A0' : char;
            button.appendChild(span);
        }
        let spans = button.querySelectorAll('span');
    
        button.addEventListener('mouseenter', () => {
            spans.forEach((span, index) => {
                setTimeout(() => {
                    span.classList.add('hover');
                }, index * 50)
            })
        })
    
        button.addEventListener('mouseleave', () => {
            spans.forEach((span, index) => {
                setTimeout(() => {
                    span.classList.remove('hover');
                }, index * 50)
            })
        })
    })

    // Scroll horizontal con mouse + touch
    const slider = document.querySelector('.thumbnail1');
    if (!slider) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    // --- Desktop (mouse) ---
    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => isDown = false);
    slider.addEventListener('mouseup', () => isDown = false);
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2;
        slider.scrollLeft = scrollLeft - walk;
    });

    // --- Móviles (touch) ---
    slider.addEventListener('touchstart', (e) => {
        isDown = true;
        startX = e.touches[0].pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('touchend', () => isDown = false);
    slider.addEventListener('touchmove', (e) => {
        if (!isDown) return;
        const x = e.touches[0].pageX - slider.offsetLeft;
        const walk = (x - startX) * 2;
        slider.scrollLeft = scrollLeft - walk;
    });
}






