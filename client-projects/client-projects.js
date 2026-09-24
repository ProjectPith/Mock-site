// Global State
let userProjects = [];
let activeUserEmail = null;
let activeProject = null;
let projectBookmarks = [];
let toastTimeout = null;

if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_bT739cvrORLIrJYQmUVO2Q_9qe25hOU";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const getDb = () => window.supabaseClient;

document.addEventListener("DOMContentLoaded", async () => {
  await initClientDashboard();
});

async function initClientDashboard() {
  const db = getDb();
  if (!db) return;

  const { data: { user } } = await db.auth.getUser();

  if (user && user.email) {
    activeUserEmail = user.email;
  } else {
    const { data: profile } = await db.from("profiles").select("email").maybeSingle();
    if (profile?.email) {
      activeUserEmail = profile.email;
    } else {
      const urlParams = new URLSearchParams(window.location.search);
      activeUserEmail = urlParams.get("email");
    }
  }

  if (activeUserEmail) {
    await fetchUserProjects(activeUserEmail);
  } else {
    renderProjectsList([]);
  }
}

async function fetchUserProjects(email) {
  const container = document.getElementById("projects-list");
  if (!container) return;

  container.innerHTML = `<p class="loading-text">Loading your projects...</p>`;

  const db = getDb();

  const { data: allProjects, error } = await db
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    container.innerHTML = `<p class="empty-text">Error loading projects.</p>`;
    return;
  }

  const targetEmail = email.toLowerCase();
  
  userProjects = (allProjects || []).filter(proj => {
    let projectEmails = [];

    if (Array.isArray(proj.client_emails)) {
      projectEmails = proj.client_emails;
    } else if (typeof proj.client_emails === "string") {
      projectEmails = proj.client_emails.split(",").map(e => e.trim());
    }

    if (proj.client_email) {
      projectEmails.push(proj.client_email);
    }

    return projectEmails.some(e => e.toLowerCase() === targetEmail);
  });

  renderProjectsList(userProjects);
}

function renderProjectsList(projects) {
  const container = document.getElementById("projects-list");
  if (!container) return;

  if (!projects || projects.length === 0) {
    container.innerHTML = `<p class="empty-text">No active projects found for your account.</p>`;
    return;
  }

  container.innerHTML = projects.map(p => {
    const status = p.status || "Active";
    return `
      <button type="button" class="project-card-btn" onclick="selectProject('${escapeHtml(p.id)}')">
        <div class="project-card-info">
          <span class="project-card-title">${escapeHtml(p.name || "Untitled Project")}</span>
        </div>
        <span class="status-badge status-${escapeHtml(status.toLowerCase().replace(/\s+/g, '-'))}">
          ${escapeHtml(status)}
        </span>
      </button>
    `;
  }).join("");
}

async function selectProject(projectId) {
  activeProject = userProjects.find(p => p.id === projectId);
  if (!activeProject) return;

  // 1. Hide Project Selector List & Show Details View
  document.getElementById("projects-list")?.classList.add("hidden");
  document.getElementById("project-details-view")?.classList.remove("hidden");

  // 2. Update Header Title & Show Back Button
  const titleEl = document.getElementById("projects-widget-title");
  if (titleEl) titleEl.textContent = activeProject.name || "Project Details";
  document.getElementById("btn-back-to-projects")?.classList.remove("hidden");

  // 3. Fetch Bookmarks matching active project_id
  const db = getDb();
  const { data: bookmarks, error } = await db
    .from("bookmarks")
    .select("*")
    .eq("project_id", projectId);

  if (error) {
    console.error("Error fetching bookmarks:", error);
    projectBookmarks = [];
  } else {
    projectBookmarks = bookmarks || [];
  }

  renderLinkBoxes();
}

function deselectProject() {
  activeProject = null;
  projectBookmarks = [];

  // Show Project List & Hide Details View
  document.getElementById("projects-list")?.classList.remove("hidden");
  document.getElementById("project-details-view")?.classList.add("hidden");

  // Reset Header Title & Hide Back Button
  const titleEl = document.getElementById("projects-widget-title");
  if (titleEl) titleEl.textContent = "Projects";
  document.getElementById("btn-back-to-projects")?.classList.add("hidden");
}

function renderLinkBoxes() {
  // 1. LIVE LINK -> Look for "site"
  const liveBookmark = projectBookmarks.find(b => b.name && b.name.toLowerCase().trim() === "site");
  setupLinkBox("btn-link-live", liveBookmark?.url);

  // 2. TEST LINK -> Look for "test environment"
  const testBookmark = projectBookmarks.find(b => b.name && b.name.toLowerCase().trim() === "test environment");
  setupLinkBox("btn-link-test", testBookmark?.url);

  // 3. GITHUB REPOSITORY -> "repo access" takes priority over "public repo"
  const repoAccess = projectBookmarks.find(b => b.name && b.name.toLowerCase().trim() === "repo access");
  const publicRepo = projectBookmarks.find(b => b.name && b.name.toLowerCase().trim() === "public repo");
  const githubBookmark = repoAccess || publicRepo;
  setupLinkBox("btn-link-github", githubBookmark?.url);
}

function setupLinkBox(buttonId, url) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  if (url) {
    btn.classList.add("available");
    btn.classList.remove("disabled");
    btn.onclick = () => window.open(url, "_blank", "noopener,noreferrer");
  } else {
    btn.classList.add("disabled");
    btn.classList.remove("available");
    btn.onclick = () => showToast("Link has not been attached yet.");
  }
}

function showToast(message) {
  const toast = document.getElementById("toast-overlay");
  const toastMsg = document.getElementById("toast-message");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.remove("hidden");

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 5000);
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
