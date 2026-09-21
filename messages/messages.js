// messages.js - Standardized Client & Room Management

// 1. Standardized Supabase Client Initialization
(function () {
  if (!window.supabaseClient && window.supabase) {
    const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjMwNDMsImV4cCI6MjEwNTE5OTA0M30.I9oy9CDFsEPdPuq2hA6pgnhI79_m4JxsROTfAh4Jjf0";
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
})();

let activeRoomId = null;
const DEV_DEFAULT_EMAIL = "hkmartin08@gmail.com";

// Helper: Resolve name locally or via direct profiles query (No RPC required)
async function fetchAccountNameByEmail(email) {
  const cleanEmail = email ? email.trim().toLowerCase() : "";
  if (!cleanEmail) return "Guest";

  const fallbackName = cleanEmail.split('@')[0];
  const db = window.supabaseClient;
  if (!db) return fallbackName;

  try {
    // 1. Check active auth session
    const { data: sessionData } = await db.auth.getSession();
    const currentUser = sessionData?.session?.user;
    if (currentUser && currentUser.email?.toLowerCase() === cleanEmail) {
      const metaName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name;
      if (metaName) return metaName;
    }

    // 2. Direct table query on profiles
    const { data: profile } = await db
      .from('profiles')
      .select('full_name, name, display_name')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (profile) {
      return profile.full_name || profile.name || profile.display_name || fallbackName;
    }
  } catch (err) {
    // Suppress network errors
  }

  return fallbackName;
}

// Determine sender role dynamically
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

  return { type: isAdmin ? 'admin' : 'client', name: senderName };
}

// Select a chat room
window.selectRoom = function (roomId, roomName, clientEmail) {
  activeRoomId = roomId;

  document.querySelector(".chat-layout")?.classList.add("room-active");

  const titleEl = document.getElementById("active-room-title");
  const subtitleEl = document.getElementById("active-room-subtitle");
  if (titleEl) titleEl.textContent = roomName || "Chat";
  if (subtitleEl) subtitleEl.textContent = clientEmail || "";

  document.querySelectorAll(".room-card").forEach((el) => el.classList.remove("active"));
  const selectedItem = document.querySelector(`[data-room-id="${roomId}"]`);
  if (selectedItem) selectedItem.classList.add("active");

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

// Render messages feed
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

  messages.forEach((msg) => appendMessageToFeed(msg));
  feedEl.scrollTop = feedEl.scrollHeight;
}

// Append bubble to feed
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

// Fetch and render list of rooms
window.loadRoomsList = async function loadRoomsList(retryCount = 0) {
  if (!window.ChatEngine) {
    if (retryCount < 10) {
      setTimeout(() => window.loadRoomsList(retryCount + 1), 200);
    }
    return;
  }

  try {
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
  } catch (err) {
    console.warn("Failed to load rooms list:", err);
  }

  const newChatBtn = document.getElementById("new-chat-btn");
  const modal = document.getElementById("create-room-modal");
  if (newChatBtn && modal) {
    newChatBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  }
};

// UI Event Handlers
function setupUIEventListeners() {
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

  const backBtn = document.getElementById("mobile-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      document.querySelector(".chat-layout")?.classList.remove("room-active");
    });
  }

  // Modal Handlers
  const modal = document.getElementById("create-room-modal");
  const cancelModalBtn = document.getElementById("cancel-modal-btn");
  const createRoomForm = document.getElementById("create-room-form");
  const devCheckbox = document.getElementById("modal-dev-checkbox");

  const roomNameInput = document.getElementById("modal-room-name");
  const clientEmailInput = document.getElementById("modal-client-email");

  if (cancelModalBtn && modal) {
    cancelModalBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }

  if (devCheckbox && clientEmailInput) {
    devCheckbox.addEventListener("change", (e) => {
      let currentEmails = clientEmailInput.value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      if (e.target.checked) {
        if (roomNameInput && !roomNameInput.value) {
          roomNameInput.value = "Support Ticket";
        }
        if (!currentEmails.includes(DEV_DEFAULT_EMAIL)) {
          currentEmails.push(DEV_DEFAULT_EMAIL);
        }
      } else {
        currentEmails = currentEmails.filter(email => email !== DEV_DEFAULT_EMAIL);
      }

      clientEmailInput.value = currentEmails.join(", ");
    });
  }

  if (createRoomForm && modal) {
    createRoomForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const roomName = roomNameInput?.value.trim();
      const rawEmails = clientEmailInput?.value.trim();

      if (!roomName || !rawEmails) return;

      const emailList = rawEmails.split(',').map(e => e.trim()).filter(Boolean);

      const resolvedNames = await Promise.all(
        emailList.map(email => fetchAccountNameByEmail(email))
      );

      const clientEmailStr = emailList.join(", ");
      const clientNameStr = resolvedNames.join(", ");

      if (window.ChatEngine) {
        const newRoom = await window.ChatEngine.createRoom(roomName, clientNameStr, clientEmailStr);
        modal.classList.add("hidden");
        createRoomForm.reset();
        if (devCheckbox) devCheckbox.checked = false;

        await window.loadRoomsList();
        if (newRoom && newRoom.id) {
          window.selectRoom(newRoom.id, newRoom.name || newRoom.room_name, newRoom.client_email);
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupUIEventListeners();
  window.loadRoomsList();
});
