document.addEventListener("DOMContentLoaded", function () {
  const navContainer = document.getElementById("nav-placeholder");
  if (!navContainer) return;

  navContainer.innerHTML = `
    <header class="navbar">
      <a href="/index.html" class="nav-brand">LunarCraft</a>
      
      <nav class="nav-links">
        <a href="/index/index.html">Home</a>
        <a href="/booking/booking.html">Booking & Estimator</a>
        <a href="/store/store.html">Store</a>
      </nav>

      <div class="nav-actions">
        <button class="cart-btn" onclick="if(typeof toggleCart === 'function') toggleCart(true)">
          Cart <span id="cart-count">0</span>
        </button>
        <div id="auth-nav-container">
          <button class="btn btn-primary" onclick="if(typeof openAuthModal === 'function') openAuthModal()">Sign In</button>
        </div>
      </div>
    </header>
  `;

  if (typeof updateCartBadge === 'function') {
    updateCartBadge();
  }
});
