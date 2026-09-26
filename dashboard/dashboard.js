// Global State
let activeDashRoomId = null;
let toolBookmarks = [];
let editingToolBookmarkId = null;

if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_bT739cvrORLIrJYQmUVO2Q_9qe25hOU";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const getDb = () => window.supabaseClient;

document.addEventListener("DOMContentLoaded", () => {
  loadToolBookmarks();
  fetchProjects();
  renderPayoutWidget();
  initDashboardChat();
  setupEventListeners();
});

// ==========================================
// 1. TOOL BOOKMARKS LOGIC
// ==========================================
async function loadToolBookmarks() {
  const container = document.getElementById("tools-list");
  if (!container) return;

  const db = getDb();
  if (!db) {
    container.innerHTML = `<p style="font-size: 0.8rem; color: #8b949e;">Bookmarks are unavailable.</p>`;
    return;
  }

  const { data: bookmarks, error } = await db
    .from("bookmarks")
    .select("*")
    .is("project_id", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tool bookmarks:", error);
    toolBookmarks = [];
    container.innerHTML = `<p style="font-size: 0.8rem; color: #8b949e;">Unable to load bookmarks.</p>`;
    return;
  }

  toolBookmarks = bookmarks || [];
  if (toolBookmarks.length === 0) {
    container.innerHTML = `<p style="font-size: 0.8rem; color: #8b949e;">No tools bookmarked yet.</p>`;
    return;
  }

  container.innerHTML = toolBookmarks.map((bookmark) => `
    <div class="tool-bookmark-item">
      <a href="${escapeHtml(bookmark.url)}" target="_blank" rel="noopener noreferrer" class="tool-card">
        <span>${escapeHtml(bookmark.name)}</span>
        <span style="font-size: 0.75rem; color: #8b949e;">↗</span>
      </a>
      <div class="tool-bookmark-actions">
        <button type="button" data-bookmark-action="edit" data-bookmark-id="${escapeHtml(bookmark.id)}">Edit</button>
        <button type="button" data-bookmark-action="delete" data-bookmark-id="${escapeHtml(bookmark.id)}">Delete</button>
      </div>
    </div>
  `).join("");
}

async function saveToolBookmark(name, url) {
  const db = getDb();
  if (!db) {
    alert("Unable to save bookmark.");
    return false;
  }

  const changes = { name, url };
  const result = editingToolBookmarkId
    ? await db.from("bookmarks").update(changes).eq("id", editingToolBookmarkId).is("project_id", null)
    : await db.from("bookmarks").insert({ ...changes, visibility: "private" });

  if (result.error) {
    console.error("Error saving tool bookmark:", result.error);
    alert("Unable to save bookmark.");
    return false;
  }

  editingToolBookmarkId = null;
  await loadToolBookmarks();
  return true;
}

async function deleteToolBookmark(bookmarkId) {
  const bookmark = toolBookmarks.find(item => item.id === bookmarkId);
  if (!bookmark || !window.confirm(`Delete the bookmark "${bookmark.name}"?`)) return;

  const db = getDb();
  const { error } = await db
    .from("bookmarks")
    .delete()
    .eq("id", bookmarkId)
    .is("project_id", null);

  if (error) {
    console.error("Error deleting tool bookmark:", error);
    alert("Unable to delete bookmark.");
    return;
  }

  await loadToolBookmarks();
}

function openToolBookmarkEditor(bookmark) {
  editingToolBookmarkId = bookmark.id;
  document.getElementById("tool-name").value = bookmark.name || "";
  document.getElementById("tool-url").value = bookmark.url || "";
  document.querySelector("#tool-modal h3").textContent = "Edit Tool Bookmark";
  document.querySelector("#add-tool-form button[type='submit']").textContent = "Save Changes";
  document.getElementById("tool-modal").classList.remove("hidden");
}

function resetToolBookmarkForm() {
  editingToolBookmarkId = null;
  const form = document.getElementById("add-tool-form");
  form?.reset();
  document.querySelector("#tool-modal h3").textContent = "Add Tool Bookmark";
  document.querySelector("#add-tool-form button[type='submit']").textContent = "Save Bookmark";
}

// ==========================================
// 2. ACTIVE PROJECTS LOGIC
// ==========================================
async function fetchProjects() {
  const tableBody = document.getElementById("projects-table-body");
  if (!tableBody) return;

  const db = getDb();
  if (!db) return;

  const { data: projects, error } = await db
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !projects || projects.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="color: #8b949e; text-align: center;">No active projects found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = projects.map(proj => {
    const safeRepoUrl = window.sanitizeUrl(proj.repo_url, '#');
    return `
      <tr class="project-row" onclick="navigateToProject(${JSON.stringify(String(proj.id))})">
        <td><strong>${escapeHtml(proj.name)}</strong></td>
        <td class="hide-mobile">${escapeHtml(proj.client_name || proj.client_email || 'Client')}</td>
        <td><span class="badge">${escapeHtml(proj.status || 'Active')}</span></td>
        <td class="hide-mobile">
          ${safeRepoUrl !== '#' ? `<a href="${safeRepoUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();">Repo ↗</a>` : 'N/A'}
        </td>
        <td class="hide-mobile"><button class="btn btn-outline btn-sm">View Page</button></td>
      </tr>
    `;
  }).join("");
}

window.navigateToProject = function(projectId) {
  window.location.href = `/admin-projects/admin-projects.html?id=${projectId}`;
};

// ==========================================
// 3. PAYOUT WIDGET DISPLAY LOGIC
// ==========================================
async function renderPayoutWidget() {
  if (!window.BookkeepingEngine) return;

  const { gross, cuts, tax, net } = await window.BookkeepingEngine.calculateNetPayout();

  const netDisplay = document.getElementById("net-payout-display");
  const grossDisplay = document.getElementById("payout-gross");
  const deductionsDisplay = document.getElementById("payout-deductions");

  if (netDisplay) netDisplay.textContent = `$${net.toFixed(2)}`;
  if (grossDisplay) grossDisplay.textContent = `Gross: $${gross.toFixed(2)}`;
  if (deductionsDisplay) deductionsDisplay.textContent = `Deductions: -$${(cuts + tax).toFixed(2)}`;
}

// ==========================================
// 4. INTERACTIVE DASHBOARD CHAT LOGIC
// ==========================================
async function initDashboardChat() {
  if (!window.ChatEngine) return;

  const roomSelect = document.getElementById("dash-room-select");
  const messagesList = document.getElementById("messages-list");
  const chatInput = document.getElementById("dash-chat-input");
  const chatSend = document.getElementById("dash-chat-send");
  const chatForm = document.getElementById("dash-chat-form");

  // Fetch available client chat rooms
  const rooms = await window.ChatEngine.fetchRooms();

  if (!rooms || rooms.length === 0) {
    if (messagesList) messagesList.innerHTML = `<div class="message-placeholder"><p style="font-size:0.8rem; color:#8b949e;">No active chat streams found.</p></div>`;
    return;
  }

  // Populate dropdown with active rooms
  if (roomSelect) {
    roomSelect.innerHTML = `<option value="">Select Room...</option>` + 
      rooms.map(r => `<option value="${r.id}">${r.name || r.client_name || r.client_email || 'Chat'}</option>`).join("");

    roomSelect.addEventListener("change", (e) => {
      const selectedRoomId = e.target.value;
      if (selectedRoomId) {
        connectDashRoom(selectedRoomId);
      } else {
        activeDashRoomId = null;
        if (chatInput) chatInput.disabled = true;
        if (chatSend) chatSend.disabled = true;
      }
    });
  }

  // Automatically select the most recent room on load
  if (rooms[0] && rooms[0].id) {
    if (roomSelect) roomSelect.value = rooms[0].id;
    connectDashRoom(rooms[0].id);
  }

  // Handle in-widget replies
  if (chatForm) {
    chatForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!activeDashRoomId || !chatInput || !chatInput.value.trim()) return;

      const text = chatInput.value.trim();
      chatInput.value = "";

      await window.ChatEngine.sendMessage(activeDashRoomId, "admin", "Admin", text);
    });
  }
}

function connectDashRoom(roomId) {
  activeDashRoomId = roomId;
  const chatInput = document.getElementById("dash-chat-input");
  const chatSend = document.getElementById("dash-chat-send");

  if (chatInput) chatInput.disabled = false;
  if (chatSend) chatSend.disabled = false;

  window.ChatEngine.subscribeToRoom(roomId, (messages, isInitialLoad) => {
    const messagesList = document.getElementById("messages-list");
    if (!messagesList) return;

    if (isInitialLoad) {
      messagesList.innerHTML = "";
      if (!messages || messages.length === 0) {
        messagesList.innerHTML = `<div class="message-placeholder"><p style="font-size:0.8rem; color:#8b949e;">No messages in this chat yet.</p></div>`;
        return;
      }
      messages.forEach(appendDashBubble);
    } else if (messages && messages[0]) {
      appendDashBubble(messages[0]);
    }

    messagesList.scrollTop = messagesList.scrollHeight;
  });
}

function appendDashBubble(msg) {
  const messagesList = document.getElementById("messages-list");
  if (!messagesList) return;

  // Clear initial placeholder if present
  const placeholder = messagesList.querySelector(".message-placeholder");
  if (placeholder) placeholder.remove();

  const bubble = document.createElement("div");
  const isAdmin = msg.sender_type === "admin";
  bubble.className = `dash-msg-bubble ${isAdmin ? 'admin' : 'client'}`;

  const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  bubble.innerHTML = `
    <div>${escapeHtml(msg.content)}</div>
    <span class="dash-msg-meta">${msg.sender_name || (isAdmin ? 'Admin' : 'Client')} • ${timeStr}</span>
  `;

  messagesList.appendChild(bubble);
  messagesList.scrollTop = messagesList.scrollHeight;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ==========================================
// 5. EVENT LISTENERS & MODALS
// ==========================================
function setupEventListeners() {
  const toolModal = document.getElementById("tool-modal");
  const addBtn = document.getElementById("add-tool-btn");
  const closeBtn = document.getElementById("close-tool-modal");
  const form = document.getElementById("add-tool-form");
  const startContractBtn = document.getElementById("start-contract-btn");

  if (addBtn && toolModal) {
    addBtn.addEventListener("click", () => {
      resetToolBookmarkForm();
      toolModal.classList.remove("hidden");
    });
  }

  if (closeBtn && toolModal) {
    closeBtn.addEventListener("click", () => toolModal.classList.add("hidden"));
  }

  if (form && toolModal) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("tool-name").value.trim();
      const url = document.getElementById("tool-url").value.trim();
      
      const saved = await saveToolBookmark(name, url);
      if (!saved) return;

      form.reset();
      document.querySelector("#tool-modal h3").textContent = "Add Tool Bookmark";
      document.querySelector("#add-tool-form button[type='submit']").textContent = "Save Bookmark";
      toolModal.classList.add("hidden");
    });
  }

  document.getElementById("tools-list")?.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-bookmark-action]");
    if (!button) return;

    const bookmark = toolBookmarks.find(item => item.id === button.dataset.bookmarkId);
    if (!bookmark) return;

    if (button.dataset.bookmarkAction === "edit") openToolBookmarkEditor(bookmark);
    if (button.dataset.bookmarkAction === "delete") deleteToolBookmark(bookmark.id);
  });

  if (startContractBtn) {
    startContractBtn.addEventListener("click", () => {
      window.location.href = "/dashboard/new-contract/intake-review/intake-review.html";
    });
  }
}
