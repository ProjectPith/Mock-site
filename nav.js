document.addEventListener("DOMContentLoaded", () => {
  const navContainer = document.getElementById("site-header-container") || document.body;

  const navHTML = `
    <header class="site-header">
      <div class="header-container">
        <div class="brand-logo">
          <a href="/index.html">Lunarcraft</a>
        </div>
        <nav class="nav-links">
          <a href="/index.html" class="nav-item">Home</a>
          <a href="/booking/booking.html" class="nav-item">Booking & Estimator</a>
          <a href="/store/store.html" class="nav-item">Store</a>
        </nav>
        <div class="nav-actions">
          <button id="cart-btn" class="nav-btn">
            Cart <span class="cart-badge" id="cart-count">0</span>
          </button>
          <button id="account-btn" class="nav-btn">Sign In</button>
        </div>
      </div>
    </header>
  `;

  if (navContainer === document.body) {
    document.body.insertAdjacentHTML("afterbegin", navHTML);
  } else {
    navContainer.innerHTML = navHTML;
  }

  // Event handlers for header buttons
  const cartBtn = document.getElementById("cart-btn");
  const accountBtn = document.getElementById("account-btn");
  const cartDrawer = document.getElementById("cart-drawer-backdrop");
  const accountDrawer = document.getElementById("account-drawer-backdrop");

  if (cartBtn && cartDrawer) {
    cartBtn.addEventListener("click", () => cartDrawer.classList.remove("hidden"));
  }

  if (accountBtn && accountDrawer) {
    accountBtn.addEventListener("click", () => accountDrawer.classList.remove("hidden"));
  }
});
