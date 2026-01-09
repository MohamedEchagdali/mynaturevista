// Variables for reCAPTCHA
let recaptchaV2Rendered = false;
let currentEmail = '';
let currentPassword = '';

document.addEventListener("DOMContentLoaded", function() {

    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");
    const loginMessage = document.getElementById("loginMessage");
    const signupMessage = document.getElementById("signupMessage"); 
    
    if (loginForm && signupForm) {
        // Password validation in signup
        const passwordInputs = signupForm.querySelectorAll("input[type='password']"); 
        
        if (passwordInputs.length >= 2) {
            const passwordField = passwordInputs[0];
            const confirmPasswordField = passwordInputs[1];
            
            confirmPasswordField.addEventListener("input", () => {
                if (passwordField.value !== confirmPasswordField.value) {
                    confirmPasswordField.setCustomValidity("Passwords do not match");
                } else {
                    confirmPasswordField.setCustomValidity("");
                }
            });
        }
        
        const API_URL = window.location.origin;
        
        function showMessage(message, isError = false, messageElement = null) {
            if (!messageElement) return;

            messageElement.textContent = message;
            messageElement.className = 'message show ' + (isError ? 'error' : 'success');

            setTimeout(() => {
                messageElement.classList.remove('show');
            }, 5000);
        }
        
        // Main login function with reCAPTCHA
        async function doLogin(email, password, recaptchaTokenV3 = null, recaptchaTokenV2 = null) {
            try { 
                
                const res = await fetch(`${API_URL}/api/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        email, 
                        password,
                        recaptchaTokenV3: recaptchaTokenV3 || undefined,
                        'g-recaptcha-response': recaptchaTokenV2 || undefined
                    })
                });
                
                const data = await res.json(); 
                
                if (data.requireCaptchaV2) {
                    showMessage("Please complete the additional verification", true, loginMessage);

                    // Show reCAPTCHA v2 container
                    const recaptchaV2Container = document.getElementById('recaptchaV2Container');
                    if (recaptchaV2Container) {
                        recaptchaV2Container.style.display = 'block';

                        if (!recaptchaV2Rendered) {
                            await loadRecaptchaV2();

                            // Render reCAPTCHA v2
                            const recaptchaWidget = document.getElementById('recaptchaWidget');
                            if (recaptchaWidget) {
                                grecaptcha.render('recaptchaWidget', {
                                    sitekey: '6LeqluIrAAAAAPUe-UPnG9Q7IPeiRpKzNc3AqaRg',
                                    callback: (token) => {
                                        doLogin(currentEmail, currentPassword, null, token);
                                    }
                                });
                                recaptchaV2Rendered = true;
                            }
                        }
                    }
                } else if (res.ok && data.token) {
                    showMessage("Login successful", false, loginMessage);
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("user", JSON.stringify(data.user));
                    
                    setTimeout(() => {
                        window.location.href = "/dashboard/dashboard.html";
                    }, 1000);
                } else {
                    showMessage(data.message || "Error logging in", true, loginMessage);
                }
            } catch (err) {
                showMessage("Error connecting to the server", true, loginMessage);
            }
        }
        
        // Function to load reCAPTCHA v2 script
        function loadRecaptchaV2() {
            return new Promise((resolve) => {
                if (document.getElementById('recaptchaV2Script')) {
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://www.google.com/recaptcha/api.js';
                script.id = 'recaptchaV2Script';
                script.async = true;
                script.defer = true;
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }
        
        // Login form submit event
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault(); 
            
            const email = loginForm.querySelector("input[type='email']").value;
            const password = loginForm.querySelector("input[type='password']").value;
            
            currentEmail = email;
            currentPassword = password;

            // Check if reCAPTCHA v2 has already been shown
            const recaptchaV2Container = document.getElementById('recaptchaV2Container');
            if (recaptchaV2Container && recaptchaV2Container.style.display === 'block') {
                const recaptchaTokenV2 = grecaptcha.getResponse();
                
                if (!recaptchaTokenV2) {
                    showMessage('Please complete the reCAPTCHA', true, loginMessage);
                    return;
                }
                
                await doLogin(email, password, null, recaptchaTokenV2);
                return;
            }

            // Try with reCAPTCHA v3
            if (typeof grecaptcha !== 'undefined') {
                grecaptcha.ready(async () => {
                    try {
                        const token = await grecaptcha.execute('6LfV-OQrAAAAAA6Baqh2cODcFmtppaYov9EWqnNj', { action: 'login' }); 
                        await doLogin(email, password, token, null);
                    } catch (error) {
                        showMessage('Verification error. Please try again.', true, loginMessage);
                    }
                });
            } else {
                // If reCAPTCHA v3 is not loaded, try login without it
                await doLogin(email, password, null, null);
            }
        });

        // Signup form submit event
        signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            // ✅ Usar IDs en lugar de name attributes
    const nameInput = signupForm.querySelector("input[name='name']");
    const emailInput = signupForm.querySelector("input[name='email']");
    const domainInput = signupForm.querySelector("input[name='domain']");
    const passwordInput = document.getElementById('signupPassword');        // ✅ CAMBIADO
    const confirmPasswordInput = document.getElementById('confirmPassword'); // ✅ CAMBIADO
    const phoneInput = signupForm.querySelector("input[name='phone']");
    const addressInput = signupForm.querySelector("input[name='addresses']");
    
    // ✅ Validar que TODOS los campos existen
    if (!nameInput || !emailInput || !domainInput || !passwordInput || !confirmPasswordInput) {
        console.error('Missing form elements:', {
            name: !!nameInput,
            email: !!emailInput,
            domain: !!domainInput,
            password: !!passwordInput,
            confirmPassword: !!confirmPasswordInput
        });
        showMessage("Error: form fields not found", true, signupMessage);
        return;
    }
            
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const domain = domainInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            const phone = phoneInput ? phoneInput.value.trim() || null : null;
            const addresses = addressInput ? addressInput.value.trim() || null : null;
            
            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{9,}$/;
            const domainRegex = /^((?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+[A-Za-z]{2,}$/; 
            
            if (!name || !email || !domain || !password) {
                showMessage("All required fields must be filled out", true, signupMessage);
                return;
            }

            if (!domainRegex.test(domain)) {
                showMessage("The domain format is invalid (e.g., mydomain.com)", true, signupMessage);
                return;
            }

            if (!passwordRegex.test(password)) {
                showMessage("The password must be at least 9 characters long and include at least one letter and one number.", true, signupMessage);
                return;
            }
            
            if (password !== confirmPassword) {
                showMessage("Passwords do not match", true, signupMessage);
                return;
            }
            
            try {
                const requestBody = { 
                    name, 
                    email, 
                    domain,
                    password, 
                    phone, 
                    addresses 
                };
                
                const res = await fetch(`${API_URL}/api/signup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody)
                });

                if (!res.ok) {
                    let data = { message: `Registration error: ${res.status}` };
                    try {
                        data = await res.json();
                    } catch {}
                    showMessage(data.message || `Registration error: ${res.status}`, true, signupMessage);
                    return;
                }
                
                const data = await res.json(); 
                
                showMessage("Account created successfully", false, signupMessage);
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));
                
                setTimeout(() => {
                    window.location.href = "/dashboard/payment.html";
                }, 2000);
                
            } catch (err) {
                showMessage("Error connecting to the server", true, signupMessage);
            }
        });
    }
});