// Global State
let userProjects = [];
let activeUserEmail = null;

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

  // 1. Check active Supabase auth session
  const { data: { user } } = await db.auth.getUser();

  if (user && user.email) {
    activeUserEmail = user.email;
  } else {
    // Look up email in profiles table for current user session
    const { data: profile } = await db.from("profiles").select("email").maybeSingle();
    if (profile?.email) {
      activeUserEmail = profile.email;
    } else {
      // Fallback URL param for manual testing (e.g. ?email=client@example.com)
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

  // 2. Query projects table
  const { data: allProjects, error } = await db
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    container.innerHTML = `<p class="empty-text">Error loading projects.</p>`;
    return;
  }

  // 3. Match profiles email against client_emails in projects
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

function selectProject(projectId) {
  console.log("Selected project ID:", projectId);
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
