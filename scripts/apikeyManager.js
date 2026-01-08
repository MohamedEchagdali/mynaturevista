// components/ApiKeyManager.js
import { ApiKeyService } from '../services/apiKeyService.js';
import { AlertManager } from './AlertManager.js';

// Helper function to escape HTML and prevent XSS
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export class ApiKeyManager {
  constructor() {
    this.currentKey = null;
    this.allKeys = [];
    this.visible = false;
    this.historyVisible = false;
    this.mode = 'regenerate'; // 'regenerate' | 'new'
    this.limits = {
      domains_used: 0,
      domains_allowed: 1,
      domains_base: 1,
      domains_extra: 0, // 🔥 Cambiado de domains_additional a domains_extra
      can_add_domain: false
    };
  }

  async init() {
    try {
      await this.loadCurrentKey();
      await this.loadAllKeys();
      await this.loadUserDomain();
      this.setupEventListeners();
      this.updateDisplay();
      this.updateFormUI();
    } catch (error) {
      AlertManager.show('Error cargando datos de API keys');
    }
  }

  async loadCurrentKey() {
    try {
      this.currentKey = await ApiKeyService.getCurrentKey();
    } catch (error) {
      console.error('Error cargando API key actual:', error);
      throw error;
    }
  }

  async loadAllKeys() {
    try {
      const response = await ApiKeyService.getAllKeys();
      this.allKeys = response.keys || [];
      this.limits = response.limits || this.limits;
      
    } catch (error) {
      console.error('Error cargando historial de API keys:', error);
      throw error;
    }
  }

  async loadUserDomain() {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const domainInput = document.getElementById('domain');
        const emailInput = document.getElementById('email');
        
        if (domainInput && payload.domain) {
          domainInput.value = payload.domain;
          this.currentDomain = payload.domain;
        }
        if (emailInput && payload.email) {
          emailInput.value = payload.email;
        }
      }
    } catch (error) {
      console.error('Error cargando dominio del usuario:', error);
    }
  }

  setupEventListeners() {
    const form = document.getElementById("newApiKeyForm");
    if (form) {
      form.addEventListener("submit", (e) => this.handleNewKeySubmit(e));
    }

    // Event listeners para botones toggle
    const btnRegenerate = document.getElementById("btnRegenerate");
    const btnNewDomain = document.getElementById("btnNewDomain");
    
    if (btnRegenerate) {
      btnRegenerate.addEventListener("click", () => this.toggleMode('regenerate'));
    }
    if (btnNewDomain) {
      btnNewDomain.addEventListener("click", () => this.toggleMode('new'));
    }

    // 🔥 Event listener para el botón de historial
    const historyButton = document.getElementById("historyButton");
    if (historyButton) {
      historyButton.addEventListener("click", () => {
        this.toggleHistory();
      });
    }
  }

  // Toggle entre modos
  toggleMode(mode) {
    this.mode = mode;
    this.updateFormUI();
  }

  // Actualizar UI del formulario según el modo
  updateFormUI() {
    const btnRegenerate = document.getElementById("btnRegenerate");
    const btnNewDomain = document.getElementById("btnNewDomain");
    const domainInput = document.getElementById("domain");
    const domainHelp = document.getElementById("domainHelp");
    const upgradePrompt = document.getElementById("upgradePrompt");
    const submitBtn = document.querySelector('#newApiKeyForm button[type="submit"]');

    if (!domainInput || !submitBtn) return;

    if (this.mode === 'regenerate') {
      // Modo: Regenerar para dominio actual
      btnRegenerate?.classList.add('active');
      btnNewDomain?.classList.remove('active');
      
      domainInput.value = this.currentDomain || '';
      domainInput.disabled = true;
      
      if (domainHelp) {
        domainHelp.textContent = 'Genera una nueva clave para tu dominio actual';
      }
      
      upgradePrompt?.classList.remove('show');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-sync"></i> Regenerar API Key';
      
    } else {
      // Modo: Agregar nuevo dominio
      btnRegenerate?.classList.remove('active');
      btnNewDomain?.classList.add('active');
      
      if (domainHelp) {
        domainHelp.textContent = 'Ingresa un nuevo dominio para esta clave';
      }
      
      // Verificar si puede agregar más dominios
      if (!this.limits.can_add_domain) {
        upgradePrompt?.classList.add('show');
        domainInput.disabled = true;
        domainInput.value = '';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-lock"></i> Límite Alcanzado';
      } else {
        upgradePrompt?.classList.remove('show');
        domainInput.disabled = false;
        domainInput.value = '';
        domainInput.focus();
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Crear API Key para Nuevo Dominio';
      }
    }

    // Actualizar info de límites
    this.updateLimitsDisplay();
  }

  // Actualizar display de límites
  updateLimitsDisplay() {
    const domainsUsedEl = document.getElementById('domainsUsed');
    const domainsAllowedEl = document.getElementById('domainsAllowed');
    const planNameEl = document.getElementById('planName');
    
    if (domainsUsedEl) {
      domainsUsedEl.textContent = this.limits.domains_used;
    }
    if (domainsAllowedEl) {
      domainsAllowedEl.textContent = this.limits.domains_allowed;
    }
    
    // Actualizar nombre del plan
    if (planNameEl) {
      const base = this.limits.domains_base || 1;
      const extra = this.limits.domains_extra || 0; // 🔥 Usa domains_extra
      const total = this.limits.domains_allowed;
      
      let planText = `Plan (${total} dominio${total !== 1 ? 's' : ''})`;
      
      if (extra > 0) {
        planText = `Plan (${base} base + ${extra} extra${extra !== 1 ? 's' : ''} = ${total})`;
      }
      
      planNameEl.textContent = planText;
    }
  }

  toggleKey() {
    if (!this.currentKey) {
      AlertManager.show('No hay API key activa');
      return;
    }

    this.visible = !this.visible;
    const display = document.getElementById("apiKeyDisplay");
    if (display) {
      display.textContent = this.visible 
        ? this.formatApiKey(this.currentKey.api_key)
        : this.getMaskedKey(this.currentKey.api_key);
    }
  }

  async copyKey() {
    if (!this.currentKey) {
      AlertManager.show('No hay API key activa para copiar');
      return;
    }

    try {
      await navigator.clipboard.writeText(this.currentKey.api_key);
      this.showCopyMessage();
    } catch (error) {
      console.error('Error copiando API key:', error);
      AlertManager.show("Error al copiar la API key");
    }
  }

  toggleHistory() {
    const historyContent = document.getElementById("historyContent");
    
    if (!historyContent) {
      console.error('❌ Elemento historyContent no encontrado');
      return;
    }
    
    const isVisible = historyContent.classList.contains("show");
    
    if (isVisible) {
      historyContent.classList.remove("show");
    } else {
      this.renderHistoryList();
      historyContent.classList.add("show");
    }
  }

  renderHistoryList() {
    const historyList = document.getElementById("historyList");
    if (!historyList) {
      console.error('❌ Elemento historyList no encontrado');
      return;
    };

    historyList.innerHTML = "";
    
    if (this.allKeys.length === 0) {
      historyList.innerHTML = '<div class="no-keys">No hay historial de API keys</div>';
      return;
    }

    this.allKeys.forEach(keyData => {
      const item = document.createElement("div");
      item.classList.add("key-item");
      
      const statusText = keyData.is_active ? "Active" : "Revoked";
      const statusClass = keyData.is_active ? "active" : "revoked";
      
      const allowedOrigins = keyData.allowed_origins
        ? `<div class="key-label">Allowed Origins: ${escapeHtml(keyData.allowed_origins.join(', '))}</div>`
        : '';

      item.innerHTML = `
        <div class="key-value">${escapeHtml(this.formatApiKey(keyData.api_key_masked || keyData.api_key))}</div>
        <div class="key-details">
          <div class="key-label">Domain: ${escapeHtml(keyData.domain || 'N/A')}</div>
          <div class="key-label">Created: ${escapeHtml(this.formatDate(keyData.created_at))}</div>
          <div class="key-label">Description: ${escapeHtml(keyData.description || 'N/A')}</div>
          ${allowedOrigins}
        </div>
        <div class="key-status">
          <span class="status ${statusClass}">${escapeHtml(statusText)}</span>
          ${keyData.is_active ? `<button class="revoke-btn" onclick="window.apiKeyManager.revokeKey(${parseInt(keyData.id)})">Revoke</button>` : ''}
        </div>
      `;
      
      historyList.appendChild(item);
    });
  }

  async handleNewKeySubmit(e) {
    e.preventDefault();

    const descriptionInput = document.getElementById("description");
    const domainInput = document.getElementById("domain");
    
    if (!descriptionInput) {
      AlertManager.show('Formulario incompleto');
      return;
    }

    const payload = {
      description: descriptionInput.value.trim()
    };

    // Si está en modo "new" y puede agregar dominio, incluir el dominio
    if (this.mode === 'new' && domainInput && !domainInput.disabled) {
      const newDomain = domainInput.value.trim();
      if (!newDomain) {
        AlertManager.show('Ingresa un dominio válido');
        return;
      }
      payload.domain = newDomain;
    }

    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton?.innerHTML || '';
    
    try {
      submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
      submitButton.disabled = true;
      const response = await ApiKeyService.generateKey(payload);

      if (response.success) {
        this.currentKey = response.apiKey;
        await this.loadAllKeys(); // Recargar para actualizar límites
        
        this.showNewKey(response.apiKey.api_key, response.apiKey.allowed_origins);
        this.updateDisplay();
        this.updateFormUI();
        
        descriptionInput.value = "";
        if (this.mode === 'new' && domainInput) {
          domainInput.value = "";
        }
        
        AlertManager.show(response.message || 'Nueva API key generada exitosamente', 'success');
      } else {
        // Manejar error de límite alcanzado
        if (response.limit_reached) {
          AlertManager.show('⚠️ ' + (response.error || 'Límite de dominios alcanzado'));
        } else {
          AlertManager.show(response.error || 'Error generando API key');
        }
      }

    } catch (error) {
      console.error('Error generando nueva API key:', error);
      AlertManager.show('Error al generar nueva API key');
    } finally {
      submitButton.innerHTML = originalText;
      submitButton.disabled = false;
    }
  }

  async revokeKey(keyId) {
    if (!confirm('¿Estás seguro de que quieres revocar esta API key? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await ApiKeyService.revokeKey(keyId);

      if (response.success) {
        await this.loadCurrentKey();
        await this.loadAllKeys();
        
        this.updateDisplay();
        this.updateFormUI();
        this.renderHistoryList(); // Re-renderizar el historial
        
        AlertManager.show('API key revocada exitosamente', 'success');
      } else {
        AlertManager.show(response.error || 'Error revocando API key');
      }
    } catch (error) {
      console.error('Error revocando API key:', error);
      AlertManager.show('Error al revocar API key');
    }
  }

  showNewKey(apiKey, allowedOrigins = []) {
    const display = document.getElementById("generatedApiKey");
    const content = document.getElementById("newKeyContent");

    if (display) {
      let html = `<strong>API Key:</strong><br>${escapeHtml(this.formatApiKey(apiKey))}`;

      if (allowedOrigins && allowedOrigins.length > 0) {
        html += `<br><br><strong>Allowed Origins:</strong><br>`;
        html += allowedOrigins.map(origin => `• ${escapeHtml(origin)}`).join('<br>');
      }

      display.innerHTML = html;
    }
    if (content) content.classList.add("show");
  }

  async copyNewKey() {
    const keyElement = document.getElementById("generatedApiKey");
    if (!keyElement) return;

    try {
      const text = keyElement.textContent;
      const keyMatch = text.match(/API Key:\s*([a-f0-9\s]+)/);
      const rawKey = keyMatch ? keyMatch[1].replace(/\s/g, '') : text.replace(/\s/g, '');
      
      await navigator.clipboard.writeText(rawKey);
      
      const message = document.getElementById("newKeyCopyMessage");
      if (message) {
        message.style.display = "block";
        setTimeout(() => message.style.display = "none", 3000);
      }
    } catch (error) {
      console.error('Error copiando nueva API key:', error);
      AlertManager.show("Error al copiar nueva API key");
    }
  }

  hideNewKey() {
    const content = document.getElementById("newKeyContent");
    if (content) content.classList.remove("show");
  }

  updateDisplay() {
    const display = document.getElementById("apiKeyDisplay");
    
    if (this.currentKey) {
      if (display) {
        display.textContent = this.visible 
          ? this.formatApiKey(this.currentKey.api_key)
          : this.getMaskedKey(this.currentKey.api_key);
      }
      this.updateKeyInfo();
    } else {
      if (display) {
        display.textContent = "No hay API key activa";
      }
      this.updateKeyInfo(null);
    }
  }

  updateKeyInfo(keyData = this.currentKey) {
    const domainElement = document.querySelector('[data-field="domain"]');
    if (domainElement) {
      domainElement.textContent = keyData ? keyData.domain || 'N/A' : 'N/A';
    }

    const dateElement = document.querySelector('[data-field="date"]');
    if (dateElement) {
      dateElement.textContent = keyData ? this.formatDate(keyData.created_at) : 'N/A';
    }

    const statusElement = document.querySelector('.status');
    if (statusElement) {
      if (keyData && keyData.is_active) {
        statusElement.textContent = 'Active';
        statusElement.className = 'status active';
      } else {
        statusElement.textContent = keyData ? 'Inactive' : 'No Key';
        statusElement.className = 'status inactive';
      }
    }
  }

  showCopyMessage() {
    const message = document.getElementById("copyMessage");
    if (message) {
      message.style.display = "block";
      setTimeout(() => message.style.display = "none", 3000);
    }
  }

  // Utilidades
  formatApiKey(key) {
    if (!key) return '';
    return key.match(/.{1,4}/g)?.join(' ') || key;
  }

  getMaskedKey(key) {
    if (!key) return '';
    const visible = 4;
    return key.substring(0, visible) + '•'.repeat(key.length - visible * 2) + key.substring(key.length - visible);
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}