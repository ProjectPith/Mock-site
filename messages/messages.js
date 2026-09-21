// Inherit global Supabase client initialization if needed
if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let activeRoomId = null;
let activeChannel = null;

document.addEventListener("DOMContentLoaded", () => {
  loadRoomsList();
  setupUIEventListeners();
});

// Load Sidebar Rooms
async function loadRoomsList() {
  const rooms = await window.ChatEngine.fetchRooms();
  const roomsContainer = document.getElementById("rooms-list");

  if (rooms.length === 0) {
    roomsContainer.innerHTML = `<p style="padding: 1rem; color: #8b949e; font-size: 0.85rem;">No active chats.</p>`;
    return;
  }

  roomsContainer.innerHTML = rooms.map(room => `
    <div class="room-card ${room.id === activeRoomId ? 'active' : ''}" onclick="selectRoom('${room.id}', '${room.name}', '${room.client_email}')">
      <h4>${room.name}</h4>
      <small>${room.client_name || room.client_email}</small>
    </div>
  `).join("");
}

// Select a Room and Start Realtime Listener
window.selectRoom = function(roomId, roomName, clientEmail) {
  activeRoomId = roomId;

  // UI state swap
  document.getElementById("no-chat-selected").classList.add("hidden");
  document.getElementById("active-chat-container").classList.remove("hidden");
  document.getElementById("active-room-title").textContent = roomName;
  document.getElementById("active-room-subtitle").textContent = clientEmail;

  // Unsubscribe from previous room stream if changing rooms
  if (activeChannel) {
    window.supabaseClient.removeChannel(activeChannel);
  }

  const feed = document.getElementById("messages-feed");
  feed.innerHTML = ""; // Clear current view

  // Subscribe to live messages
  activeChannel = window.ChatEngine.subscribeToRoom(roomId, (messages, isInitialLoad) => {
    if (isInitialLoad) {
      feed.innerHTML = "";
    }
    
    messages.forEach(msg => {
      const bubble = document.createElement("div");
      bubble.className = `message-bubble ${msg.sender_type}`;
      bubble.innerHTML = `
        <div>${msg.content}</div>
        <span class="message-info">${msg.sender_name} • ${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      `;
      feed.appendChild(bubble);
    });

    feed.scrollTop = feed.scrollHeight; // Auto-scroll to bottom
  });

  loadRoomsList(); // Refresh active highlighting in sidebar
};

async function getCurrentUserRole() {
  const db = window.supabaseClient;
  if (!db) return { type: 'client', name: 'Client' };

  const { data } = await db.auth.getSession();
  const user = data?.session?.user;

  if (!user) return { type: 'client', name: 'Guest Client' };

  // Primary admin check or metadata check
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

// Update the Message Send event listener inside setupUIEventListeners():
document.getElementById("message-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("message-input");
  const content = input.value.trim();

  if (!content || !activeRoomId) return;

  // Dynamically determine sender role and name
  const userRole = await getCurrentUserRole();

  input.value = "";
  await window.ChatEngine.sendMessage(
    activeRoomId, 
    userRole.type,  // Sends 'admin' or 'client' automatically
    userRole.name,  // Uses actual user's full name/email
    content
  );
});
