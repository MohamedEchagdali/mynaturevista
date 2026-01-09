// pages/ChartsPage.js - IMPROVED VERSION WITH OPENINGS AND NAVIGATION
export class ChartsPage {
  constructor() {
    this.charts = {};
    this.currentPeriod = 30;
    this.selectedDomain = 'global';
    this.availableDomains = [];
    this.isLoading = false;
  }

  async init() {
    await this.loadDomains();
    this.addControls();
    await this.loadAllStats();
    setInterval(() => this.loadAllStats(), 5 * 60 * 1000);
  }

  async loadDomains() {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/stats/domains?period=90', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        this.availableDomains = data.domains || [];
      }
    } catch (error) {
      console.error('❌ Error loading domains:', error);
    }
  }

  addControls() {
    const container = document.querySelector('.page-header .d-flex') 
                   || document.querySelector('.container-fluid');
    
    if (!container) return;

    const existingControls = document.getElementById('statsControls');
    if (existingControls) existingControls.remove();

    const domainOptions = this.availableDomains.length > 0
      ? this.availableDomains.map(d => {
          const icon = d.type === 'primary' ? '⭐' : '📍';
          const views = parseInt(d.total_views) || 0;
          const label = views > 0 
            ? `${icon} ${d.domain} (${views.toLocaleString()} views)`
            : `${icon} ${d.domain} (no data)`;
          
          return `<option value="${d.domain}">${label}</option>`;
        }).join('')
      : '<option value="" disabled>No domains configured</option>';

    const controlsHtml = `
      <div id="statsControls" class="d-flex gap-3 align-items-center flex-wrap mb-3">
        <div class="form-group mb-0">
          <label class="small mb-1" for="domainSelector">
            <i class="fas fa-globe me-1"></i> Domain
          </label>
          <select id="domainSelector" class="form-select form-select-sm" ${this.availableDomains.length === 0 ? 'disabled' : ''}>
            <option value="global">🌍 Global (All)</option>
            ${domainOptions}
          </select>
        </div>
        
        <div class="form-group mb-0">
          <label class="small mb-1" for="periodSelector">
            <i class="fas fa-calendar me-1"></i> Period
          </label>
          <select id="periodSelector" class="form-select form-select-sm">
            <option value="7">Last 7 days</option>
            <option value="30" selected>Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>

        <button class="btn btn-sm btn-outline-primary align-self-end" onclick="chartsPageInstance.refreshStats()">
          <i class="fas fa-sync-alt me-1"></i> Refresh
        </button>
      </div>
    `;
    
    const pageHeader = document.querySelector('.page-header');
    if (pageHeader) {
      pageHeader.insertAdjacentHTML('afterend', controlsHtml);
    } else {
      container.insertAdjacentHTML('afterbegin', controlsHtml);
    }
    
    document.getElementById('periodSelector')?.addEventListener('change', async (e) => {
      this.currentPeriod = parseInt(e.target.value);
      await this.loadAllStats();
    });

    document.getElementById('domainSelector')?.addEventListener('change', async (e) => {
      this.selectedDomain = e.target.value;
      await this.loadAllStats();
    });
  }

  async refreshStats() {
    await this.loadDomains();
    this.addControls();
    await this.loadAllStats();
  }

  async loadAllStats() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/dashboard/loginSignup.html';
        return;
      }

      this.showLoading();

      let domainParam = this.selectedDomain;
      if (domainParam !== 'global') {
        domainParam = domainParam
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/$/, '')
          .trim()
          .toLowerCase();
      }

      const params = new URLSearchParams({
        period: this.currentPeriod,
        ...(domainParam !== 'global' && { domain: domainParam })
      });

      const [overview, timeline, breakdown, performance] = await Promise.all([
        this.fetchStats(`/api/stats/overview?${params}`),
        this.fetchStats(`/api/stats/timeline?${params}`),
        this.fetchStats(`/api/stats/widgets-breakdown?${params}`),
        this.fetchStats(`/api/stats/performance?${params}`)
      ]);

      this.hideLoading();

      this.updateOverviewCards(overview);
      this.updateAreaChart(timeline);
      this.updateBarChart(breakdown);
      this.updatePieChart(breakdown);
      this.updatePerformanceInfo(performance);
      this.updateFilterBadge();
    } catch (error) {
      console.error('❌ Error loading statistics:', error);
      this.hideLoading();
      this.showError('Error loading statistics. ' + error.message);
    } finally {
      this.isLoading = false;
    }
  }

  updateFilterBadge() {
    const container = document.querySelector('.page-header h1');
    if (!container) return;

    const oldBadge = container.querySelector('.filter-badge');
    if (oldBadge) oldBadge.remove();

    if (this.selectedDomain !== 'global') {
      const domainInfo = this.availableDomains.find(d => d.domain === this.selectedDomain);
      const badge = `
        <span class="filter-badge badge bg-info ms-2">
          <i class="fas fa-filter me-1"></i>
          ${this.selectedDomain}
          ${domainInfo ? `(${parseInt(domainInfo.total_views).toLocaleString()} views)` : ''}
        </span>
      `;
      container.insertAdjacentHTML('beforeend', badge);
    }
  }

  async fetchStats(endpoint) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error at ${endpoint}:`, errorText);
      throw new Error(`${response.status}: ${response.statusText}`);
    }

    return await response.json();
  }

updateOverviewCards(data) {
  
  // Domain indicator if there's a filter
  const domainIndicator = this.selectedDomain !== 'global' 
    ? `<small class="text-muted d-block mt-1">Domain: ${this.selectedDomain}</small>`
    : '';
  
  // 1. Openings (with limit and progress)
  const openingsEl = document.getElementById('stat-openings');
  const openingsLimitEl = document.getElementById('stat-openings-limit');
  const openingsProgressEl = document.getElementById('progress-openings');
  
  if (openingsEl && data.widgets) {
    const openings = parseInt(data.widgets.totalOpenings) || 0;
    const limit = parseInt(data.widgets.openingsLimit) || 1000;
    const percentage = limit > 0 ? Math.min((openings / limit) * 100, 100) : 0;
    
    openingsEl.textContent = openings.toLocaleString();
    if (openingsLimitEl) {
      openingsLimitEl.innerHTML = `of ${limit.toLocaleString()} available<br>
        <small class="text-muted" style="font-size: 0.75rem;">Last ${this.currentPeriod} days</small>`;
    }
    if (openingsProgressEl) {
      openingsProgressEl.style.width = `${percentage}%`;
      
      // Change color based on percentage
      if (percentage >= 90) {
        openingsProgressEl.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
      } else if (percentage >= 75) {
        openingsProgressEl.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
      } else {
        openingsProgressEl.style.background = 'linear-gradient(90deg, #00b894, #00a884)';
      }
    }
  }

  // 2. Internal navigation
  const internalNavEl = document.getElementById('stat-internal-nav');
  const internalNavSubEl = internalNavEl?.parentElement.querySelector('div:last-child');
  
  if (internalNavEl && data.widgets) {
    const internalNav = parseInt(data.widgets.internalNavigation) || 0;
    internalNavEl.textContent = internalNav.toLocaleString();
    
    // Update the text below with the period
    if (internalNavSubEl) {
      internalNavSubEl.innerHTML = `Clicks within widget<br>
        <small class="text-muted" style="font-size: 0.75rem;">Last ${this.currentPeriod} days</small>`;
    }
  }

  // 3. Response time
  const responseTimeEl = document.getElementById('stat-response-time');
  const responseTimeSubEl = responseTimeEl?.parentElement.querySelector('div:last-child');
  
  if (responseTimeEl && data.widgets) {
    const avgTime = parseInt(data.widgets.avgResponseTime) || 0;
    responseTimeEl.textContent = avgTime;
    
    if (responseTimeSubEl) {
      responseTimeSubEl.innerHTML = `Milliseconds<br>
        <small class="text-muted" style="font-size: 0.75rem;">Last ${this.currentPeriod} days</small>`;
    }
  }

  // 4. Active days
  const activeDaysEl = document.getElementById('stat-active-days');
  const activeDaysLimitEl = document.getElementById('stat-active-days-limit');
  
  if (activeDaysEl && data.widgets) {
    const activeDays = parseInt(data.widgets.activeDays) || 0;
    activeDaysEl.textContent = activeDays;
    if (activeDaysLimitEl) {
      activeDaysLimitEl.innerHTML = `Out of ${this.currentPeriod} possible<br>
        <small class="text-muted" style="font-size: 0.75rem;">Last ${this.currentPeriod} days</small>`;
    }
  }
}

  updateAreaChart(data) {
    const ctx = document.getElementById('myAreaChart');
    if (!ctx) {
      console.warn('⚠️ Canvas myAreaChart not found');
      return;
    }

    if (!data.widgetUsage || data.widgetUsage.length === 0) {
      console.warn('⚠️ No widgetUsage data');
      this.showEmptyChart(ctx, 'No usage data available for this period');
      return;
    }

    // Prepare widget-only data
    const sortedDates = data.widgetUsage.map(d => d.date).sort();
    
    const labels = sortedDates.map(date => {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const widgetMap = new Map(data.widgetUsage.map(d => [d.date, parseInt(d.views) || 0]));
    const widgetData = sortedDates.map(date => widgetMap.get(date) || 0);

    ctx.style.display = 'block';
    
    const emptyMsg = ctx.parentElement.querySelector('.empty-chart-message');
    if (emptyMsg) emptyMsg.remove();

    if (this.charts.areaChart) {
      this.charts.areaChart.destroy();
    }

    const chartTitle = this.selectedDomain !== 'global' 
      ? `Usage Evolution - ${this.selectedDomain}`
      : 'Usage Evolution - Global';

    this.charts.areaChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Widget Views',
          data: widgetData,
          backgroundColor: 'rgba(0, 184, 148, 0.1)',
          borderColor: 'rgba(0, 184, 148, 1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(0, 184, 148, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2
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
            intersect: false,
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#ddd',
            borderWidth: 1
          },
          title: {
            display: true,
            text: chartTitle,
            font: { size: 14, weight: 'normal' },
            color: '#6c757d'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toLocaleString();
              }
            },
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  updateBarChart(data) {
    const ctx = document.getElementById('myBarChart');
    if (!ctx) {
      console.warn('⚠️ Canvas myBarChart not found.');
      return;
    }

    if (!data.breakdown || data.breakdown.length === 0) {
      console.warn('⚠️ No data');
      this.showEmptyChart(ctx, 'No widget data available');
      return;
    }

    const labels = data.breakdown.map(d => {
      let label = d.widget_type || 'Unknown';
      return label
        .replace('widget-', '')
        .replace('widget', 'Main')
        .replace('country', 'Country')
        .replace('eachPlace', 'Place')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    });
    
    const views = data.breakdown.map(d => parseInt(d.total_views) || 0);
    
    const colors = [
      'rgba(0, 184, 148, 0.8)',
      'rgba(255, 107, 107, 0.8)',
      'rgba(74, 144, 226, 0.8)',
      'rgba(245, 176, 65, 0.8)',
      'rgba(155, 89, 182, 0.8)'
    ];

    ctx.style.display = 'block';
    
    const emptyMsg = ctx.parentElement.querySelector('.empty-chart-message');
    if (emptyMsg) emptyMsg.remove();

    if (this.charts.barChart) {
      this.charts.barChart.destroy();
    }

    this.charts.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Views',
          data: views,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: colors.slice(0, labels.length).map(c => c.replace('0.8', '1')),
          borderWidth: 2,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#ddd',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                return `Views: ${context.parsed.y.toLocaleString()}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toLocaleString();
              }
            },
            grid: {
              color: 'rgba(0,0,0,0.05)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });

    const header = ctx.closest('.card').querySelector('.card-header');
    if (header) {
      const totalViews = views.reduce((sum, v) => sum + v, 0);
      header.innerHTML = `
        <i class="fas fa-chart-bar me-1"></i>
        Usage by Widget Type
        <span class="badge bg-light text-dark ms-2">${totalViews.toLocaleString()} total</span>
      `;
    }

  }

  updatePieChart(data) {
    const ctx = document.getElementById('myPieChart');
    if (!ctx) return;

    if (!data.breakdown || data.breakdown.length === 0) {
      this.showEmptyChart(ctx, 'No distribution data available');
      return;
    }

    const labels = data.breakdown.map(d => {
      let label = d.widget_type || 'Unknown';
      return label
        .replace('widget-', '')
        .replace('widget', 'Main')
        .replace('country', 'Country')
        .replace('eachPlace', 'Place')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    });
    
    const views = data.breakdown.map(d => parseInt(d.total_views) || 0);
    
    const colors = [
      'rgba(0, 184, 148, 1)',
      'rgba(255, 107, 107, 1)',
      'rgba(74, 144, 226, 1)',
      'rgba(245, 176, 65, 1)',
      'rgba(155, 89, 182, 1)'
    ];

    ctx.style.display = 'block';
    
    const emptyMsg = ctx.parentElement.querySelector('.empty-chart-message');
    if (emptyMsg) emptyMsg.remove();

    if (this.charts.pieChart) {
      this.charts.pieChart.destroy();
    }

    this.charts.pieChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: views,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#fff',
          borderWidth: 3,
          hoverBorderWidth: 4,
          hoverBorderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#ddd',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                return `${context.label}: ${context.parsed.toLocaleString()} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  updatePerformanceInfo(data) {
    const container = document.querySelector('.container-fluid');
    let performanceCard = document.getElementById('performanceTable');

    if (!performanceCard) {
      const cardHtml = `
        <div class="card mb-4">
          <div class="card-header">
            <i class="fas fa-tachometer-alt me-2"></i>
            Performance by Hour of Day
          </div>
          <div class="card-body">
            <div class="table-responsive">
              <table class="table table-sm table-hover" id="performanceTable">
                <thead>
                  <tr>
                    <th>Hour</th>
                    <th>Requests</th>
                    <th>Average Time</th>
                    <th>Range</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      `;
      
      const tipsCard = container.querySelector('.card.mb-4:last-child');
      if (tipsCard) {
        tipsCard.insertAdjacentHTML('beforebegin', cardHtml);
      } else {
        container.insertAdjacentHTML('beforeend', cardHtml);
      }
      performanceCard = document.getElementById('performanceTable');
    }

    const tbody = performanceCard.querySelector('tbody');
    if (tbody) {
      if (!data.hourlyPerformance || data.hourlyPerformance.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center text-muted py-4">
              <i class="fas fa-info-circle me-2"></i>
              No performance data available
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = data.hourlyPerformance.map(row => `
          <tr>
            <td><strong>${String(row.hour).padStart(2, '0')}:00</strong></td>
            <td>
              <span class="badge bg-info">${parseInt(row.requests).toLocaleString()}</span>
            </td>
            <td>
              <span class="badge ${this.getResponseTimeBadgeClass(row.avg_response_time)}">
                ${row.avg_response_time}ms
              </span>
            </td>
            <td>
              <small class="text-muted">
                ${row.min_response_time}ms - ${row.max_response_time}ms
              </small>
            </td>
          </tr>
        `).join('');
      }
    }
  }

  getResponseTimeBadgeClass(time) {
    if (time < 100) return 'bg-success';
    if (time < 300) return 'bg-warning';
    return 'bg-danger';
  }

  showLoading() {
    const cards = document.querySelectorAll('.stat-card .card-body');
    cards.forEach(card => {
      const statNumber = card.querySelector('.stat-number');
      if (statNumber && !statNumber.querySelector('.loading-skeleton')) {
        statNumber.innerHTML = '<div class="loading-skeleton" style="height: 2rem; width: 80px;"></div>';
      }
    });
  }

  hideLoading() {
    // Loading disappears when real data is updated
  }

  showEmptyChart(canvas, message) {
    const parent = canvas.parentElement;
    if (!parent) return;
    
    parent.style.position = 'relative';
    parent.style.minHeight = '300px';
    
    canvas.style.display = 'none';
    
    const existingMsg = parent.querySelector('.empty-chart-message');
    if (existingMsg) existingMsg.remove();
    
    parent.insertAdjacentHTML('beforeend', `
      <div class="empty-chart-message text-center py-5">
        <i class="fas fa-chart-line fa-3x text-muted mb-3" style="opacity: 0.3;"></i>
        <p class="text-muted">${message}</p>
        <small class="text-muted">Data will appear once your widget is used.</small>
      </div>
    `);
  }

  showError(message) {
    this.hideLoading();
    const container = document.querySelector('.container-fluid');
    
    document.querySelectorAll('.alert-danger.auto-dismiss').forEach(el => el.remove());
    
    const alertHtml = `
      <div class="alert alert-danger alert-dismissible fade show auto-dismiss" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Error:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      </div>
    `;
    
    const h1 = container.querySelector('h1');
    if (h1) {
      h1.insertAdjacentHTML('afterend', alertHtml);
    } else {
      container.insertAdjacentHTML('afterbegin', alertHtml);
    }

    setTimeout(() => {
      const alert = container.querySelector('.alert-danger.auto-dismiss');
      if (alert) alert.remove();
    }, 10000);
  }

  async exportData(type = 'widget') {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        type,
        period: this.currentPeriod,
        ...(this.selectedDomain !== 'global' && { domain: this.selectedDomain })
      });

      const response = await fetch(`/api/stats/export?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 429) {
        const errorData = await response.json();
        
        const container = document.querySelector('.container-fluid');
        const warningHtml = `
          <div class="alert alert-warning alert-dismissible fade show" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Export limit reached</strong><br>
            ${errorData.message || 'You have exceeded the export limit. Please wait 15 minutes.'}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
          </div>
        `;
        container.insertAdjacentHTML('afterbegin', warningHtml);
        
        setTimeout(() => {
          const alert = container.querySelector('.alert-warning');
          if (alert) alert.remove();
        }, 10000);
        
        return;
      }

      if (response.status === 404) {
        const errorData = await response.json();
        this.showError(errorData.message || 'No data available for export');
        return;
      }

      if (!response.ok) {
        throw new Error('Error exporting data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stats-${type}-${this.selectedDomain}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      const cacheStatus = response.headers.get('X-Cache');
      const recordCount = response.headers.get('X-Record-Count');
      
      const container = document.querySelector('.container-fluid');
      const successHtml = `
        <div class="alert alert-success alert-dismissible fade show" role="alert">
          <i class="fas fa-check-circle me-2"></i>
          <strong>Export successful!</strong>
          ${recordCount ? ` ${parseInt(recordCount).toLocaleString()} records exported.` : ''}
          ${cacheStatus === 'HIT' ? ' <span class="badge bg-info">From cache</span>' : ''}
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
      `;
      container.insertAdjacentHTML('afterbegin', successHtml);
      
      setTimeout(() => {
        const alert = container.querySelector('.alert-success');
        if (alert) alert.remove();
      }, 5000);
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      this.showError('Could not export data');
    }
  }
}