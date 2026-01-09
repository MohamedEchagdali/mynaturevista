// ===== pages/ButtonsEditorPage.js =====
export class ButtonsEditorPage {
  constructor() {
    this.setupEventListeners();
  }

  async init() {
    this.setupEditorTabs();
    this.setupPreviewSystem();
  }

  setupEventListeners() {
    // Event listeners are set up in setupEditorTabs and setupPreviewSystem
  }

  setupEditorTabs() {
    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        // Remove active class from all tabs
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        
        // Add active class to clicked tab
        tab.classList.add("active");
        
        // Show corresponding panel
        const panel = document.getElementById(tab.dataset.tab + "-panel");
        if (panel) {
          panel.classList.add("active");
        }
      });
    });
  }

  setupPreviewSystem() {
    const updatePreviewSilent = () => {
      const htmlCode = document.getElementById("html-code");
      const cssCode = document.getElementById("css-code");
      const iframe = document.getElementById("preview");
     
      if (!htmlCode || !cssCode || !iframe) {
        console.warn('Preview elements not found');
        return;
      }

      const previewContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: linear-gradient(135deg, #fff7f6, #f0f0f0);
              }
              ${cssCode.value}
            </style>
          </head>
          <body>
            ${htmlCode.value}
          </body>
        </html>`;

      // Safe way to update iframe - avoid cross-origin issues
      try {
        iframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(previewContent);
      } catch (error) {
        console.error('Error updating preview:', error);
        
        // Fallback: Create blob URL
        try {
          const blob = new Blob([previewContent], { type: 'text/html' });
          iframe.src = URL.createObjectURL(blob);
        } catch (fallbackError) {
          console.error('Fallback method also failed:', fallbackError);
        }
      }
    };

    const updatePreviewWithNotification = () => {
      updatePreviewSilent();
      this.showUpdateSuccess(); 
    };

    setTimeout(updatePreviewSilent, 100);
    
    // 🔥 Make updatePreview available globally SOLO para botones onclick
    window.updatePreview = updatePreviewWithNotification;

    // Add keyboard shortcuts for updating preview
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        updatePreviewWithNotification();
      }
    });
  }

  showUpdateSuccess() {
    const notification = document.getElementById('copySuccess');
    if (notification) {
      notification.classList.add('show');
      
      setTimeout(() => {
        notification.classList.remove('show');
      }, 3000);
    } else {
      // Fallback: create temporary notification
      this.createTemporaryNotification('Preview updated successfully!');
    }
  }

  createTemporaryNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 120px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      z-index: 1100;
      transition: transform 0.3s ease;
      transform: translateX(100%);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // Method to handle real-time preview updates
  setupRealtimePreview() {
    const htmlCode = document.getElementById("html-code");
    const cssCode = document.getElementById("css-code");
    
    if (htmlCode && cssCode) {
      // Add input event listeners for real-time updates
      let debounceTimer;
      
      const debouncedUpdate = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          window.updatePreview();
        }, 500); // Wait 500ms after user stops typing
      };
      
      htmlCode.addEventListener('input', debouncedUpdate);
      cssCode.addEventListener('input', debouncedUpdate);
    }
  }

  // Method to export button code
  exportButtonCode() {
    const htmlCode = document.getElementById("html-code");
    const cssCode = document.getElementById("css-code");
    
    if (htmlCode && cssCode) {
      const exportContent = {
        html: htmlCode.value,
        css: cssCode.value,
        combined: `<style>\n${cssCode.value}\n</style>\n\n${htmlCode.value}`
      };
      
      return exportContent;
    }
    
    return null;
  }

  // Method to copy code to clipboard
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showUpdateSuccess();
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        this.showUpdateSuccess();
        return true;
      } catch (fallbackError) {
        console.error('Fallback copy method also failed:', fallbackError);
        document.body.removeChild(textArea);
        return false;
      }
    }
  }
}