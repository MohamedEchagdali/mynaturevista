// components/ApiKeyManager.js - IMPROVED VERSION
import { ApiKeyService } from '../services/ApiKeyService.js';
import { DomainPurchaseService } from '../services/DomainPurchaseService.js';

export class ApiKeyManager {
  constructor() {
    this.baseDomain = null;
    this.extraDomains = [];
    this.keysByDomain = {};
    this.limits = {};
  }

  async init() {
    await this.loadAllData();
    this.render();
  }

  /**
   * Load all necessary data
   */
  async loadAllData() {
    try {
      // Load available domains
      const domainsResult = await ApiKeyService.getAllDomains();
      if (domainsResult.success) {
        this.baseDomain = domainsResult.baseDomain;
        this.extraDomains = domainsResult.extraDomains;
      }

      // Load existing API keys
      const keysResult = await ApiKeyService.getAllKeys();
      if (keysResult.success) {
        this.keysByDomain = keysResult.keysByDomain;
        this.limits = keysResult.limits;
      }

    } catch (error) {
      this.showError('Error loading data');
    }
  }

  /**
   * Render complete interface
   */
  render() {
    const container = document.getElementById('apiKeysContainer');
    if (!container) return;

    let html = '';

    if (this.baseDomain) {
      html += this.renderDomainSection(this.baseDomain, true);
    }

    this.extraDomains.forEach(extraDomain => {
      html += this.renderDomainSection(extraDomain.domain, false, extraDomain);
    });

    // 3. Button to add domain (if has permission)
    if (this.limits.can_add_domain) {
      html += this.renderAddDomainButton();
    } else {
      html += this.renderUpgradePrompt();
    }

    container.innerHTML = html;

    // Update summary
    this.updateSummary();
  }

  /**
   * Render section for a specific domain
   */
  renderDomainSection(domain, isBase = false, extraDomainData = null) {
    const keys = this.keysByDomain[domain] || [];
    const activeKey = keys.find(k => k.is_active);
    const hasActiveKey = !!activeKey;

    const domainId = domain.replace(/[^a-zA-Z0-9]/g, '_');

return `
  <div class="domain-card ${isBase ? 'base-domain' : 'extra-domain'}" id="domain-${domainId}">
    <div class="domain-header">
      <div class="domain-info">
        <h3 class="domain-name">
          🌐 ${domain}
          ${isBase ? '<span class="badge badge-primary">Base Domain</span>' : '<span class="badge badge-secondary">Extra Domain</span>'}
        </h3>
        ${!isBase && extraDomainData ? `
          <p class="domain-meta">
            💳 ${(extraDomainData.monthly_price / 100).toFixed(2)}€/month
            ${extraDomainData.next_billing_date ? `• Next invoice: ${new Date(extraDomainData.next_billing_date).toLocaleDateString()}` : ''}
          </p>
        ` : ''}
      </div>
      ${!isBase ? `
        <button class="btn btn-sm btn-danger" onclick="apiKeyManager.cancelExtraDomain('${domain}', ${extraDomainData?.id})">
          🗑️ Cancel
        </button>
      ` : ''}
    </div>

    <div class="api-key-section">
      ${hasActiveKey ? `
        <!-- Active API Key -->
        <div class="api-key-display">
          <label>🔑 Active API Key</label>
          <div class="key-container">
            <input 
              type="password" 
              id="key-${domainId}" 
              value="${activeKey.api_key}" 
              class="form-control" 
              readonly
            />
            <button class="btn btn-icon" onclick="apiKeyManager.toggleKeyVisibility('${domainId}')" title="Show/Hide">
              👁️
            </button>
            <button class="btn btn-icon" onclick="apiKeyManager.copyKey('${domainId}')" title="Copy">
              📋
            </button>
          </div>
          <p class="key-info">
            Created: ${new Date(activeKey.created_at).toLocaleDateString()}
            ${activeKey.description ? `• ${activeKey.description}` : ''}
          </p>
        </div>

        <!-- Action buttons -->
        <div class="key-actions">
          <button class="btn btn-secondary" onclick="apiKeyManager.regenerateKey('${domain}')">
            🔄 Regenerate Key
          </button>
          <button class="btn btn-danger" onclick="apiKeyManager.revokeKey(${activeKey.id}, '${domain}')">
            ❌ Revoke Key
          </button>
        </div>
      ` : `
        <!-- No API Key -->
        <div class="no-key-message">
          <p>⚠️ No active API Key for this domain</p>
          <button class="btn btn-primary" onclick="apiKeyManager.generateKey('${domain}')">
            ➕ Generate API Key
          </button>
        </div>
      `}

      ${keys.length > 1 ? `
        <!-- Key history -->
        <details class="key-history">
          <summary>📜 History (${keys.length - 1} previous keys)</summary>
          <ul>
            ${keys.filter(k => !k.is_active).map(k => `
              <li>
                <code>${k.api_key_masked}</code>
                <span class="text-muted">• ${new Date(k.created_at).toLocaleDateString()}</span>
              </li>
            `).join('')}
          </ul>
        </details>
      ` : ''}
    </div>
  </div>
`;
}


  /**
   * Render button to add domain
   */
  renderAddDomainButton() {
    return `
      <div class="add-domain-section">
        <button class="btn btn-success btn-lg" onclick="window.location.href='addDomain.html'">
          ➕ Add Additional Domain
        </button>
        <p class="help-text">
          Domains used: ${this.limits.domains_used} / ${this.limits.domains_allowed + this.limits.domains_extra}
        </p>
      </div>
    `;
  }

  /**
   * Render upgrade message
   */
 renderUpgradePrompt() {
  return `
    <div class="upgrade-prompt">
      <h4>💎 Need more domains?</h4>
      <p>You've reached the limit of your current plan (${this.limits.domains_allowed} domain${this.limits.domains_allowed > 1 ? 's' : ''})</p>
      <button class="btn btn-primary" onclick="window.location.href='plans.html'">
        Upgrade Plan
      </button>
    </div>
  `;
}


  /**
   * Update usage summary
   */
  updateSummary() {
    const summaryElement = document.getElementById('domainsSummary');
    if (!summaryElement) return;

    const totalDomains = 1 + this.extraDomains.length;
    const domainsWithKeys = Object.keys(this.keysByDomain).length;

summaryElement.innerHTML = `
  <div class="summary-stats">
    <div class="stat">
      <span class="stat-value">${totalDomains}</span>
      <span class="stat-label">Total Domains</span>
    </div>
    <div class="stat">
      <span class="stat-value">${domainsWithKeys}</span>
      <span class="stat-label">With API Keys</span>
    </div>
    <div class="stat">
      <span class="stat-value">${this.limits.domains_allowed + this.limits.domains_extra}</span>
      <span class="stat-label">Plan Limit</span>
    </div>
  </div>
`}

/**
 * Generate new API Key
 */
async generateKey(domain) {
  const description = prompt(`Optional description for the API Key of ${domain}:`);
  
  const confirmation = confirm(`Generate a new API Key for ${domain}?`);
  if (!confirmation) return;

  this.showLoading('Generating API Key...');

  try {
    const result = await ApiKeyService.generateKey({
      domain: domain,
      description: description || undefined
    });

    if (result.success) {
      this.showSuccess('✅ API Key generated successfully');
      await this.loadAllData();
      this.render();
    } else {
      this.showError(result.error || 'Error generating API Key');
    }
  } catch (error) {
    this.showError('Error generating API Key');
    console.error(error);
  }
}

/**
 * Regenerate existing API Key
 */
async regenerateKey(domain) {
  const confirmation = confirm(`⚠️ Regenerate API Key for ${domain}?\n\nThe previous key will stop working.`);
  if (!confirmation) return;

  const description = prompt('New description (optional):');

  this.showLoading('Regenerating API Key...');

  try {
    const result = await ApiKeyService.generateKey({
      domain: domain,
      description: description || undefined
    });

    if (result.success) {
      this.showSuccess('✅ API Key regenerated successfully');
      await this.loadAllData();
      this.render();
    } else {
      this.showError(result.error || 'Error regenerating API Key');
    }
  } catch (error) {
    this.showError('Error regenerating API Key');
    console.error(error);
  }
}


  /**
 * Revoke API Key
 */
async revokeKey(keyId, domain) {
  const confirmation = confirm(`⚠️ Revoke API Key for ${domain}?\n\nThis action cannot be undone.`);
  if (!confirmation) return;

  this.showLoading('Revoking API Key...');

  try {
    const result = await ApiKeyService.revokeKey(keyId);

    if (result.success) {
      this.showSuccess('✅ API Key revoked successfully');
      await this.loadAllData();
      this.render();
    } else {
      this.showError(result.error || 'Error revoking API Key');
    }
  } catch (error) {
    this.showError('Error revoking API Key');
    console.error(error);
  }
}

/**
 * Cancel extra domain
 */
async cancelExtraDomain(domain, domainId) {
  const confirmation = confirm(`⚠️ Cancel domain ${domain}?\n\nThe subscription and associated API Keys will be cancelled.`);
  if (!confirmation) return;

  this.showLoading('Cancelling domain...');

  try {
    const result = await DomainPurchaseService.cancelDomain(domainId);

    if (result.success) {
      this.showSuccess('✅ Domain cancelled successfully');
      await this.loadAllData();
      this.render();
    } else {
      this.showError(result.error || 'Error cancelling domain');
    }
  } catch (error) {
    this.showError('Error cancelling domain');
    console.error(error);
  }
}

/**
 * Toggle API Key visibility
 */
toggleKeyVisibility(domainId) {
  const input = document.getElementById(`key-${domainId}`);
  if (!input) return;
  
  input.type = input.type === 'password' ? 'text' : 'password';
}

/**
 * Copy API Key to clipboard
 */
async copyKey(domainId) {
  const input = document.getElementById(`key-${domainId}`);
  if (!input) return;

  try {
    await navigator.clipboard.writeText(input.value);
    this.showSuccess('📋 API Key copied to clipboard');
  } catch (error) {
    console.error('Error copying:', error);
    this.showError('Error copying');
  }
}


  // UI methods
  showLoading(message) {
    console.log('Loading:', message);
  }

  showSuccess(message) {
    console.log('Success:', message);
  }

  showError(message) {
    console.error('Error:', message);
  }
}