// ==========================================
// GLOBAL STATE MANAGEMENT
// ==========================================
const state = {
  cart: JSON.parse(localStorage.getItem('cart')) || [],
  currentUser: JSON.parse(localStorage.getItem('currentUser')) || null,
  selectedService: null,
  orders: JSON.parse(localStorage.getItem('orders')) || [],
  bookings: JSON.parse(localStorage.getItem('bookings')) || []
};

// ==========================================
// GLOBAL INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  updateAuthNav();
});

// Sync cart quantity badge across header elements
function updateCartBadge() {
  const cartCountEl = document.getElementById('cart-count');
  if (cartCountEl) {
    const totalCount = state.cart.reduce((sum, item) => sum + item.qty, 0);
    cartCountEl.innerText = totalCount;
  }
}

// Persist cart to local storage and refresh count
function saveCart() {
  localStorage.setItem('cart', JSON.stringify(state.cart));
  updateCartBadge();
}

// Global Auth Display Helper
function updateAuthNav() {
  const container = document.getElementById('auth-nav-container');
  if (!container) return;

  if (state.currentUser) {
    container.innerHTML = `
      <a href="../account/account.html" class="btn btn-secondary">
        Account (${state.currentUser.name})
      </a>
    `;
  } else {
    container.innerHTML = `
      <button class="btn btn-primary" onclick="openAuthModal()">Sign In</button>
    `;
  }
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('currentUser');
  updateAuthNav();
  window.location.href = '../index.html';
}
