// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Logo scroll to top
document.getElementById('logoLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Mobile menu toggle
document.getElementById('mobileToggle').addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('active');
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            document.getElementById('navLinks').classList.remove('active');
        }
    });
});

// Counter animation for stats
function animateCounter(element, target, duration = 2000) {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
        start += increment;
        if (start >= target) {
            element.textContent = target + '+';
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(start) + '+';
        }
    }, 16);
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            
            // Animate counters when they come into view
            if (entry.target.id === 'placesCount') {
                animateCounter(entry.target, 293);
            }
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.feature-card, .step, .pricing-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
});

// Observe counter
const counterElement = document.getElementById('placesCount');
if (counterElement) {
    observer.observe(counterElement);
}

// Feature Modal Functions
function openFeatureModal(title, description, videoUrl) {
    const modal = document.getElementById('featureModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const video = document.getElementById('modalVideo');
    const videoContainer = document.getElementById('videoContainer');
    
    modalTitle.textContent = title;
    modalDescription.textContent = description;
    
    // Resetear estado del video
    videoContainer.classList.remove('paused', 'loading');
    video.pause();
    video.currentTime = 0;
    
    // Actualizar la URL del video
    if (videoUrl) {
        const source = video.querySelector('source');
        source.src = videoUrl;
        
        // Determinar el tipo de video basado en la extensión
        if (videoUrl.includes('.webm')) {
            source.type = 'video/webm';
        } else if (videoUrl.includes('.mp4')) {
            source.type = 'video/mp4';
        }
        
        // Recargar el video
        video.load();
        
        // Asegurar que el video tenga muted para autoplay
        video.muted = true;
        
        // Intentar reproducir automáticamente
        video.play().then(() => {
            console.log('Video playing automatically');
            videoContainer.classList.remove('paused');
        }).catch(err => {
            console.log('Autoplay prevented, showing play button:', err);
            videoContainer.classList.add('paused');
        });
    } else {
        // Si no hay video URL, mostrar el estado pausado
        videoContainer.classList.add('paused');
    }
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Inicializar controles de video
    initVideoControls();
}

function closeFeatureModal() {
    const modal = document.getElementById('featureModal');
    const video = document.getElementById('modalVideo');
    
    // Pausar y resetear el video
    video.pause();
    video.currentTime = 0;
    
    // Limpiar event listeners
    cleanupVideoControls();
    
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Sistema de controles de video
let videoControlsTimeout;

function initVideoControls() {
    const video = document.getElementById('modalVideo');
    const videoContainer = document.getElementById('videoContainer');
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playOverlay = document.getElementById('playOverlay');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const videoTime = document.getElementById('videoTime');
    const muteBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const controls = document.getElementById('videoControls');
    
// Play/Pause
const togglePlayPause = () => {
    if (video.paused) {
        video.play().then(() => {
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            videoContainer.classList.remove('paused');
        }).catch(err => {
            console.error('Error playing video:', err);
        });
    } else {
        video.pause();
        playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        videoContainer.classList.add('paused');
    }
};
    
    playPauseBtn.addEventListener('click', togglePlayPause);
    playOverlay.addEventListener('click', togglePlayPause);
    video.addEventListener('click', togglePlayPause);
    
    // Actualizar progreso
    video.addEventListener('timeupdate', () => {
        const progress = (video.currentTime / video.duration) * 100;
        progressBar.style.width = progress + '%';
        
        const currentMinutes = Math.floor(video.currentTime / 60);
        const currentSeconds = Math.floor(video.currentTime % 60);
        const durationMinutes = Math.floor(video.duration / 60);
        const durationSeconds = Math.floor(video.duration % 60);
        
        videoTime.textContent = `${currentMinutes}:${currentSeconds.toString().padStart(2, '0')} / ${durationMinutes}:${durationSeconds.toString().padStart(2, '0')}`;
    });
    
    // Al final de initVideoControls(), agrega:

// Detectar cuando el video está listo para reproducirse
video.addEventListener('loadedmetadata', () => {
    console.log('Video metadata loaded');
    videoContainer.classList.remove('loading');
});

// Detectar errores de carga
video.addEventListener('error', (e) => {
    console.error('Error loading video:', e);
    videoContainer.classList.add('paused');
    videoContainer.classList.remove('loading');
});

// Detectar cuando el video realmente empieza a reproducirse
video.addEventListener('playing', () => {
    playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
    videoContainer.classList.remove('paused');
});

// Detectar cuando el video se pausa
video.addEventListener('pause', () => {
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    videoContainer.classList.add('paused');
});

    // Click en barra de progreso
    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    });
    
    // Volumen
    muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        if (video.muted) {
            muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            volumeSlider.value = 0;
        } else {
            muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            volumeSlider.value = video.volume * 100;
        }
    });
    
    volumeSlider.addEventListener('input', (e) => {
        video.volume = e.target.value / 100;
        video.muted = false;
        
        if (video.volume === 0) {
            muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (video.volume < 0.5) {
            muteBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }
    });
    
    // Fullscreen
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            videoContainer.requestFullscreen().catch(err => {
                console.log('Error entering fullscreen:', err);
            });
            fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
        } else {
            document.exitFullscreen();
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
        }
    });
    
    // Mostrar/ocultar controles automáticamente
    const showControls = () => {
        controls.classList.add('show');
        clearTimeout(videoControlsTimeout);
        videoControlsTimeout = setTimeout(() => {
            if (!video.paused) {
                controls.classList.remove('show');
            }
        }, 3000);
    };
    
    videoContainer.addEventListener('mousemove', showControls);
    videoContainer.addEventListener('touchstart', showControls);
    
    // Mostrar controles cuando está pausado
    video.addEventListener('pause', () => {
        controls.classList.add('show');
    });
    
    video.addEventListener('play', () => {
        showControls();
    });
    
    // Loading state
    video.addEventListener('waiting', () => {
        videoContainer.classList.add('loading');
    });
    
    video.addEventListener('canplay', () => {
        videoContainer.classList.remove('loading');
    });
    
    // Teclas del teclado
    document.addEventListener('keydown', handleKeyPress);
}

function handleKeyPress(e) {
    const video = document.getElementById('modalVideo');
    const modal = document.getElementById('featureModal');
    
    if (!modal.classList.contains('active')) return;
    
    switch(e.key) {
        case ' ':
        case 'k':
            e.preventDefault();
            video.paused ? video.play() : video.pause();
            break;
        case 'ArrowLeft':
            video.currentTime -= 5;
            break;
        case 'ArrowRight':
            video.currentTime += 5;
            break;
        case 'ArrowUp':
            e.preventDefault();
            video.volume = Math.min(1, video.volume + 0.1);
            document.getElementById('volumeSlider').value = video.volume * 100;
            break;
        case 'ArrowDown':
            e.preventDefault();
            video.volume = Math.max(0, video.volume - 0.1);
            document.getElementById('volumeSlider').value = video.volume * 100;
            break;
        case 'm':
            video.muted = !video.muted;
            break;
        case 'f':
            document.getElementById('fullscreenBtn').click();
            break;
    }
}

function cleanupVideoControls() {
    document.removeEventListener('keydown', handleKeyPress);
    clearTimeout(videoControlsTimeout);
}

// Close modal when clicking outside
document.getElementById('featureModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeFeatureModal();
    }
});

// Close modal with ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeFeatureModal();
    }
});

// Close modal when clicking outside
document.getElementById('featureModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeFeatureModal();
    }
});

// Close modal with ESC key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeFeatureModal();
    }
});

// Contact Form Handler
document.getElementById('contactForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submitBtn');
    const formMessage = document.getElementById('formMessage');
    
    // Disable button during submission
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    // Get form data
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value
    };
    
    try {
        const response = await fetch('/api/landing-contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Show success message
            formMessage.textContent = data.message || 'Thank you for your message! We will get back to you soon.';
            formMessage.className = 'form-message success';
            formMessage.style.display = 'block';
            
            // Reset form
            this.reset();
            
            // Hide message after 5 seconds
            setTimeout(() => {
                formMessage.style.display = 'none';
            }, 5000);
        } else {
            // Show error message
            formMessage.textContent = data.error || 'An error occurred. Please try again.';
            formMessage.className = 'form-message error';
            formMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Error:', error);
        formMessage.textContent = 'Network error. Please check your connection and try again.';
        formMessage.className = 'form-message error';
        formMessage.style.display = 'block';
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
    }
});