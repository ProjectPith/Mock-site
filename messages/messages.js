// messages.js - Ensured Logged-in Creator Email Inclusion

(function () {
  if (!window.supabaseClient && window.supabase) {
    const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
})();

let activeRoomId = null;
let activeRoomData = null;
const DEV_DEFAULT_EMAIL = "hkmartin08@gmail.com";

// Helper: Resolve account name by email
async function fetchAccountNameByEmail(email) {
  const cleanEmail = email ? email.trim().toLowerCase() : "";
  if (!cleanEmail) return "Guest";

  const fallbackName = cleanEmail.split('@')[0];
  const db = window.supabaseClient;
  if (!db) return fallbackName;

  try {
    const { data: sessionData } = await db.auth.getSession();
    const currentUser = sessionData?.session?.user;
    if (currentUser && currentUser.email?.toLowerCase() === cleanEmail) {
      const metaName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name;
      if (metaName) return metaName;
    }

    const { data: profile } = await db
      .from('profiles')
      .select('full_name')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (profile && profile.full_name) {
      return profile.full_name;
    }
  } catch (err) {
    // Suppress network errors
  }

  return fallbackName;
}

// Determine sender role
async function getCurrentUserRole() {
  const db = window.supabaseClient;
  if (!db) return { type: 'client', name: 'Client', isAdmin: false, email: '' };

  const { data } = await db.auth.getSession();
  const user = data?.session?.user;

  if (!user) return { type: 'client', name: 'Guest Client', isAdmin: false, email: '' };

  const PRIMARY_ADMIN_UID = "a854c1f9-292f-49ac-89c0-37dd509e683d";
  const promotedAdmins = JSON.parse(localStorage.getItem("promoted_admins") || "[]");
  const userEmail = (user.email || "").toLowerCase();

  const isAdmin = user.id === PRIMARY_ADMIN_UID || promotedAdmins.includes(userEmail);
  const senderName = user.user_metadata?.full_name || user.email || (isAdmin ? 'Admin' : 'Client');

  return { type: isAdmin ? 'admin' : 'client', name: senderName, isAdmin, email: userEmail };
}

// Select a chat room
window.selectRoom = function (roomId, roomName, roomData) {
  activeRoomId = roomId;
  activeRoomData = roomData || {};

  document.querySelector(".chat-layout")?.classList.add("room-active");

  const titleEl = document.getElementById("active-room-title");
  const subtitleEl = document.getElementById("active-room-subtitle");
  
  if (titleEl) titleEl.textContent = roomName || "Chat";
  if (subtitleEl) subtitleEl.textContent = ""; 

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

window.loadRoomsList = async function loadRoomsList(retryCount = 0) {
  if (!window.ChatEngine) {
    if (retryCount < 10) {
      setTimeout(() => window.loadRoomsList(retryCount + 1), 200);
    }
    return;
  }

  try {
    const userRole = await getCurrentUserRole();
    const filterSelect = document.getElementById("admin-room-filter");
    
    if (userRole.isAdmin && filterSelect) {
      filterSelect.classList.remove("hidden");
    }

    const adminFilterMode = filterSelect ? filterSelect.value : 'my_chats';
    const rooms = await window.ChatEngine.fetchRooms(adminFilterMode);
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

      const displayName = room.name || room.client_name || "Chat";

      card.innerHTML = `<h4>${escapeHtml(displayName)}</h4>`;

      card.addEventListener("click", () => {
        window.selectRoom(room.id, displayName, room);
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

async function updateRoomParticipants(roomId, emailList) {
  if (!roomId || !window.ChatEngine) return;

  // De-duplicate emails
  const uniqueEmails = [...new Set(emailList.map(e => e.trim().toLowerCase()).filter(Boolean))];

  const resolvedNames = await Promise.all(
    uniqueEmails.map(email => fetchAccountNameByEmail(email))
  );

  const clientEmailStr = uniqueEmails.join(", ");
  const clientNameStr = resolvedNames.join(", ");

  const success = await window.ChatEngine.updateRoomMembers(roomId, clientEmailStr, clientNameStr);

  if (success) {
    if (activeRoomData) {
      activeRoomData.client_email = clientEmailStr;
      activeRoomData.client_name = clientNameStr;
    }
    await window.loadRoomsList();
  }
}

function setupUIEventListeners() {
  const filterSelect = document.getElementById("admin-room-filter");
  if (filterSelect) {
    filterSelect.addEventListener("change", () => {
      window.loadRoomsList();
    });
  }

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

  const membersBtn = document.getElementById("manage-members-btn");
  const membersModal = document.getElementById("members-modal");
  const closeMembersBtn = document.getElementById("close-members-modal-btn");
  const membersListContainer = document.getElementById("members-list-container");
  const addMemberForm = document.getElementById("add-member-form");
  const newMemberEmailInput = document.getElementById("new-member-email");

  if (membersBtn && membersModal) {
    membersBtn.addEventListener("click", () => {
      if (!activeRoomId || !activeRoomData) return;

      renderMembersList();
      membersModal.classList.remove("hidden");
    });
  }

  if (closeMembersBtn && membersModal) {
    closeMembersBtn.addEventListener("click", () => membersModal.classList.add("hidden"));
  }

  function getActiveEmailList() {
    if (!activeRoomData || !activeRoomData.client_email) return [];
    return activeRoomData.client_email
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);
  }

  async function renderMembersList() {
    if (!membersListContainer) return;
    const emails = getActiveEmailList();
    membersListContainer.innerHTML = "";

    if (emails.length === 0) {
      membersListContainer.innerHTML = `<div class="empty-chat-state">No members attached.</div>`;
      return;
    }

    const memberDetails = await Promise.all(
      emails.map(async (email) => {
        const name = await fetchAccountNameByEmail(email);
        return { email, name };
      })
    );

    memberDetails.forEach(({ email, name }) => {
      const row = document.createElement("div");
      row.className = "member-item-row";
      row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.05));";

      row.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-main, #fff);">${escapeHtml(name)}</span>
          <small style="font-size: 0.75rem; color: var(--text-muted, #8b949e);">${escapeHtml(email)}</small>
        </div>
        <button type="button" class="btn-remove-member" data-email="${escapeHtml(email)}" style="background: none; border: none; color: #ff6b6b; cursor: pointer; font-size: 0.85rem;">Remove</button>
      `;

      row.querySelector(".btn-remove-member").addEventListener("click", async (e) => {
        const emailToRemove = e.target.getAttribute("data-email");
        const currentList = getActiveEmailList();
        const updatedList = currentList.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());

        await updateRoomParticipants(activeRoomId, updatedList);
        await renderMembersList();
      });

      membersListContainer.appendChild(row);
    });
  }

  if (addMemberForm && newMemberEmailInput) {
    addMemberForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailToAdd = newMemberEmailInput.value.trim().toLowerCase();
      if (!emailToAdd || !activeRoomId) return;

      const currentList = getActiveEmailList();
      if (!currentList.map(e => e.toLowerCase()).includes(emailToAdd)) {
        currentList.push(emailToAdd);
        await updateRoomParticipants(activeRoomId, currentList);
      }

      newMemberEmailInput.value = "";
      await renderMembersList();
    });
  }

  // Create Room Modal Handlers
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

      const userRole = await getCurrentUserRole();
      let emailList = rawEmails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

      // ALWAYS force the creator's logged-in email into the list
      if (userRole.email && !emailList.includes(userRole.email)) {
        emailList.unshift(userRole.email);
      }

      // Deduplicate email list
      emailList = [...new Set(emailList)];

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
          window.selectRoom(newRoom.id, newRoom.name || newRoom.client_name, newRoom);
        }
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupUIEventListeners();
  window.loadRoomsList();
});
