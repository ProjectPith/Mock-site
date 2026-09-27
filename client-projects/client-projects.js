// Global State
let userProjects = [];
let activeUserEmail = null;
let activeProject = null;
let activeChatUser = null;
let activeChatRoomId = null;
let activeChatChannel = null;
let projectBookmarks = [];
let toastTimeout = null;

if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_bT739cvrORLIrJYQmUVO2Q_9qe25hOU";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const getDb = () => window.supabaseClient;

document.addEventListener("DOMContentLoaded", async () => {
  setupClientChatListeners();
  setupProjectDetailListeners();
  await initClientDashboard();
});

async function initClientDashboard() {
  const db = getDb();
  if (!db) return;

  const { data: { user } } = await db.auth.getUser();
  activeChatUser = user || null;

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
      <button type="button" class="project-card-btn" onclick="selectProject('${p.id}')">
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

  clearChatMessages("Loading chats for this project...");
  document.getElementById("client-chat-room-select").innerHTML = '<option value="">Loading project chats...</option>';
  document.getElementById("btn-client-chat-create").disabled = true;
  document.getElementById("client-chat-create-form")?.classList.add("hidden");

  // 1. Hide Project Selector List & Show Details View
  document.getElementById("projects-list")?.classList.add("hidden");
  document.getElementById("project-details-view")?.classList.remove("hidden");

  // 2. Update Header Title & Show Back Button
  const titleEl = document.getElementById("projects-widget-title");
  if (titleEl) titleEl.textContent = activeProject.name || "Project Details";
  document.getElementById("btn-back-to-projects")?.classList.remove("hidden");

  // 3. Fetch Bookmarks matching active project_id
  const db = getDb();
  const [bookmarkResult, detailsResult, maintenanceResult] = await Promise.all([
    db.from("bookmarks").select("*").eq("project_id", projectId),
    db.from("project_details").select("*").eq("project_id", projectId).maybeSingle(),
    db.from("project_maintenance").select("*").eq("project_id", projectId).maybeSingle()
  ]);

  if (activeProject?.id !== projectId) return;

  if (bookmarkResult.error) {
    console.error("Error fetching bookmarks:", bookmarkResult.error);
    projectBookmarks = [];
  } else {
    projectBookmarks = bookmarkResult.data || [];
  }

  renderLinkBoxes();
  renderProjectDocuments(activeProject);
  renderProjectDetails(detailsResult.data, maintenanceResult.data);
  await Promise.all([
    fetchProjectChatRooms(projectId),
    renderProjectFinance(activeProject)
  ]);
}

function deselectProject() {
  activeProject = null;
  projectBookmarks = [];
  clearChatMessages("Select a project to view its chats.");
  document.getElementById("client-chat-room-select").innerHTML = '<option value="">Select a project first</option>';
  document.getElementById("btn-client-chat-create").disabled = true;
  document.getElementById("client-chat-create-form")?.classList.add("hidden");
  document.getElementById("finance-summary")?.classList.add("hidden");
  document.getElementById("finance-placeholder")?.classList.remove("hidden");

  // Show Project List & Hide Details View
  document.getElementById("projects-list")?.classList.remove("hidden");
  document.getElementById("project-details-view")?.classList.add("hidden");

  // Reset Header Title & Hide Back Button
  const titleEl = document.getElementById("projects-widget-title");
  if (titleEl) titleEl.textContent = "Projects";
  document.getElementById("btn-back-to-projects")?.classList.add("hidden");
}

function renderLinkBoxes() {
  const liveBookmark = projectBookmarks.find(b => b.name && b.name.toLowerCase().trim() === "live site");
  setupLinkBox("btn-link-live", liveBookmark?.url);

  const testBookmark = projectBookmarks.find(b => b.name && b.name.toLowerCase().trim() === "test site");
  setupLinkBox("btn-link-test", testBookmark?.url);

  const publicRepo = projectBookmarks.find(b => b.name && b.name.toLowerCase().trim() === "public repo");
  setupLinkBox("btn-link-github", publicRepo?.url);
}

function renderProjectDocuments(project) {
  setupDocumentLink("doc-link-intake", project?.intake_pdf_url);
  setupDocumentLink("doc-link-contract", project?.contract_pdf_url);
}

function setupDocumentLink(linkId, url) {
  const link = document.getElementById(linkId);
  if (!link) return;

  const safeUrl = url && window.sanitizeUrl ? window.sanitizeUrl(url, "#") : "#";
  const disabled = safeUrl === "#";
  link.href = safeUrl;
  link.classList.toggle("disabled", disabled);
  link.setAttribute("aria-disabled", String(disabled));
  link.onclick = event => {
    if (disabled) {
      event.preventDefault();
      showToast("This document has not been attached yet.");
    }
  };
}

function setupProjectDetailListeners() {
  const docsButton = document.getElementById("btn-project-docs");
  const docsMenu = document.getElementById("docs-dropdown-menu");
  docsButton?.addEventListener("click", event => {
    event.stopPropagation();
    const isOpening = docsMenu.classList.contains("hidden");
    docsMenu.classList.toggle("hidden", !isOpening);
    docsButton.setAttribute("aria-expanded", String(isOpening));
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".docs-dropdown-container")) {
      docsMenu?.classList.add("hidden");
      docsButton?.setAttribute("aria-expanded", "false");
    }
  });
}

function formatProjectDetail(value) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "Not provided";
  if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== null && entryValue !== "");
    return entries.length
      ? entries.map(([key, entryValue]) => `${key}: ${entryValue}`).join(" | ")
      : "Not provided";
  }
  return String(value);
}

function renderProjectDetails(details = {}, maintenance = {}) {
  const container = document.getElementById("project-details-content");
  if (!container || !activeProject) return;

  const value = key => details?.[key] ?? activeProject[key];
  const entries = [
    ["Company", value("company_name")],
    ["Project Description", value("project_description")],
    ["Target Audience", value("target_audience")],
    ["Custom Domain", value("custom_domain")],
    ["Site Type", value("site_type")],
    ["Selected Features", value("selected_features")],
    ["Color Mode", value("color_mode")],
    ["Color Details", value("color_details")],
    ["Custom Specifications", value("custom_specifications")],
    ["Extra Notes", value("extra_notes")],
    ["Design Vibe", value("vibe_text")],
    ["Maintenance Frequency", maintenance?.recurrence],
    ["Maintenance Needs", maintenance?.needs]
  ];

  container.replaceChildren();
  entries.forEach(([label, detail]) => {
    const item = document.createElement("div");
    item.className = "project-detail-item";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = formatProjectDetail(detail);
    item.append(term, description);
    container.appendChild(item);
  });
}

function setupLinkBox(buttonId, url) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  if (url) {
    const safeUrl = window.sanitizeUrl ? window.sanitizeUrl(url, '#') : url;
    btn.classList.add("available");
    btn.classList.remove("disabled");
    btn.onclick = () => {
      if (safeUrl === '#') {
        showToast("Link has not been attached yet.");
        return;
      }
      window.open(safeUrl, "_blank", "noopener,noreferrer");
    };
  } else {
    btn.classList.add("disabled");
    btn.classList.remove("available");
    btn.onclick = () => showToast("Link has not been attached yet.");
  }
}

function toEmailList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",");
  return [];
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

async function renderProjectFinance(project) {
  const placeholder = document.getElementById("finance-placeholder");
  const summary = document.getElementById("finance-summary");
  const currentBalanceEl = document.getElementById("finance-current-balance");
  const buildRow = document.getElementById("finance-build-row");
  const buildRemainingEl = document.getElementById("finance-build-remaining");
  if (!project || !summary || !currentBalanceEl || !buildRow || !buildRemainingEl) return;

  placeholder?.classList.add("hidden");
  summary.classList.remove("hidden");

  const currentBalance = Number(project.current_balance ?? 0);
  currentBalanceEl.textContent = formatCurrency(Number.isFinite(currentBalance) ? currentBalance : 0);

  const totalCost = Number(project.total_cost ?? 0);
  if (!Number.isFinite(totalCost) || totalCost <= 0) {
    buildRow.classList.add("hidden");
    return;
  }

  buildRow.classList.remove("hidden");
  buildRemainingEl.textContent = "Loading...";
  const { data: transactions, error } = await getDb()
    .from("transactions")
    .select("amount")
    .eq("project_id", project.id)
    .eq("status", "succeeded");

  if (activeProject?.id !== project.id) return;
  if (error) {
    console.error("Unable to load project payments:", error);
    buildRemainingEl.textContent = "Unavailable";
    return;
  }

  const collected = (transactions || []).reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  buildRemainingEl.textContent = formatCurrency(Math.max(0, totalCost - collected));
}

function setupClientChatListeners() {
  document.getElementById("btn-client-chat-create")?.addEventListener("click", () => {
    if (!activeProject) return;
    const form = document.getElementById("client-chat-create-form");
    const nameInput = document.getElementById("client-chat-name");
    nameInput.value = `${activeProject.name || "Project"} Chat`;
    renderClientChatMembers(activeProject);
    form.classList.remove("hidden");
    document.getElementById("client-chat-feedback").classList.remove("visible");
  });

  document.getElementById("btn-client-chat-cancel")?.addEventListener("click", () => {
    document.getElementById("client-chat-create-form")?.classList.add("hidden");
  });

  document.getElementById("client-chat-room-select")?.addEventListener("change", (event) => {
    if (event.target.value) connectClientChatRoom(event.target.value);
    else clearChatMessages("Select a chat to read messages.");
  });

  document.getElementById("client-chat-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("client-chat-input");
    const content = input.value.trim();
    if (!activeChatRoomId || !content || !activeChatUser) return;

    const { error } = await getDb().from("messages").insert({
      room_id: activeChatRoomId,
      sender_type: "client",
      sender_name: activeChatUser.user_metadata?.full_name || activeChatUser.email || "Client",
      content
    });
    if (error) {
      console.error("Unable to send message:", error);
      showClientChatFeedback(`Message not sent: ${error.message}`);
      return;
    }

    input.value = "";
    document.getElementById("client-chat-feedback")?.classList.remove("visible");
  });

  document.getElementById("client-chat-create-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeProject) return;

    const name = document.getElementById("client-chat-name").value.trim();
    const externalEmail = document.getElementById("client-chat-extra-email").value.trim();
    const memberEmails = Array.from(document.querySelectorAll("#client-chat-members input:checked"))
      .map(input => input.value);
    const submitButton = event.currentTarget.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.textContent = "Creating...";

    const { data: roomId, error } = await getDb().rpc("create_client_project_chat", {
      p_project_id: activeProject.id,
      p_name: name,
      p_member_emails: memberEmails,
      p_extra_email: externalEmail || null
    });

    if (error) {
      console.error("Unable to create project chat:", error);
      showClientChatFeedback(`Chat not created: ${error.message}`);
    } else {
      document.getElementById("client-chat-create-form").reset();
      document.getElementById("client-chat-create-form").classList.add("hidden");
      await fetchProjectChatRooms(activeProject.id, roomId);
    }

    submitButton.disabled = false;
    submitButton.textContent = "Create Chat";
  });
}

function renderClientChatMembers(project) {
  const container = document.getElementById("client-chat-members");
  if (!container) return;
  container.replaceChildren();

  const emails = [...new Set(toEmailList(project.client_emails)
    .concat(toEmailList(project.client_email))
    .map(email => String(email).trim().toLowerCase())
    .filter(Boolean))];
  const names = toEmailList(project.client_names);
  const currentEmail = (activeChatUser?.email || "").toLowerCase();

  if (!emails.length) {
    container.textContent = "No project members listed.";
    return;
  }

  emails.forEach((email, index) => {
    const label = document.createElement("label");
    label.className = "client-chat-member";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = email;
    checkbox.checked = true;
    const displayName = String(names[index] || "").trim();
    const isCurrentUser = email === currentEmail;
    label.append(checkbox, document.createTextNode(`${displayName || email}${isCurrentUser ? " (you)" : ""}`));
    container.appendChild(label);
  });
}

async function fetchProjectChatRooms(projectId, selectedRoomId = null) {
  const roomSelect = document.getElementById("client-chat-room-select");
  const createButton = document.getElementById("btn-client-chat-create");
  if (!roomSelect) return;
  if (createButton) createButton.disabled = true;

  const { data: rooms, error } = await getDb()
    .from("chat_rooms")
    .select("id, name, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (activeProject?.id !== projectId) return;
  if (error) {
    console.error("Unable to load project chats:", error);
    roomSelect.innerHTML = '<option value="">Unable to load chats</option>';
    showClientChatFeedback(`Chats unavailable: ${error.message}`);
    clearChatMessages("Unable to load project chats.");
    return;
  }

  createButton.disabled = false;
  roomSelect.replaceChildren();
  if (!rooms?.length) {
    roomSelect.appendChild(new Option("No project chats yet", ""));
    clearChatMessages("No chat attached to this project yet. Create one to start messaging.");
    return;
  }

  rooms.forEach(room => roomSelect.appendChild(new Option(room.name || "Project Chat", room.id)));
  const firstRoomId = selectedRoomId && rooms.some(room => room.id === selectedRoomId)
    ? selectedRoomId
    : rooms[0].id;
  roomSelect.value = firstRoomId;
  connectClientChatRoom(firstRoomId);
}

async function connectClientChatRoom(roomId) {
  activeChatRoomId = roomId;
  const input = document.getElementById("client-chat-input");
  const sendButton = document.getElementById("client-chat-send");
  const messages = document.getElementById("client-messages-list");
  input.disabled = false;
  sendButton.disabled = false;
  messages.innerHTML = '<div class="message-placeholder"><p>Loading messages...</p></div>';

  const db = getDb();
  if (activeChatChannel) db.removeChannel(activeChatChannel);
  activeChatChannel = db.channel(`client-room-${roomId}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `room_id=eq.${roomId}`
    }, payload => appendClientMessage(payload.new))
    .subscribe();

  const { data: chatMessages, error } = await db
    .from("messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  if (activeChatRoomId !== roomId) return;
  if (error) {
    console.error("Unable to load chat messages:", error);
    clearChatMessages("Unable to load messages for this chat.");
    showClientChatFeedback(`Messages unavailable: ${error.message}`);
    return;
  }

  messages.replaceChildren();
  if (!chatMessages?.length) {
    messages.innerHTML = '<div class="message-placeholder"><p>No messages yet. Start the conversation.</p></div>';
    return;
  }
  chatMessages.forEach(appendClientMessage);
}

function appendClientMessage(message) {
  const container = document.getElementById("client-messages-list");
  if (!container || !message) return;
  container.querySelector(".message-placeholder")?.remove();

  const bubble = document.createElement("div");
  bubble.className = `dash-msg-bubble ${message.sender_type === "client" ? "client" : "admin"}`;
  bubble.textContent = message.content || "";
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function clearChatMessages(message = "No chat attached to this project.") {
  activeChatRoomId = null;
  if (activeChatChannel) {
    getDb()?.removeChannel(activeChatChannel);
    activeChatChannel = null;
  }
  const container = document.getElementById("client-messages-list");
  if (container) {
    const placeholder = document.createElement("div");
    placeholder.className = "message-placeholder";
    const text = document.createElement("p");
    text.textContent = message;
    placeholder.appendChild(text);
    container.replaceChildren(placeholder);
  }
  const input = document.getElementById("client-chat-input");
  const sendButton = document.getElementById("client-chat-send");
  if (input) input.disabled = true;
  if (sendButton) sendButton.disabled = true;
}

function showClientChatFeedback(message) {
  const feedback = document.getElementById("client-chat-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.add("visible");
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
