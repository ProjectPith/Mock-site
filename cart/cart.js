// ==========================================
// CART & STRIPE EMBEDDED CHECKOUT CONTROLLER
// ==========================================

// Global Cart State (Sync with global state or localStorage)
let cart = (typeof state !== 'undefined' && state.cart) 
  ? state.cart 
  : (JSON.parse(localStorage.getItem('cart')) || []);

// Initialize Stripe JS SDK
const stripeKey = 'pk_live_YOUR_PUBLISHABLE_KEY_HERE'; 
let stripeInstance = null;

if (window.Stripe) {
  stripeInstance = Stripe(stripeKey);
}

document.addEventListener('DOMContentLoaded', () => {
  initCartOverlay();
  updateCartUI();

  // Delegation: Handle clicks on dynamically inserted nav buttons
  document.addEventListener('click', (e) => {
    // Open cart drawer when clicking #cart-btn in nav.js
    if (e.target.closest('#cart-btn')) {
      openCartDrawer();
    }
    // Close cart drawer
    if (e.target.closest('#cart-close-btn') || e.target.classList.contains('cart-overlay-backdrop')) {
      closeCartDrawer();
    }
    // Checkout trigger button inside overlay
    if (e.target.closest('#checkout-btn')) {
      handleCheckout(e);
    }
  });
});

// Create and inject your cart drawer panel matching cart.css
function initCartOverlay() {
  if (document.getElementById('cart-drawer-overlay')) return;

  const overlayHTML = `
    <div id="cart-drawer-overlay" class="cart-overlay-backdrop hidden">
      <div class="cart-overlay-panel">
        <div class="cart-overlay-header">
          <h3>Your Shopping Cart</h3>
          <button id="cart-close-btn" class="cart-close-btn">&times;</button>
        </div>
        <div class="cart-overlay-body" id="cart-overlay-body">
          <!-- Dynamically populated cart items or Stripe Checkout -->
          <div id="cart-items-list"></div>
          <div id="checkout-container"></div>
        </div>
        <div class="cart-overlay-footer" id="cart-overlay-footer">
          <button id="checkout-btn" class="nav-btn" style="width: 100%; justify-content: center;">
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', overlayHTML);
}

function openCartDrawer() {
  renderCartItems();
  const overlay = document.getElementById('cart-drawer-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

function closeCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  if (overlay) overlay.classList.add('hidden');
}

// Render cart items inside the drawer
function renderCartItems() {
  const listContainer = document.getElementById('cart-items-list');
  const checkoutContainer = document.getElementById('checkout-container');
  const footer = document.getElementById('cart-overlay-footer');

  if (!listContainer) return;

  // Reset view to normal cart list
  if (checkoutContainer) checkoutContainer.innerHTML = '';
  if (footer) footer.style.display = 'block';

  if (!cart || cart.length === 0) {
    listContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Your cart is empty.</p>';
    if (footer) footer.style.display = 'none';
    return;
  }

  listContainer.innerHTML = cart.map((item, index) => `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-subtle);">
      <div>
        <div style="color: var(--text-main); font-weight: 500;">${item.name}</div>
        <div style="color: var(--text-muted); font-size: 0.85rem;">$${(item.price).toFixed(2)} × ${item.quantity || 1}</div>
      </div>
      <button onclick="removeFromCart(${index})" style="background:none; border:none; color: var(--text-muted); cursor:pointer;">&times;</button>
    </div>
  `).join('');
}

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  localStorage.setItem('cart', JSON.stringify(cart));
  if (typeof state !== 'undefined') state.cart = cart;
  updateCartUI();
  renderCartItems();
};

// Checkout API call to Netlify function
async function handleCheckout(event) {
  if (event) event.preventDefault();

  if (!cart || cart.length === 0) return;

  const checkoutBtn = document.getElementById('checkout-btn');
  const footer = document.getElementById('cart-overlay-footer');
  const listContainer = document.getElementById('cart-items-list');

  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Loading Checkout...';
  }

  try {
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server returned ${response.status}`);
    }

    const { clientSecret } = await response.json();

    if (!clientSecret) throw new Error('No clientSecret returned from server.');

    if (!stripeInstance && window.Stripe) {
      stripeInstance = Stripe(stripeKey);
    }

    // Hide item list and footer, mount Stripe directly into drawer
    if (listContainer) listContainer.innerHTML = '';
    if (footer) footer.style.display = 'none';

    const checkout = await stripeInstance.initEmbeddedCheckout({ clientSecret });
    checkout.mount('#checkout-container');

  } catch (err) {
    console.error('Checkout error:', err.message);
    alert(`Could not initiate checkout: ${err.message}`);
    if (footer) footer.style.display = 'block';
    renderCartItems();
  } finally {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Proceed to Checkout';
    }
  }
}

function updateCartUI() {
  const cartCountEl = document.getElementById('cart-count');
  if (cartCountEl) {
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartCountEl.textContent = totalItems;
  }
}
