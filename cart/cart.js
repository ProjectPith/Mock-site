// ==========================================
// CART & STRIPE EMBEDDED CHECKOUT CONTROLLER
// ==========================================

// Global Cart State (or read from your existing storage mechanism)
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Initialize Stripe JS SDK (Uses your publishable key)
// Replace with your actual Stripe Publishable Key if different
const stripeKey = 'pk_live_YOUR_PUBLISHABLE_KEY_HERE'; 
let stripeInstance = null;

if (window.Stripe) {
  stripeInstance = Stripe(stripeKey);
} else {
  console.error('Stripe SDK not loaded. Ensure <script src="https://js.stripe.com/v3/"></script> is in your HTML <head>.');
}

// Attach Event Listeners on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  updateCartUI();

  // Attach listener to Checkout Button inside your Nav/Cart Overlay
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', handleCheckout);
  }
});

// Primary Checkout Handler
async function handleCheckout(event) {
  if (event) event.preventDefault();

  if (!cart || cart.length === 0) {
    alert('Your cart is empty.');
    return;
  }

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = 'Loading Checkout...';
  }

  try {
    // POST request to Netlify backend serverless route
    const response = await fetch('/.netlify/functions/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items: cart }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    const { clientSecret } = await response.json();

    if (!clientSecret) {
      throw new Error('No clientSecret returned from server backend.');
    }

    if (!stripeInstance) {
      stripeInstance = Stripe(stripeKey);
    }

    // Initialize and Mount Embedded Checkout inside your side-panel overlay container
    const checkout = await stripeInstance.initEmbeddedCheckout({
      clientSecret: clientSecret,
    });

    // Replace #checkout-container with the ID of your modal/overlay div
    const container = document.getElementById('checkout-container');
    if (container) {
      container.innerHTML = ''; // Clear prior contents
      checkout.mount('#checkout-container');
    } else {
      console.error('Target #checkout-container element missing from DOM.');
    }

  } catch (err) {
    console.error('Checkout error:', err.message);
    alert(`Could not initiate checkout: ${err.message}`);
  } finally {
    if (checkoutBtn) {
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = 'Checkout';
    }
  }
}

// Utility Function to Keep Cart UI Updated
function updateCartUI() {
  const cartCountEl = document.getElementById('cart-count');
  if (cartCountEl) {
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartCountEl.textContent = totalItems;
  }
}
