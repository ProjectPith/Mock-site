// ==========================================
// SUPABASE INITIALIZATION
// ==========================================
if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Assign to a local variable named db (or use window.supabaseClient directly)
const db = window.supabaseClient;

// Catalog dictionary to decode shorthand tags back to full descriptions
const catalogMap = {
  'LC MP': 'LunarCraft Mouse Pad',
  'LC Hdy': 'LunarCraft Developer Hoodie',
  'LC CM': 'LunarCraft Ceramic Mug',
  'LC LTS': 'LunarCraft Laptop Sleeve'
};

const colorMap = {
  'C': 'Charcoal',
  'B': 'Black',
  'G': 'Gray',
  'N': 'Navy'
};

document.addEventListener("DOMContentLoaded", async () => {
  await fetchCustomerOrders();
});

async function fetchCustomerOrders() {
  const container = document.getElementById('orders-list');
  if (!container) return;

  // 1. Fetch current logged-in user session
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    container.innerHTML = `
      <div class="orders-empty-state">
        <p>Please log in to view your order history.</p>
        <a href="../account/account.html" class="btn btn-primary">Go to Account</a>
      </div>`;
    return;
  }

  // 2. Query Supabase orders matching the customer's email
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_email', user.email) // Filtered by email column
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching orders:', error);
    container.innerHTML = `<p class="error-msg">Failed to load orders. Please try again later.</p>`;
    return;
  }

  if (!orders || orders.length === 0) {
    container.innerHTML = `
      <div class="orders-empty-state">
        <p>You haven't placed any orders yet.</p>
        <a href="../store/store.html" class="btn btn-primary">Browse Store</a>
      </div>`;
    return;
  }

  // 3. Render Order Cards
  container.innerHTML = orders.map(order => renderOrderCard(order)).join('');
}

function renderOrderCard(order) {
  const dateFormatted = new Date(order.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const items = Array.isArray(order.items) ? order.items : JSON.parse(order.items || '[]');
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  
  // Format tracking link/text
  const trackingDisplay = order.tracking_number 
    ? `<a href="${order.tracking_url || '#'}" target="_blank" class="tracking-link">${order.tracking_number}</a>`
    : `<span class="text-muted">N/A</span>`;

  // Dynamic Status Badge Logic
  const statusBadge = getStatusBadgeHTML(order.status);

  return `
    <div class="order-card">
      <div class="order-header">
        <div>
          <span class="order-id">Order #${order.order_number || order.id.slice(0, 8)}</span>
          <span class="order-date">${dateFormatted}</span>
        </div>
        ${statusBadge}
      </div>

      <div class="order-body">
        <div class="order-items-list">
          ${items.map(item => `
            <div class="order-item-row">
              <span class="item-qty">${item.quantity || 1}x</span>
              <span class="item-details">${decodeShorthand(item.shortTag || item.title)}</span>            </div>
          `).join('')}
        </div>

        <div class="order-meta-grid">
          <div class="meta-block">
            <span class="meta-label">Total Amount</span>
            <span class="meta-value highlight">$${Number(order.total_amount).toFixed(2)}</span>
          </div>
          <div class="meta-block">
            <span class="meta-label">Total Items</span>
            <span class="meta-value">${itemCount} item${itemCount === 1 ? '' : 's'}</span>
          </div>
          <div class="meta-block">
            <span class="meta-label">Tracking Number</span>
            <span class="meta-value">${trackingDisplay}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Translates "LC LTS | 13" or "LC Hdy | M | C" back to full text
function decodeShorthand(rawTag) {
  if (!rawTag) return 'Unknown Product';
  
  const parts = rawTag.split(' | ').map(p => p.trim());
  const code = parts[0];
  
  const fullTitle = catalogMap[code] || code;
  
  // Handle optional variant descriptors (Size / Color)
  const variants = parts.slice(1).map(v => colorMap[v] || v);
  const variantText = variants.length > 0 ? ` (${variants.join(', ')})` : '';

  return `${fullTitle}${variantText}`;
}

// Maps internal status to readable badges
function getStatusBadgeHTML(status) {
  const s = (status || 'pending').toLowerCase();

  switch (s) {
    case 'in_printify':
    case 'processing':
      return `<span class="status-badge badge-processing">In Production (Printify)</span>`;
    case 'shipped':
      return `<span class="status-badge badge-shipped">Shipped</span>`;
    case 'completed':
    case 'delivered':
      return `<span class="status-badge badge-completed">Delivered</span>`;
    default:
      return `<span class="status-badge badge-pending">Order Placed</span>`;
  }
}
