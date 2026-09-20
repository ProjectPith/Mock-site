(function () {
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
    const showCompletedCheckbox = document.getElementById("show-completed");
    const showCompleted = showCompletedCheckbox ? showCompletedCheckbox.checked : false;

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    // Hide finished orders unless checkbox is checked
    if (!showCompleted) {
      query = query.not("status", "in", '("completed","delivered")');
    }

    const { data, error } = await query;

    if (error) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="color: #ff6b6b;">Error loading orders: ${error.message}</td></tr>`;
      console.error("Fetch orders error:", error);
      return;
    }

    activeOrders = data || [];
    renderTable(activeOrders);

    if (!window.orderSubscription) {
      window.orderSubscription = supabase
        .channel('public:orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          fetchOrders();
        })
        .subscribe();
    }
  }

  function renderTable(orders) {
    const tableBody = document.getElementById("orders-table-body");
    if (!tableBody) return;

    if (!orders.length) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #919ba1;">No active orders found.</td></tr>`;
      return;
    }

    tableBody.innerHTML = orders.map(order => {
      let itemCount = 0;
      if (Array.isArray(order.product_tags)) {
        itemCount = order.product_tags.length;
      } else if (order.items) {
        const rawItems = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : order.items;
        itemCount = Array.isArray(rawItems) ? rawItems.length : 1;
      }

      const orderDate = new Date(order.created_at).toLocaleDateString();
      const currentStatus = (order.status || 'pending').toLowerCase();
      const isFinished = currentStatus === "completed" || currentStatus === "delivered";

      return `
        <tr class="${isFinished ? 'completed' : ''}" data-id="${order.id}">
          <td><strong>${order.customer_email || 'No email'}</strong></td>
          <td>${orderDate}</td>
          <td>${itemCount} item(s)</td>
          <td>$${Number(order.total_amount || order.total || 0).toFixed(2)}</td>
          <td><span class="status-badge ${currentStatus}">${currentStatus.replace('_', ' ')}</span></td>
          <td style="text-align: center;" onclick="event.stopPropagation();">
            <input type="checkbox" class="order-complete-checkbox" data-id="${order.id}" ${isFinished ? 'checked' : ''}>
          </td>
        </tr>
      `;
    }).join("");

    document.querySelectorAll(".orders-table tbody tr").forEach(row => {
      row.addEventListener("click", () => {
        const orderId = row.getAttribute("data-id");
        openOrderModal(orderId);
      });
    });

    document.querySelectorAll(".order-complete-checkbox").forEach(box => {
      box.addEventListener("click", (e) => e.stopPropagation());
      box.addEventListener("change", async (e) => {
        e.stopPropagation();
        const orderId = e.target.getAttribute("data-id");
        const newStatus = e.target.checked ? "delivered" : "pending";
        await updateOrderStatusInDb(orderId, newStatus);
      });
    });
  }

  async function updateOrderStatusInDb(orderId, status, trackingNumber = null) {
    const updatePayload = { status: status };
    if (trackingNumber !== null) {
      updatePayload.tracking_number = trackingNumber;
    }

    const { error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId);

    if (error) {
      alert(`Failed to update status in database: ${error.message}`);
      console.error("Supabase DB Update Error:", error);
      fetchOrders();
    } else {
      fetchOrders();
    }
  }

  function openOrderModal(orderId) {
    currentSelectedOrder = activeOrders.find(o => o.id === orderId);
    if (!currentSelectedOrder) return;

    const modal = document.getElementById("order-modal");
    if (!modal) return;

    document.getElementById("customer-email").textContent = currentSelectedOrder.customer_email || "N/A";
    
    // Address Formatting
    const addrEl = document.getElementById("shipping-address");
    const ship = currentSelectedOrder.shipping_address;
    if (typeof ship === 'object' && ship !== null) {
      addrEl.innerHTML = `
        ${currentSelectedOrder.customer_name || ship.name || ''}<br>
        ${ship.line1 || ship.address || ''} ${ship.line2 || ''}<br>
        ${ship.city || ''}${ship.city ? ',' : ''} ${ship.state || ''} ${ship.postal_code || ship.zip || ''}<br>
        ${ship.country || ''}
      `;
    } else {
      addrEl.innerText = ship || "No shipping address provided.";
    }

    // Render Product Tags directly as short codes
    const itemsList = document.getElementById("ordered-items-list");
    itemsList.innerHTML = "";

    let tags = currentSelectedOrder.product_tags;
    
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch(e) { tags = [tags]; }
    }

    if (Array.isArray(tags) && tags.length > 0) {
      tags.forEach(tag => {
        const li = document.createElement("li");
        li.innerHTML = `<span style="font-family: monospace; font-weight: 600; color: #87ceeb;">${tag}</span>`;
        itemsList.appendChild(li);
      });
    } else {
      itemsList.innerHTML = `<li><span>No product tags recorded.</span></li>`;
    }

    // Tracking Number Input Setup
    const trackingInput = document.getElementById("tracking-input");
    if (trackingInput) {
      trackingInput.value = currentSelectedOrder.tracking_number || "";
    }

    modal.classList.remove("hidden");
  }

  // Event Listeners
  document.getElementById("close-modal-btn")?.addEventListener("click", () => {
    document.getElementById("order-modal")?.classList.add("hidden");
  });

  document.getElementById("show-completed")?.addEventListener("change", fetchOrders);

  // Action 1: Mark order as "in_progress" (Sent to Printify)
  document.getElementById("in-progress-btn")?.addEventListener("click", async () => {
    if (!currentSelectedOrder) return;
    await updateOrderStatusInDb(currentSelectedOrder.id, "in_progress");
    document.getElementById("order-modal")?.classList.add("hidden");
  });

  // Action 2: Mark order as "shipped" with tracking number (Triggers Email)
  document.getElementById("fulfill-btn")?.addEventListener("click", async () => {
    if (!currentSelectedOrder) return;
    const tracking = document.getElementById("tracking-input")?.value?.trim();

    if (!tracking) {
      alert("Please enter a tracking number before marking as shipped.");
      return;
    }

    await updateOrderStatusInDb(currentSelectedOrder.id, "shipped", tracking);
    document.getElementById("order-modal")?.classList.add("hidden");
  });

  document.addEventListener("DOMContentLoaded", checkAuthAndLoad);
})();
