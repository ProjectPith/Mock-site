(function () {
  // Check if a client already exists on window, otherwise create it
  if (!window.supabaseClient && window.supabase) {
    const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjMwNDMsImV4cCI6MjEwNTE5OTA0M30.I9oy9CDFsEPdPuq2hA6pgnhI79_m4JxsROTfAh4Jjf0";
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  const supabase = window.supabaseClient;
  let activeOrders = [];
  let currentSelectedOrder = null;

  async function checkAuthAndLoad() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("Unauthorized access. Please sign in as Admin.");
      window.location.href = "store.html";
      return;
    }
    fetchOrders();
  }

  async function fetchOrders() {
    const tableBody = document.getElementById("orders-table-body");
    const showCompleted = document.getElementById("show-completed").checked;

    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

    if (!showCompleted) {
      query = query.neq("status", "completed");
    }

    const { data, error } = await query;

    if (error) {
      tableBody.innerHTML = `<tr><td colspan="6" style="color: #ff6b6b;">Error loading orders: ${error.message}</td></tr>`;
      return;
    }

    activeOrders = data || [];
    renderTable(activeOrders);

    // REALTIME LISTENER: Refresh queue instantly on new order
    if (!window.orderSubscription) {
      window.orderSubscription = supabase
        .channel('public:orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
          fetchOrders();
        })
        .subscribe();
    }
  }
  function renderTable(orders) {
    const tableBody = document.getElementById("orders-table-body");
    if (!orders.length) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #919ba1;">No active orders found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = orders.map(order => {
      const itemCount = order.order_items ? order.order_items.reduce((sum, item) => sum + item.quantity, 0) : 0;
      const orderDate = new Date(order.created_at).toLocaleDateString();
      const isCompleted = order.status === "completed";

      return `
        <tr class="${isCompleted ? 'completed' : ''}" data-id="${order.id}">
          <td><strong>${order.customer_email}</strong></td>
          <td>${orderDate}</td>
          <td>${itemCount} item(s)</td>
          <td>$${Number(order.total_amount).toFixed(2)}</td>
          <td><span class="status-badge ${order.status}">${order.status}</span></td>
          <td style="text-align: center;" onclick="event.stopPropagation();">
            <input type="checkbox" class="order-complete-checkbox" data-id="${order.id}" ${isCompleted ? 'checked' : ''}>
          </td>
        </tr>
      `;
    }).join("");

    // Row Click Listener for Details Modal
    document.querySelectorAll(".orders-table tbody tr").forEach(row => {
      row.addEventListener("click", () => {
        const orderId = row.getAttribute("data-id");
        openOrderModal(orderId);
      });
    });

    // Checkbox Quick Toggle with Stop Propagation
    document.querySelectorAll(".order-complete-checkbox").forEach(box => {
      box.addEventListener("click", (e) => e.stopPropagation());
      box.addEventListener("change", async (e) => {
        e.stopPropagation();
        const orderId = e.target.getAttribute("data-id");
        const newStatus = e.target.checked ? "completed" : "pending";
        await toggleOrderStatus(orderId, newStatus, e.target);
      });
    });
  }

  async function toggleOrderStatus(orderId, status, checkboxEl) {
    console.log(`Updating order ${orderId} to status: ${status}...`);
    
    const { data, error } = await supabase
      .from("orders")
      .update({ status: status })
      .eq("id", orderId)
      .select();

    if (error) {
      console.error("Supabase Update Error:", error);
      alert(`Failed to update status: ${error.message}`);
      if (checkboxEl) checkboxEl.checked = !checkboxEl.checked; // Revert checkbox visual state on failure
    } else {
      console.log("Successfully updated order status in DB:", data);
      fetchOrders();
    }
  }

  function openOrderModal(orderId) {
    currentSelectedOrder = activeOrders.find(o => o.id === orderId);
    if (!currentSelectedOrder) return;

    const modal = document.getElementById("order-modal");
    document.getElementById("modal-order-title").textContent = `Order Details: ${currentSelectedOrder.customer_email}`;
    
    const itemsList = (currentSelectedOrder.order_items || [])
      .map(item => `<li>${item.quantity}x ${item.product_title} (${item.variant_title || 'Default'}) - $${item.unit_price}</li>`)
      .join("");

    const shipping = currentSelectedOrder.shipping_address || {};

    document.getElementById("modal-order-body").innerHTML = `
      <div>
        <h4>Shipping Address</h4>
        <p style="margin: 0; color: #919ba1;">
          ${currentSelectedOrder.customer_name}<br>
          ${shipping.line1 || ''} ${shipping.line2 || ''}<br>
          ${shipping.city || ''}, ${shipping.state || ''} ${shipping.postal_code || ''}<br>
          ${shipping.country || ''}
        </p>
      </div>
      <div>
        <h4>Ordered Items</h4>
        <ul style="padding-left: 1.25rem; color: #919ba1;">${itemsList}</ul>
      </div>
      <div class="account-form-group">
        <label for="modal-tracking">Tracking Number (Optional for automated email):</label>
        <input type="text" id="modal-tracking" class="account-input" placeholder="e.g. 9400100000000000000000" value="${currentSelectedOrder.tracking_number || ''}">
      </div>
    `;

    modal.classList.remove("hidden");
  }

  async function toggleOrderStatus(orderId, status) {
    const { error } = await supabase
      .from("orders")
      .update({ status: status })
      .eq("id", orderId);

    if (error) {
      alert(`Failed to update status: ${error.message}`);
      fetchOrders(); // Reset UI state on error
    } else {
      // Re-fetch orders so row either disappears (if showCompleted is off) 
      // or stays checked smoothly (if showCompleted is on)
      fetchOrders();
    }
  }

  // Event Listeners
  document.getElementById("close-modal-btn")?.addEventListener("click", () => {
    document.getElementById("order-modal").classList.add("hidden");
  });

  document.getElementById("show-completed")?.addEventListener("change", fetchOrders);

  document.getElementById("fulfill-btn")?.addEventListener("click", async () => {
    if (!currentSelectedOrder) return;
    const tracking = document.getElementById("modal-tracking")?.value;

    const { error } = await supabase
      .from("orders")
      .update({ 
        status: "completed",
        tracking_number: tracking
      })
      .eq("id", currentSelectedOrder.id);

    if (!error) {
      alert("Order marked as complete!");
      document.getElementById("order-modal").classList.add("hidden");
      fetchOrders();
    }
  });

  document.addEventListener("DOMContentLoaded", checkAuthAndLoad);
})();
