// components/SubscriptionChecker.js
import { UserService } from '../services/UserService.js';
import { AuthUtils } from '../utils/auth.js';

export class SubscriptionChecker {
  static async checkSubscriptionStatus() {
    const token = AuthUtils.getToken();

    if (!token) {
      AuthUtils.redirectToLogin();
      return false;
    }

    try {
      const data = await UserService.checkSubscriptionStatus();

      if (!data.is_subscribed) {
        this.showSubscriptionRequired();
        return false;
      }
      return true;

    } catch (error) {
      console.error('Connection error:', error);
      this.showConnectionError();
      return false;
    }
  }

static showSubscriptionRequired() {
  const modal = document.createElement('div');
  modal.innerHTML = `
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">

    <style>
      .subscription-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        z-index: 10000;
      }

      .subscription-card {
        background: rgba(255,255,255,0.95);
        border-radius: 20px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        overflow: hidden;
        animation: fadeInUp 0.5s ease;
        font-family: 'Poppins', sans-serif;
        max-width: 420px;
        width: 90%;
      }

      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .subscription-header {
        background: linear-gradient(135deg, #ff3d5d, #f1683a);
        padding: 2rem 1.5rem;
        text-align: center;
        color: white;
        position: relative;
      }

      .subscription-header .icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        animation: bounce 2s infinite;
      }

      @keyframes bounce {
        0%,20%,50%,80%,100% { transform: translateY(0); }
        40% { transform: translateY(-10px); }
        60% { transform: translateY(-5px); }
      }

      .subscription-body {
        padding: 2rem;
        text-align: center;
        color: #333;
      }

      .subscription-body p {
        color: #666;
        margin-bottom: 1.5rem;
      }

      .btn-gradient {
        background: linear-gradient(135deg, #ff3d5d, #f1683a);
        border: none;
        border-radius: 12px;
        padding: 0.75rem 1.5rem;
        font-weight: 600;
        color: white;
        transition: all 0.3s ease;
      }

      .btn-gradient:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(241, 104, 58, 0.4);
        color: white;
      }

      .btn-outline-custom {
        border: 2px solid #ff3d5d;
        background: white;
        color: #ff3d5d;
        border-radius: 12px;
        padding: 0.75rem 1.5rem;
        font-weight: 600;
        transition: all 0.3s ease;
      }

      .btn-outline-custom:hover {
        background: #ff3d5d;
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(255, 61, 93, 0.3);
      }
    </style>

    <div class="subscription-overlay">
  <div class="subscription-card">
    <div class="subscription-header">
      <div class="icon"><i class="fas fa-lock"></i></div>
      <h2>Subscription Required</h2>
      <p>Restricted Access to the Dashboard</p>
    </div>
    <div class="subscription-body">
      <p>You need an <strong>active subscription</strong> to access the dashboard.</p>
      <div class="d-flex flex-column flex-sm-row gap-2 justify-content-center">
        <a href="/dashboard/payment.html" class="btn btn-gradient w-100">
          <i class="fas fa-credit-card"></i> View Plans
        </a>
        <a href="/" class="btn btn-outline-custom w-100">
          <i class="fas fa-home"></i> Go to Home
        </a>
      </div>
    </div>
  </div>
</div>

  `;
  document.body.appendChild(modal);
}


  static showConnectionError() {
    console.error('Connection error. Please try again.');
    window.location.href = '/';
  }
}