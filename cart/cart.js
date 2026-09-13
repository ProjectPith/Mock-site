// ==========================================
// CART & AUTHENTICATION OVERLAYS
// ==========================================
function updateCartUI() {
  const totalCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const cartCountEl = document.getElementById('cart-count');
  if (cartCountEl) cartCountEl.innerText = totalCount;

  const cartContainer = document.getElementById('cart-items');
  if (cartContainer) {
    if (state.cart.length === 0) {
      cartContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Cart is empty.</p>`;
    } else {
      cartContainer.innerHTML = state.cart.map(item => `
        <div class="cart-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <div>
            <strong>${item.title}</strong><br>
            <small style="color: var(--text-muted);">$${item.price} × ${item.qty}</small>
          </div>
          <button class="close-btn" onclick="removeFromCart('${item.id}')">&times;</button>
        </div>
      `).join('');
    }
  }

  const totalPrice = state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartTotalEl = document.getElementById('cart-total-price');
  if (cartTotalEl) cartTotalEl.innerText = `$${totalPrice.toFixed(2)}`;
}

function removeFromCart(id) {
  state.cart = state.cart.filter(item => item.id !== id);
  saveCart();
  updateCartUI();
}

function toggleCart(forceOpen = false) {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer || !overlay) return;

  if (forceOpen || !drawer.classList.contains('open')) {
    drawer.classList.add('open');
    overlay.classList.add('open');
  } else {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  }
}
