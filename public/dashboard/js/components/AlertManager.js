export class AlertManager {
  static show(message, type = 'error', duration = 5000) {
    let alertElement = document.getElementById('globalAlert');
    if (!alertElement) {
      alertElement = document.createElement('div');
      alertElement.id = 'globalAlert';
      alertElement.className = 'alert';
      document.body.appendChild(alertElement);
      this.addStyles();
    }
    
    alertElement.className = `alert alert-${type}`;
    alertElement.textContent = message;
    alertElement.style.display = 'block';
    
    setTimeout(() => {
      alertElement.style.display = 'none';
    }, duration);
  }

  static addStyles() {
    if (document.getElementById('alert-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'alert-styles';
    styles.textContent = `
      .alert {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        border-radius: 5px;
        z-index: 10000;
        max-width: 300px;
        display: none;
      }
      .alert-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
      .alert-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    `;
    document.head.appendChild(styles);
  }
}