// Initialization pattern matching your existing modules
if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const getDb = window.supabaseClient;

document.addEventListener("DOMContentLoaded", () => {
  loadToolBookmarks();
  fetchProjects();
  setupEventListeners();
});

// ==========================================
// 1. TOOL BOOKMARKS LOGIC (LocalStorage)
// ==========================================
function loadToolBookmarks() {
  const tools = JSON.parse(localStorage.getItem("dev_tools") || "[]");
  const container = document.getElementById("tools-list");
  
  if (tools.length === 0) {
    container.innerHTML = `<p style="font-size: 0.8rem; color: #8b949e;">No tools bookmarked yet.</p>`;
    return;
  }

  container.innerHTML = tools.map((tool, index) => `
    <a href="${tool.url}" target="_blank" class="tool-card">
      <span>${tool.name}</span>
      <span style="font-size: 0.75rem; color: #8b949e;">↗</span>
    </a>
  `).join("");
}

function saveToolBookmark(name, url) {
  const tools = JSON.parse(localStorage.getItem("dev_tools") || "[]");
  tools.push({ name, url });
  localStorage.setItem("dev_tools", JSON.stringify(tools));
  loadToolBookmarks();
}

// ==========================================
// 2. ACTIVE PROJECTS LOGIC
// ==========================================
async function fetchProjects() {
  const tableBody = document.getElementById("projects-table-body");

  // Fetching projects from Supabase 'projects' table
  const { data: projects, error } = await db
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Projects table notice:", error.message);
    tableBody.innerHTML = `<tr><td colspan="5" style="color: #8b949e; text-align: center;">No active projects found.</td></tr>`;
    return;
  }

  if (!projects || projects.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="color: #8b949e; text-align: center;">No active projects. Start a new contract above.</td></tr>`;
    return;
  }

  tableBody.innerHTML = projects.map(proj => `
    <tr class="project-row" onclick="navigateToProject('${proj.id}')">
      <td><strong>${proj.name}</strong></td>
      <td>${proj.client_name || proj.client_email}</td>
      <td><span class="badge">${proj.status || 'Active'}</span></td>
      <td>
        ${proj.repo_url ? `<a href="${proj.repo_url}" target="_blank" onclick="event.stopPropagation();">Repo ↗</a>` : 'N/A'}
      </td>
      <td><button class="btn btn-outline btn-sm">View Page</button></td>
    </tr>
  `).join("");
}

// Navigates directly to the single project detail page
window.navigateToProject = function(projectId) {
  window.location.href = `../projects/project.html?id=${projectId}`;
};

// ==========================================
// 3. EVENT LISTENERS & MODALS
// ==========================================
function setupEventListeners() {
  const toolModal = document.getElementById("tool-modal");
  
  document.getElementById("add-tool-btn").addEventListener("click", () => {
    toolModal.classList.remove("hidden");
  });

  document.getElementById("close-tool-modal").addEventListener("click", () => {
    toolModal.classList.add("hidden");
  });

  document.getElementById("add-tool-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("tool-name").value;
    const url = document.getElementById("tool-url").value;
    
    saveToolBookmark(name, url);
    
    document.getElementById("add-tool-form").reset();
    toolModal.classList.add("hidden");
  });

  // Future Contract Generator Workflow Trigger
  document.getElementById("start-contract-btn").addEventListener("click", () => {
    window.location.href = "../contracts/new-contract.html";
  });
  document.addEventListener("DOMContentLoaded", () => {
    loadToolBookmarks();
    fetchProjects();
    renderPayoutWidget();
    setupEventListeners();
  });

  // ==========================================
  // PAYOUT WIDGET DISPLAY LOGIC
  // ==========================================
  async function renderPayoutWidget() {
    if (!window.BookkeepingEngine) {
      console.error("BookkeepingEngine script not found.");
      return;
    }

    // Pull calculated figures directly from the bookkeeping module
    const { grossRevenue, totalDeductions, netPayout } = await window.BookkeepingEngine.calculateNetPayout();

    // Render to UI
    document.getElementById("net-payout-display").textContent = `$${netPayout.toFixed(2)}`;
    document.getElementById("payout-gross").textContent = `Gross: $${grossRevenue.toFixed(2)}`;
    document.getElementById("payout-deductions").textContent = `Est. Cuts/Tax: -$${totalDeductions.toFixed(2)}`;
  }

  window.navigateToBookkeeping = function() {
    window.location.href = "../bookkeeping/bookkeeping.html";
  };
}
