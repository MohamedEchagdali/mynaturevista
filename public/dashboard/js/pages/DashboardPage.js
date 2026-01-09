// pages/DashboardPage.js - CORRECTED VERSION with working domain selector
import { SubscriptionChecker } from '../components/SubscriptionChecker.js';

export class DashboardPage {
  constructor() {
    this.charts = {};
    this.refreshInterval = null;
    this.currentDomain = null;
    this.availableDomains = [];
  }

  async init() {
    const hasAccess = await SubscriptionChecker.checkSubscriptionStatus();

    if (hasAccess) {
      // 🔥 FIX: Load domains FIRST, then initialize everything
      await this.loadAvailableDomains();
      
      // Only continue if we have domains
      if (this.availableDomains.length === 0) {
        this.showError('No domains found');
        return;
      }

      this.setupDomainSelector();
      await this.initializeDashboard();
    }
  }

  /**
   * Load all available domains for the user
   */
  async loadAvailableDomains() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/domains/all', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Error loading domains');
      }

      const data = await response.json();
      
      console.log('📡 Domains loaded:', data); // Debug

      // Build list of domains
      this.availableDomains = [];
      
      // Add base domain
      if (data.baseDomain) {
        this.availableDomains.push({
          domain: data.baseDomain,
          type: 'base',
          label: `${data.baseDomain} (Base Domain)`
        });
      }

      // Add extra domains
      if (data.extraDomains && data.extraDomains.length > 0) {
        data.extraDomains.forEach(extra => {
          this.availableDomains.push({
            domain: extra.domain,
            type: 'extra',
            label: `${extra.domain} (Extra Domain)`
          });
        });
      }

      // Set first domain as current
      if (this.availableDomains.length > 0) {
        this.currentDomain = this.availableDomains[0].domain;
        console.log('✅ Current domain set to:', this.currentDomain);
      }

    } catch (error) {
      console.error('❌ Error loading domains:', error);
      this.showError('Error loading domains');
    }
  }

  /**
   * Setup domain selector
   */
  setupDomainSelector() {
    const selector = document.getElementById('domainSelector');
    if (!selector) {
      console.warn('⚠️ Domain selector not found in DOM');
      return;
    }

    // Populate selector
    selector.innerHTML = this.availableDomains.map(d => 
      `<option value="${d.domain}">${d.label}</option>`
    ).join('');

    // Set current domain
    selector.value = this.currentDomain;

    console.log('🎯 Domain selector populated with', this.availableDomains.length, 'domains');

    // 🔥 FIX: Listen for changes and reload data
    selector.addEventListener('change', async (e) => {
      const newDomain = e.target.value;
      console.log('🔄 Domain changed from', this.currentDomain, 'to', newDomain);
      
      this.currentDomain = newDomain;
      
      // Show loading state
      this.showLoadingState();
      
      // Reload all data for new domain
      await this.loadDashboardData();
    });
  }

  /**
   * Show loading state on cards
   */
  showLoadingState() {
    // Show loading skeletons
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(el => {
      el.innerHTML = '<div class="loading-skeleton" style="height: 2rem; width: 80px;"></div>';
    });

    const container = document.getElementById('activeWidgetsContainer');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-muted mt-2">Loading statistics...</p>
        </div>
      `;
    }
  }

  async initializeDashboard() {
    try {
      console.log('🚀 Initializing dashboard with domain:', this.currentDomain);
      
      await this.loadDashboardData();

      // Auto-refresh every 5 minutes
      this.refreshInterval = setInterval(() => {
        console.log('🔄 Auto-refreshing dashboard data...');
        this.loadDashboardData();
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error('❌ Error initializing dashboard:', error);
      this.showError('Error loading dashboard');
    }
  }

  async loadDashboardData() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/dashboard/loginSignup.html';
        return;
      }

      // 🔥 IMPORTANT: Verify we have a domain selected
      if (!this.currentDomain) {
        console.error('❌ No domain selected!');
        return;
      }

      console.log('📊 Loading data for domain:', this.currentDomain);

      // Send selected domain as parameter
      const url = `/api/stats/dashboard?period=30&domain=${encodeURIComponent(this.currentDomain)}`;
      
      const dashboardData = await this.fetchData(url);

      console.log('✅ Dashboard data received:', dashboardData);

      // Render all sections
      this.renderMainStats(dashboardData);
      this.renderAlerts(dashboardData);
      this.renderActiveWidgets(dashboardData);
      this.createUsageCharts(dashboardData);

    } catch (error) {
      console.error('❌ Error loading data:', error);
      this.showError('Error loading statistics');
    }
  }

  async fetchData(endpoint) {
    const token = localStorage.getItem('token'); 
    
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

  renderMainStats(data) {
    console.log('🎨 Rendering main stats...', data);

    const { metrics, subscription } = data;

    // 1. OPENINGS
    const openingsEl = document.getElementById('stat-openings');
    const openingsLimitEl = document.getElementById('stat-openings-limit');
    const openingsProgressEl = document.getElementById('progress-openings');
    
    if (openingsEl) {
      openingsEl.textContent = metrics.openings.current.toLocaleString();
      console.log('✅ Updated openings:', metrics.openings.current);
    }
    
    if (openingsLimitEl) {
      openingsLimitEl.textContent = `of ${metrics.openings.limit.toLocaleString()} available`;
    }
    
    if (openingsProgressEl) {
      openingsProgressEl.style.width = `${Math.min(metrics.openings.percentage, 100)}%`;

      // Change color based on usage
      if (metrics.openings.percentage >= 90) {
        openingsProgressEl.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
      } else if (metrics.openings.percentage >= 75) {
        openingsProgressEl.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
      } else {
        openingsProgressEl.style.background = 'linear-gradient(90deg, #00b894, #00a884)';
      }
    }

    // 2. INTERNAL NAVIGATION
    const internalNavEl = document.getElementById('stat-internal-nav');
    if (internalNavEl && metrics.internalNavigation) {
      internalNavEl.textContent = metrics.internalNavigation.current.toLocaleString();
      console.log('✅ Updated internal navigation:', metrics.internalNavigation.current);
    }

    // 3. DOMAINS (total count)
    const domainsEl = document.getElementById('stat-domains');
    const domainsLimitEl = document.getElementById('stat-domains-limit');
    
    if (domainsEl) {
      domainsEl.textContent = `${this.availableDomains.length}`;
    }
    
    if (domainsLimitEl) {
      domainsLimitEl.textContent = `${metrics.domains.allowed} allowed in plan`;
    }

    // 4. CUSTOM PLACES
    const placesEl = document.getElementById('stat-places');
    const placesLimitEl = document.getElementById('stat-places-limit');
    const placesProgressEl = document.getElementById('progress-places');

    if (placesEl) {
      if (metrics.customPlaces.limit === -1) {
        placesEl.textContent = metrics.customPlaces.current.toLocaleString();
        if (placesLimitEl) placesLimitEl.textContent = 'unlimited ✨';
        if (placesProgressEl) placesProgressEl.style.width = '100%';
      } else {
        const placesPercent = metrics.customPlaces.limit > 0
          ? (metrics.customPlaces.current / metrics.customPlaces.limit) * 100
          : 0;

        placesEl.textContent = `${metrics.customPlaces.current} / ${metrics.customPlaces.limit}`;
        
        if (placesLimitEl) {
          placesLimitEl.textContent = metrics.customPlaces.current < metrics.customPlaces.limit
            ? 'Available'
            : 'Limit reached';
        }

        if (placesProgressEl) {
          placesProgressEl.style.width = `${Math.min(placesPercent, 100)}%`;
        }
      }
      console.log('✅ Updated custom places:', metrics.customPlaces.current);
    }

    // 5. RENEWAL
    const renewalEl = document.getElementById('stat-renewal');
    const renewalDateEl = document.getElementById('stat-renewal-date');

    if (renewalEl) {
      if (metrics.renewal.daysUntil !== null) {
        renewalEl.textContent = metrics.renewal.daysUntil;

        if (renewalDateEl) {
          const renewalDate = new Date(metrics.renewal.date);
          renewalDateEl.textContent = renewalDate.toLocaleDateString('en-EN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }

        // Color coding
        if (metrics.renewal.daysUntil <= 7) {
          renewalEl.style.color = '#ef4444';
        } else if (metrics.renewal.daysUntil <= 15) {
          renewalEl.style.color = '#f59e0b';
        } else {
          renewalEl.style.color = '#1f2937';
        }
      } else {
        renewalEl.textContent = '--';
        if (renewalDateEl) renewalDateEl.textContent = 'Not active';
      }
    }

    // 6. PLAN BADGE
    const planBadgeEl = document.getElementById('userPlanBadge');
    if (planBadgeEl) {
      const planName = (subscription.plan_type || 'free').toUpperCase();
      planBadgeEl.textContent = planName;
      planBadgeEl.className = `plan-badge ${subscription.plan_type || 'starter'}`;
    }

    console.log('✅ All stats rendered successfully');
  }

  renderAlerts(data) {
    const container = document.getElementById('alertsContainer');
    if (!container) return;

    const { metrics, subscription } = data;
    let alerts = '';

    // Opening limit alert
    if (metrics.openings.percentage >= 80) {
      const severity = metrics.openings.percentage >= 90 ? 'danger' : 'warning';
      alerts += `
        <div class="alert alert-${severity} alert-custom mb-3">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <strong>${this.currentDomain}:</strong> You've used ${metrics.openings.percentage}% of your monthly openings.
          ${metrics.openings.percentage >= 95 ? '<strong>Critical!</strong>' : ''}
          <a href="updatePlan.html" class="alert-link ms-2">Upgrade plan →</a>
        </div>
      `;
    }

    // No active subscription
    if (subscription.status !== 'active' || subscription.plan_type === 'free') {
      alerts += `
        <div class="alert alert-warning-custom alert-custom mb-3">
          <i class="fas fa-crown me-2"></i>
          <strong>Activate your subscription!</strong> Unlock all features.
          <a href="updatePlan.html" class="alert-link ms-2">View plans →</a>
        </div>
      `;
    }

    // Upcoming renewal
    if (metrics.renewal.daysUntil !== null && metrics.renewal.daysUntil <= 7) {
      alerts += `
        <div class="alert alert-info-custom alert-custom mb-3">
          <i class="fas fa-calendar-alt me-2"></i>
          <strong>Upcoming Renewal:</strong> Your subscription renews in ${metrics.renewal.daysUntil} day${metrics.renewal.daysUntil !== 1 ? 's' : ''}.
          <a href="billing.html" class="alert-link ms-2">View billing →</a>
        </div>
      `;
    }

    container.innerHTML = alerts;
  }

  renderActiveWidgets(data) {
    const container = document.getElementById('activeWidgetsContainer');
    if (!container) return;

    const { recentActivity } = data;
    
    if (!recentActivity || recentActivity.total_views === 0) {
      container.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
          <p class="text-muted mb-3">No recent activity for <strong>${this.currentDomain}</strong></p>
          <a href="widgetSettings.html" class="btn btn-sm" style="background: linear-gradient(135deg, #00b894, #00a884); color: white;">
            <i class="fas fa-code me-2"></i>Set up your widget
          </a>
        </div>
      `;
      return;
    }

    const html = `
      <div class="row g-3">
        <div class="col-md-3">
          <div class="metric-mini">
            <i class="fas fa-eye"></i>
            <div class="flex-grow-1">
              <div class="metric-mini-label">Total views</div>
              <div class="metric-mini-value">${parseInt(recentActivity.total_views).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="metric-mini">
            <i class="fas fa-globe"></i>
            <div class="flex-grow-1">
              <div class="metric-mini-label">Current domain</div>
              <div class="metric-mini-value" style="font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis;">${this.currentDomain}</div>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="metric-mini">
            <i class="fas fa-map-marked-alt"></i>
            <div class="flex-grow-1">
              <div class="metric-mini-label">Countries visited</div>
              <div class="metric-mini-value">${parseInt(recentActivity.countries_viewed)}</div>
            </div>
          </div>
        </div>
        <div class="col-md-3">
          <div class="metric-mini">
            <i class="fas fa-tachometer-alt"></i>
            <div class="flex-grow-1">
              <div class="metric-mini-label">Average time</div>
              <div class="metric-mini-value">${recentActivity.avg_response_time}ms</div>
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  async createUsageCharts(data) {
    try {
      const url = `/api/stats/timeline?period=30&domain=${encodeURIComponent(this.currentDomain)}`;
      const timelineData = await this.fetchData(url);
      
      this.createUsageChart(timelineData);
      this.createDistributionChart(data);
      
    } catch (error) {
      console.error('❌ Error creating charts:', error);
    }
  }

  createUsageChart(data) {
    const ctx = document.getElementById('usageChart');
    if (!ctx) return;

    if (this.charts.usageChart) {
      this.charts.usageChart.destroy();
    }

    let labels = [];
    let values = [];

    if (data.widgetUsage && data.widgetUsage.length > 0) {
      labels = data.widgetUsage.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-EN', { day: '2-digit', month: 'short' });
      });
      values = data.widgetUsage.map(d => parseInt(d.views) || 0);
    } else {
      labels = Array.from({length: 30}, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (29 - i));
        return date.toLocaleDateString('en-EN', { day: '2-digit', month: 'short' });
      });
      values = Array.from({length: 30}, () => 0);
    }

    this.charts.usageChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `${this.currentDomain}`,
          data: values,
          backgroundColor: 'rgba(0, 184, 148, 0.1)',
          borderColor: '#00b894',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  async createDistributionChart(data) {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;

    try {
      const url = `/api/stats/widgets-breakdown?period=30&domain=${encodeURIComponent(this.currentDomain)}`;
      const breakdownData = await this.fetchData(url);

      if (this.charts.distributionChart) {
        this.charts.distributionChart.destroy();
      }

      if (!breakdownData.breakdown || breakdownData.breakdown.length === 0) {
        ctx.style.display = 'none';
        const parent = ctx.parentElement;
        if (parent) {
          parent.innerHTML = `
            <div class="text-center py-5">
              <i class="fas fa-chart-pie fa-3x text-muted mb-3"></i>
              <p class="text-muted">No distribution data for ${this.currentDomain}</p>
            </div>
          `;
        }
        return;
      }

      ctx.style.display = 'block';

      const labels = breakdownData.breakdown.map(d => {
        let label = d.widget_type || 'Unknown';
        return label
          .replace('widget-', '')
          .replace('widget', 'Main')
          .replace('country', 'Country')
          .replace('eachPlace', 'Place');
      });
      
      const values = breakdownData.breakdown.map(d => parseInt(d.total_views) || 0);
      const colors = ['#00b894', '#2e5dc4ff', '#ff6b6b', '#f59e0b'];

      this.charts.distributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const total = context.dataset.data.reduce((acc, val) => acc + val, 0);
                  const value = context.dataset.data[context.dataIndex];
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${context.label}: ${percentage}%`;
                }
              }
            }
          }
        }
      });

    } catch (error) {
      console.error('Error creating distribution chart:', error);
    }
  }

  showError(message) {
    const container = document.querySelector('.container-fluid');
    if (!container) return;

    const alertHtml = `
      <div class="alert alert-danger alert-dismissible fade show" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Error:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;

    const pageHeader = container.querySelector('.page-header') || container.querySelector('h1');
    if (pageHeader) {
      pageHeader.insertAdjacentHTML('afterend', alertHtml);
    } else {
      container.insertAdjacentHTML('afterbegin', alertHtml);
    }
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    Object.values(this.charts).forEach(chart => {
      if (chart) chart.destroy();
    });
  }
}