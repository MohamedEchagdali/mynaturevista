export class ButtonEditorManager {
  constructor(container) {
    this.container = container;
    this.elements = this.getElements();
  }

  getElements() {
    return {
      tabs: this.container.querySelectorAll('.tab'),
      panels: this.container.querySelectorAll('.panel'),
      htmlPanel: this.container.querySelector('.html-panel') || 
                 this.container.querySelector('[id$="html-panel"]'),
      cssPanel: this.container.querySelector('.css-panel') || 
                this.container.querySelector('[id$="css-panel"]'),
      htmlCode: this.container.querySelector('.html-code') || 
                this.container.querySelector('[id$="htmlCode"]'),
      cssCode: this.container.querySelector('.css-code') || 
               this.container.querySelector('[id$="cssCode"]'),
      preview: this.container.querySelector('.preview-frame') || 
               this.container.querySelector('[id$="preview"]'),
      copyButton: this.container.querySelector('.copy-button')
    };
  }

  init() {
    this.setupTabs();
    this.updatePreview();
  }

  setupTabs() {
    this.elements.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.elements.tabs.forEach(t => t.classList.remove('active'));
        this.elements.panels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const type = tab.dataset.tab;
        
        if (type === 'html' && this.elements.htmlPanel) {
          this.elements.htmlPanel.classList.add('active');
        } else if (type === 'css' && this.elements.cssPanel) {
          this.elements.cssPanel.classList.add('active');
        }
      });
    });
  }

  updatePreview() {
    if (!this.elements.preview || !this.elements.htmlCode || !this.elements.cssCode) {
      return;
    }

    const combined = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>${this.elements.cssCode.value}</style>
        </head>
        <body>
          ${this.elements.htmlCode.value}
        </body>
      </html>
    `;
    
    const doc = this.elements.preview.contentDocument || 
                this.elements.preview.contentWindow.document;
    doc.open();
    doc.write(combined);
    doc.close();
  }
}