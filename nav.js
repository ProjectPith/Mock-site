(function () {
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

  loadAsset("/nav.css", "css");
  loadAsset("https://js.stripe.com/v3/", "js");
  loadAsset("/cart/cart.css", "css");
  loadAsset("/cart/cart.js", "js");
  loadAsset("/account/account.css", "css");
  loadAsset("/account/account.js", "js");
  loadAsset("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", "js");
  loadAsset("/ai/ai.js", "js");

  document.addEventListener("DOMContentLoaded", () => {
    let navContainer = document.getElementById("nav-container") || 
                         document.getElementById("site-header-container") || 
                         document.getElementById("nav-placeholder");

    if (!navContainer) {
      navContainer = document.createElement("div");
      document.body.insertAdjacentElement("afterbegin", navContainer);
    }
    navContainer.id = "nav-container";

    const navHTML = `
      <header class="site-header">
        <div class="header-container">
          <div class="brand-logo">
            <a href="/index.html">LunarCraft</a>
          </div>

          <nav class="nav-links desktop-only">
            <a href="/index.html" class="nav-item">Home</a>
            <a href="/booking/booking.html" class="nav-item">Booking & Estimator</a>
            <a href="/store/store.html" class="nav-item">Store</a>
          </nav>

          <div class="nav-actions">
            <button id="ai-assistant-btn" class="nav-btn icon-nav-btn ai-nav-btn" aria-label="Open AI assistant" type="button" hidden>
              <span class="icon-symbol" aria-hidden="true">✦</span>
              <span class="btn-text-label">AI</span>
            </button>

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

      <div id="nav-drawer-overlay" class="drawer-overlay"></div>
      <aside id="nav-side-drawer" class="nav-side-drawer">
        <div class="drawer-header">
          <h3>Menu</h3>
          <button id="close-nav-drawer" class="close-btn">&times;</button>
        </div>
        <nav class="drawer-links">
          <a href="/index.html" class="drawer-item">Home</a>
          <a href="/booking/booking.html" class="drawer-item">Booking & Estimator</a>
          <a href="/store/store.html" class="drawer-item">Store</a>
        </nav>
      </aside>
    `;

    navContainer.innerHTML = navHTML;

    // --- PROTECT ACCOUNT BUTTON STRUCTURE ---
    const accountBtn = document.getElementById("account-btn");
    if (accountBtn) {
      const lockAccountMarkup = () => {
        // If account.js stripped the icon-symbol, put it back while preserving dynamic text
        if (!accountBtn.querySelector(".icon-symbol")) {
          const currentText = accountBtn.textContent.trim();
          accountBtn.innerHTML = `
            <span class="icon-symbol">👤</span>
            <span class="btn-text-label">${currentText || "Account"}</span>
          `;
        }
      };

      // Watch for dynamic DOM text updates from account.js
      const observer = new MutationObserver(() => {
        observer.disconnect(); // Pause observer to prevent recursive loops
        lockAccountMarkup();
        observer.observe(accountBtn, { childList: true, subtree: true });
      });

      observer.observe(accountBtn, { childList: true, subtree: true });
    }

    // --- DRAWER TOGGLE HANDLERS ---
    const hamburgerBtn = document.getElementById("hamburger-btn");
    const closeBtn = document.getElementById("close-nav-drawer");
    const drawer = document.getElementById("nav-side-drawer");
    const overlay = document.getElementById("nav-drawer-overlay");

    function openDrawer() {
      drawer.classList.add("open");
      overlay.classList.add("open");
    }

    function closeDrawer() {
      drawer.classList.remove("open");
      overlay.classList.remove("open");
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener("click", openDrawer);
    if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
    if (overlay) overlay.addEventListener("click", closeDrawer);
  });
})();
