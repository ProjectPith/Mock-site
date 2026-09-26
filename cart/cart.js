// ==========================================
// CART & STRIPE EMBEDDED CHECKOUT CONTROLLER
// ==========================================

let activeCheckout = null;

// Global Cart State
let cart = (typeof state !== 'undefined' && state.cart) 
  ? state.cart 
  : (JSON.parse(localStorage.getItem('cart')) || []);

const stripeKey = 'pk_test_51UFYfXC73VlwIj7JYrP3KUOFJL4S32D2PHrHmZAfjCByTz9z999jGdfZv2ea6AkMHnLmzDrghpXB4iGikUL8oKOm00KdYIxacV'; 
let stripeInstance = null;

// Helper to convert cart items into short codes
function generateShortTag(item) {
  // If item already has a pre-formatted short tag, use it
  if (item.shortTag) return item.shortTag;

  // Derive short code prefix based on product title or ID
  let code = 'LC';
  const title = (item.title || item.name || '').toLowerCase();

  if (title.includes('hoodie')) code = 'LC Hdy';
  else if (title.includes('laptop') || title.includes('sleeve')) code = 'LC LTS';
  else if (title.includes('mouse')) code = 'LC MP';
  else if (title.includes('mug') || title.includes('cup')) code = 'LC CM';
  else code = item.code || 'LC Item';

  // Build variants string (Size / Color or Specs)
  const parts = [code];

  if (item.size) parts.push(item.size); // e.g. S, M, L, XL, 2XL, or 12, 13, 15
  if (item.color) {
    // Map full color names to single letters if needed
    const colorMap = { 'gray': 'G', 'charcoal': 'C', 'black': 'B', 'navy': 'N' };
    const colorCode = colorMap[item.color.toLowerCase()] || item.color.toUpperCase()[0];
    parts.push(colorCode);
  }

  return parts.join(' | ');
}

// Self-initializing setup
function setupCartEnvironment() {
  if (window.Stripe) {
    stripeInstance = Stripe(stripeKey);
  }
  
  checkAndClearSuccessCart();
  initCartOverlay();
  updateCartUI();
}

function checkAndClearSuccessCart() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("session_id") || window.location.pathname.includes("/success")) {
    clearCart();
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

function clearCart() {
  cart = [];
  localStorage.removeItem('cart');
  if (typeof state !== 'undefined') state.cart = [];
  updateCartUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupCartEnvironment);
} else {
  setupCartEnvironment();
}

// Global Event Delegation
document.addEventListener('click', (e) => {
  if (e.target.closest('#cart-btn')) {
    e.preventDefault();
    openCartDrawer();
  }
  
  if (e.target.closest('#cart-close-btn') || e.target.classList.contains('cart-overlay-backdrop')) {
    e.preventDefault();
    closeCartDrawer();
  }
  
  if (e.target.closest('#checkout-btn')) {
    handleCheckout(e);
  }
});

// Inject Drawer HTML
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
  cart = (typeof state !== 'undefined' && state.cart) 
    ? state.cart 
    : (JSON.parse(localStorage.getItem('cart')) || []);

  renderCartItems();
  const overlay = document.getElementById('cart-drawer-overlay');
  if (overlay) overlay.classList.remove('hidden');
}

function closeCartDrawer() {
  const overlay = document.getElementById('cart-drawer-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function renderCartItems() {
  const listContainer = document.getElementById('cart-items-list');
  const checkoutContainer = document.getElementById('checkout-container');
  const footer = document.getElementById('cart-overlay-footer');

  if (!listContainer) return;

  if (checkoutContainer) checkoutContainer.innerHTML = '';
  if (footer) footer.style.display = 'block';

  if (!cart || cart.length === 0) {
    listContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center; margin-top: 2rem;">Your cart is empty.</p>';
    if (footer) footer.style.display = 'none';
    return;
  }

  listContainer.innerHTML = cart.map((item, index) => {
    const itemTitle = item.title || item.name || 'Item';
    const itemPrice = typeof item.price === 'number' ? item.price : parseFloat(item.price || 0);

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-subtle);">
        <div>
          <div style="color: var(--text-main); font-weight: 500;">${itemTitle}</div>
          <div style="color: var(--text-muted); font-size: 0.85rem;">$${itemPrice.toFixed(2)} × ${item.quantity || 1}</div>
        </div>
        <button onclick="removeFromCart(${index})" style="background:none; border:none; color: var(--text-muted); cursor:pointer;">&times;</button>
      </div>
    `;
  }).join('');
}

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  localStorage.setItem('cart', JSON.stringify(cart));
  if (typeof state !== 'undefined') state.cart = cart;
  updateCartUI();
  renderCartItems();
};

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

  if (activeCheckout) {
    try {
      activeCheckout.destroy();
    } catch (e) {
      console.warn('Destroying previous checkout instance:', e);
    }
    activeCheckout = null;
  }

  const checkoutContainer = document.getElementById('checkout-container');
  if (checkoutContainer) checkoutContainer.innerHTML = '';

  // Transform cart items into your short tags array
  const formattedTags = cart.map(item => generateShortTag(item));

  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: cart,
        product_tags: formattedTags
      }),
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

    if (listContainer) listContainer.innerHTML = '';
    if (footer) footer.style.display = 'none';

    activeCheckout = await stripeInstance.initEmbeddedCheckout({ clientSecret });
    activeCheckout.mount('#checkout-container');

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
    const currentCart = (typeof state !== 'undefined' && state.cart) 
      ? state.cart 
      : (JSON.parse(localStorage.getItem('cart')) || []);
    const totalItems = currentCart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartCountEl.textContent = totalItems;
  }
}
