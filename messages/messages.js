// messages.js - Complete Updated Script

let activeRoomId = null;

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

  // Toggle responsive layout state for mobile
  document.querySelector(".chat-layout")?.classList.add("room-active");

  const titleEl = document.getElementById("active-room-title");
  const subtitleEl = document.getElementById("active-room-subtitle");
  if (titleEl) titleEl.textContent = roomName || clientEmail || "Chat";
  if (subtitleEl) subtitleEl.textContent = clientEmail || "";

  // Highlight selected room card in list (matching .room-card.active in CSS)
  document.querySelectorAll(".room-card").forEach((el) => el.classList.remove("active"));
  const selectedItem = document.querySelector(`[data-room-id="${roomId}"]`);
  if (selectedItem) selectedItem.classList.add("active");

  if (window.ChatEngine) {
    window.ChatEngine.subscribeToRoom(roomId, (messages, isInitialLoad) => {
      if (isInitialLoad) {
        renderMessages(messages);
      } else {
        if (messages && messages[0]) {
          appendMessageToFeed(messages[0]);
        }
      }
    });
  }
};

// Render messages to feed
function renderMessages(messages) {
  const feed = document.getElementById("messages-feed");
  if (!feed) return;

  feed.innerHTML = "";

  messages.forEach((msg) => {
    appendMessageToFeed(msg);
  });

  feed.scrollTop = feed.scrollHeight;
}

// Append single message bubble
function appendMessageToFeed(msg) {
  const feed = document.getElementById("messages-feed");
  if (!feed) return;

  const bubble = document.createElement("div");
  const senderClass = msg.sender_type === "admin" ? "admin" : "client";
  bubble.className = `message-bubble ${senderClass}`;

  const timeString = new Date(msg.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  bubble.innerHTML = `
    <div class="message-content">${escapeHtml(msg.content)}</div>
    <div class="message-meta">${escapeHtml(msg.sender_name || msg.sender_type)} • ${timeString}</div>
  `;

  feed.appendChild(bubble);
  feed.scrollTop = feed.scrollHeight;
}

// Handle incoming realtime message
function handleNewMessage(msg) {
  appendMessageToFeed(msg);
}

// Helper to escape HTML characters
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
    roomsListEl.innerHTML = `<div class="empty-chat-state">No active chats.</div>`;
    return;
  }

  rooms.forEach((room) => {
    const card = document.createElement("div");
    // Matches .room-card in messages.css
    card.className = "room-card";
    card.setAttribute("data-room-id", room.id);

    const displayName = room.name || room.room_name || room.client_name || room.client_email || "Chat";
    const subText = room.client_email && displayName !== room.client_email ? room.client_email : "";

    // Matches <h4> and <small> structure in messages.css
    card.innerHTML = `
      <h4>${escapeHtml(displayName)}</h4>
      ${subText ? `<small>${escapeHtml(subText)}</small>` : ""}
    `;

    // Attach click handler directly to the room card element
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

  if (newChatBtn && modal) {
    newChatBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  }

  if (cancelModalBtn && modal) {
    cancelModalBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }

  if (createRoomForm && modal) {
    createRoomForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const roomName = document.getElementById("modal-room-name")?.value.trim();
      const clientName = document.getElementById("modal-client-name")?.value.trim();
      const clientEmail = document.getElementById("modal-client-email")?.value.trim();

      if (!roomName || !clientEmail) return;

      if (window.ChatEngine) {
        const newRoom = await window.ChatEngine.createRoom(roomName, clientName, clientEmail);
        modal.classList.add("hidden");
        createRoomForm.reset();
        await loadRoomsList();
        if (newRoom && newRoom.id) {
          window.selectRoom(newRoom.id, newRoom.room_name, newRoom.client_email);
        }
      }
    });
  }
}

// Initialize interface on DOM load
document.addEventListener("DOMContentLoaded", () => {
  setupUIEventListeners();
  loadRoomsList();
});
