// ==========================================
// GLOBAL STATE MANAGEMENT
// ==========================================
const state = {
  cart: JSON.parse(localStorage.getItem('cart')) || [],
  currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
  selectedService: null,
  orders: JSON.parse(localStorage.getItem('orders')) || [],
  bookings: JSON.parse(localStorage.getItem('bookings')) || []
};

// ==========================================
// GLOBAL INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", () => {

  // 1. Inject Global Header & Navigation
  const headerContainer = document.getElementById("site-header-container") || document.body;
  
  const navHTML = `
    <header class="site-header">
      <div class="brand-logo">
        <a href="/">Brand-Place-Holder</a>
      </div>
      <nav class="nav-links">
        <a href="/index.html" class="nav-item">Home</a>
        <a href="/booking/booking.html" class="nav-item">Booking & Estimator</a>
        <a href="/store/store.html" class="nav-item">Store</a>
        <button id="cart-btn" class="nav-btn">Cart <span class="cart-badge">2</span></button>
        <button id="account-btn" class="nav-btn sign-in-btn">Sign In</button>
      </nav>
    </header>

    <!-- Account Slide-Over Drawer -->
    <div id="account-drawer-backdrop" class="drawer-backdrop hidden">
      <aside id="account-drawer" class="account-drawer">
        <div class="drawer-header">
          <h3>Account & Plugins</h3>
          <button id="close-account-drawer" class="close-btn" aria-label="Close Account">✕</button>
        </div>
        <div class="drawer-body">
          <section class="account-section">
            <h4>Profile & Setup</h4>
            <p class="section-desc">Manage workspace settings and active site plugins.</p>
            
            <form id="account-setup-form" onsubmit="event.preventDefault();">
              <div class="form-group">
                <label for="acc-name">Display Name</label>
                <input type="text" id="acc-name" class="form-input" placeholder="e.g. Alex Rivera">
              </div>

              <div class="form-group">
                <label for="acc-email">Email Address</label>
                <input type="email" id="acc-email" class="form-input" placeholder="alex@domain.com">
              </div>

              <div class="plugins-section">
                <label class="group-label">Active Account Plugins</label>
                
                <label class="toggle-control">
                  <input type="checkbox" id="plugin-cal" checked>
                  <span class="toggle-label">Cal.com Booking Sync</span>
                </label>

                <label class="toggle-control">
                  <input type="checkbox" id="plugin-stripe">
                  <span class="toggle-label">Stripe Client Billing Portal</span>
                </label>
              </div>

              <button type="submit" class="btn-save-account">Save Account Settings</button>
            </form>
          </section>
        </div>
      </aside>
    </div>
  `;

  // Prepend to top of <body> if no dedicated header container exists
  if (headerContainer === document.body) {
    document.body.insertAdjacentHTML("afterbegin", navHTML);
  } else {
    headerContainer.innerHTML = navHTML;
  }

  // 2. Bind Drawer Triggers AFTER HTML is inserted into DOM
  const accountBtn = document.getElementById("account-btn");
  const accountBackdrop = document.getElementById("account-drawer-backdrop");
  const closeAccountBtn = document.getElementById("close-account-drawer");

  function openAccount() {
    if (accountBackdrop) {
      accountBackdrop.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
  }

  function closeAccount() {
    if (accountBackdrop) {
      accountBackdrop.classList.add("hidden");
      document.body.style.overflow = "";
    }
  }

  if (accountBtn) {
    accountBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openAccount();
    });
  }

  if (closeAccountBtn) closeAccountBtn.addEventListener("click", closeAccount);

  if (accountBackdrop) {
    accountBackdrop.addEventListener("click", (e) => {
      if (e.target === accountBackdrop) closeAccount();
    });
  }

});
