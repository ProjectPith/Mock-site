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

  // 2. Global Event Delegation: Intercept clicks anywhere on the document
  document.addEventListener("click", (e) => {
    // Check if the clicked element (or its parent) matches #cart-btn
    const cartButton = e.target.closest("#cart-btn");
    if (cartButton) {
      e.preventDefault();
      cartOverlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
  });

  // 3. Close Overlay Handlers
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
