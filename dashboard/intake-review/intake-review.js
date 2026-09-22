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
// 2. CHAT WIDGET LOGIC ('messages' table)
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
  document.getElementById("dash-chat-input").disabled = false;
  document.getElementById("dash-chat-send").disabled = false;

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
  container.querySelector(".message-placeholder")?.remove();

  const bubble = document.createElement("div");
  const isAdmin = msg.sender_type === "admin";
  bubble.className = `dash-msg-bubble ${isAdmin ? 'admin' : 'client'}`;
  bubble.innerHTML = `<div>${escapeHtml(msg.content)}</div>`;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

async function handleCreateOrOpenChat() {
  if (!activeIntake || !activeIntake.client_emails?.length) return;
  const db = getDb();
  const primaryEmail = activeIntake.client_emails[0];

  const { data: existingRooms } = await db
    .from("chat_rooms")
    .select("*")
    .eq("client_email", primaryEmail);

  if (existingRooms && existingRooms.length > 0) {
    const roomId = existingRooms[0].id;
    document.getElementById("dash-room-select").value = roomId;
    connectChatRoom(roomId);
  } else {
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
// 3. FETCH ONLY 'awaiting_admin_review' INTAKES
// ==========================================
async function fetchPendingIntakes() {
  const grid = document.getElementById("intake-cards-grid");
  const db = getDb();

  // Query ONLY forms currently submitted for admin review
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

  switchViewStage("detail");
  document.getElementById("btn-nav-back").classList.remove("hidden");
  document.getElementById("right-panel-title").textContent = activeIntake.project_name || "Intake Review";
  document.getElementById("chat-party-action-bar").classList.remove("hidden");

  const doc = document.getElementById("intake-mini-doc");
  
  const formatList = (arr) => (Array.isArray(arr) && arr.length > 0) ? arr.map(i => escapeHtml(i)).join(", ") : "None Specified";
  const formatValue = (val) => val ? escapeHtml(val) : "<em>Not Provided</em>";

  doc.innerHTML = `
    <h2>PROJECT INTAKE SUBMISSION</h2>
    <p><strong>Submitted Date:</strong> ${new Date(activeIntake.created_at).toLocaleString()}</p>

    <h3>1. General Client & Project Info</h3>
    <table>
      <tr><td class="label-col">Project Name</td><td>${formatValue(activeIntake.project_name)}</td></tr>
      <tr><td class="label-col">Client Email(s)</td><td>${formatList(activeIntake.client_emails)}</td></tr>
      <tr><td class="label-col">Custom Domain</td><td>${formatValue(activeIntake.custom_domain)}</td></tr>
      <tr><td class="label-col">Target Launch Date</td><td>${formatValue(activeIntake.target_launch_date)}</td></tr>
    </table>

    <h3>2. Technical & Feature Scope</h3>
    <table>
      <tr><td class="label-col">Site Type</td><td>${activeIntake.site_type === 'dynamic' ? 'Dynamic Application' : 'Static Site'}</td></tr>
      <tr><td class="label-col">Selected Features</td><td>${formatList(activeIntake.selected_features)}</td></tr>
      <tr><td class="label-col">Estimated Architecture Price</td><td>$${activeIntake.estimated_price || (activeIntake.site_type === 'dynamic' ? '300' : '150')}</td></tr>
    </table>

    <h3>3. Content & Design Requirements</h3>
    <table>
      <tr><td class="label-col">Target Audience</td><td>${formatValue(activeIntake.target_audience)}</td></tr>
      <tr><td class="label-col">Required Pages / Sections</td><td>${formatValue(activeIntake.page_breakdown || activeIntake.pages)}</td></tr>
      <tr><td class="label-col">Inspiration / Competitor Links</td><td>${formatValue(activeIntake.inspiration_links)}</td></tr>
      <tr><td class="label-col">Brand Assets / Drive Link</td><td>${formatValue(activeIntake.asset_drive_link)}</td></tr>
    </table>

    <h3>4. Maintenance & Hosting Needs</h3>
    <table>
      <tr><td class="label-col">Maintenance Preference</td><td>${formatValue(activeIntake.maintenance_needs)}</td></tr>
      <tr><td class="label-col">Additional Client Notes</td><td>${formatValue(activeIntake.additional_notes || activeIntake.notes)}</td></tr>
    </table>
  `;

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
// 4. IN-DOCUMENT CONTRACT EDITOR
// ==========================================
function renderContractPreview() {
  const doc = document.getElementById("contract-mini-doc");
  const projName = activeIntake?.project_name || "Web Development Build";
  const clientEmail = activeIntake?.client_emails?.[0] || "client@example.com";
  const defaultCost = activeIntake?.estimated_price || (activeIntake?.site_type === 'dynamic' ? '300' : '150');

  doc.innerHTML = `
    <h2>SERVICE AGREEMENT & CONTRACT</h2>
    <p>This agreement is entered into between <strong>LunarCraft</strong> and <strong><input type="text" id="doc-client-email" class="doc-input" value="${escapeHtml(clientEmail)}"></strong> for the project titled <strong><input type="text" id="doc-proj-name" class="doc-input" value="${escapeHtml(projName)}"></strong>.</p>
    
    <h3>1. Scope of Work</h3>
    <p>LunarCraft will design and develop the requested web assets including: <em>${escapeHtml((activeIntake?.selected_features || []).join(', ') || 'Custom Web Design & Integration')}</em>.</p>

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
        <td><input type="text" id="doc-maint-cost" class="doc-input doc-table-input" value="30 / month" placeholder="e.g. $30 / month or None"></td>
      </tr>
    </table>

    <h3>3. Hosting & Deployment Terms</h3>
    <p>Domain configuration (<input type="text" id="doc-domain" class="doc-input" value="${escapeHtml(activeIntake?.custom_domain || 'Pending Provider Setup')}">) and deployment services are provided as specified in the intake scope.</p>

    <div style="margin-top: 30px; border-top: 1px dashed #aaa; padding-top: 15px;">
      <p><em>By proceeding, an e-signature request with these finalized terms will be issued to the client.</em></p>
    </div>
  `;
}

// ==========================================
// 5. STATUS UPDATES & ACTIONS
// ==========================================
function setupEventListeners() {
  document.getElementById("btn-nav-back").addEventListener("click", () => switchViewStage("list"));
  document.getElementById("btn-create-or-open-chat").addEventListener("click", handleCreateOrOpenChat);

  // ACTION 1: REJECT (Mark as 'rejected')
  document.getElementById("btn-action-reject").addEventListener("click", async () => {
    if (!activeIntake || !confirm("Reject this intake form?")) return;
    const db = getDb();

    await db.from("project_intakes").update({
      status: "rejected"
    }).eq("id", activeIntake.id);

    setFeedback("Project rejected and removed from review queue.", "#e74c3c");
    setTimeout(() => { switchViewStage("list"); fetchPendingIntakes(); }, 1200);
  });

  // ACTION 2: SEND BACK FOR REVISIONS (Mark as 'awaiting_client_review')
  document.getElementById("btn-action-review").addEventListener("click", async () => {
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

  // ACTION 3: APPROVE & OPEN CONTRACT EDITOR
  document.getElementById("btn-action-approve").addEventListener("click", () => {
    switchViewStage("contract");
    renderContractPreview();
  });

  // ACTION 4: ISSUING CONTRACT (Mark as 'contract_issued')
  document.getElementById("btn-action-esign-initiate").addEventListener("click", executeProjectSequence);
}

// COMPLETE WORKFLOW EXECUTION
async function executeProjectSequence() {
  if (!activeIntake) return;
  const db = getDb();
  setFeedback("Initiating project creation sequence...", "#88c0d0");

  const totalCost = document.getElementById("doc-total-cost")?.value || "300";
  const primaryEmail = document.getElementById("doc-client-email")?.value || activeIntake.client_emails?.[0] || "client@example.com";
  const projName = document.getElementById("doc-proj-name")?.value || activeIntake.project_name || "New Site Project";

  try {
    // 1. Create Project Entry
    const { data: newProject, error: projErr } = await db
      .from("projects")
      .insert({
        name: projName,
        client_email: primaryEmail,
        status: "Contract Pending Signature",
        total_cost: parseFloat(totalCost),
        intake_id: activeIntake.id // Link back to original intake form
      })
      .select()
      .single();

    if (projErr) throw projErr;

    // 2. Open / Connect Chat Room
    await handleCreateOrOpenChat();

    // 3. Convert Contract DOM Document to PDF
    const pdfElement = document.getElementById("contract-mini-doc");
    
    const clonedElement = pdfElement.cloneNode(true);
    clonedElement.querySelectorAll("input").forEach(input => {
      const span = document.createElement("span");
      span.style.fontWeight = "bold";
      span.textContent = input.value;
      input.parentNode.replaceChild(span, input);
    });

    const pdfBlob = await html2pdf().from(clonedElement).output('blob');
    
    // Upload PDF to Supabase Storage
    const filePath = `documents/project_${newProject.id}_contract.pdf`;
    await db.storage.from("project-files").upload(filePath, pdfBlob);

    // 4. Update Intake Status to 'contract_issued'
    await db.from("project_intakes").update({
      status: "contract_issued",
      project_id: newProject.id
    }).eq("id", activeIntake.id);

    setFeedback("Success! Contract issued, project created, and PDF stored.", "#4ed1a0");
    setTimeout(() => { switchViewStage("list"); fetchPendingIntakes(); }, 2000);

  } catch (err) {
    console.error(err);
    setFeedback("Error executing sequence: " + err.message, "#e74c3c");
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
