    (function () {
  // 1. Load Stripe JS dynamically
  if (!document.querySelector('script[src="https://js.stripe.com/v3/"]')) {
    const stripeScript = document.createElement("script");
    stripeScript.src = "https://js.stripe.com/v3/";
    document.head.appendChild(stripeScript);
  }

  // 2. Global Cart State
  window.cart = JSON.parse(localStorage.getItem("lunarcraft_cart")) || [];

  // 3. Define Global Helper Functions FIRST so they exist immediately
  window.saveCart = function () {
    localStorage.setItem("lunarcraft_cart", JSON.stringify(window.cart));
    window.renderCartUI();
  };

  window.removeFromCart = function (index) {
    window.cart.splice(index, 1);
    window.saveCart();
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

  // 4. Initialize Cart UI Elements & Event Listeners
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
              <button id="checkout-btn" class="nav-btn" style="width: 100%; justify-content: center;" type="button">Proceed to Checkout →</button>
            </div>
          </aside>
        </div>

        <div id="stripe-checkout-modal" class="cart-overlay-backdrop hidden" style="z-index: 10000;">
          <div style="background: var(--bg-main, #181c20); padding: 2rem; border-radius: 8px; width: 90%; max-width: 600px; max-height: 85vh; overflow-y: auto; position: relative; border: 1px solid var(--border-subtle, #373e47);">
            <button id="close-stripe-modal" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: #fff; cursor: pointer; font-size: 1.2rem;">✕</button>
            <div id="checkout"></div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML("beforeend", cartHTML);
    }

    // Call render explicitly now that functions are defined above
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

      if (e.target.closest("#checkout-btn")) {
        e.preventDefault();

        if (!window.cart || window.cart.length === 0) {
          alert("Your cart is empty!");
          return;
        }

        if (typeof Stripe === "undefined") {
          alert("Stripe SDK is still loading. Please try again in a moment.");
          return;
        }

        // Initialize Stripe directly with your Publishable Key
        const stripe = Stripe('pk_live_YOUR_PUBLISHABLE_KEY_HERE');

        async function handleCheckout() {
        // Build line items array directly from your active cart array
          const lineItems = cart.map(item => ({
            price_data: {
            currency: 'usd',
            product_data: { name: item.name },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity || 1,
        }));

        // Redirect directly to Stripe's hosted checkout page
        const { error } = await stripe.redirectToCheckout({
          lineItems: lineItems,
          mode: 'payment',
          successUrl: `${window.location.origin}/return.html?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: window.location.href,
         });

          if (error) {
            console.error('Stripe Checkout Error:', error.message);
          }
        }
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCart);
  } else {
    initCart();
  }
})();
