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
  loadAsset("/cart/cart.css", "css");
  loadAsset("/cart/cart.js", "js");
  loadAsset("/account/account.css", "css");
  loadAsset("/account/account.js", "js");

  // 3. Render Navigation Bar HTML
  document.addEventListener("DOMContentLoaded", () => {
    const navContainer = document.getElementById("site-header-container") || 
                         document.getElementById("nav-placeholder") || 
                         document.body;

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
  });
})();
