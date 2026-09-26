// Global State
let currentProjects = [];
let activeProject = null;
let activeChatRoomId = null;
let activeChatChannel = null;
let editingBubbleIndex = null;
let memberToRemoveEmail = null;
let projectBookmarks = [];
let editingBookmarkId = null;

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

  renderProjectDetails(activeProject);
  renderFinancialOverview(activeProject);
  fetchProjectMembers(activeProject);
  fetchProjectBookmarks(activeProject.id);
  fetchProjectChatRooms(activeProject.id);
}

// ==========================================
// 2. RIGHT-TOP: PROJECT SPECS & DETAILS
// ==========================================
function renderProjectDetails(proj) {
  document.getElementById("display-project-title").textContent = proj.name || "Untitled Project";

  // Left Side
  document.getElementById("info-company-name").textContent = proj.company_name || proj.client_name || "N/A";
  document.getElementById("info-custom-domain").textContent = proj.custom_domain || "N/A";
  document.getElementById("info-site-type").textContent = proj.site_type || "N/A";
  
  const features = Array.isArray(proj.selected_features) 
    ? proj.selected_features.join(", ") 
    : (proj.selected_features || "N/A");
  document.getElementById("info-selected-features").textContent = features;
  document.getElementById("info-project-description").textContent = proj.project_description || "No project description provided.";

  // Right Side
  document.getElementById("info-color-mode").textContent = proj.color_mode || "N/A";
  document.getElementById("info-target-audience").textContent = proj.target_audience || "N/A";
  document.getElementById("info-extra-notes").textContent = proj.extra_notes || proj.custom_specifications || "None";

  // Parse Color Details into 4 Bubbles + Extra Text
  renderColorBubbles(proj.color_details || "");
}

function renderColorBubbles(colorDetailsStr) {
  const bubbles = document.querySelectorAll("#color-bubbles-row .color-bubble");
  const extraTextEl = document.getElementById("info-color-details-extra");

  const hexRegex = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
  const foundHexes = colorDetailsStr.match(hexRegex) || [];

  let remainingText = colorDetailsStr;
  foundHexes.forEach(hex => {
    remainingText = remainingText.replace(hex, "");
  });
  remainingText = remainingText.replace(/[,;]/g, " ").trim();

  bubbles.forEach((bubble, index) => {
    const hex = foundHexes[index] || "#FFFFFF";
    bubble.style.backgroundColor = hex;
    bubble.dataset.hex = hex;
  });

  if (remainingText && extraTextEl) {
    extraTextEl.textContent = remainingText;
    extraTextEl.classList.remove("hidden");
  } else if (extraTextEl) {
    extraTextEl.classList.add("hidden");
  }
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

  const currentBalance = proj.current_balance !== undefined && proj.current_balance !== null 
    ? proj.current_balance 
    : (proj.balance_due !== undefined && proj.balance_due !== null ? proj.balance_due : 0);
    
  if (balanceEl) balanceEl.textContent = `$${parseFloat(currentBalance).toFixed(2)}`;

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

  const { data: profiles } = await db
    .from("profiles")
    .select("*")
    .in("email", rawEmails);

  const profileMap = {};
  if (profiles) {
    profiles.forEach(p => {
      if (p.email) profileMap[p.email.toLowerCase()] = p;
    });
  }

  const members = rawEmails.map(email => {
    const prof = profileMap[email.toLowerCase()] || {};
    return {
      email: email,
      full_name: prof.full_name || email
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
        <span class="member-email-sub">${escapeHtml(m.email)}</span>
      </div>
      <button class="btn-sm btn-danger" onclick="openRemoveMemberModal(${JSON.stringify(String(m.email))}, ${JSON.stringify(String(m.full_name))})">Remove</button>
    </div>
  `).join("");
}

window.openRemoveMemberModal = function(email, displayName) {
  memberToRemoveEmail = email;
  const label = document.getElementById("remove-member-label");
  if (label) label.textContent = `${displayName} (${email})`;
  openModal("modal-member-remove");
};

async function confirmRemoveMember() {
  if (!memberToRemoveEmail || !activeProject) return;

  const db = getDb();

  // Filter out email from client_emails
  const currentEmails = activeProject.client_emails || (activeProject.client_email ? [activeProject.client_email] : []);
  const updatedEmails = currentEmails.filter(e => e.toLowerCase() !== memberToRemoveEmail.toLowerCase());

  // Filter out name from client_names
  const currentNames = activeProject.client_names || (activeProject.client_name ? [activeProject.client_name] : []);
  const updatedNames = currentNames.filter((_, idx) => {
    return currentEmails[idx] && currentEmails[idx].toLowerCase() !== memberToRemoveEmail.toLowerCase();
  });

  const { error } = await db
    .from("projects")
    .update({ 
      client_emails: updatedEmails,
      client_names: updatedNames
    })
    .eq("id", activeProject.id);

  if (error) {
    console.error("Error removing member:", error);
    alert("Failed to remove member: " + error.message);
    return;
  }

  activeProject.client_emails = updatedEmails;
  activeProject.client_names = updatedNames;

  fetchProjectMembers(activeProject);
  renderProjectDetails(activeProject);

  memberToRemoveEmail = null;
  closeModal("modal-member-remove");
}

// ==========================================
// 5. LEFT-TOP: BOOKMARKS & TOOLS WIDGET
// ==========================================
async function fetchProjectBookmarks(projectId) {
  const container = document.getElementById("bookmarks-list");
  if (!container) return;

  const db = getDb();

  const { data: bookmarks, error } = await db
    .from("bookmarks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error || !bookmarks || bookmarks.length === 0) {
    projectBookmarks = [];
    container.innerHTML = `<p style="font-size:0.8rem; color:#8b949e;">No bookmarks linked to this project.</p>`;
    return;
  }

  projectBookmarks = bookmarks;
  container.innerHTML = projectBookmarks.map(bm => `
    <div class="project-bookmark-item">
      <a href="${escapeHtml(bm.url)}" target="_blank" rel="noopener noreferrer" class="bookmark-card">
        <span>${escapeHtml(bm.name)} ↗</span>
        <span class="visibility-tag ${escapeHtml(bm.visibility)}">${escapeHtml(bm.visibility)}</span>
      </a>
      <div class="project-bookmark-actions">
        <button type="button" data-bookmark-action="edit" data-bookmark-id="${escapeHtml(bm.id)}">Edit</button>
        <button type="button" data-bookmark-action="delete" data-bookmark-id="${escapeHtml(bm.id)}">Delete</button>
      </div>
    </div>
  `).join("");
}

async function saveBookmark(name, url, visibility) {
  if (!activeProject) return;
  const db = getDb();

  const changes = { name, url, visibility };
  const result = editingBookmarkId
    ? await db.from("bookmarks").update(changes).eq("id", editingBookmarkId).eq("project_id", activeProject.id)
    : await db.from("bookmarks").insert({ ...changes, project_id: activeProject.id });

  if (result.error) {
    console.error("Error saving bookmark:", result.error);
    alert("Failed to save bookmark.");
    return false;
  }

  editingBookmarkId = null;
  await fetchProjectBookmarks(activeProject.id);
  return true;
}

function openProjectBookmarkEditor(bookmark) {
  editingBookmarkId = bookmark.id;
  document.getElementById("bm-name").value = bookmark.name || "";
  document.getElementById("bm-url").value = bookmark.url || "";
  document.getElementById("bm-visibility").value = bookmark.visibility || "private";
  document.querySelector("#modal-bookmark h3").textContent = "Edit Project Bookmark";
  document.querySelector("#form-add-bookmark button[type='submit']").textContent = "Save Changes";
  openModal("modal-bookmark");
}

function resetProjectBookmarkForm() {
  editingBookmarkId = null;
  document.getElementById("form-add-bookmark")?.reset();
  document.querySelector("#modal-bookmark h3").textContent = "Add Project Bookmark";
  document.querySelector("#form-add-bookmark button[type='submit']").textContent = "Save Bookmark";
}

async function deleteProjectBookmark(bookmarkId) {
  const bookmark = projectBookmarks.find(item => item.id === bookmarkId);
  if (!activeProject || !bookmark || !window.confirm(`Delete the bookmark "${bookmark.name}"?`)) return;

  const db = getDb();
  const { error } = await db
    .from("bookmarks")
    .delete()
    .eq("id", bookmarkId)
    .eq("project_id", activeProject.id);

  if (error) {
    console.error("Error deleting bookmark:", error);
    alert("Failed to delete bookmark.");
    return;
  }

  await fetchProjectBookmarks(activeProject.id);
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
  
  roomSelect.onchange = (e) => {
    if (e.target.value) {
      connectChatRoom(e.target.value);
    }
  };

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
  // Confirm Remove Member Button
  document.getElementById("btn-confirm-remove-member")?.addEventListener("click", confirmRemoveMember);

  // Bookmark Modal
  document.getElementById("btn-add-bookmark")?.addEventListener("click", () => {
    resetProjectBookmarkForm();
    openModal("modal-bookmark");
  });
  document.getElementById("form-add-bookmark")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("bm-name").value;
    const url = document.getElementById("bm-url").value;
    const vis = document.getElementById("bm-visibility").value;
    const saved = await saveBookmark(name, url, vis);
    if (!saved) return;

    closeModal("modal-bookmark");
    resetProjectBookmarkForm();
  });

  document.getElementById("bookmarks-list")?.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-bookmark-action]");
    if (!button) return;

    const bookmark = projectBookmarks.find(item => item.id === button.dataset.bookmarkId);
    if (!bookmark) return;

    if (button.dataset.bookmarkAction === "edit") openProjectBookmarkEditor(bookmark);
    if (button.dataset.bookmarkAction === "delete") deleteProjectBookmark(bookmark.id);
  });

  // Docs Modal
  document.getElementById("btn-open-docs")?.addEventListener("click", () => {
    openModal("modal-docs");
    renderDocsList();
  });

  // Open Edit Details Modal
  document.getElementById("btn-edit-details")?.addEventListener("click", () => {
    if (!activeProject) return;
    populateEditDetailsModal(activeProject);
    openModal("modal-edit-details");
  });

  // Submit Edit Details Form
  document.getElementById("form-edit-details")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeProject) return;

    const db = getDb();

    const featuresRaw = document.getElementById("edit-selected-features").value;
    const featuresArr = featuresRaw.split(",").map(f => f.trim()).filter(Boolean);

    const updatePayload = {
      company_name: document.getElementById("edit-company-name").value.trim(),
      custom_domain: document.getElementById("edit-custom-domain").value.trim(),
      site_type: document.getElementById("edit-site-type").value.trim(),
      selected_features: featuresArr,
      project_description: document.getElementById("edit-project-description").value.trim(),
      color_mode: document.getElementById("edit-color-mode").value.trim(),
      color_details: document.getElementById("edit-color-details").value.trim(),
      target_audience: document.getElementById("edit-target-audience").value.trim(),
      extra_notes: document.getElementById("edit-extra-notes").value.trim()
    };

    const { error } = await db
      .from("projects")
      .update(updatePayload)
      .eq("id", activeProject.id);

    if (error) {
      console.error("Error updating project details:", error);
      alert("Failed to save project details: " + error.message);
      return;
    }

    Object.assign(activeProject, updatePayload);
    renderProjectDetails(activeProject);
    closeModal("modal-edit-details");
  });

  // Color Bubbles Click Handlers
  document.querySelectorAll("#color-bubbles-row .color-bubble").forEach(bubble => {
    bubble.addEventListener("click", (e) => {
      editingBubbleIndex = parseInt(e.currentTarget.dataset.index, 10);
      const currentHex = e.currentTarget.dataset.hex || "#FFFFFF";
      
      const shadePicker = document.getElementById("shade-picker-input");
      const hexInput = document.getElementById("hex-code-input");
      
      if (shadePicker) shadePicker.value = currentHex.length === 7 ? currentHex : "#FFFFFF";
      if (hexInput) hexInput.value = currentHex;

      openModal("modal-color-picker");
    });
  });

  // Sync Color Inputs in Color Picker Modal
  document.getElementById("shade-picker-input")?.addEventListener("input", (e) => {
    const hexInput = document.getElementById("hex-code-input");
    if (hexInput) hexInput.value = e.target.value.toUpperCase();
  });

  document.getElementById("hex-code-input")?.addEventListener("input", (e) => {
    const shadePicker = document.getElementById("shade-picker-input");
    const val = e.target.value.trim();
    if (/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(val) && shadePicker) {
      shadePicker.value = val;
    }
  });

  // Apply Single Color Bubble Edit
  document.getElementById("btn-save-color-bubble")?.addEventListener("click", async () => {
    if (editingBubbleIndex === null || !activeProject) return;

    let newHex = document.getElementById("hex-code-input").value.trim();
    if (!newHex.startsWith("#")) newHex = "#" + newHex;

    const bubbles = document.querySelectorAll("#color-bubbles-row .color-bubble");
    const hexes = [];
    bubbles.forEach((b, idx) => {
      if (idx === editingBubbleIndex) {
        hexes.push(newHex);
      } else {
        hexes.push(b.dataset.hex || "#FFFFFF");
      }
    });

    const colorDetailsStr = activeProject.color_details || "";
    const hexRegex = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
    let extraNotes = colorDetailsStr.replace(hexRegex, "").replace(/[,;]/g, " ").trim();

    const updatedColorDetails = hexes.join(", ") + (extraNotes ? ` (${extraNotes})` : "");

    const db = getDb();
    const { error } = await db
      .from("projects")
      .update({ color_details: updatedColorDetails })
      .eq("id", activeProject.id);

    if (error) {
      console.error("Error updating color details:", error);
      alert("Failed to update color bubble: " + error.message);
      return;
    }

    activeProject.color_details = updatedColorDetails;
    renderColorBubbles(updatedColorDetails);
    closeModal("modal-color-picker");
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
    populateModalMembers();
  });

  // Add Member Modal Listener
  document.getElementById("btn-add-member")?.addEventListener("click", () => {
    openModal("modal-member-add");
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

    const selectedCheckboxes = document.querySelectorAll('input[name="chat-members"]:checked');
    const memberEmails = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (externalEmail && !memberEmails.includes(externalEmail)) {
      memberEmails.push(externalEmail);
    }

    if (memberEmails.length === 0 && activeProject.client_email) {
      memberEmails.push(activeProject.client_email);
    }

    const db = getDb();

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

    const namesList = [];
    const emailsList = [];

    memberEmails.forEach(email => {
      const fullName = profileMap[email.toLowerCase()];
      emailsList.push(email);
      namesList.push(fullName || email);
    });

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

    const currentEmails = activeProject.client_emails || (activeProject.client_email ? [activeProject.client_email] : []);
    const currentNames = activeProject.client_names || (activeProject.client_name ? [activeProject.client_name] : []);

    const { data: profile } = await db
      .from("profiles")
      .select("full_name")
      .ilike("email", email)
      .maybeSingle();

    const memberName = profile?.full_name || email;

    if (!currentEmails.map(e => e.toLowerCase()).includes(email.toLowerCase())) {
      currentEmails.push(email);
      currentNames.push(memberName);
    }

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

    activeProject.client_emails = currentEmails;
    activeProject.client_names = currentNames;
    
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

function populateEditDetailsModal(proj) {
  document.getElementById("edit-company-name").value = proj.company_name || proj.client_name || "";
  document.getElementById("edit-custom-domain").value = proj.custom_domain || "";
  document.getElementById("edit-site-type").value = proj.site_type || "";
  document.getElementById("edit-selected-features").value = Array.isArray(proj.selected_features) ? proj.selected_features.join(", ") : (proj.selected_features || "");
  document.getElementById("edit-project-description").value = proj.project_description || "";

  document.getElementById("edit-color-mode").value = proj.color_mode || "";
  document.getElementById("edit-color-details").value = proj.color_details || "";
  document.getElementById("edit-target-audience").value = proj.target_audience || "";
  document.getElementById("edit-extra-notes").value = proj.extra_notes || proj.custom_specifications || "";
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

window.updateProjectStatus = async function(newStatus) {
  if (!activeProject) return;

  const db = getDb();
  
  const { error } = await db
    .from("projects")
    .update({ status: newStatus })
    .eq("id", activeProject.id);

  if (error) {
    console.error("Error updating project status:", error);
    alert("Failed to update status: " + error.message);
    return;
  }

  activeProject.status = newStatus;
  const statusEl = document.getElementById("display-project-status");
  if (statusEl) {
    statusEl.textContent = newStatus;
  }

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

    return `
      <label class="checkbox-item">
        <input type="checkbox" name="chat-members" value="${escapeHtml(email)}" checked>
        ${escapeHtml(displayName)}
      </label>
    `;
  }).join("");
}
