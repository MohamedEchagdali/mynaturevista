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

  // 1️⃣ ADD at the beginning of the class (after constructor):

  /**
   * Check if user can add domains
   */
  canAddDomain() {
    return this.limits.can_add_domain === true;
  }

  /**
   * Get current plan information
   */
  getCurrentPlanInfo() {
    // Detect plan based on limits
    const domainsAllowed = this.limits.domains_allowed || 1;
    
    if (domainsAllowed === 1) {
      return {
        name: 'Starter',
        domainsIncluded: 1,
        pricePerExtraDomain: null // Doesn't allow extra domains
      };
    } else if (domainsAllowed > 1 && domainsAllowed <= 3) {
      return {
        name: 'Business',
        domainsIncluded: domainsAllowed,
        pricePerExtraDomain: 10 // €10 per extra domain
      };
    } else {
      return {
        name: 'Enterprise',
        domainsIncluded: domainsAllowed,
        pricePerExtraDomain: 15 // €15 per extra domain
      };
    }
  }

  async init() {
    this.injectStyles();
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

    // 1. Base domain section
    if (this.baseDomain) {
      html += this.renderDomainSection(this.baseDomain, true);
    }

    // 2. Extra domains sections
    this.extraDomains.forEach(extraDomain => {
      html += this.renderDomainSection(extraDomain.domain, false, extraDomain);
    });

    // 3. Add domain button (if has permission)
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
                ${extraDomainData.next_billing_date ? `• Next billing: ${new Date(extraDomainData.next_billing_date).toLocaleDateString()}` : ''}
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
   * Render add domain button
   */
  renderAddDomainButton() {
    const canAdd = this.canAddDomain();
    
    return `
      <div class="add-domain-section">
        <button 
          class="btn btn-success btn-lg" 
          onclick="apiKeyManager.handleAddDomainClick()"
          ${!canAdd ? 'disabled' : ''}
        >
          ➕ Add Additional Domain
        </button>
        <p class="help-text">
          Domains used: ${this.limits.domains_used} / ${this.limits.domains_allowed + this.limits.domains_extra}
        </p>
      </div>
    `;
  }

  // 3️⃣ ADD this new method:

  /**
   * Handle click on "Add Domain"
   * Verifies permissions before redirecting
   */
  handleAddDomainClick() {
    if (!this.canAddDomain()) {
      this.showUpgradeModalForDomains();
      return;
    }
    
    // If has permissions, redirect to purchase page
    window.location.href = 'addDomain.html';
  }

  // 4️⃣ ADD upgrade modal for domains:

  /**
   * Upgrade modal for additional domains
   */
  showUpgradeModalForDomains() {
    const planInfo = this.getCurrentPlanInfo();
    
    let upgradeMessage = '';
    if (planInfo.name === 'Starter') {
      upgradeMessage = 'Your <strong>Starter</strong> plan includes only <strong>1 domain</strong>. Additional domains are available in higher plans.';
    } else {
      upgradeMessage = `You have reached the limit of <strong>${this.limits.domains_allowed} domain(s)</strong> for your plan.`;
    }
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'upgradeOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
      padding: 1rem;
    `;
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: white;
      border-radius: 24px;
      max-width: 550px;
      width: 100%;
      box-shadow: 0 25px 70px rgba(0, 0, 0, 0.4);
      animation: slideInUp 0.4s ease;
      overflow: hidden;
    `;
    
    modal.innerHTML = `
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 2.5rem 2rem;
        text-align: center;
        position: relative;
      ">
        <button onclick="apiKeyManager.closeUpgradeModal()" style="
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        "
        onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='rotate(90deg)'"
        onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform=''">
          <i class="fas fa-times"></i>
        </button>
        
        <div style="
          width: 90px;
          height: 90px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.25rem;
          backdrop-filter: blur(10px);
        ">
          <i class="fas fa-lock" style="font-size: 2.75rem; color: white;"></i>
        </div>
        
        <h2 style="color: white; margin: 0 0 0.5rem 0; font-size: 2rem; font-weight: 700;">
          Feature Not Available
        </h2>
        <p style="color: rgba(255, 255, 255, 0.95); margin: 0; font-size: 1.05rem; line-height: 1.5;">
          Current plan: <strong>${planInfo.name}</strong>
        </p>
      </div>
      
      <!-- Body -->
      <div style="padding: 2.5rem 2rem;">
        
        <!-- Main Message -->
        <div style="text-align: center; margin-bottom: 2rem;">
          <p style="font-size: 1.15rem; color: #374151; margin: 0 0 1.5rem 0; line-height: 1.7;">
            ${upgradeMessage}
          </p>
          
          <div style="
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-left: 4px solid #f59e0b;
            padding: 1.25rem;
            border-radius: 12px;
            text-align: left;
          ">
            <div style="display: flex; align-items: start; gap: 1rem;">
              <i class="fas fa-info-circle" style="
                color: #d97706;
                font-size: 1.5rem;
                margin-top: 0.25rem;
                flex-shrink: 0;
              "></i>
              <div>
                <h4 style="margin: 0 0 0.5rem 0; color: #92400e; font-size: 1.05rem; font-weight: 700;">
                  Why add more domains?
                </h4>
                <p style="margin: 0; color: #78350f; font-size: 0.95rem; line-height: 1.6;">
                  Each additional domain allows you to use the myNaturvista widget on a different website, 
                  perfect if you manage multiple brands or projects.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div style="
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        ">
          <button onclick="apiKeyManager.closeUpgradeModal()" style="
            background: #f3f4f6;
            color: #6b7280;
            border: none;
            padding: 0.875rem 2rem;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            flex: 1;
            min-width: 140px;
          "
          onmouseover="this.style.background='#e5e7eb'; this.style.color='#374151'"
          onmouseout="this.style.background='#f3f4f6'; this.style.color='#6b7280'">
            Maybe Later
          </button>
          
          <a href="/dashboard/subscription" style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 0.875rem 2rem;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
            flex: 1;
            min-width: 140px;
          "
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.5)'"
          onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)'">
            <i class="fas fa-rocket"></i>
            View Plans
          </a>
        </div>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    
    // Close when clicking outside modal
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        apiKeyManager.closeUpgradeModal();
      }
    });
  }

  /**
   * Close upgrade modal
   */
  closeUpgradeModal() {
    const overlay = document.getElementById('upgradeOverlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.3s ease';
      setTimeout(() => {
        overlay.remove();
        document.body.style.overflow = 'auto';
      }, 300);
    }
  }

  // 5️⃣ ADD necessary CSS styles (at the end of file or in your CSS):

  /**
   * Inject necessary styles
   */
  injectStyles() {
    if (document.getElementById('upgradeModalStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'upgradeModalStyles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideInUp {
        from { 
          opacity: 0; 
          transform: translateY(30px) scale(0.95);
        }
        to { 
          opacity: 1; 
          transform: translateY(0) scale(1);
        }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
      
      /* Disable button */
      .btn[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Render upgrade message
   */
  renderUpgradePrompt() {
    return `
      <div class="upgrade-prompt">
        <h4>💎 Need more domains?</h4>
        <p>You have reached your current plan's limit (${this.limits.domains_allowed} domain${this.limits.domains_allowed > 1 ? 's' : ''})</p>
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
    `;
  }

  /**
   * Generate new API Key
   */
  async generateKey(domain) {
    const description = prompt(`Optional description for ${domain} API Key:`);
    
    const confirmation = confirm(`Generate new API Key for ${domain}?`);
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
    const confirmation = confirm(`⚠️ Cancel domain ${domain}?\n\nThe subscription and associated API Keys will be canceled.`);
    if (!confirmation) return;

    this.showLoading('Canceling domain...');

    try {
      const result = await DomainPurchaseService.cancelDomain(domainId);

      if (result.success) {
        this.showSuccess('✅ Domain canceled successfully');
        await this.loadAllData();
        this.render();
      } else {
        this.showError(result.error || 'Error canceling domain');
      }
    } catch (error) {
      this.showError('Error canceling domain');
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

  // UI Methods
  showLoading(message) {
    // Implement according to your notification system
    console.log('⏳', message);
  }

  showSuccess(message) {
    alert(message);
  }

  showError(message) {
    alert(message);
  }
}