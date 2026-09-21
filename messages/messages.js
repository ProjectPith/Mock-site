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

  // Highlight selected room item in list
  document.querySelectorAll(".room-item").forEach((el) => el.classList.remove("active"));
  const selectedItem = document.querySelector(`[data-room-id="${roomId}"]`);
  if (selectedItem) selectedItem.classList.add("active");

  if (window.ChatEngine) {
    // Subscribe handles both loading initial messages AND realtime updates
    window.ChatEngine.subscribeToRoom(roomId, (messages, isInitialLoad) => {
      if (isInitialLoad) {
        renderMessages(messages);
      } else {
        // Append new realtime message
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
    roomsListEl.innerHTML = `<div class="empty-state" style="padding: 1rem; opacity: 0.7;">No active chats.</div>`;
    return;
  }

  rooms.forEach((room) => {
    const item = document.createElement("div");
    item.className = "room-item";
    item.setAttribute("data-room-id", room.id);

    // Displays name, or falls back to client_name or client_email
    const displayName = room.name || room.room_name || room.client_name || room.client_email || "Chat";
    const subText = room.client_email && displayName !== room.client_email ? room.client_email : "";

    item.innerHTML = `
      <div class="room-item-name" style="font-weight: 600;">${escapeHtml(displayName)}</div>
      ${subText ? `<div class="room-item-sub" style="font-size: 0.85rem; opacity: 0.7;">${escapeHtml(subText)}</div>` : ''}
    `;

    item.addEventListener("click", () => {
      window.selectRoom(room.id, displayName, room.client_email);
    });

    roomsListEl.appendChild(item);
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
