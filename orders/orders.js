// ==========================================
// CLIENT ORDER HISTORY & SHORTHAND DECODER
// ==========================================

// Shorthand Translation Mapping Dictionary
const PRODUCT_DECODER = {
  // Product Short Codes
  codes: {
    'LC MP': 'LunarCraft Mouse Pad',
    'LC Hdy': 'LunarCraft Developer Hoodie',
    'LC CM': 'LunarCraft Ceramic Mug',
    'LC LTS': 'LunarCraft Laptop Sleeve'
  },
  // Color Code Mapping
  colors: {
    'C': 'Charcoal',
    'B': 'Black',
    'G': 'Gray',
    'N': 'Navy'
  }
};

/**
 * Translates cart tags like "LC LTS | 13" or "LC Hdy | M | C" into full titles
 * @param {string} shortTag 
 * @returns {string} Human-readable product description
 */
function decodeShortTag(shortTag) {
  if (!shortTag) return 'Custom Item';
  
  const parts = shortTag.split('|').map(p => p.trim());
  const rawCode = parts[0];
  const translatedTitle = PRODUCT_DECODER.codes[rawCode] || rawCode;
  
  const formattedSpecs = parts.slice(1).map(spec => {
    // If spec matches a color code, translate it; otherwise return raw size/spec
    return PRODUCT_DECODER.colors[spec] || spec;
  });

  return formattedSpecs.length > 0 
    ? `${translatedTitle} (${formattedSpecs.join(' / ')})` 
    : translatedTitle;
}

// Render Orders for Logged-In User
function renderCustomerOrders() {
  const container = document.getElementById('customer-orders-container');
  if (!container) return;

  // Retrieve current user and global order database from localStorage
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const allOrders = JSON.parse(localStorage.getItem('lunar_orders')) || [];

  if (!currentUser) {
    container.innerHTML = `
      <div class="orders-empty-state">
        <p>Please log in to view your order history.</p>
        <a href="../account/login.html" class="btn btn-primary">Log In</a>
      </div>`;
    return;
  }

  // Filter orders pertaining ONLY to this client's account
  const userOrders = allOrders.filter(order => order.customerEmail === currentUser.email);

  if (userOrders.length === 0) {
    container.innerHTML = `
      <div class="orders-empty-state">
        <p>You haven't placed any orders yet.</p>
        <a href="../store/store.html" class="btn btn-secondary">Visit Store</a>
      </div>`;
    return;
  }

  // Build Orders HTML
  container.innerHTML = userOrders.map(order => {
    // Calculate total quantity of items
    const totalItems = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    // Status Badge Formatting
    const isPrintifySent = order.status === 'In Production' || order.status === 'Shipped' || order.status === 'Complete';
    const statusClass = isPrintifySent ? 'status-active' : 'status-pending';
    const statusDisplay = isPrintifySent ? 'In Printify Queue' : (order.status || 'Processing');

    return `
      <div class="order-card">
        <div class="order-header">
          <div>
            <span class="order-number">Order #${order.orderId}</span>
            <span class="order-date">${new Date(order.createdAt).toLocaleDateString()}</span>
          </div>
          <span class="order-status-badge ${statusClass}">${statusDisplay}</span>
        </div>

        <div class="order-items-list">
          ${order.items.map(item => `
            <div class="order-item-row">
              <span class="item-name">${decodeShortTag(item.shortTag || item.title)}</span>
              <span class="item-qty">x${item.quantity \vert{}\vert{} 1}</span>               <span class="item-price">$${(item.price * (item.quantity || 1)).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>

        <div class="order-footer">
          <div class="order-meta">
            <span><strong>Total Items:</strong> ${totalItems}</span>
            <span><strong>Tracking Number:</strong> ${order.trackingNumber ? `<a href="${order.trackingUrl \vert{}\vert{} '#'}" target="_blank">${order.trackingNumber}</a>` : 'N/A'}</span>
          </div>
          <div class="order-total">$${parseFloat(order.totalPaid).toFixed(2)}</div>
        </div>
      </div>
    `;
  }).join('');
}

document.addEventListener('DOMContentLoaded', renderCustomerOrders);
