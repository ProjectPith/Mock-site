// admin-billing.js - Admin Records & Filtering Logic

(function () {
  if (!window.supabaseClient && window.supabase) {
    const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
})();

let allProjects = [];
let allTransactions = [];
let allSubscriptions = [];

async function initAdminBilling() {
  const db = window.supabaseClient;
  if (!db) return;

  await loadAllAdminData();
  setupFilterEventListeners();
}

async function loadAllAdminData() {
  const db = window.supabaseClient;

  // 1. Fetch ALL transactions globally
  const { data: transactions } = await db
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  // 2. Fetch ALL projects
  const { data: projects } = await db
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  // 3. Fetch ALL subscriptions
  const { data: subscriptions } = await db
    .from('subscriptions')
    .select('*');

  allTransactions = transactions || [];
  allProjects = projects || [];
  allSubscriptions = subscriptions || [];

  renderGlobalPaymentHistory();
  renderAwaitingSummary();
  renderFilteredProjects();
}

// 1. Left Widget: Global Payment History (All Payments)
function renderGlobalPaymentHistory() {
  const historyList = document.getElementById("global-history-list");
  if (!historyList) return;

  if (allTransactions.length === 0) {
    historyList.innerHTML = `<div class="loading-text">No payment records found.</div>`;
    return;
  }

  historyList.innerHTML = allTransactions.map(tx => {
    const project = allProjects.find(p => p.id === tx.project_id);
    const projTitle = project ? project.title : 'General Payment';
    const dateStr = new Date(tx.created_at).toLocaleDateString();

    return `
      <div class="history-item">
        <div>
          <div class="tx-project">${escapeHtml(projTitle)}</div>
          <div class="tx-payer">${escapeHtml(tx.payer_email)}</div>
        </div>
        <div>
          <div class="tx-amount">+${formatUSD(tx.amount)}</div>
          <div class="tx-date">${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

// 2. Top Right Widget: Total Awaiting Payments across all project bills
function renderAwaitingSummary() {
  const totalAwaitingEl = document.getElementById("total-awaiting-amount");
  const summaryTextEl = document.getElementById("awaiting-summary-text");

  let totalUncollected = 0;
  let uncollectedProjectsCount = 0;

  allProjects.forEach(project => {
    const projectTx = allTransactions.filter(t => t.project_id === project.id && t.status === 'succeeded');
    const totalCollected = projectTx.reduce((sum, t) => sum + Number(t.amount), 0);
    const remaining = Math.max(0, Number(project.total_cost) - totalCollected);

    if (remaining > 0) {
      totalUncollected += remaining;
      uncollectedProjectsCount++;
    }
  });

  if (totalAwaitingEl) totalAwaitingEl.textContent = formatUSD(totalUncollected);
  if (summaryTextEl) {
    summaryTextEl.innerHTML = `Spread across <strong>${uncollectedProjectsCount}</strong> active project bill(s).`;
  }
}

// 3. Bottom Right Grid: Filtered Projects Overview
function renderFilteredProjects() {
  const grid = document.getElementById("admin-projects-grid");
  if (!grid) return;

  const timelineFilter = document.getElementById("filter-timeline")?.value || "all";
  const typeFilter = document.getElementById("filter-type")?.value || "both";

  const NOW = new Date();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  let filtered = allProjects.filter(project => {
    const projectTx = allTransactions.filter(t => t.project_id === project.id && t.status === 'succeeded');
    const totalCollected = projectTx.reduce((sum, t) => sum + Number(t.amount), 0);
    const remaining = Math.max(0, Number(project.total_cost) - totalCollected);

    // Filter 1: Timeline (Upcoming = Outstanding Balance, Recent = Paid in last 30 days)
    if (timelineFilter === 'upcoming' && remaining <= 0) return false;
    if (timelineFilter === 'recent') {
      const recentTx = projectTx.some(t => (NOW - new Date(t.created_at)) <= THIRTY_DAYS_MS);
      if (!recentTx) return false;
    }

    // Filter 2: Type (Maintenance vs Build Payout)
    // We treat projects with title containing "Maintenance" or tagged as subscription as Maintenance
    const isMaintenance = project.title.toLowerCase().includes("maintenance") || project.title.toLowerCase().includes("hosting");
    if (typeFilter === 'build' && isMaintenance) return false;
    if (typeFilter === 'maintenance' && !isMaintenance) return false;

    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="loading-text" style="grid-column: 1/-1;">No projects match selected filters.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(project => {
    const projectTx = allTransactions.filter(t => t.project_id === project.id && t.status === 'succeeded');
    const totalCollected = projectTx.reduce((sum, t) => sum + Number(t.amount), 0);
    const remaining = Math.max(0, Number(project.total_cost) - totalCollected);
    const isMaintenance = project.title.toLowerCase().includes("maintenance") || project.title.toLowerCase().includes("hosting");

    return `
      <div class="project-card" onclick="openAdminProjectModal('${project.id}')">
        <span class="card-badge ${isMaintenance ? 'badge-maintenance' : 'badge-build'}">
          ${isMaintenance ? 'Maintenance' : 'Build'}
        </span>
        <h4>${escapeHtml(project.title)}</h4>
        <div class="stat-row">
          <span class="stat-label">Total Cost:</span>
          <span class="stat-val">${formatUSD(project.total_cost)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Collected:</span>
          <span class="stat-val" style="color: #4ed1a0;">${formatUSD(totalCollected)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Remaining Due:</span>
          <span class="stat-val" style="color: ${remaining > 0 ? '#ff6b6b' : '#4ed1a0'};">
            ${formatUSD(remaining)}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// Open Admin Modal Overlay
window.openAdminProjectModal = function (projectId) {
  const project = allProjects.find(p => p.id === projectId);
  if (!project) return;

  const projectTx = allTransactions.filter(t => t.project_id === projectId && t.status === 'succeeded');
  const totalCollected = projectTx.reduce((sum, t) => sum + Number(t.amount), 0);
  const remaining = Math.max(0, Number(project.total_cost) - totalCollected);

  document.getElementById("admin-modal-project-title").textContent = project.title;
  document.getElementById("admin-modal-total").textContent = formatUSD(project.total_cost);
  document.getElementById("admin-modal-collected").textContent = formatUSD(totalCollected);
  document.getElementById("admin-modal-remaining").textContent = formatUSD(remaining);

  // Render client emails assigned to project
  const emails = (project.client_email || "").split(',').map(e => e.trim()).filter(Boolean);
  const clientContainer = document.getElementById("admin-modal-clients");
  clientContainer.innerHTML = emails.map(e => `<span class="client-tag">${escapeHtml(e)}</span>`).join('');

  // Render transaction history for this project
  const txContainer = document.getElementById("admin-modal-tx-list");
  if (projectTx.length === 0) {
    txContainer.innerHTML = `<div class="loading-text" style="padding: 12px 0;">No payments received yet.</div>`;
  } else {
    txContainer.innerHTML = projectTx.map(t => `
      <div class="history-item" style="margin-bottom: 8px;">
        <div>
          <div class="tx-project">${escapeHtml(t.payer_email)}</div>
          <div class="tx-date">${new Date(t.created_at).toLocaleDateString()}</div>
        </div>
        <div class="tx-amount">+${formatUSD(t.amount)}</div>
      </div>
    `).join('');
  }

  document.getElementById("admin-project-modal").classList.remove("hidden");
};

function setupFilterEventListeners() {
  document.getElementById("filter-timeline")?.addEventListener("change", renderFilteredProjects);
  document.getElementById("filter-type")?.addEventListener("change", renderFilteredProjects);

  const closeBtn = document.getElementById("admin-close-modal-btn");
  const modal = document.getElementById("admin-project-modal");

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }
}

function formatUSD(num) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.addEventListener("DOMContentLoaded", initAdminBilling);
