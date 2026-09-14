(function () {
  function initCart() {
    if (document.getElementById("cart-overlay")) return;

    const cartHTML = `
      <div id="cart-overlay" class="cart-overlay-backdrop hidden">
        <aside class="cart-overlay-panel">
          <div class="cart-overlay-header">
            <h3>Your Order Cart</h3>
            <button id="close-cart-overlay" class="cart-close-btn" type="button">✕</button>
          </div>
          <div class="cart-overlay-body">
            <p style="color: var(--text-muted, #919bA1); font-size: 0.9rem;">Your cart is currently empty.</p>
          </div>
          <div class="cart-overlay-footer">
            <button class="nav-btn" style="width: 100%; justify-content: center;" type="button">Proceed to Checkout →</button>
          </div>
        </aside>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", cartHTML);

    const cartOverlay = document.getElementById("cart-overlay");

    // Global Click Delegation
    document.addEventListener("click", (e) => {
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
