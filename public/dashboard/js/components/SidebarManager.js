// ===== components/SidebarManager.js =====
import { AuthUtils } from '../utils/auth.js';

export class SidebarManager {
  static init() {
    const sidebar = document.getElementById('modernSidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('sidebarOverlay');
    const userProfileToggle = document.getElementById('userProfileToggle');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    const headerUserDropdown = document.getElementById('headerUserDropdown');
    const headerDropdownMenu = document.getElementById('headerDropdownMenu');

    if (!sidebar || !sidebarToggle) return;

    // ========================================
    // TOGGLE SIDEBAR - LOGO CLICK
    // ========================================
    sidebarToggle.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('show');
            
            if (!sidebar.classList.contains('mobile-open')) {
                userDropdownMenu.classList.remove('show');
            }
        } else {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
            
            if (sidebar.classList.contains('collapsed')) {
                userDropdownMenu.classList.remove('show');
            }
        }
    });

    // ========================================
    // MOBILE HAMBURGER BUTTON
    // ========================================
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('show');
        });
    }

    // ========================================
    // CLOSE ON OVERLAY CLICK
    // ========================================
    if (overlay) {
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('show');
            userDropdownMenu.classList.remove('show');
        });
    }

    // ========================================
    // EXPAND SIDEBAR ON LINK CLICK
    // ========================================
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                // MOBILE: Close sidebar
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('show');
                userDropdownMenu.classList.remove('show');
            } else {
                // DESKTOP: Expand if collapsed
                if (sidebar.classList.contains('collapsed')) {
                    sidebar.classList.remove('collapsed');
                    localStorage.setItem('sidebarCollapsed', 'false');
                }
            }
        });
    });

    // ========================================
    // RESTORE SIDEBAR STATE (DESKTOP ONLY)
    // ========================================
    if (window.innerWidth > 768) {
        const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (isCollapsed) {
            sidebar.classList.add('collapsed');
        }
    }

    // ========================================
    // HANDLE RESIZE
    // ========================================
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 768) {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('show');
                
                const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
                if (isCollapsed) {
                    sidebar.classList.add('collapsed');
                } else {
                    sidebar.classList.remove('collapsed');
                }
            } else {
                sidebar.classList.remove('collapsed');
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('show');
            }
        }, 250);
    });

    // ========================================
    // USER DROPDOWN MENU - SIDEBAR
    // ========================================
    if (userProfileToggle && userDropdownMenu) {
        userProfileToggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            if (window.innerWidth <= 768) {
                if (!sidebar.classList.contains('mobile-open')) {
                    sidebar.classList.add('mobile-open');
                    overlay.classList.add('show');
                    
                    setTimeout(() => {
                        userDropdownMenu.classList.add('show');
                    }, 300);
                } else {
                    userDropdownMenu.classList.toggle('show');
                }
            } else {
                if (sidebar.classList.contains('collapsed')) {
                    sidebar.classList.remove('collapsed');
                    localStorage.setItem('sidebarCollapsed', 'false');
                    
                    setTimeout(() => {
                        userDropdownMenu.classList.add('show');
                    }, 300);
                } else {
                    userDropdownMenu.classList.toggle('show');
                }
            }
        });
    }

    // ========================================
    // CLOSE DROPDOWNS ON OUTSIDE CLICK
    // ========================================
    document.addEventListener('click', function(e) {
        if (userDropdownMenu && userProfileToggle) {
            if (!userDropdownMenu.contains(e.target) && !userProfileToggle.contains(e.target)) {
                userDropdownMenu.classList.remove('show');
            }
        }
        
        if (headerDropdownMenu && headerUserDropdown) {
            if (!headerDropdownMenu.contains(e.target) && !headerUserDropdown.contains(e.target)) {
                headerDropdownMenu.classList.remove('show');
            }
        }
    });

    // ========================================
    // LOGOUT BUTTONS
    // ========================================
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            AuthUtils.logout();
        });
    }

    const headerLogoutBtn = document.getElementById('headerLogoutBtn');
    if (headerLogoutBtn) {
        headerLogoutBtn.addEventListener('click', function() {
            AuthUtils.logout();
        });
    }

    // ========================================
    // USER DROPDOWN MENU - HEADER
    // ========================================
    if (headerUserDropdown && headerDropdownMenu) {
        headerUserDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
            headerDropdownMenu.classList.toggle('show');
        });
    }

    // ========================================
    // SET ACTIVE LINK
    // ========================================
    SidebarManager.setActiveLink();
    
    // ========================================
    // LOAD USER INFO
    // ========================================
    SidebarManager.loadUserInfo();
  }

  static setActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
  }

  static async loadUserInfo() {
    try {
        const token = AuthUtils.getToken();
        if (!token) return;

        const payload = JSON.parse(atob(token.split('.')[1]));
        const userName = payload.email?.split('@')[0] || 'User';
        
        const sidebarName = document.getElementById('sidebarUserName');
        if (sidebarName) sidebarName.textContent = userName;

        const userNameDisplay = document.getElementById('userNameDisplay');
        if (userNameDisplay) userNameDisplay.textContent = userName;

        const isAdmin = await AuthUtils.isAdmin();
        if (isAdmin) {
            const adminSection = document.getElementById('adminSection');
            if (adminSection) adminSection.style.display = 'block';
        }

        const response = await fetch('/api/user/current-plan', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const planElement = document.getElementById('sidebarUserPlan');
            if (planElement) planElement.textContent = `Plan ${data.planName || 'Free'}`;
            
            const planBadge = document.getElementById('userPlanBadge');
            if (planBadge) planBadge.textContent = `Plan ${data.planName || 'Free'}`;
        }
    } catch (error) {
        console.error('Error - Load data:', error);
    }
  }
}