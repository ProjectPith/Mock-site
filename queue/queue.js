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
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

    if (!showCompleted) {
      query = query.neq("status", "completed");
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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
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
      // Calculate count from order_items relational table or raw json items column
      let itemCount = 0;
      if (order.order_items && order.order_items.length > 0) {
        itemCount = order.order_items.reduce((sum, item) => sum + (item.quantity || 1), 0);
      } else if (order.items) {
        const rawItems = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : order.items;
        itemCount = rawItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
      }

      const orderDate = new Date(order.created_at).toLocaleDateString();
      const isCompleted = order.status === "completed";

      return `
        <tr class="${isCompleted ? 'completed' : ''}" data-id="${order.id}">
          <td><strong>${order.customer_email || 'No email'}</strong></td>
          <td>${orderDate}</td>
          <td>${itemCount} item(s)</td>
          <td>$${Number(order.total_amount || order.total || 0).toFixed(2)}</td>
          <td><span class="status-badge ${order.status}">${order.status}</span></td>
          <td style="text-align: center;" onclick="event.stopPropagation();">
            <input type="checkbox" class="order-complete-checkbox" data-id="${order.id}" ${isCompleted ? 'checked' : ''}>
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
        const newStatus = e.target.checked ? "completed" : "pending";
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
    
    // Format Shipping Address (Object or String)
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

    // Format Ordered Items
    const itemsList = document.getElementById("ordered-items-list");
    itemsList.innerHTML = "";

    let itemsToRender = currentSelectedOrder.order_items || [];
    if (!itemsToRender.length && currentSelectedOrder.items) {
      itemsToRender = typeof currentSelectedOrder.items === 'string' 
        ? JSON.parse(currentSelectedOrder.items) 
        : currentSelectedOrder.items;
    }

    if (Array.isArray(itemsToRender) && itemsToRender.length > 0) {
      itemsToRender.forEach(item => {
        const li = document.createElement("li");
        const title = item.product_title || item.title || item.name || "Product Item";
        const qty = item.quantity || item.qty || 1;
        const price = item.unit_price || item.price || 0;
        
        li.innerHTML = `
          <span><strong>${qty}x</strong> ${title}</span>
          <span>$${Number(price).toFixed(2)}</span>
        `;
        itemsList.appendChild(li);
      });
    } else {
      itemsList.innerHTML = `<li><span>No item breakdown available.</span></li>`;
    }

    // Set tracking number input
    const trackingInput = document.getElementById("tracking-input");
    if (trackingInput) {
      trackingInput.value = currentSelectedOrder.tracking_number || "";
    }

    modal.classList.remove("hidden");
  }

  // Bind Listeners
  document.getElementById("close-modal-btn")?.addEventListener("click", () => {
    document.getElementById("order-modal")?.classList.add("hidden");
  });

  document.getElementById("show-completed")?.addEventListener("change", fetchOrders);

  document.getElementById("fulfill-btn")?.addEventListener("click", async () => {
    if (!currentSelectedOrder) return;
    const tracking = document.getElementById("tracking-input")?.value;

    await updateOrderStatusInDb(currentSelectedOrder.id, "completed", tracking);
    document.getElementById("order-modal")?.classList.add("hidden");
  });

  document.addEventListener("DOMContentLoaded", checkAuthAndLoad);
})();
