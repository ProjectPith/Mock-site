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
  const container = document.getElementById("members-list") || document.getElementById("project-members-list");
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

// Add Member Modal Listener
  document.getElementById("btn-add-member")?.addEventListener("click", () => {
    openModal("modal-member-add");
  });

// ==========================================
// 5. LEFT-TOP: BOOKMARKS & TOOLS WIDGET
// ==========================================
async function fetchProjectBookmarks(projectId) {
  const container = document.getElementById("bookmarks-list");
  if (!container) return;

  const db = getDb();

  // Query bookmarks table filtered exclusively by project_id
  const { data: bookmarks, error } = await db
    .from("bookmarks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error || !bookmarks || bookmarks.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:#8b949e;">No bookmarks linked to this project.</p>`;
    return;
  }

  container.innerHTML = bookmarks.map(bm => `
    <a href="${escapeHtml(bm.url)}" target="_blank" rel="noopener noreferrer" class="bookmark-card">
      <span>${escapeHtml(bm.name)} ↗</span>
      <span class="visibility-tag ${bm.visibility}">${escapeHtml(bm.visibility)}</span>
    </a>
  `).join("");
}

async function saveBookmark(name, url, visibility) {
  if (!activeProject) return;
  const db = getDb();

  const { error } = await db.from("bookmarks").insert({
    project_id: activeProject.id,
    name: name,
    url: url,
    visibility: visibility
  });

  if (error) {
    console.error("Error saving bookmark:", error);
    alert("Failed to save bookmark.");
    return;
  }

  // Refresh bookmarks list for active project
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

  // Render rooms dropdown
  roomSelect.innerHTML = rooms.map(r => `<option value="${r.id}">${escapeHtml(r.name || 'Project Chat')}</option>`).join("");
  
  // Attach change listener to switch chat rooms when selected
  roomSelect.onchange = (e) => {
    if (e.target.value) {
      connectChatRoom(e.target.value);
    }
  };

  // Connect to first room by default
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
    populateModalMembers(); // <-- Ensures actual project members are rendered
  });

  // Detach Chat Button
  document.getElementById("btn-chat-detach")?.addEventListener("click", async () => {
    if (!activeChatRoomId || !activeProject) return;
    if (!confirm("Remove open chat room from this project?")) return;

    const db = getDb();
    await db.from("chat_rooms").update({ project_id: null }).eq("id", activeChatRoomId);
    fetchProjectChatRooms(activeProject.id);
  });

  // Form: Create Chat
  document.getElementById("form-create-chat")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("new-chat-name").value;
    const externalEmail = document.getElementById("chat-external-email")?.value.trim();
    if (!name || !activeProject) return;

    // 1. Collect selected member emails from checkboxes
    const selectedCheckboxes = document.querySelectorAll('input[name="chat-members"]:checked');
    const memberEmails = Array.from(selectedCheckboxes).map(cb => cb.value);

    // 2. Append external email if provided and not already included
    if (externalEmail && !memberEmails.includes(externalEmail)) {
      memberEmails.push(externalEmail);
    }

    // 3. Fallback: if nothing selected, use active project email
    if (memberEmails.length === 0 && activeProject.client_email) {
      memberEmails.push(activeProject.client_email);
    }

    const db = getDb();

    // 4. Query profiles for all emails to pull full names
    const { data: profiles } = await db
      .from("profiles")
      .select("email, full_name")
      .in("email", memberEmails);

    const profileMap = {};
    if (profiles) {
      profiles.forEach(p => {
        if (p.email) profileMap[p.email.toLowerCase()] = p.full_name;
      });
    }

    // 5. Separate names and emails into two clean lists
    const namesList = [];
    const emailsList = [];

    memberEmails.forEach(email => {
      const fullName = profileMap[email.toLowerCase()];
      emailsList.push(email);
      namesList.push(fullName || email); // Uses profile full_name if found, otherwise email
    });

    // 6. Insert with names in client_name and emails in client_email
    const { data: newRoom, error } = await db.from("chat_rooms").insert({
      name: name,
      project_id: activeProject.id,
      client_email: emailsList.join(", "),
      client_name: namesList.join(", ")
    }).select().single();

    if (error) {
      console.error("Error creating chat room:", error);
      alert("Failed to create chat room: " + error.message);
      return;
    }

    closeModal("modal-chat-manage");
    e.target.reset();
    if (newRoom) fetchProjectChatRooms(activeProject.id);
  });

  // Form: Add Member Submit
  document.getElementById("form-add-member")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("add-member-email").value.trim();
    if (!email || !activeProject) return;

    const db = getDb();

    // 1. Get existing emails & names arrays/strings from activeProject
    const currentEmails = activeProject.client_emails || (activeProject.client_email ? [activeProject.client_email] : []);
    const currentNames = activeProject.client_names || (activeProject.client_name ? [activeProject.client_name] : []);

    // 2. Look up the new member's full name in profiles
    const { data: profile } = await db
      .from("profiles")
      .select("full_name")
      .ilike("email", email)
      .maybeSingle();

    const memberName = profile?.full_name || email;

    // 3. Append email and resolved name if not already present
    if (!currentEmails.map(e => e.toLowerCase()).includes(email.toLowerCase())) {
      currentEmails.push(email);
      currentNames.push(memberName);
    }

    // 4. Update the projects table with both lists
    const { error } = await db
      .from("projects")
      .update({ 
        client_emails: currentEmails,
        client_names: currentNames
      })
      .eq("id", activeProject.id);

    if (error) {
      console.error("Error adding member:", error);
      alert("Failed to add member: " + error.message);
      return;
    }

    // 5. Update local state & refresh project details + members UI
    activeProject.client_emails = currentEmails;
    activeProject.client_names = currentNames;
    
    // Refresh members list and header info
    fetchProjectMembers(activeProject);
    renderProjectDetails(activeProject);

    closeModal("modal-member-add");
    e.target.reset();
  });

  // Open Status Selection Overlay
  document.getElementById("display-project-status")?.addEventListener("click", () => {
    if (activeProject) {
      openModal("modal-status-select");
    }
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

window.updateProjectStatus = async function(newStatus) {
  if (!activeProject) return;

  const db = getDb();
  
  // Update status in Supabase
  const { error } = await db
    .from("projects")
    .update({ status: newStatus })
    .eq("id", activeProject.id);

  if (error) {
    console.error("Error updating project status:", error);
    alert("Failed to update status: " + error.message);
    return;
  }

  // Update active state & UI
  activeProject.status = newStatus;
  const statusEl = document.getElementById("display-project-status");
  if (statusEl) {
    statusEl.textContent = newStatus;
  }

  // Also sync the project in currentProjects list
  const proj = currentProjects.find(p => p.id === activeProject.id);
  if (proj) proj.status = newStatus;

  closeModal("modal-status-select");
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

async function populateModalMembers() {
  const container = document.getElementById("modal-chat-members-select");
  if (!container || !activeProject) return;

  const db = getDb();
  const rawEmails = activeProject.client_emails || (activeProject.client_email ? [activeProject.client_email] : []);

  if (rawEmails.length === 0) {
    container.innerHTML = `<p style="font-size:0.8rem; color:#8b949e;">No project members available.</p>`;
    return;
  }

  const { data: profiles } = await db
    .from("profiles")
    .select("*")
    .in("email", rawEmails);

  const profileMap = {};
  if (profiles) {
    profiles.forEach(p => {
      profileMap[p.email.toLowerCase()] = p;
    });
  }

  container.innerHTML = rawEmails.map((email) => {
    const prof = profileMap[email.toLowerCase()] || {};
    const displayName = prof.full_name || email;
    const role = prof.project_role || "Client";

    return `
      <label class="checkbox-item">
        <input type="checkbox" name="chat-members" value="${escapeHtml(email)}" checked>
        ${escapeHtml(displayName)} (${escapeHtml(role)})
      </label>
    `;
  }).join("");
}
