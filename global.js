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

  // 1. Inject Global Header & Utility Drawers
  const headerContainer = document.getElementById("site-header-container") || document.body;
  
  const globalUI = `
    <header class="site-header">
      <div class="brand-logo">
        <a href="/index.html">Lunarcraft</a>
      </div>
      <nav class="nav-links">
        <a href="/index.html" class="nav-item">Home</a>
        <a href="/booking/booking.html" class="nav-item">Booking & Estimator</a>
        <a href="/store/store.html" class="nav-item">Store</a>
        <button id="cart-btn" class="nav-btn">
          Cart <span class="cart-badge" id="cart-count">2</span>
        </button>
        <button id="account-btn" class="nav-btn">Sign In</button>
      </nav>
    </header>

    <!-- Cart Drawer Overlay -->
    <div id="cart-drawer-backdrop" class="drawer-backdrop hidden">
      <aside id="cart-drawer" class="drawer-panel">
        <div class="drawer-header">
          <h3>Your Order Cart</h3>
          <button id="close-cart-drawer" class="close-btn">✕</button>
        </div>
        <div class="drawer-body">
          <div id="cart-items-container">
            <div class="cart-item">
              <div>
                <strong>LunarCraft Developer Hoodie</strong>
                <p class="item-price">$55.56</p>
              </div>
              <button class="remove-item-btn">Remove</button>
            </div>
            <div class="cart-item">
              <div>
                <strong>LunarCraft Ceramic Mug</strong>
                <p class="item-price">$12.99</p>
              </div>
              <button class="remove-item-btn">Remove</button>
            </div>
          </div>
          <div class="cart-summary">
            <div class="summary-row">
              <span>Subtotal:</span>
              <strong id="cart-subtotal">$68.55</strong>
            </div>
            <button class="card-btn">Proceed to Checkout →</button>
          </div>
        </div>
      </aside>
    </div>

    <!-- Client Account / Portal Drawer Overlay -->
    <div id="account-drawer-backdrop" class="drawer-backdrop hidden">
      <aside id="account-drawer" class="drawer-panel">
        <div class="drawer-header">
          <h3>Client Portal & Workspace</h3>
          <button id="close-account-drawer" class="close-btn">✕</button>
        </div>
        <div class="drawer-body">
          <section class="account-section">
            <h4>Client Authentication</h4>
            <p class="section-desc">Sign in to access custom build estimates, saved spec forms, and contract drafts.</p>
            
            <form id="client-login-form" onsubmit="event.preventDefault();">
              <div class="form-group">
                <label for="client-email">Client Email</label>
                <input type="email" id="client-email" class="form-control" placeholder="client@company.com" required>
              </div>

              <div class="form-group">
                <label for="client-pass">Password / Project Code</label>
                <input type="password" id="client-pass" class="form-control" placeholder="••••••••" required>
              </div>

              <button type="submit" class="card-btn">Sign In to Workspace</button>
            </form>

            <div class="drawer-divider"></div>

            <div class="option-card">
              <h4>📋 Project Spec Intake</h4>
              <p>Looking for a custom site architecture build? Submit your specifications directly through our intake portal.</p>
              <a href="/intake/intake.html" class="card-link">Start Spec Build →</a>
            </div>
          </section>
        </div>
      </aside>
    </div>
  `;

  if (headerContainer === document.body) {
    document.body.insertAdjacentHTML("afterbegin", globalUI);
  } else {
    headerContainer.innerHTML = globalUI;
  }

  // 2. Event Listener Bindings
  function toggleDrawer(backdropEl, forceOpen) {
    if (!backdropEl) return;
    if (forceOpen) {
      backdropEl.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    } else {
      backdropEl.classList.add("hidden");
      document.body.style.overflow = "";
    }
  }

  // Account Drawer
  const accountBtn = document.getElementById("account-btn");
  const accountBackdrop = document.getElementById("account-drawer-backdrop");
  const closeAccountBtn = document.getElementById("close-account-drawer");

  if (accountBtn) accountBtn.addEventListener("click", () => toggleDrawer(accountBackdrop, true));
  if (closeAccountBtn) closeAccountBtn.addEventListener("click", () => toggleDrawer(accountBackdrop, false));
  if (accountBackdrop) {
    accountBackdrop.addEventListener("click", (e) => {
      if (e.target === accountBackdrop) toggleDrawer(accountBackdrop, false);
    });
  }

  // Cart Drawer
  const cartBtn = document.getElementById("cart-btn");
  const cartBackdrop = document.getElementById("cart-drawer-backdrop");
  const closeCartBtn = document.getElementById("close-cart-drawer");

  if (cartBtn) cartBtn.addEventListener("click", () => toggleDrawer(cartBackdrop, true));
  if (closeCartBtn) closeCartBtn.addEventListener("click", () => toggleDrawer(cartBackdrop, false));
  if (cartBackdrop) {
    cartBackdrop.addEventListener("click", (e) => {
      if (e.target === cartBackdrop) toggleDrawer(cartBackdrop, false);
    });
  }

});
