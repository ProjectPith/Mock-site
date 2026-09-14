(function () {
  // Global cart state in localStorage
  window.cart = JSON.parse(localStorage.getItem("lunarcraft_cart")) || [];

  window.saveCart = function () {
    localStorage.setItem("lunarcraft_cart", JSON.stringify(window.cart));
    window.renderCartUI();
  };

  window.renderCartUI = function () {
  const badge = document.getElementById("cart-count");
  const cartBody = document.querySelector(".cart-overlay-body");

  const totalCount = window.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  if (badge) badge.innerText = totalCount;

  if (!cartBody) return;

  if (window.cart.length === 0) {
    cartBody.innerHTML = `<p style="color: var(--text-muted, #919bA1); font-size: 0.9rem;">Your cart is currently empty.</p>`;
    return;
  }

  let html = `<ul style="list-style: none; padding: 0; margin: 0;">`;
  let subtotal = 0;

  window.cart.forEach((item, index) => {
    // Parse price safely, fallback to 0 if NaN
    const rawPrice = parseFloat(item.price);
    const validPrice = isNaN(rawPrice) ? 0 : rawPrice;
    const itemTotal = validPrice * (item.quantity || 1);
    
    subtotal += itemTotal;

    html += `
      <li style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle, #373e47); padding-bottom: 0.5rem;">
        <div>
          <strong style="color: var(--text-main, #e6edf3); font-size: 0.95rem;">${item.title || 'Product'}</strong>
          <div style="color: var(--text-muted, #919bA1); font-size: 0.85rem;">$${validPrice.toFixed(2)} x ${item.quantity || 1}</div>
        </div>
        <button onclick="window.removeFromCart(${index})" style="background: none; border: none; color: #f85149; cursor: pointer;">✕</button>
      </li>
    `;
  });

  html += `</ul>`;
  html += `
    <div style="margin-top: 1rem; font-weight: bold; color: var(--text-main, #e6edf3); display: flex; justify-content: space-between;">
      <span>Total:</span>
      <span style="color: var(--sky-blue, #88c0d0);">$${subtotal.toFixed(2)}</span>
    </div>
  `;

  cartBody.innerHTML = html;
};

  window.removeFromCart = function (index) {
    window.cart.splice(index, 1);
    window.saveCart();
  };

  function initCart() {
    if (!document.getElementById("cart-overlay")) {
      const cartHTML = `
        <div id="cart-overlay" class="cart-overlay-backdrop hidden">
          <aside class="cart-overlay-panel">
            <div class="cart-overlay-header">
              <h3>Your Order Cart</h3>
              <button id="close-cart-overlay" class="cart-close-btn" type="button">✕</button>
            </div>
            <div class="cart-overlay-body"></div>
            <div class="cart-overlay-footer">
              <button class="nav-btn" style="width: 100%; justify-content: center;" type="button">Proceed to Checkout →</button>
            </div>
          </aside>
        </div>
      `;
      document.body.insertAdjacentHTML("beforeend", cartHTML);
    }

    window.renderCartUI();

    // Event Delegation
    document.addEventListener("click", (e) => {
      const cartOverlay = document.getElementById("cart-overlay");
      
      if (e.target.closest("#cart-btn")) {
        e.preventDefault();
        cartOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
      }

      if (e.target.closest("#close-cart-overlay") || e.target === cartOverlay) {
        cartOverlay.classList.add("hidden");
        document.body.style.overflow = "";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCart);
  } else {
    initCart();
  }
})();

(function () {
  // Initialize Stripe with your Publishable Key (pk_live_... or pk_test_...)
  const stripe = Stripe("pk_test_YOUR_STRIPE_PUBLISHABLE_KEY");

  function initCart() {
    if (!document.getElementById("cart-overlay")) {
      const cartHTML = `
        <!-- Main Cart Drawer -->
        <div id="cart-overlay" class="cart-overlay-backdrop hidden">
          <aside class="cart-overlay-panel">
            <div class="cart-overlay-header">
              <h3>Your Order Cart</h3>
              <button id="close-cart-overlay" class="cart-close-btn" type="button">✕</button>
            </div>
            <div class="cart-overlay-body"></div>
            <div class="cart-overlay-footer">
              <button id="checkout-btn" class="nav-btn" style="width: 100%; justify-content: center;" type="button">Proceed to Checkout →</button>
            </div>
          </aside>
        </div>

        <!-- Embedded Stripe Checkout Modal Container -->
        <div id="stripe-checkout-modal" class="cart-overlay-backdrop hidden" style="z-index: 10000;">
          <div style="background: var(--bg-main, #181c20); padding: 2rem; border-radius: 8px; width: 90%; max-width: 600px; max-height: 85vh; overflow-y: auto; position: relative; border: 1px solid var(--border-subtle, #373e47);">
            <button id="close-stripe-modal" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: #fff; cursor: pointer; font-size: 1.2rem;">✕</button>
            <div id="checkout"></div> <!-- Stripe mounts here -->
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML("beforeend", cartHTML);
    }

    window.renderCartUI();

    // Event Delegation
    document.addEventListener("click", async (e) => {
      const cartOverlay = document.getElementById("cart-overlay");
      const stripeModal = document.getElementById("stripe-checkout-modal");

      if (e.target.closest("#cart-btn")) {
        e.preventDefault();
        cartOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
      }

      if (e.target.closest("#close-cart-overlay") || e.target === cartOverlay) {
        cartOverlay.classList.add("hidden");
        document.body.style.overflow = "";
      }

      if (e.target.closest("#close-stripe-modal") || e.target === stripeModal) {
        stripeModal.classList.add("hidden");
        document.body.style.overflow = "";
      }

      // Handle Embedded Checkout Trigger
      if (e.target.closest("#checkout-btn")) {
        e.preventDefault();

        if (!window.cart || window.cart.length === 0) {
          alert("Your cart is empty!");
          return;
        }

        // Hide cart drawer, show stripe modal
        cartOverlay.classList.add("hidden");
        stripeModal.classList.remove("hidden");

        // Fetch client Secret from your Cloudflare Worker / backend endpoint
        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: window.cart })
        });

        const { clientSecret } = await response.json();

        // Initialize Embedded Checkout
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret });
        checkout.mount("#checkout");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCart);
  } else {
    initCart();
  }
})();
