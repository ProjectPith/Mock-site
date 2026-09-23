// Global State
let currentProjects = [];
let activeProject = null;
let activeChatRoomId = null;
let activeChatChannel = null;

if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_bT739cvrORLIrJYQmUVO2Q_9qe25hOU";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const getDb = () => window.supabaseClient;

document.addEventListener("DOMContentLoaded", async () => {
  await fetchProjects();
  setupEventListeners();
});

// ==========================================
// 1. PROJECT INITIALIZATION & SELECTOR
// ==========================================
async function fetchProjects() {
  const db = getDb();
  if (!db) return;

  const { data: projects, error } = await db
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const selector = document.getElementById("project-selector");
  if (!selector) return;

  if (error || !projects || projects.length === 0) {
    selector.innerHTML = `<option value="">No Active Projects Found</option>`;
    return;
  }

  currentProjects = projects;
  selector.innerHTML = projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");

  selector.addEventListener("change", (e) => {
    if (e.target.value) loadProjectDetails(e.target.value);
  });

  // Check URL params for project ID or default to first project
  const urlParams = new URLSearchParams(window.location.search);
  const paramProjectId = urlParams.get("id");

  if (paramProjectId && currentProjects.some(p => p.id === paramProjectId)) {
    selector.value = paramProjectId;
    loadProjectDetails(paramProjectId);
  } else if (currentProjects[0]) {
    selector.value = currentProjects[0].id;
    loadProjectDetails(currentProjects[0].id);
  }
}

async function loadProjectDetails(projectId) {
  activeProject = currentProjects.find(p => p.id === projectId);
  if (!activeProject) return;

  // Render Project Specifications Top-Right
  renderProjectDetails(activeProject);

  // Render Financial Overview Bottom-Left
  renderFinancialOverview(activeProject);

  // Fetch & Render Members Center
  fetchProjectMembers(activeProject);

  // Fetch & Render Bookmarks Top-Left
  fetchProjectBookmarks(activeProject.id);

  // Load Associated Chat Streams Bottom-Right
  fetchProjectChatRooms(activeProject.id);
}

// ==========================================
// 2. RIGHT-TOP: PROJECT SPECS & DETAILS
// ==========================================
function renderProjectDetails(proj) {
  document.getElementById("display-project-title").textContent = proj.name || "Untitled Project";
  document.getElementById("info-client-name").textContent = proj.client_name || proj.client_email || "N/A";
  document.getElementById("info-site-type").textContent = proj.site_type || "N/A";
  document.getElementById("info-color-specs").textContent = proj.color_details || "N/A";
  document.getElementById("info-features").textContent = Array.isArray(proj.selected_features) ? proj.selected_features.join(", ") : (proj.selected_features || "N/A");
  document.getElementById("info-audience").textContent = proj.target_audience || "N/A";
  document.getElementById("info-description").textContent = proj.project_description || "No description provided.";
  document.getElementById("info-custom-specs").textContent = proj.custom_specifications || "None";
}

// ==========================================
// 3. LEFT-BOTTOM: FINANCIAL OVERVIEW
// ==========================================
function renderFinancialOverview(proj) {
  const statusEl = document.getElementById("display-project-status");
  const balanceEl = document.getElementById("display-balance-due");
  const buildPlanBox = document.getElementById("payment-plan-section");
  const buildRemainingEl = document.getElementById("display-build-remaining");

  if (statusEl) statusEl.textContent = proj.status || "Active";
  
  // Current due balance on project
  const currentDue = proj.balance_due !== undefined ? proj.balance_due : 0;
  if (balanceEl) balanceEl.textContent = `$${parseFloat(currentDue).toFixed(2)}`;

  // Payment plan evaluation
  if (proj.has_payment_plan || proj.total_build_remaining !== undefined) {
    if (buildPlanBox) buildPlanBox.classList.remove("hidden");
    const remaining = proj.total_build_remaining || 0;
    if (buildRemainingEl) buildRemainingEl.textContent = `$${parseFloat(remaining).toFixed(2)}`;
  } else {
    if (buildPlanBox) buildPlanBox.classList.add("hidden");
  }
}

// ==========================================
// 4. CENTER: PROJECT MEMBERS
// ==========================================
async function fetchProjectMembers(proj) {
  const db = getDb();
  if (!db || !proj) return;

  const rawEmails = proj.client_emails || (proj.client_email ? [proj.client_email] : []);

  if (rawEmails.length === 0) {
    renderProjectMembers([]);
    return;
  }

  const { data: profiles, error } = await db
    .from("profiles")
    .select("*")
    .in("email", rawEmails);

  const profileMap = {};
  if (profiles) {
    profiles.forEach(p => {
      profileMap[p.email.toLowerCase()] = p;
    });
  }

  const members = rawEmails.map(email => {
    const prof = profileMap[email.toLowerCase()] || {};
    return {
      email: email,
      full_name: prof.full_name || email,
      role: prof.project_role || "Client"
    };
  });

  renderProjectMembers(members);
}

function renderProjectMembers(members) {
  const container = document.getElementById("project-members-list");
  if (!container) return;

  if (!members || members.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:#8b949e;">No project members assigned.</p>`;
    return;
  }

  container.innerHTML = members.map(m => `
    <div class="member-card">
      <div class="member-info">
        <span class="member-name">${escapeHtml(m.full_name)}</span>
        <span class="member-role">${escapeHtml(m.role)}</span>
      </div>
      <button class="btn-sm btn-outline" onclick="openEditMemberModal('${escapeHtml(m.email)}', '${escapeHtml(m.full_name)}', '${escapeHtml(m.role)}')">Edit</button>
    </div>
  `).join("");
}

// Update the event listener in setupEventListeners():
document.getElementById("btn-chat-attach-create")?.addEventListener("click", () => {
  openModal("modal-chat-manage");
  populateUnattachedChats();
  populateModalMembers();
});

// ==========================================
// 5. LEFT-TOP: BOOKMARKS & TOOLS WIDGET
// ==========================================
async function fetchProjectBookmarks(projectId) {
  const container = document.getElementById("bookmarks-list");
  if (!container) return;

  const db = getDb();
  
  // Fetch from bookmarks table or fallback to localStorage
  const { data: bookmarks, error } = await db
    .from("project_bookmarks")
    .select("*")
    .eq("project_id", projectId);

  if (error || !bookmarks || bookmarks.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:#8b949e;">No bookmarks linked to this project.</p>`;
    return;
  }

  container.innerHTML = bookmarks.map(bm => `
    <a href="${bm.url}" target="_blank" class="bookmark-card">
      <span>${escapeHtml(bm.name)} ↗</span>
      <span class="visibility-tag ${bm.visibility}">${bm.visibility}</span>
    </a>
  `).join("");
}

async function saveBookmark(name, url, visibility) {
  if (!activeProject) return;
  const db = getDb();

  await db.from("project_bookmarks").insert({
    project_id: activeProject.id,
    name,
    url,
    visibility
  });

  fetchProjectBookmarks(activeProject.id);
}

// ==========================================
// 6. RIGHT-BOTTOM: PROJECT CHAT MESSAGES WIDGET
// ==========================================
async function fetchProjectChatRooms(projectId) {
  const roomSelect = document.getElementById("chat-room-select");
  if (!roomSelect) return;

  const db = getDb();
  
  const { data: rooms } = await db
    .from("chat_rooms")
    .select("*")
    .eq("project_id", projectId);

  if (!rooms || rooms.length === 0) {
    roomSelect.innerHTML = `<option value="">No Active Project Chat</option>`;
    clearChatMessages();
    return;
  }

  roomSelect.innerHTML = rooms.map(r => `<option value="${r.id}">${escapeHtml(r.name || 'Project Chat')}</option>`).join("");
  
  // Connect to first room
  connectChatRoom(rooms[0].id);
}

function connectChatRoom(roomId) {
  activeChatRoomId = roomId;
  const chatInput = document.getElementById("dash-chat-input");
  const chatSend = document.getElementById("dash-chat-send");
  if (chatInput) chatInput.disabled = false;
  if (chatSend) chatSend.disabled = false;

  const db = getDb();

  if (activeChatChannel) {
    db.removeChannel(activeChatChannel);
    activeChatChannel = null;
  }

  // Subscribe to real-time chat messages
  activeChatChannel = db.channel(`room_${roomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      appendMessageBubble(payload.new);
    })
    .subscribe();

  // Load existing messages
  db.from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .then(({ data: messages }) => {
      const container = document.getElementById("messages-list");
      if (!container) return;
      container.innerHTML = "";
      if (!messages || messages.length === 0) {
        container.innerHTML = `<div class="message-placeholder"><p>No messages in room.</p></div>`;
        return;
      }
      messages.forEach(appendMessageBubble);
    });
}

function clearChatMessages() {
  activeChatRoomId = null;
  const container = document.getElementById("messages-list");
  if (container) container.innerHTML = `<div class="message-placeholder"><p>No chat attached to this project.</p></div>`;
  
  const chatInput = document.getElementById("dash-chat-input");
  const chatSend = document.getElementById("dash-chat-send");
  if (chatInput) chatInput.disabled = true;
  if (chatSend) chatSend.disabled = true;
}

function appendMessageBubble(msg) {
  const container = document.getElementById("messages-list");
  if (!container) return;

  container.querySelector(".message-placeholder")?.remove();

  const bubble = document.createElement("div");
  const isAdmin = msg.sender_type === "admin";
  bubble.className = `dash-msg-bubble ${isAdmin ? 'admin' : 'client'}`;
  bubble.innerHTML = `<div>${escapeHtml(msg.content)}</div>`;

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// ==========================================
// 7. EVENT LISTENERS & MODAL CONTROLS
// ==========================================
function setupEventListeners() {
  // Bookmark Modal
  document.getElementById("btn-add-bookmark")?.addEventListener("click", () => openModal("modal-bookmark"));
  document.getElementById("form-add-bookmark")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("bm-name").value;
    const url = document.getElementById("bm-url").value;
    const vis = document.getElementById("bm-visibility").value;
    saveBookmark(name, url, vis);
    closeModal("modal-bookmark");
    e.target.reset();
  });

  // Docs Modal
  document.getElementById("btn-open-docs")?.addEventListener("click", () => {
    openModal("modal-docs");
    renderDocsList();
  });

  // Chat Form Send
  document.getElementById("dash-chat-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("dash-chat-input");
    if (!activeChatRoomId || !input.value.trim()) return;

    const msg = input.value.trim();
    input.value = "";

    const db = getDb();
    await db.from("messages").insert({
      room_id: activeChatRoomId,
      sender_type: "admin",
      sender_name: "Admin",
      content: msg
    });
  });

  // Attach / Create Chat Modal Controls
  document.getElementById("btn-chat-attach-create")?.addEventListener("click", () => {
    openModal("modal-chat-manage");
    populateUnattachedChats();
  });

  // Detach Chat Button
  document.getElementById("btn-chat-detach")?.addEventListener("click", async () => {
    if (!activeChatRoomId || !activeProject) return;
    if (!confirm("Remove open chat room from this project?")) return;

    const db = getDb();
    await db.from("chat_rooms").update({ project_id: null }).eq("id", activeChatRoomId);
    fetchProjectChatRooms(activeProject.id);
  });

  // Form: Attach Chat
  document.getElementById("form-attach-chat")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const roomId = document.getElementById("attach-chat-select").value;
    if (!roomId || !activeProject) return;

    const db = getDb();
    await db.from("chat_rooms").update({ project_id: activeProject.id }).eq("id", roomId);
    closeModal("modal-chat-manage");
    fetchProjectChatRooms(activeProject.id);
  });

  // Form: Create Chat
  document.getElementById("form-create-chat")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("new-chat-name").value;
    if (!name || !activeProject) return;

    const db = getDb();
    const { data: newRoom } = await db.from("chat_rooms").insert({
      name: name,
      project_id: activeProject.id,
      client_email: activeProject.client_email || null
    }).select().single();

    closeModal("modal-chat-manage");
    if (newRoom) fetchProjectChatRooms(activeProject.id);
  });
}

// Modal Helpers
window.openModal = function(modalId) {
  document.getElementById(modalId)?.classList.remove("hidden");
};

window.closeModal = function(modalId) {
  document.getElementById(modalId)?.classList.add("hidden");
};

window.toggleChatTab = function(tab) {
  if (tab === 'attach') {
    document.getElementById("tab-btn-attach").classList.add("active");
    document.getElementById("tab-btn-create").classList.remove("active");
    document.getElementById("form-attach-chat").classList.remove("hidden");
    document.getElementById("form-create-chat").classList.add("hidden");
  } else {
    document.getElementById("tab-btn-create").classList.add("active");
    document.getElementById("tab-btn-attach").classList.remove("active");
    document.getElementById("form-create-chat").classList.remove("hidden");
    document.getElementById("form-attach-chat").classList.add("hidden");
  }
};

window.openEditMemberModal = function(email, name, role) {
  document.getElementById("edit-member-id").value = email;
  document.getElementById("edit-member-label").textContent = `${name} (${email})`;
  document.getElementById("edit-member-role").value = role;
  openModal("modal-member-edit");
};

async function populateUnattachedChats() {
  const select = document.getElementById("attach-chat-select");
  if (!select) return;

  const db = getDb();
  const { data: rooms } = await db.from("chat_rooms").select("*").is("project_id", null);

  if (!rooms || rooms.length === 0) {
    select.innerHTML = `<option value="">No unattached chat rooms found.</option>`;
    return;
  }

  select.innerHTML = rooms.map(r => `<option value="${r.id}">${escapeHtml(r.name || r.client_email || 'Chat Room')}</option>`).join("");
}

function renderDocsList() {
  const container = document.getElementById("docs-modal-body");
  if (!container || !activeProject) return;

  const docs = [];
  if (activeProject.intake_pdf_url) docs.push({ name: "Intake Specification PDF", url: activeProject.intake_pdf_url });
  if (activeProject.contract_pdf_url) docs.push({ name: "Signed Service Contract PDF", url: activeProject.contract_pdf_url });

  if (docs.length === 0) {
    container.innerHTML = `<p style="font-size:0.85rem; color:#8b949e;">No PDF documents attached to this project.</p>`;
    return;
  }

  container.innerHTML = docs.map(d => `
    <div class="bookmark-card" style="margin-bottom:0.5rem;">
      <span>📄 ${escapeHtml(d.name)}</span>
      <a href="${d.url}" target="_blank" class="btn-sm btn-accent" style="text-decoration:none;">View PDF ↗</a>
    </div>
  `).join("");
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
