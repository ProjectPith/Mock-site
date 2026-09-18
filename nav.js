(function () {
  // 1. Helper function to dynamically load component CSS & JS dependencies
  function loadAsset(src, type) {
    if (type === "css") {
      if (!document.querySelector(`link[href="${src}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = src;
        document.head.appendChild(link);
      }
    } else if (type === "js") {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement("script");
        script.src = src;
        script.defer = true;
        document.head.appendChild(script);
      }
    }
  }

  // 2. Automatically pull in Cart and Account CSS + JS files
  loadAsset("https://js.stripe.com/v3/", "js");
  loadAsset("/cart/cart.css", "css");
  loadAsset("/cart/cart.js", "js");
  loadAsset("/account/account.css", "css");
  loadAsset("/account/account.js", "js");
  loadAsset("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", "js");
  
  // 3. Render Navigation Bar HTML
  document.addEventListener("DOMContentLoaded", () => {
    const navContainer = document.getElementById("site-header-container") || 
                         document.getElementById("nav-placeholder") || 
                         document.body;

    const navHTML = `
      <header class="site-header">
        <div class="header-container">
          <div class="brand-logo">
            <a href="/index.html">LunarCraft</a>
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
  });
})();

/* --- MOBILE NAVBAR STYLING --- */
@media (max-width: 600px) {
  .navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    width: 100%;
    box-sizing: border-box;
  }

  /* Shrink Logo on Mobile */
  .logo, .logo-text {
    font-size: 1.1rem !important;
    letter-spacing: -0.02em;
  }

  /* Hide Desktop Links by Default */
  .nav-links {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    background-color: #0d1117;
    border-bottom: 1px solid #30363d;
    flex-direction: column;
    padding: 1rem 0;
    z-index: 1000;
  }

  /* Revealed state when Hamburger is clicked */
  .nav-links.mobile-active {
    display: flex;
  }

  .nav-links a {
    padding: 0.75rem 1.5rem;
    width: 100%;
    box-sizing: border-box;
  }

  /* Action Icons Group (Hamburger + Cart Icon + Account Icon) */
  .nav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Icon Button Styling */
  .icon-nav-btn {
    min-width: 38px;
    height: 38px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background-color: #161b22;
    border: 1px solid #30363d;
    color: #f0f6fc;
    font-size: 1.1rem;
    cursor: pointer;
    position: relative;
  }

  /* Compact Badge on Cart Icon */
  .cart-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background-color: #1f6beb;
    color: #ffffff;
    font-size: 0.65rem;
    font-weight: bold;
    padding: 2px 5px;
    border-radius: 10px;
    line-height: 1;
  }

  /* Hide full button text labels on mobile */
  .btn-text-label {
    display: none;
  }
}

/* Hide Hamburger Toggle on Desktop */
@media (min-width: 601px) {
  .hamburger-btn {
    display: none !important;
  }
}
