// ===== pages/BillingPage.js =====
export class BillingPage {
  constructor() {
    this.currentPage = 0;
    this.pageSize = 20;
    this.totalPayments = 0;
  }

  async init() {
    const elements = {
      billingSummary: document.getElementById('billingSummary'),
      loadingSpinner: document.getElementById('loadingSpinner'),
      historyCard: document.getElementById('historyCard'),
      statusFilter: document.getElementById('statusFilter'),
      searchInput: document.getElementById('searchInput')
    };

    const missing = Object.entries(elements)
      .filter(([key, el]) => !el)
      .map(([key]) => key);

    if (missing.length > 0) {
      console.warn('⚠️ Missing elements:', missing);
    } else {
      console.log('✅ All billing elements are present');
    }
  }
}