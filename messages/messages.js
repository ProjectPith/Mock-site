// messages.js - Clean Script without Inline Styles

let activeRoomId = null;

// Developer default email
const DEV_DEFAULT_EMAIL = "hkmartin08@gmail.com";

// Determine sender role (admin vs client) dynamically from Supabase session
async function getCurrentUserRole() {
  const db = window.supabaseClient;
  if (!db) return { type: 'client', name: 'Client' };

  const { data } = await db.auth.getSession();
  const user = data?.session?.user;

  if (!user) return { type: 'client', name: 'Guest Client' };

  const PRIMARY_ADMIN_UID = "a854c1f9-292f-49ac-89c0-37dd509e683d";
  const promotedAdmins = JSON.parse(localStorage.getItem("promoted_admins") || "[]");
  const userEmail = (user.email || "").toLowerCase();

  const isAdmin = user.id === PRIMARY_ADMIN_UID || promotedAdmins.includes(userEmail);
  const senderName = user.user_metadata?.full_name || user.email || (isAdmin ? 'Admin' : 'Client');

  return {
    type: isAdmin ? 'admin' : 'client',
    name: senderName
  };
}

// Select a chat room and render messages
window.selectRoom = function (roomId, roomName, clientEmail) {
  activeRoomId = roomId;

  // Mobile layout switch
  document.querySelector(".chat-layout")?.classList.add("room-active");

  // Update room header titles
  const titleEl = document.getElementById("active-room-title");
  const subtitleEl = document.getElementById("active-room-subtitle");
  if (titleEl) titleEl.textContent = roomName || clientEmail || "Chat";
  if (subtitleEl) subtitleEl.textContent = clientEmail || "";

  // Highlight card in sidebar
  document.querySelectorAll(".room-card").forEach((el) => el.classList.remove("active"));
  const selectedItem = document.querySelector(`[data-room-id="${roomId}"]`);
  if (selectedItem) selectedItem.classList.add("active");

  // Reveal main chat container immediately
  const emptyState = document.getElementById("empty-chat-state");
  const chatContainer = document.getElementById("active-chat-container");
  if (emptyState) emptyState.classList.add("hidden");
  if (chatContainer) chatContainer.classList.remove("hidden");

  if (window.ChatEngine) {
    window.ChatEngine.subscribeToRoom(roomId, (messages, isInitialLoad) => {
      if (isInitialLoad) {
        renderMessages(messages);
      } else if (messages && messages[0]) {
        appendMessageToFeed(messages[0]);
      }
    });
  }
};

// Render messages to feed
function renderMessages(messages) {
  const emptyState = document.getElementById("empty-chat-state");
  const chatContainer = document.getElementById("active-chat-container");
  const feedEl = document.getElementById("messages-feed");

  if (emptyState) emptyState.classList.add("hidden");
  if (chatContainer) chatContainer.classList.remove("hidden");

  if (!feedEl) return;
  feedEl.innerHTML = "";

  if (!messages || messages.length === 0) {
    feedEl.innerHTML = `<div class="chat-empty-notice">No messages yet in this room.</div>`;
    return;
  }

  messages.forEach((msg) => {
    appendMessageToFeed(msg);
  });

  feedEl.scrollTop = feedEl.scrollHeight;
}

// Append single message bubble
function appendMessageToFeed(msg) {
  const feed = document.getElementById("messages-feed");
  if (!feed) return;

  const bubble = document.createElement("div");
  const senderClass = msg.sender_type === "admin" ? "admin" : "client";
  bubble.className = `message-bubble ${senderClass}`;

  const timeString = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  }) : '';

  bubble.innerHTML = `
    <div class="message-content">${escapeHtml(msg.content)}</div>
    <div class="message-meta">
      ${escapeHtml(msg.sender_name || msg.sender_type)} • ${timeString}
    </div>
  `;

  feed.appendChild(bubble);
  feed.scrollTop = feed.scrollHeight;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Fetch and load initial list of rooms
async function loadRoomsList() {
  if (!window.ChatEngine) return;

  const rooms = await window.ChatEngine.fetchRooms();
  const roomsListEl = document.getElementById("rooms-list");
  if (!roomsListEl) return;

  roomsListEl.innerHTML = "";

  if (!rooms || rooms.length === 0) {
    roomsListEl.innerHTML = `<div class="empty-chat-state rooms-empty-padding">No active chats.</div>`;
    return;
  }

  rooms.forEach((room) => {
    const card = document.createElement("div");
    card.className = "room-card";
    card.setAttribute("data-room-id", room.id);

    const displayName = room.name || room.room_name || room.client_name || room.client_email || "Chat";
    const subText = room.client_email && displayName !== room.client_email ? room.client_email : "";

    card.innerHTML = `
      <h4>${escapeHtml(displayName)}</h4>
      ${subText ? `<small>${escapeHtml(subText)}</small>` : ""}
    `;

    card.addEventListener("click", () => {
      window.selectRoom(room.id, displayName, room.client_email);
    });

    roomsListEl.appendChild(card);
  });
}

// Set up UI Event Listeners
function setupUIEventListeners() {
  // --- Message Submit Event ---
  const messageForm = document.getElementById("message-form");
  if (messageForm) {
    messageForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("message-input");
      const content = input.value.trim();

      if (!content || !activeRoomId) return;

      const userRole = await getCurrentUserRole();
      input.value = "";

      if (window.ChatEngine) {
        await window.ChatEngine.sendMessage(
          activeRoomId,
          userRole.type,
          userRole.name,
          content
        );
      }
    });
  }

  // --- Mobile Back Button Event ---
  const backBtn = document.getElementById("mobile-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      document.querySelector(".chat-layout")?.classList.remove("room-active");
    });
  }

  // --- New Chat Modal Handlers ---
  const newChatBtn = document.getElementById("new-chat-btn");
  const modal = document.getElementById("create-room-modal");
  const cancelModalBtn = document.getElementById("cancel-modal-btn");
  const createRoomForm = document.getElementById("create-room-form");
  const devCheckbox = document.getElementById("modal-dev-checkbox");

  const roomNameInput = document.getElementById("modal-room-name");
  const clientNameInput = document.getElementById("modal-client-name");
  const clientEmailInput = document.getElementById("modal-client-email");

  if (newChatBtn && modal) {
    newChatBtn.addEventListener("click", () => {
      modal.classList.remove("hidden");
    });
  }

  if (cancelModalBtn && modal) {
    cancelModalBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }

  // Handle Developer Checkbox Toggle
  if (devCheckbox) {
    devCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        clientEmailInput.value = DEV_DEFAULT_EMAIL;
        clientEmailInput.readOnly = true;
        if (!roomNameInput.value) roomNameInput.value = "Developer Inquiry";
        if (!clientNameInput.value) clientNameInput.value = "Client Support Chat";
      } else {
        clientEmailInput.readOnly = false;
        clientEmailInput.value = "";
      }
    });
  }

  if (createRoomForm && modal) {
    createRoomForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const roomName = roomNameInput?.value.trim();
      const clientName = clientNameInput?.value.trim();
      const clientEmail = clientEmailInput?.value.trim();

      if (!roomName || !clientEmail) return;

      if (window.ChatEngine) {
        const newRoom = await window.ChatEngine.createRoom(roomName, clientName, clientEmail);
        modal.classList.add("hidden");
        createRoomForm.reset();
        if (devCheckbox) devCheckbox.checked = false;
        if (clientEmailInput) clientEmailInput.readOnly = false;

        await loadRoomsList();
        if (newRoom && newRoom.id) {
          window.selectRoom(newRoom.id, newRoom.name || newRoom.room_name, newRoom.client_email);
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupUIEventListeners();
  loadRoomsList();
});
