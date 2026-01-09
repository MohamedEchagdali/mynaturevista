// ===== pages/UpdatePlanPage.js =====
import { UserService } from '../services/UserService.js';
import { AlertManager } from '../components/AlertManager.js';

export class UpdatePlanPage {
  constructor() {
    this.setupEventListeners();
  }

  async init() {
    this.setupPlanCalculator();
    this.setupPaymentMethods();
  }

  setupEventListeners() {
    const form = document.getElementById("updatePlanForm");
    if (form) {
      form.addEventListener("submit", (e) => this.handlePlanUpdate(e));
    }
  }

  setupPlanCalculator() {
    const planSelect = document.getElementById("plan");
    if (planSelect) {
      planSelect.addEventListener('change', () => this.updatePlanTotal());
      this.updatePlanTotal();
    }
  }

  updatePlanTotal() {
    const planSelect = document.getElementById("plan");
    if (!planSelect) return;
    
    const selectedOption = planSelect.options[planSelect.selectedIndex];
    const price = parseFloat(selectedOption.value || 0);
    const planType = selectedOption.dataset.type;
    const original = parseFloat(selectedOption.dataset.original || 0);
    
    const elements = {
      originalPrice: document.getElementById("originalPrice"),
      discountedPrice: document.getElementById("discountedPrice"),
      discountBadge: document.getElementById("discountBadge"),
      total: document.getElementById("total"),
      subtotal: document.getElementById("subtotal"),
      priceRow: document.getElementById("priceRow")
    };
    
    if (planType === "anual" && elements.priceRow) {
      if (elements.originalPrice) {
        elements.originalPrice.innerHTML = `<s>${original.toFixed(2)}€</s>`;
      }
      if (elements.discountedPrice) {
        elements.discountedPrice.textContent = `${price.toFixed(2)}€`;
      }
      if (elements.discountBadge) {
        elements.discountBadge.textContent = "🏷️ -20%";
      }
      elements.priceRow.style.display = "block";
    } else if (elements.priceRow) {
      elements.priceRow.style.display = "none";
    }
    
    if (elements.total) elements.total.textContent = `${price.toFixed(2)}€`;
    if (elements.subtotal) elements.subtotal.textContent = `${price.toFixed(2)}€`;
  }

  setupPaymentMethods() {
    const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
    paymentMethods.forEach(method => {
      method.addEventListener('change', () => this.togglePaymentSection());
    });
  }

  togglePaymentSection() {
    const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked');
    if (!selectedMethod) return;
    
    const method = selectedMethod.value;
    const sections = {
      cardSection: document.getElementById("cardSection"),
      paypalSection: document.getElementById("paypalSection"),
      bancontactSection: document.getElementById("bancontactSection")
    };
    
    Object.values(sections).forEach(section => {
      if (section) section.style.display = "none";
    });
    
    const targetSection = sections[method + "Section"];
    if (targetSection) {
      targetSection.style.display = "block";
    }
  }

  async handlePlanUpdate(e) {
    e.preventDefault();
    
    const formData = this.getPlanFormData();
    if (!this.validatePlanData(formData)) return;
    
    try {
      AlertManager.show('Plan updated successfully', 'success');
    } catch (error) {
      console.error('Error updating plan:', error);
      AlertManager.show('Error updating plan');
    }
  }

  getPlanFormData() {
    const planSelect = document.getElementById("plan");
    const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked');
    
    return {
      plan: planSelect ? planSelect.value : null,
      planType: planSelect ? planSelect.options[planSelect.selectedIndex].dataset.type : null,
      paymentMethod: selectedPayment ? selectedPayment.value : null,
    };
  }

  validatePlanData(data) {
    if (!data.plan) {
      AlertManager.show("Please select a plan.");
      return false;
    }
    
    if (!data.paymentMethod) {
      AlertManager.show("Please select a payment method.");
      return false;
    }
    
    return true;
  }
}