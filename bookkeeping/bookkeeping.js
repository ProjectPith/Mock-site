if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjUyNDMwNjgsImV4cCI6MjA0MDgxOTA2OH0.Q1aJ_x8Q0p0Rz-xY-E9x2n-08Zk8";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const db = window.supabaseClient;

// Global engine accessible by dashboard
window.BookkeepingEngine = {
  async calculateNetPayout() {
    const { data: orders } = await db.from("orders").select("total_amount");
    const gross = (orders || []).reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
    
    const stripeCut = (gross * 0.029) + ((orders || []).length * 0.30);
    const bizReserve = gross * 0.10; // 10% auto-reinvest/growth
    const taxReserve = (gross - stripeCut) * 0.25;
    
    const net = Math.max(0, gross - stripeCut - bizReserve - taxReserve);
    return { gross, cuts: stripeCut + bizReserve, tax: taxReserve, net };
  }
};

let currentView = "sitewide";

document.addEventListener("DOMContentLoaded", () => {
  setupFilters();
  loadMetrics();
  renderLedgerTable(currentView);
});

async function loadMetrics() {
  const { gross, cuts, tax, net } = await window.BookkeepingEngine.calculateNetPayout();
  document.getElementById("metric-gross").textContent = `$${gross.toFixed(2)}`;
  document.getElementById("metric-cuts").textContent = `-$${cuts.toFixed(2)}`;
  document.getElementById("metric-taxes").textContent = `-$${tax.toFixed(2)}`;
  document.getElementById("metric-net").textContent = `$${net.toFixed(2)}`;
}

function setupFilters() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentView = e.target.getAttribute("data-view");
      renderLedgerTable(currentView);
    });
  });
}

async function renderLedgerTable(view) {
  const thead = document.getElementById("ledger-thead");
  const tbody = document.getElementById("ledger-tbody");

  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #8b949e;">Loading ledger records...</td></tr>`;

  if (view === "sitewide") {
    thead.innerHTML = `
      <tr>
        <th>Date</th><th>Type</th><th>Client/Customer</th><th>Gross</th><th>Stripe/Printify Cut</th><th>Biz Reserve (10%)</th><th>Net Balance</th>
      </tr>`;
    
    const { data: orders } = await db.from("orders").select("*").order("created_at", { ascending: false });
    
    if (!orders || orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #8b949e;">No site-wide transactions recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o => {
      const gross = Number(o.total_amount || 0);
      const stripe = (gross * 0.029) + 0.30;
      const biz = gross * 0.10;
      const net = gross - stripe - biz;
      return `
        <tr>
          <td>${new Date(o.created_at).toLocaleDateString()}</td>
          <td><span class="badge">Merchandise</span></td>
          <td>${o.customer_email}</td>
          <td>$${gross.toFixed(2)}</td>
          <td class="text-danger">-$${stripe.toFixed(2)}</td>
          <td class="text-warning">-$${biz.toFixed(2)}</td>
          <td class="text-success"><strong>$${net.toFixed(2)}</strong></td>
        </tr>`;
    }).join("");

  } else if (view === "printify") {
    thead.innerHTML = `
      <tr>
        <th>Date</th><th>Order ID</th><th>Customer</th><th>Items</th><th>Retail Price</th><th>Printify COGS</th><th>Margin</th>
      </tr>`;
    
    const { data: orders } = await db.from("orders").select("*").order("created_at", { ascending: false });
    
    tbody.innerHTML = (orders || []).map(o => `
      <tr>
        <td>${new Date(o.created_at).toLocaleDateString()}</td>
        <td>#${o.id.slice(0, 8)}</td>
        <td>${o.customer_email}</td>
        <td>${Array.isArray(o.product_tags) ? o.product_tags.length : 1} item(s)</td>
        <td>$${Number(o.total_amount || 0).toFixed(2)}</td>
        <td class="text-danger">-$${(Number(o.total_amount || 0) * 0.5).toFixed(2)}</td>
        <td class="text-success"><strong>$${(Number(o.total_amount || 0) * 0.5).toFixed(2)}</strong></td>
      </tr>
    `).join("") || `<tr><td colspan="7" style="text-align: center; color: #8b949e;">No Printify transactions found.</td></tr>`;

  } else if (view === "maintenance" || view === "builds") {
    const isMaintenance = view === "maintenance";
    thead.innerHTML = `
      <tr>
        <th>Date</th><th>Contract Name</th><th>Client</th><th>Cycle</th><th>Gross Amount</th><th>Platform Fee</th><th>Net Received</th>
      </tr>`;
    
    // Connects to your future contracts/services table
    const { data: contracts } = await db.from("contracts").select("*").eq("type", isMaintenance ? "maintenance" : "site_build");

    if (!contracts || contracts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #8b949e;">No ${isMaintenance ? "maintenance" : "site build"} contracts recorded yet.</td></tr>`;
      return;
    }

  } else if (view === "tax_ledger") {
    thead.innerHTML = `
      <tr>
        <th>Quarter/Date</th><th>Source View</th><th>Taxable Base</th><th>Est. Tax (25%)</th><th>Status</th>
      </tr>`;
    
    const { gross } = await window.BookkeepingEngine.calculateNetPayout();
    const taxEst = gross * 0.25;

    tbody.innerHTML = `
      <tr>
        <td>${new Date().getFullYear()} Q3 (YTD)</td>
        <td>Site-Wide Net Remaining</td>
        <td>$${gross.toFixed(2)}</td>
        <td class="text-warning"><strong>$${taxEst.toFixed(2)}</strong></td>
        <td><span class="badge">Reserved</span></td>
      </tr>`;
  }
}
