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

document.addEventListener("DOMContentLoaded", () => {
  
  // Account Drawer Triggers
  const accountTrigger = document.getElementById("account-btn") || 
                         document.querySelector(".sign-in-btn") || 
                         document.querySelector("a[href*='account']");
                         
  const accountBackdrop = document.getElementById("account-drawer-backdrop");
  const closeAccountBtn = document.getElementById("close-account-drawer");

  function openAccount() {
    if (accountBackdrop) {
      accountBackdrop.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
  }

  function closeAccount() {
    if (accountBackdrop) {
      accountBackdrop.classList.add("hidden");
      document.body.style.overflow = "";
    }
  }

  if (accountTrigger) {
    accountTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      openAccount();
    });
  }

  if (closeAccountBtn) closeAccountBtn.addEventListener("click", closeAccount);

  if (accountBackdrop) {
    accountBackdrop.addEventListener("click", (e) => {
      if (e.target === accountBackdrop) closeAccount();
    });
  }

});
