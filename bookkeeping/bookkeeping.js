// Global Supabase check
if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Attach calculations engine globally for dashboard & other pages
window.BookkeepingEngine = {
  async calculateNetPayout() {
    const supabase = window.supabaseClient;
    const { data: orders, error } = await supabase.from("orders").select("total_amount");
    
    if (error || !orders) {
      return { gross: 0, cuts: 0, tax: 0, net: 0 };
    }

    const gross = orders.reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
    const stripeCut = (gross * 0.029) + (orders.length * 0.30);
    const bizReserve = gross * 0.10; // 10% business reserve
    const taxReserve = (gross - stripeCut) * 0.25; // 25% tax estimation
    const net = Math.max(0, gross - stripeCut - bizReserve - taxReserve);

    return { gross, cuts: stripeCut + bizReserve, tax: taxReserve, net };
  }
};

// ONLY run ledger rendering if we are on bookkeeping.html
document.addEventListener("DOMContentLoaded", () => {
  const isBookkeepingPage = document.getElementById("metric-gross");
  if (!isBookkeepingPage) return; // Exit cleanly if on dashboard.html

  setupFilters();
  loadMetrics();
  renderLedgerTable("sitewide");
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
      renderLedgerTable(e.target.getAttribute("data-view"));
    });
  });
}

async function renderLedgerTable(view) {
  const thead = document.getElementById("ledger-thead");
  const tbody = document.getElementById("ledger-tbody");
  const supabase = window.supabaseClient;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #8b949e;">Loading ledger records...</td></tr>`;

  if (view === "sitewide") {
    thead.innerHTML = `
      <tr>
        <th>Date</th><th>Type</th><th>Client/Customer</th><th>Gross</th><th>Stripe Cut</th><th>Biz Reserve (10%)</th><th>Net Balance</th>
      </tr>`;
    
    const { data: orders } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    
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
          <td>${o.customer_email || 'N/A'}</td>
          <td>$${gross.toFixed(2)}</td>
          <td class="text-danger">-$${stripe.toFixed(2)}</td>
          <td class="text-warning">-$${biz.toFixed(2)}</td>
          <td class="text-success"><strong>$${net.toFixed(2)}</strong></td>
        </tr>`;
    }).join("");
  }
}
