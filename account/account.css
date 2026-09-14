document.addEventListener("DOMContentLoaded", () => {
  // 1. Inject Cart Drawer Overlay into body
  const cartHTML = `
    <div id="cart-overlay" class="cart-overlay-backdrop hidden">
      <aside class="cart-overlay-panel">
        <div class="cart-overlay-header">
          <h3>Your Order Cart</h3>
          <button id="close-cart-overlay" class="cart-close-btn">✕</button>
        </div>
        <div class="cart-overlay-body">
          <p style="color: var(--text-muted); font-size: 0.9rem;">Your cart is currently empty.</p>
        </div>
        <div class="cart-overlay-footer">
          <button class="nav-btn" style="width: 100%; justify-content: center;">Proceed to Checkout →</button>
        </div>
      </aside>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", cartHTML);

  const cartOverlay = document.getElementById("cart-overlay");
  const closeBtn = document.getElementById("close-cart-overlay");

  // 2. Event delegation listener for ANY cart button clicked on the page
  document.addEventListener("click", (e) => {
    if (e.target.closest("#cart-btn")) {
      e.preventDefault();
      cartOverlay.classList.remove("hidden");
      document.body.style.overflow = "hidden"; // Lock background scroll
    }
  });

  // 3. Close Overlay Controls
  function closeCart() {
    cartOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  if (closeBtn) closeBtn.addEventListener("click", closeCart);
  if (cartOverlay) {
    cartOverlay.addEventListener("click", (e) => {
      if (e.target === cartOverlay) closeCart();
    });
  }
});
