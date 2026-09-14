(function () {
  // 1. Dynamically append Stripe JS if missing
  if (!document.querySelector('script[src="https://js.stripe.com/v3/"]')) {
    const stripeScript = document.createElement("script");
    stripeScript.src = "https://js.stripe.com/v3/";
    document.head.appendChild(stripeScript);
  }

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

      // Handle Checkout Trigger
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

        // Initialize Stripe here once user clicks checkout
        const stripe = Stripe("pk_test_YOUR_STRIPE_PUBLISHABLE_KEY");

        // Hide cart drawer, show stripe modal
        cartOverlay.classList.add("hidden");
        stripeModal.classList.remove("hidden");

        try {
          const response = await fetch("/api/create-checkout-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: window.cart })
          });

          const { clientSecret } = await response.json();

          const checkout = await stripe.initEmbeddedCheckout({ clientSecret });
          checkout.mount("#checkout");
        } catch (err) {
          console.error("Checkout Session Error:", err);
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
