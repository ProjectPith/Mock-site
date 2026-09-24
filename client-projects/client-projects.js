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

  // 1. Get current authenticated session user
  const { data: { user } } = await db.auth.getUser();

  if (user) {
    activeUserEmail = user.email;
  } else {
    // Fallback: If session isn't active, try looking up profile or URL param fallback for testing
    const urlParams = new URLSearchParams(window.location.search);
    activeUserEmail = urlParams.get("email");
  }

  // If we have an email from session or profile query
  if (activeUserEmail) {
    await fetchUserProjects(activeUserEmail);
  } else {
    // Attempt profile fetch from current authenticated user context
    const { data: profile } = await db.from("profiles").select("email").maybeSingle();
    if (profile?.email) {
      activeUserEmail = profile.email;
      await fetchUserProjects(activeUserEmail);
    } else {
      renderProjectsList([]);
    }
  }
}

async function fetchUserProjects(email) {
  const db = getDb();
  const container = document.getElementById("projects-list");
  if (!container) return;

  container.innerHTML = `<p class="loading-text">Loading your projects...</p>`;

  // 2. Query projects where client_emails contains the user's email
  const { data: projects, error } = await db
    .from("projects")
    .select("*")
    .cs("client_emails", [email]) // Using Supabase array contains filter
    .order("created_at", { ascending: false });

  // Fallback query if cs operator filter behaves differently for plain array strings
  let finalProjects = projects;
  if ((!finalProjects || finalProjects.length === 0) && !error) {
    const { data: allProjects } = await db.from("projects").select("*");
    if (allProjects) {
      finalProjects = allProjects.filter(p => {
        const emails = Array.isArray(p.client_emails) 
          ? p.client_emails 
          : (p.client_emails ? p.client_emails.split(",").map(e => e.trim()) : []);
        if (p.client_email) emails.push(p.client_email);
        return emails.some(e => e.toLowerCase() === email.toLowerCase());
      });
    }
  }

  if (error && (!finalProjects || finalProjects.length === 0)) {
    console.error("Error fetching projects:", error);
    container.innerHTML = `<p class="empty-text">Error loading projects.</p>`;
    return;
  }

  userProjects = finalProjects || [];
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
  // Ready for next step
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
