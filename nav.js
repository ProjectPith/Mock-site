(function () {
  // 1. Dependency Loader
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

  // Load Component Assets
  loadAsset("/nav.css", "css");
  loadAsset("https://js.stripe.com/v3/", "js");
  loadAsset("/cart/cart.css", "css");
  loadAsset("/cart/cart.js", "js");
  loadAsset("/account/account.css", "css");
  loadAsset("/account/account.js", "js");
  loadAsset("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", "js");

  // 2. Render Single Unified Nav Header
  document.addEventListener("DOMContentLoaded", () => {
    // Find target wrapper, or create a default wrapper at top of body
    let navContainer = document.getElementById("nav-container") || 
                         document.getElementById("site-header-container") || 
                         document.getElementById("nav-placeholder");

    if (!navContainer) {
      navContainer = document.createElement("div");
      navContainer.id = "nav-container";
      document.body.insertAdjacentElement("afterbegin", navContainer);
    } else {
      navContainer.id = "nav-container"; // Ensure ID matches nav.css selectors
    }

    const navHTML = `
      <header class="site-header">
        <div class="header-container">
          <div class="brand-logo">
            <a href="/index.html">LunarCraft</a>
          </div>

          <nav class="nav-links" id="mobile-nav-menu">
            <a href="/index.html" class="nav-item">Home</a>
            <a href="/booking/booking.html" class="nav-item">Booking & Estimator</a>
            <a href="/store/store.html" class="nav-item">Store</a>
          </nav>

          <div class="nav-actions">
            <button id="cart-btn" class="nav-btn icon-nav-btn" aria-label="Cart" type="button">
              <span class="icon-symbol">🛒</span>
              <span class="btn-text-label">Cart</span>
              <span class="cart-badge" id="cart-count">0</span>
            </button>

            <button id="account-btn" class="nav-btn icon-nav-btn" aria-label="Account" type="button">
              <span class="icon-symbol">👤</span>
              <span class="btn-text-label">Sign In</span>
            </button>

            <button id="hamburger-btn" class="nav-btn icon-nav-btn hamburger-btn" aria-label="Toggle Menu" type="button">
              <span class="icon-symbol">☰</span>
            </button>
          </div>
        </div>
      </header>
    `;

    navContainer.innerHTML = navHTML;

    // 3. Hamburger Toggle Event Listener
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const navLinks = document.getElementById("mobile-nav-menu");

    if (hamburgerBtn && navLinks) {
      hamburgerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        navLinks.classList.toggle("mobile-active");
      });

      // Close mobile dropdown when clicking anywhere else
      document.addEventListener("click", (e) => {
        if (!hamburgerBtn.contains(e.target) && !navLinks.contains(e.target)) {
          navLinks.classList.remove("mobile-active");
        }
      });
    }
  });
})();
