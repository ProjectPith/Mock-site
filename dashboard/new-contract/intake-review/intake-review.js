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
// 1. PRICE ESTIMATOR LOGIC
// ==========================================
function initPriceEstimator() {
  const siteTypeSelect = document.getElementById("review-site-type");
  const addonsGroup = document.getElementById("calc-dynamic-addons");
  const addonBoxes = document.querySelectorAll(".calc-addon");
  const totalPriceEl = document.getElementById("calc-total-price");

  if (!siteTypeSelect || !totalPriceEl) return;

  function calculate() {
    const type = siteTypeSelect.value;
    let total = type === 'dynamic' ? 300 : 150;

    if (type === 'dynamic') {
      if (addonsGroup) addonsGroup.classList.remove("hidden");
      addonBoxes.forEach(box => {
        if (box.checked) total += parseInt(box.value, 10);
      });
    } else {
      if (addonsGroup) addonsGroup.classList.add("hidden");
    }

    totalPriceEl.textContent = `$${total}`;
  }

  siteTypeSelect.addEventListener("change", calculate);
  addonBoxes.forEach(box => box.addEventListener("change", calculate));
}

// ==========================================
// 2. CHAT WIDGET LOGIC
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

    const db = getDb();
    await db.from("messages").insert({
      room_id: activeRoomId,
      sender_type: "admin",
      sender_name: "Admin",
      content: msg
    });
  });
}

function connectChatRoom(roomId) {
  activeRoomId = roomId;
  const chatInput = document.getElementById("dash-chat-input");
  const chatSend = document.getElementById("dash-chat-send");
  if (chatInput) chatInput.disabled = false;
  if (chatSend) chatSend.disabled = false;

  const db = getDb();
  if (window.activeChatChannel) {
    db.removeChannel(window.activeChatChannel);
    window.activeChatChannel = null;
  }

  const channel = db.channel(`room_${roomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      appendMessageBubble(payload.new);
    })
    .subscribe();

  window.activeChatChannel = channel;

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

async function handleCreateOrOpenChat() {
  if (!activeIntake) return;
  const db = getDb();
  const projName = activeIntake.project_name || 'Untitled Project';

  const rawEmails = activeIntake.client_emails || [];
  const clientEmails = Array.isArray(rawEmails) 
    ? rawEmails.filter(e => typeof e === 'string' && e.trim() !== '') 
    : [];

  const primaryEmail = clientEmails[0] || 'client@example.com';
  const allEmailsCombined = clientEmails.join(', ');
  let primaryName = activeIntake.client_name || primaryEmail;

  const { data: existingRooms, error: searchErr } = await db
    .from("chat_rooms")
    .select("*")
    .ilike("name", `%${projName}%`);

  if (!searchErr && existingRooms && existingRooms.length > 0) {
    const room = existingRooms[0];
    await db
      .from("chat_rooms")
      .update({ 
        client_name: primaryName,
        client_email: allEmailsCombined || primaryEmail
      })
      .eq("id", room.id);

    const roomSelect = document.getElementById("dash-room-select");
    if (roomSelect) roomSelect.value = room.id;
    connectChatRoom(room.id);
  } else {
    const roomPayload = {
      name: `${projName} Chat`,
      client_name: primaryName,
      client_email: allEmailsCombined || primaryEmail
    };

    const { data: newRoom, error: createErr } = await db
      .from("chat_rooms")
      .insert(roomPayload)
      .select()
      .single();

    if (!createErr && newRoom) {
      const roomSelect = document.getElementById("dash-room-select");
      if (roomSelect) {
        const opt = document.createElement("option");
        opt.value = newRoom.id;
        opt.textContent = newRoom.name;
        roomSelect.appendChild(opt);
        roomSelect.value = newRoom.id;
      }
      connectChatRoom(newRoom.id);
    } else {
      console.error("Error creating chat room:", createErr);
    }
  }
}

// ==========================================
// 3. FETCH & DISPLAY PENDING INTAKES
// ==========================================
async function fetchPendingIntakes() {
  const grid = document.getElementById("intake-cards-grid");
  if (!grid) return;
  const db = getDb();

  const { data: intakes, error } = await db
    .from("project_intakes")
    .select("*")
    .eq("status", "awaiting_admin_review")
    .order("created_at", { ascending: false });

  if (error || !intakes || intakes.length === 0) {
    grid.innerHTML = `<p class="loading-text">No pending intake submissions needing review.</p>`;
    return;
  }

  currentIntakes = intakes;

  const allEmails = intakes.flatMap(i => i.client_emails || []).filter(Boolean);
  let profileMap = {};

  if (allEmails.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('email, full_name')
      .in('email', allEmails);

    if (profiles) {
      profiles.forEach(p => {
        if (p.email && p.full_name) {
          profileMap[p.email.toLowerCase()] = p.full_name;
        }
      });
    }
  }

  grid.innerHTML = intakes.map(item => {
    const primaryEmail = item.client_emails?.[0] || "";
    const clientDisplayName = profileMap[primaryEmail.toLowerCase()] || primaryEmail || "N/A";
    const submittedDate = new Date(item.created_at).toLocaleDateString();

    return `
      <div class="intake-card" onclick="openIntakeDetail('${item.id}')">
        <div class="intake-card-row">
          <div class="intake-card-item project-title">${escapeHtml(item.project_name || "Untitled Project")}</div>
          <span class="card-divider">|</span>
          <div class="intake-card-item"><strong>Client:</strong>&nbsp;${escapeHtml(clientDisplayName)}</div>
          <span class="card-divider">|</span>
          <div class="intake-card-item"><strong>Submitted:</strong>&nbsp;${submittedDate}</div>
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================
// 4. INTAKE PDF GENERATOR & VIEWER
// ==========================================
function buildIntakePdfHtml(data) {
  const title = escapeHtml(data.project_name || "Untitled Project");
  const createdDate = data.created_at ? new Date(data.created_at).toLocaleString() : new Date().toLocaleString();
  
  const formatVal = (val) => val ? escapeHtml(val) : "<em>N/A</em>";
  const formatList = (arr) => (Array.isArray(arr) && arr.length > 0) ? arr.map(i => escapeHtml(i)).join(", ") : "<em>None Specified</em>";

  // Formats Color Scheme details cleanly based on configured method
  let colorDetails = "<em>None Specified</em>";
  if (data.color_scheme) {
    const cs = data.color_scheme;
    if (cs.method === 'hex') {
      colorDetails = `Background: ${cs.hex_bg || 'N/A'}, Primary Text: ${cs.hex_primary || 'N/A'}, Accent 1: ${cs.hex_accent1 || 'N/A'}, Accent 2: ${cs.hex_accent2 || 'N/A'}`;
    } else if (cs.method === 'preset') {
      colorDetails = `Preset Theme: ${cs.preset_theme || 'N/A'}`;
    } else if (cs.method === 'vibe') {
      colorDetails = `Vibe Description: ${cs.vibe_text || 'N/A'}`;
    }
  }

  return `
    <div style="font-family: Arial, sans-serif; padding: 25px; color: #111; line-height: 1.5;">
      <div style="border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px;">
        <h1 style="margin: 0; font-size: 18pt; text-transform: uppercase;">Project Specification: ${title}</h1>
        <p style="margin: 4px 0 0 0; font-size: 10pt; color: #555;"><strong>Date Created:</strong> ${createdDate}</p>
      </div>

      <h3 style="font-size: 11pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 15px; text-transform: uppercase;">1. Project Identification</h3>
      <table style="width:100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9.5pt;">
        <tr><td style="width:30%; padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Project Name</td><td style="padding:6px; border:1px solid #ddd;">${title}</td></tr>
        <tr><td style="padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Company Name</td><td style="padding:6px; border:1px solid #ddd;">${formatVal(data.company_name)}</td></tr>
        <tr><td style="padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Involved Party Emails</td><td style="padding:6px; border:1px solid #ddd;">${formatList(data.client_emails)}</td></tr>
        <tr><td style="padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Custom Domain</td><td style="padding:6px; border:1px solid #ddd;">${formatVal(data.custom_domain)}</td></tr>
      </table>

      <h3 style="font-size: 11pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 15px; text-transform: uppercase;">2. Overview & Details</h3>
      <table style="width:100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9.5pt;">
        <tr><td style="width:30%; padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Project Description</td><td style="padding:6px; border:1px solid #ddd;">${formatVal(data.project_description)}</td></tr>
        <tr><td style="padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Target Audience</td><td style="padding:6px; border:1px solid #ddd;">${formatVal(data.target_audience)}</td></tr>
        <tr><td style="padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Additional Notes</td><td style="padding:6px; border:1px solid #ddd;">${formatVal(data.additional_notes || data.extra_notes)}</td></tr>
      </table>

      <h3 style="font-size: 11pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 15px; text-transform: uppercase;">3. Maintenance Schedule</h3>
      <table style="width:100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9.5pt;">
        <tr><td style="width:30%; padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Recurrence Cycle</td><td style="padding:6px; border:1px solid #ddd;">${formatVal(data.maint_recurrence)}</td></tr>
        <tr><td style="padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Maintenance Scope</td><td style="padding:6px; border:1px solid #ddd;">${formatVal(data.maint_scope)}</td></tr>
      </table>

      <h3 style="font-size: 11pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 15px; text-transform: uppercase;">4. Aesthetic & Color Scheme</h3>
      <table style="width:100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9.5pt;">
        <tr><td style="width:30%; padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Color Configuration</td><td style="padding:6px; border:1px solid #ddd;">${colorDetails}</td></tr>
      </table>

      <h3 style="font-size: 11pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 15px; text-transform: uppercase;">5. Build Type & Modules</h3>
      <table style="width:100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9.5pt;">
        <tr><td style="width:30%; padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Site Build Type</td><td style="padding:6px; border:1px solid #ddd;">${data.site_type === 'dynamic' ? 'Dynamic Web Application' : 'Static Web Presence'}</td></tr>
        <tr><td style="padding:6px; background:#f4f4f4; border:1px solid #ddd; font-weight:bold;">Included Dynamic Modules</td><td style="padding:6px; border:1px solid #ddd;">${formatList(data.selected_features || data.dynamic_features)}</td></tr>
      </table>
    </div>
  `;
}

window.openIntakeDetail = function(intakeId) {
  activeIntake = currentIntakes.find(i => i.id === intakeId);
  if (!activeIntake) return;

  switchViewStage("detail");
  document.getElementById("btn-nav-back")?.classList.remove("hidden");
  document.getElementById("right-panel-title").textContent = activeIntake.project_name || "Intake Review";
  document.getElementById("chat-party-action-bar")?.classList.remove("hidden");

  const doc = document.getElementById("intake-mini-doc");
  if (doc) {
    doc.innerHTML = buildIntakePdfHtml(activeIntake);
  }

  handleCreateOrOpenChat();
};

function switchViewStage(stage) {
  document.getElementById("view-intake-list")?.classList.add("hidden");
  document.getElementById("view-intake-detail")?.classList.add("hidden");
  document.getElementById("view-contract-editor")?.classList.add("hidden");

  if (stage === "list") {
    document.getElementById("view-intake-list")?.classList.remove("hidden");
    document.getElementById("btn-nav-back")?.classList.add("hidden");
    document.getElementById("right-panel-title").textContent = "Pending Project Intakes";
    document.getElementById("chat-party-action-bar")?.classList.add("hidden");
    activeIntake = null;
  } else if (stage === "detail") {
    document.getElementById("view-intake-detail")?.classList.remove("hidden");
  } else if (stage === "contract") {
    document.getElementById("view-contract-editor")?.classList.remove("hidden");
  }
}

// ==========================================
// 5. CONTRACT & EXECUTION WORKFLOW
// ==========================================
function renderContractPreview() {
  const doc = document.getElementById("contract-mini-doc");
  if (!doc) return;

  const projName = activeIntake?.project_name || "Web Development Build";
  const clientEmail = activeIntake?.client_emails?.[0] || "client@example.com";
  const defaultCost = activeIntake?.estimated_price || (activeIntake?.site_type === 'dynamic' ? '300' : '150');

  doc.innerHTML = `
    <h2>SERVICE AGREEMENT & CONTRACT</h2>
    <p>This agreement is entered into between <strong>LunarCraft</strong> and <strong><input type="text" id="doc-client-email" class="doc-input" value="${escapeHtml(clientEmail)}"></strong> for the project titled <strong><input type="text" id="doc-proj-name" class="doc-input" value="${escapeHtml(projName)}"></strong>.</p>
    
    <h3>1. Scope of Work</h3>
    <p>LunarCraft will design and develop the requested web assets including: <em>${escapeHtml((activeIntake?.selected_features || activeIntake?.dynamic_features || []).join(', ') || 'Custom Web Design & Integration')}</em>.</p>

    <h3>2. Financial & Payment Terms</h3>
    <table>
      <tr>
        <td class="label-col">Total Build Cost ($)</td>
        <td><input type="number" id="doc-total-cost" class="doc-input doc-table-input" value="${defaultCost}"></td>
      </tr>
      <tr>
        <td class="label-col">Required Initial Deposit ($)</td>
        <td><input type="number" id="doc-deposit" class="doc-input doc-table-input" value="${Math.round(defaultCost / 2)}"></td>
      </tr>
      <tr>
        <td class="label-col">Build Monthly Plan</td>
        <td><input type="text" id="doc-build-monthly" class="doc-input doc-table-input" value="N/A" placeholder="e.g. $50/mo for 6 mos"></td>
      </tr>
      <tr>
        <td class="label-col">Monthly Maintenance ($)</td>
        <td><input type="text" id="doc-maint-cost" class="doc-input doc-table-input" value="${escapeHtml(activeIntake?.maint_recurrence || '30 / month')}" placeholder="e.g. $30 / month or None"></td>
      </tr>
    </table>

    <div style="margin-top: 20px; border-top: 1px dashed #aaa; padding-top: 15px;">
      <p><em>Approved intake specifications will be compiled into the project's permanent document repository.</em></p>
    </div>
  `;
}

function setupEventListeners() {
  document.getElementById("btn-nav-back")?.addEventListener("click", () => switchViewStage("list"));
  document.getElementById("btn-create-or-open-chat")?.addEventListener("click", handleCreateOrOpenChat);

  // REJECT WORKFLOW
  document.getElementById("btn-action-reject")?.addEventListener("click", async () => {
    if (!activeIntake || !confirm("Reject and remove this intake submission?")) return;
    const db = getDb();

    await db.from("project_intakes").delete().eq("id", activeIntake.id);

    setFeedback("Project rejected and intake form deleted.", "#e74c3c");
    setTimeout(() => { switchViewStage("list"); fetchPendingIntakes(); }, 1200);
  });

  // REQUEST REVISIONS
  document.getElementById("btn-action-review")?.addEventListener("click", async () => {
    const note = prompt("Reason for sending back to client dashboard for review:");
    if (!note) return;

    const db = getDb();
    await db.from("project_intakes").update({
      status: "awaiting_client_review",
      admin_notes: note
    }).eq("id", activeIntake.id);

    setFeedback("Form returned to client dashboard for revisions.", "#f39c12");
    setTimeout(() => { switchViewStage("list"); fetchPendingIntakes(); }, 1200);
  });

  // APPROVE WORKFLOW
  document.getElementById("btn-action-approve")?.addEventListener("click", () => {
    switchViewStage("contract");
    renderContractPreview();
  });

  // EXECUTE & GENERATE PDF
  document.getElementById("btn-action-esign-initiate")?.addEventListener("click", executeProjectSequence);
}

// APPROVAL EXECUTION: GENERATE PDF, ATTACH TO STORAGE, DELETE INTAKE FORM
async function executeProjectSequence() {
  if (!activeIntake) return;
  const db = getDb();
  setFeedback("Processing project approval & generating documents...", "#88c0d0");

  const totalCost = document.getElementById("doc-total-cost")?.value || "300";
  const primaryEmail = document.getElementById("doc-client-email")?.value || activeIntake.client_emails?.[0] || "client@example.com";
  const projName = document.getElementById("doc-proj-name")?.value || activeIntake.project_name || "New Site Project";

  try {
    // 1. Create project record
    const { data: newProject, error: projErr } = await db
      .from("projects")
      .insert({
        name: projName,
        client_email: primaryEmail,
        status: "Active",
        total_cost: parseFloat(totalCost)
      })
      .select()
      .single();

    if (projErr) throw projErr;

    // 2. Initialize chat connection
    await handleCreateOrOpenChat();

    // 3. Render PDF DOM element containing exact intake form data
    const pdfContainer = document.createElement("div");
    pdfContainer.innerHTML = buildIntakePdfHtml(activeIntake);

    // 4. Convert DOM to PDF Blob
    const pdfBlob = await html2pdf().from(pdfContainer).output('blob');

    // 5. Upload PDF file to project's document folder
    const filePath = `documents/project_${newProject.id}/intake_specifications.pdf`;
    const { error: uploadErr } = await db.storage.from("project-files").upload(filePath, pdfBlob);

    if (uploadErr) {
      console.warn("Storage upload error:", uploadErr.message);
    }

    // 6. Delete intake form from project_intakes table
    const { error: deleteErr } = await db
      .from("project_intakes")
      .delete()
      .eq("id", activeIntake.id);

    if (deleteErr) throw deleteErr;

    setFeedback("Success! Project created, PDF attached to documents, and intake form removed.", "#4ed1a0");
    setTimeout(() => { switchViewStage("list"); fetchPendingIntakes(); }, 2000);

  } catch (err) {
    console.error(err);
    setFeedback("Error executing approval sequence: " + err.message, "#e74c3c");
  }
}

function setFeedback(msg, color) {
  const el = document.getElementById("status-feedback-msg");
  if (el) {
    el.textContent = msg;
    el.style.color = color;
  }
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
