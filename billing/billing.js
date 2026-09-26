// billing.js - Client Billing Logic & Multi-Account Balance Math

(function () {
  if (!window.supabaseClient && window.supabase) {
    const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_bT739cvrORLIrJYQmUVO2Q_9qe25hOU";
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
})();

let currentUserEmail = "";
let loadedProjects = [];
let loadedTransactions = [];

async function initBilling() {
  const db = window.supabaseClient;
  if (!db) return;

  const { data: sessionData } = await db.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return;

  currentUserEmail = (user.email || "").toLowerCase().trim();

  await Promise.all([
    loadSubscriptions(),
    loadBillingData()
  ]);

  setupModalListeners();
}

// 1. Fetch & Display Recurring Subscription
async function loadSubscriptions() {
  const db = window.supabaseClient;
  const { data: subs } = await db
    .from('subscriptions')
    .select('*')
    .eq('active', true)
    .ilike('client_email', currentUserEmail)
    .maybeSingle();

  const recurringBox = document.getElementById("recurring-text");
  if (!recurringBox) return;

  if (subs) {
    const formattedAmount = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subs.amount);
    recurringBox.innerHTML = `<strong>Recurring:</strong> ${formattedAmount}/mo due on the <strong>${ordinalSuffix(subs.billing_cycle_day)}</strong> of every month.`;
  } else {
    recurringBox.textContent = "No active recurring billing on this account.";
  }
}

// 2. Load Projects & Calculated Shared Balances
async function loadBillingData() {
  const db = window.supabaseClient;

  // Fetch projects user is attached to
  const { data: projects } = await db.from('projects').select('*');
  // Fetch all transactions for visible projects
  const { data: transactions } = await db.from('transactions').select('*').order('created_at', { ascending: false });

  loadedProjects = projects || [];
  loadedTransactions = transactions || [];

  renderPaymentHistory();
  renderProjectsAndBalance();
}

// Render Left Sidebar Payment History (User's personal payments)
function renderPaymentHistory() {
  const historyList = document.getElementById("history-list");
  if (!historyList) return;

  const userTx = loadedTransactions.filter(t => t.payer_email.toLowerCase() === currentUserEmail);

  if (userTx.length === 0) {
    historyList.innerHTML = `<div class="loading-text">No payment history found.</div>`;
    return;
  }

  historyList.innerHTML = userTx.map(tx => {
    const project = loadedProjects.find(p => p.id === tx.project_id);
    const projTitle = project ? (project.name || project.title || 'Untitled Project') : 'General Payment';
    const dateStr = new Date(tx.created_at).toLocaleDateString();
    const amountStr = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(tx.amount);

    return `
      <div class="history-item">
        <div>
          <div class="tx-project">${escapeHtml(projTitle)}</div>
          <div class="tx-date">${dateStr}</div>
        </div>
        <div class="tx-amount">+${amountStr}</div>
      </div>
    `;
  }).join('');
}

// Render Projects & Overall Balance
function renderProjectsAndBalance() {
  const projectsGrid = document.getElementById("projects-grid");
  const totalBalanceEl = document.getElementById("total-balance");
  
  let userTotalOutstanding = 0;

  if (!loadedProjects || loadedProjects.length === 0) {
    if (projectsGrid) projectsGrid.innerHTML = `<div class="loading-text">No active projects found.</div>`;
    if (totalBalanceEl) totalBalanceEl.textContent = "$0.00";
    return;
  }

  const projectCardsHtml = loadedProjects.map(project => {
    // Total paid into this project by ALL participants (lowers shared total balance)
    const projectTx = loadedTransactions.filter(t => t.project_id === project.id && t.status === 'succeeded');
    const totalGroupPaid = projectTx.reduce((sum, t) => sum + Number(t.amount), 0);
    
    // Amount paid by THIS logged-in user specifically
    const userPaid = projectTx
      .filter(t => t.payer_email.toLowerCase() === currentUserEmail)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const remainingGroupBalance = Math.max(0, Number(project.total_cost) - totalGroupPaid);
    
    userTotalOutstanding += remainingGroupBalance;

    const projectLabel = project.name || project.title || 'Untitled Project';

    return `
      <div class="project-card" onclick="openProjectModal(${JSON.stringify(String(project.id))})">
        <h4>${escapeHtml(projectLabel)}</h4>
        <div class="stat-row">
          <span class="stat-label">Project Cost:</span>
          <span class="stat-val">${formatUSD(project.total_cost)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">You Paid:</span>
          <span class="stat-val" style="color: #4ed1a0;">${formatUSD(userPaid)}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Group Remaining:</span>
          <span class="stat-val" style="color: ${remainingGroupBalance > 0 ? '#ff6b6b' : '#4ed1a0'};">
            ${formatUSD(remainingGroupBalance)}
          </span>
        </div>
      </div>
    `;
  }).join('');

  if (projectsGrid) projectsGrid.innerHTML = projectCardsHtml;
  if (totalBalanceEl) totalBalanceEl.textContent = formatUSD(userTotalOutstanding);
}

// 3. Project Detail Modal
window.openProjectModal = function(projectId) {
  const project = loadedProjects.find(p => p.id === projectId);
  if (!project) return;

  const projectTx = loadedTransactions.filter(t => t.project_id === projectId && t.status === 'succeeded');
  const userTx = projectTx.filter(t => t.payer_email.toLowerCase() === currentUserEmail);

  const totalGroupPaid = projectTx.reduce((sum, t) => sum + Number(t.amount), 0);
  const userPaid = userTx.reduce((sum, t) => sum + Number(t.amount), 0);
  const remainingGroupBalance = Math.max(0, Number(project.total_cost) - totalGroupPaid);

  document.getElementById("modal-project-title").textContent = project.name || project.title || 'Untitled Project';
  document.getElementById("modal-project-total").textContent = formatUSD(project.total_cost);
  document.getElementById("modal-user-paid").textContent = formatUSD(userPaid);
  document.getElementById("modal-project-remaining").textContent = formatUSD(remainingGroupBalance);

  const txListContainer = document.getElementById("modal-tx-list");
  if (userTx.length === 0) {
    txListContainer.innerHTML = `<div class="loading-text" style="padding: 12px 0;">You have not made any payments towards this project yet.</div>`;
  } else {
    txListContainer.innerHTML = userTx.map(t => `
      <div class="history-item" style="margin-bottom: 8px;">
        <div>
          <div class="tx-project">Payment</div>
          <div class="tx-date">${new Date(t.created_at).toLocaleDateString()}</div>
        </div>
        <div class="tx-amount">+${formatUSD(t.amount)}</div>
      </div>
    `).join('');
  }

  document.getElementById("project-modal").classList.remove("hidden");
};

function setupModalListeners() {
  const closeBtn = document.getElementById("close-modal-btn");
  const modal = document.getElementById("project-modal");
  
  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }
}

// Helpers
function formatUSD(num) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num || 0);
}

function ordinalSuffix(i) {
  const j = i % 10, k = i % 100;
  if (j === 1 && k !== 11) return i + "st";
  if (j === 2 && k !== 12) return i + "nd";
  if (j === 3 && k !== 13) return i + "rd";
  return i + "th";
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.addEventListener("DOMContentLoaded", initBilling);
