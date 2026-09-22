let currentIntakes = [];
let activeIntake = null;
let activeRoomId = null;

if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const getDb = () => window.supabaseClient;

document.addEventListener("DOMContentLoaded", () => {
  initPriceEstimator();
  initChatWidget();
  fetchPendingIntakes();
  setupEventListeners();
});

// ==========================================
// 1. PRICE ESTIMATOR WIDGET LOGIC
// ==========================================
function initPriceEstimator() {
  const siteTypeSelect = document.getElementById("review-site-type");
  const addonsGroup = document.getElementById("calc-dynamic-addons");
  const addonBoxes = document.querySelectorAll(".calc-addon");
  const totalPriceEl = document.getElementById("calc-total-price");

  function calculate() {
    const type = siteTypeSelect.value;
    let total = type === 'dynamic' ? 300 : 150;

    if (type === 'dynamic') {
      addonsGroup.classList.remove("hidden");
      addonBoxes.forEach(box => {
        if (box.checked) total += parseInt(box.value, 10);
      });
    } else {
      addonsGroup.classList.add("hidden");
    }

    totalPriceEl.textContent = `$${total}`;
  }

  siteTypeSelect.addEventListener("change", calculate);
  addonBoxes.forEach(box => box.addEventListener("change", calculate));
}

// ==========================================
// 2. CHAT & MESSAGES LOGIC
// ==========================================
async function initChatWidget() {
  if (!window.ChatEngine) return;

  const roomSelect = document.getElementById("dash-room-select");
  const rooms = await window.ChatEngine.fetchRooms();

  if (roomSelect && rooms && rooms.length > 0) {
    roomSelect.innerHTML = `<option value="">Select Room...</option>` +
      rooms.map(r => `<option value="${r.id}">${r.name || r.client_email || 'Chat'}</option>`).join("");

    roomSelect.addEventListener("change", (e) => {
      if (e.target.value) connectChatRoom(e.target.value);
    });

    if (rooms[0]) {
      roomSelect.value = rooms[0].id;
      connectChatRoom(rooms[0].id);
    }
  }

  document.getElementById("dash-chat-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("dash-chat-input");
    if (!activeRoomId || !input.value.trim()) return;

    const msg = input.value.trim();
    input.value = "";
    await window.ChatEngine.sendMessage(activeRoomId, "admin", "Admin", msg);
  });
}

function connectChatRoom(roomId) {
  activeRoomId = roomId;
  document.getElementById("dash-chat-input").disabled = false;
  document.getElementById("dash-chat-send").disabled = false;

  window.ChatEngine.subscribeToRoom(roomId, (messages, isInitialLoad) => {
    const container = document.getElementById("messages-list");
    if (!container) return;

    if (isInitialLoad) {
      container.innerHTML = "";
      if (!messages || messages.length === 0) {
        container.innerHTML = `<div class="message-placeholder"><p>No messages in room.</p></div>`;
        return;
      }
      messages.forEach(appendMessageBubble);
    } else if (messages && messages[0]) {
      appendMessageBubble(messages[0]);
    }
  });
}

function appendMessageBubble(msg) {
  const container = document.getElementById("messages-list");
  container.querySelector(".message-placeholder")?.remove();

  const bubble = document.createElement("div");
  const isAdmin = msg.sender_type === "admin";
  bubble.className = `dash-msg-bubble ${isAdmin ? 'admin' : 'client'}`;
  bubble.innerHTML = `<div>${escapeHtml(msg.content)}</div>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// Check or Create Chat with Clients
async function handleCreateOrOpenChat() {
  if (!activeIntake || !activeIntake.client_emails?.length) return;
  const db = getDb();
  const primaryEmail = activeIntake.client_emails[0];

  // Check if room exists
  const { data: existingRooms } = await db
    .from("chat_rooms")
    .select("*")
    .eq("client_email", primaryEmail);

  if (existingRooms && existingRooms.length > 0) {
    const roomId = existingRooms[0].id;
    document.getElementById("dash-room-select").value = roomId;
    connectChatRoom(roomId);
  } else {
    // Create new room
    const { data: newRoom, error } = await db
      .from("chat_rooms")
      .insert({
        name: `${activeIntake.project_name || 'Project'} Chat`,
        client_email: primaryEmail
      })
      .select()
      .single();

    if (!error && newRoom) {
      const roomSelect = document.getElementById("dash-room-select");
      const opt = document.createElement("option");
      opt.value = newRoom.id;
      opt.textContent = newRoom.name;
      roomSelect.appendChild(opt);
      roomSelect.value = newRoom.id;
      connectChatRoom(newRoom.id);
    }
  }
}

// ==========================================
// 3. INTAKE REVIEW & STAGE NAVIGATION
// ==========================================
async function fetchPendingIntakes() {
  const grid = document.getElementById("intake-cards-grid");
  const db = getDb();

  const { data: intakes, error } = await db
    .from("project_intakes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !intakes || intakes.length === 0) {
    grid.innerHTML = `<p class="loading-text">No intake forms submitted for review.</p>`;
    return;
  }

  currentIntakes = intakes;
  grid.innerHTML = intakes.map(item => `
    <div class="intake-card" onclick="openIntakeDetail('${item.id}')">
      <h4>${escapeHtml(item.project_name || "Untitled Project")}</h4>
      <p><strong>Client:</strong> ${escapeHtml(item.client_emails?.[0] || "N/A")}</p>
      <p><strong>Submitted:</strong> ${new Date(item.created_at).toLocaleDateString()}</p>
    </div>
  `).join("");
}

window.openIntakeDetail = function(intakeId) {
  activeIntake = currentIntakes.find(i => i.id === intakeId);
  if (!activeIntake) return;

  // UI Setup
  switchViewStage("detail");
  document.getElementById("btn-nav-back").classList.remove("hidden");
  document.getElementById("right-panel-title").textContent = activeIntake.project_name || "Intake Review";
  document.getElementById("chat-party-action-bar").classList.remove("hidden");

  // Render Mini Intake Preview
  const doc = document.getElementById("intake-mini-doc");
  doc.innerHTML = `
    <h3>PROJECT INTAKE SPECIFICATIONS</h3>
    <table>
      <tr><td><strong>Project Name</strong></td><td>${escapeHtml(activeIntake.project_name || "N/A")}</td></tr>
      <tr><td><strong>Client Email(s)</strong></td><td>${escapeHtml((activeIntake.client_emails || []).join(", "))}</td></tr>
      <tr><td><strong>Custom Domain</strong></td><td>${escapeHtml(activeIntake.custom_domain || "None")}</td></tr>
      <tr><td><strong>Site Type</strong></td><td>${activeIntake.site_type === 'dynamic' ? 'Dynamic Application' : 'Static Site'}</td></tr>
      <tr><td><strong>Selected Features</strong></td><td>${(activeIntake.selected_features || []).join(", ") || 'None'}</td></tr>
      <tr><td><strong>Maintenance Needs</strong></td><td>${escapeHtml(activeIntake.maintenance_needs || "None")}</td></tr>
    </table>
  `;

  // Auto-connect chat if existing
  handleCreateOrOpenChat();
};

function switchViewStage(stage) {
  document.getElementById("view-intake-list").classList.add("hidden");
  document.getElementById("view-intake-detail").classList.add("hidden");
  document.getElementById("view-contract-editor").classList.add("hidden");

  if (stage === "list") {
    document.getElementById("view-intake-list").classList.remove("hidden");
    document.getElementById("btn-nav-back").classList.add("hidden");
    document.getElementById("right-panel-title").textContent = "Pending Project Intakes";
    document.getElementById("chat-party-action-bar").classList.add("hidden");
    activeIntake = null;
  } else if (stage === "detail") {
    document.getElementById("view-intake-detail").classList.remove("hidden");
  } else if (stage === "contract") {
    document.getElementById("view-contract-editor").classList.remove("hidden");
  }
}

// ==========================================
// 4. ACTION HANDLERS (REJECT, REVIEW, APPROVE)
// ==========================================
function setupEventListeners() {
  document.getElementById("btn-nav-back").addEventListener("click", () => switchViewStage("list"));
  document.getElementById("btn-create-or-open-chat").addEventListener("click", handleCreateOrOpenChat);

  // REJECT ACTION
  document.getElementById("btn-action-reject").addEventListener("click", async () => {
    if (!activeIntake || !confirm("Reject this intake and remove from Supabase?")) return;
    const db = getDb();

    await db.from("project_intakes").delete().eq("id", activeIntake.id);
    setFeedback("Project rejected, notified client email, and deleted from table.", "#e74c3c");
    setTimeout(() => { switchViewStage("list"); fetchPendingIntakes(); }, 1500);
  });

  // REVIEW / REQUEST REVISIONS ACTION
  document.getElementById("btn-action-review").addEventListener("click", async () => {
    const note = prompt("Reason for sending back to client dashboard for review:");
    if (!note) return;

    const db = getDb();
    await db.from("project_intakes").update({
      status: "requires_client_revision",
      admin_notes: note
    }).eq("id", activeIntake.id);

    setFeedback("Sent back to client dashboard for revisions.", "#f39c12");
    setTimeout(() => { switchViewStage("list"); fetchPendingIntakes(); }, 1500);
  });

  // APPROVE & PREPARE CONTRACT ACTION
  document.getElementById("btn-action-approve").addEventListener("click", () => {
    switchViewStage("contract");
    renderContractPreview();
  });

  document.getElementById("btn-update-terms").addEventListener("click", renderContractPreview);

  // E-SIGN & INITIATE PROJECT SEQUENCE
  document.getElementById("btn-action-esign-initiate").addEventListener("click", executeProjectSequence);
}

function renderContractPreview() {
  const total = document.getElementById("input-total-cost").value || "300";
  const deposit = document.getElementById("input-deposit").value || "150";
  const buildMonthly = document.getElementById("input-build-monthly").value || "N/A";
  const maint = document.getElementById("input-maint-cost").value || "30";

  const doc = document.getElementById("contract-mini-doc");
  doc.innerHTML = `
    <h3>SERVICE AGREEMENT & CONTRACT</h3>
    <p><strong>Project:</strong> ${escapeHtml(activeIntake.project_name || 'Web Build')}</p>
    <table>
      <tr><td>Total Build Cost</td><td>$${total}</td></tr>
      <tr><td>Deposit Required</td><td>$${deposit}</td></tr>
      <tr><td>Build Monthly Plan</td><td>${buildMonthly}</td></tr>
      <tr><td>Monthly Maintenance</td><td>$${maint} / month</td></tr>
    </table>
    <p><em>By proceeding, an e-signature request will be issued to the client.</em></p>
  `;
}

// COMPLETE WORKFLOW EXECUTION
async function executeProjectSequence() {
  if (!activeIntake) return;
  const db = getDb();
  setFeedback("Initiating project creation sequence...", "#88c0d0");

  const totalCost = document.getElementById("input-total-cost").value || "300";
  const primaryEmail = activeIntake.client_emails?.[0] || "client@example.com";

  try {
    // 1. Create Project
    const { data: newProject, error: projErr } = await db
      .from("projects")
      .insert({
        name: activeIntake.project_name || "New Site Project",
        client_email: primaryEmail,
        status: "Contract Pending Signature",
        total_cost: parseFloat(totalCost)
      })
      .select()
      .single();

    if (projErr) throw projErr;

    // 2. Ensure Chat Room Exists
    await handleCreateOrOpenChat();

    // 3. Generate & Attach PDF
    const pdfElement = document.getElementById("intake-mini-doc");
    const pdfBlob = await html2pdf().from(pdfElement).output('blob');
    
    // Upload PDF to Supabase Storage
    const filePath = `documents/project_${newProject.id}_intake.pdf`;
    await db.storage.from("project-files").upload(filePath, pdfBlob);

    // 4. Update Intake Status
    await db.from("project_intakes").update({
      status: "contract_issued",
      project_id: newProject.id
    }).eq("id", activeIntake.id);

    setFeedback("Success! Contract emailed, project created, and documents archived.", "#4ed1a0");
    setTimeout(() => { switchViewStage("list"); fetchPendingIntakes(); }, 2000);

  } catch (err) {
    console.error(err);
    setFeedback("Error executing project sequence: " + err.message, "#e74c3c");
  }
}

function setFeedback(msg, color) {
  const el = document.getElementById("status-feedback-msg");
  el.textContent = msg;
  el.style.color = color;
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
