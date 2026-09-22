let currentIntakes = [];
let activeIntake = null;
let activeRoomId = null;

if (!window.supabaseClient && window.supabase) {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_bT739cvrORLIrJYQmUVO2Q_9qe25hOU";
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
  let primaryName = primaryEmail;

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
    .or("status.eq.awaiting_admin_review,status.eq.pending,status.eq.submitted")
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
// HELPER: PARSE COLOR SPECS UNIFORMLY
// ==========================================
function parseColorSpecs(data) {
  if (!data || !data.color_details) return "None Specified";
  
  let cd = data.color_details;
  if (typeof cd === "string" && (cd.startsWith("{") || cd.startsWith("["))) {
    try { cd = JSON.parse(cd); } catch (e) {}
  }

  if (typeof cd === "object" && cd !== null) {
    if (data.color_mode === 'hex') {
      return `BG: ${cd.background || 'N/A'} | Primary: ${cd.primary || 'N/A'} | Accent 1: ${cd.accent1 || 'N/A'} | Accent 2: ${cd.accent2 || 'N/A'}`;
    } else if (data.color_mode === 'preset') {
      return `Preset Theme: ${cd.preset || cd.preset_theme || 'N/A'}`;
    } else if (data.color_mode === 'vibe') {
      return `Vibe: ${cd.vibe || cd.vibe_text || 'N/A'}`;
    } else {
      return JSON.stringify(cd);
    }
  }
  return String(cd);
}

// ==========================================
// 4. INTAKE PDF GENERATOR & VIEWER
// ==========================================
function buildIntakePdfHtml(data) {
  if (!data) return "";

  const title = escapeHtml(data.project_name || "Untitled Project");
  const createdDate = data.created_at ? new Date(data.created_at).toLocaleString() : new Date().toLocaleString();
  
  const formatVal = (val) => {
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return escapeHtml(val).replace(/\n/g, "<br>");
    }
    return "<em>N/A</em>";
  };

  const formatList = (arr) => (Array.isArray(arr) && arr.length > 0) ? arr.map(i => escapeHtml(i)).join(", ") : "<em>None Specified</em>";

  const colorDisplay = escapeHtml(parseColorSpecs(data));

  const recurrenceDisplay = data.maintenance_recurrence 
    ? data.maintenance_recurrence.charAt(0).toUpperCase() + data.maintenance_recurrence.slice(1) 
    : "None";

  return `
    <div class="pdf-doc-container">
      <div class="pdf-doc-header">
        <h1>Project Specification: ${title}</h1>
        <p><strong>Date Created:</strong> ${createdDate}</p>
      </div>

      <h3 class="pdf-section-title">1. Project Identification</h3>
      <table class="pdf-table">
        <tr><td class="label-col">Project Name</td><td>${title}</td></tr>
        <tr><td class="label-col">Company Name</td><td>${formatVal(data.company_name)}</td></tr>
        <tr><td class="label-col">Involved Party Emails</td><td>${formatList(data.client_emails)}</td></tr>
        <tr><td class="label-col">Custom Domain</td><td>${formatVal(data.custom_domain)}</td></tr>
      </table>

      <h3 class="pdf-section-title">2. Overview & Details</h3>
      <table class="pdf-table">
        <tr><td class="label-col">Project Description</td><td>${formatVal(data.project_description)}</td></tr>
        <tr><td class="label-col">Target Audience</td><td>${formatVal(data.target_audience)}</td></tr>
        <tr><td class="label-col">Custom Specifications</td><td>${formatVal(data.custom_specifications)}</td></tr>
        <tr><td class="label-col">Extra Notes</td><td>${formatVal(data.extra_notes)}</td></tr>
      </table>

      <h3 class="pdf-section-title">3. Maintenance Schedule</h3>
      <table class="pdf-table">
        <tr><td class="label-col">Recurrence Cycle</td><td>${formatVal(recurrenceDisplay)}</td></tr>
        <tr><td class="label-col">Maintenance Needs</td><td>${formatVal(data.maintenance_needs)}</td></tr>
      </table>

      <h3 class="pdf-section-title">4. Aesthetic & Color Scheme</h3>
      <table class="pdf-table">
        <tr><td class="label-col">Color Mode</td><td>${formatVal(data.color_mode)}</td></tr>
        <tr><td class="label-col">Color Details</td><td>${colorDisplay}</td></tr>
      </table>

      <h3 class="pdf-section-title">5. Build Type & Modules</h3>
      <table class="pdf-table">
        <tr><td class="label-col">Site Build Type</td><td>${data.site_type === 'dynamic' ? 'Dynamic Web Application' : 'Static Web Presence'}</td></tr>
        <tr><td class="label-col">Included Features</td><td>${formatList(data.selected_features)}</td></tr>
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
  if (!doc || !activeIntake) return;

  const projName = activeIntake.project_name || "Custom Web Build";
  const compName = activeIntake.company_name || "";
  const customDomain = activeIntake.custom_domain || "";
  const rawEmails = activeIntake.client_emails || [];
  const clientEmailsStr = Array.isArray(rawEmails) ? rawEmails.join(", ") : "";
  const defaultCost = activeIntake.site_type === 'dynamic' ? '300' : '150';
  const defaultDeposit = Math.round(defaultCost / 2);
  const maintRecurrence = activeIntake.maintenance_recurrence || "none";
  const maintNeeds = activeIntake.maintenance_needs || "";
  const customSpecs = activeIntake.custom_specifications || activeIntake.extra_notes || "";
  
  // Extract and format color scheme safely so HTML input tags don't cut off JSON quotes
  const colorDisplay = parseColorSpecs(activeIntake);
  const selectedFeatures = (activeIntake.selected_features || []).join(", ");

  doc.innerHTML = `
    <div class="contract-document">
      
      <div class="contract-header">
        <h1>LUNARCRAFT</h1>
        <h2>WEB DESIGN & DIGITAL SERVICES AGREEMENT</h2>
        <p>MASTER SERVICE TEMPLATE</p>
      </div>

      <p>
        This Web Design & Services Agreement ("Agreement") is entered into as of the date of final electronic signature ("Effective Date"), by and between <strong>LunarCraft</strong> ("Provider"), and the Client identified below ("Client").
      </p>

      <section class="contract-section">
        <h3>1. PROJECT DETAILS & FINANCIAL TERMS</h3>
        <table class="terms-table">
          <tr>
            <td class="label-col">Client Full Name(s) / Email(s)</td>
            <td><input type="text" id="edit-client-names" class="doc-input doc-table-input" value="${escapeHtml(clientEmailsStr)}"></td>
          </tr>
          <tr>
            <td class="label-col">Business / Company Name</td>
            <td><input type="text" id="edit-company-name" class="doc-input doc-table-input" value="${escapeHtml(compName)}"></td>
          </tr>
          <tr>
            <td class="label-col">Project Name</td>
            <td><input type="text" id="edit-project-name" class="doc-input doc-table-input" value="${escapeHtml(projName)}"></td>
          </tr>
          <tr>
            <td class="label-col">Domain Name</td>
            <td><input type="text" id="edit-domain-name" class="doc-input doc-table-input" value="${escapeHtml(customDomain)}"></td>
          </tr>
          <tr>
            <td class="label-col">Site Build Total Cost ($)</td>
            <td><input type="number" id="edit-total-cost" class="doc-input doc-table-input" value="${defaultCost}"></td>
          </tr>
          <tr>
            <td class="label-col">Deposit Amount ($)</td>
            <td><input type="number" id="edit-deposit" class="doc-input doc-table-input" value="${defaultDeposit}"></td>
          </tr>
          <tr>
            <td class="label-col">Site Build Monthly Payment</td>
            <td><input type="text" id="edit-build-monthly" class="doc-input doc-table-input" value="N/A" placeholder="e.g. $50/mo for 6 mos"></td>
          </tr>
          <tr>
            <td class="label-col">Monthly Maintenance Cost</td>
            <td><input type="text" id="edit-maint-cost" class="doc-input doc-table-input" value="$30 / month"></td>
          </tr>
          <tr>
            <td class="label-col">Maintenance Frequency</td>
            <td>
              <select id="edit-maint-recurrence" class="doc-input doc-table-input">
                <option value="none" ${maintRecurrence === 'none' ? 'selected' : ''}>No Ongoing Maintenance</option>
                <option value="weekly" ${maintRecurrence === 'weekly' ? 'selected' : ''}>Weekly</option>
                <option value="biweekly" ${maintRecurrence === 'biweekly' ? 'selected' : ''}>Bi-Weekly</option>
                <option value="monthly" ${maintRecurrence === 'monthly' ? 'selected' : ''}>Monthly</option>
              </select>
            </td>
          </tr>
          <tr>
            <td class="label-col">Scope of Maintenance</td>
            <td><textarea id="edit-maint-scope" class="doc-input doc-table-input" rows="2">${escapeHtml(maintNeeds)}</textarea></td>
          </tr>
        </table>
      </section>

      <section class="contract-section">
        <h3>2. DEVELOPMENT & SITE ACCESS</h3>
        <p><strong>Deposit & Start Date:</strong> The site build process will officially commence only upon receipt and clearance of the initial deposit by the Provider.</p>
        <p><strong>Site Delivery & Access:</strong> Full access to and deployment of the completed website will be granted upon payment of the total build fee, unless a monthly payment schedule is specified in Section 1. Under a monthly payment schedule, Client access is contingent upon remaining fully current on all payments.</p>
      </section>

      <section class="contract-section">
        <h3>3. PROJECT SCOPE & TECHNICAL SPECS</h3>
        <table class="terms-table">
          <tr>
            <td class="label-col">Site Architecture</td>
            <td>
              <select id="edit-site-type" class="doc-input doc-table-input">
                <option value="static" ${activeIntake.site_type === 'static' ? 'selected' : ''}>Static Web Presence (Informational Responsive Layout)</option>
                <option value="dynamic" ${activeIntake.site_type === 'dynamic' ? 'selected' : ''}>Dynamic Web Application (Interactive Backend & Custom Web Tools)</option>
              </select>
            </td>
          </tr>
          <tr>
            <td class="label-col">Included Modules & Features</td>
            <td><textarea id="edit-selected-features" class="doc-input doc-table-input" rows="2">${escapeHtml(selectedFeatures)}</textarea></td>
          </tr>
          <tr>
            <td class="label-col">Design & Color Scheme Specs</td>
            <td><input type="text" id="edit-color-specs" class="doc-input doc-table-input" value="${escapeHtml(colorDisplay)}"></td>
          </tr>
        </table>
      </section>

      <section class="contract-section">
        <h3>4. INTELLECTUAL PROPERTY & CODE OWNERSHIP</h3>
        <p><strong>Source Code Ownership:</strong> Provider (LunarCraft) retains full ownership of all source code, design assets, and custom scripts created for the project until the site build cost is paid in full.</p>
        <p><strong>Payment Plans:</strong> If operating under a payment plan, ownership of all source code remains strictly with the Provider until the balance is cleared in full, regardless of active deployment.</p>
        <p><strong>Transfer upon Full Payment & Termination:</strong> Upon full payment of all outstanding build fees and formal contract termination, ownership of the site source code and repository will be transferred to the Client. The Client will assume sole management of third-party services (including Stripe, hosting, and API accounts).</p>
      </section>

      <section class="contract-section">
        <h3>5. ONGOING SITE MANAGEMENT & MAINTENANCE</h3>
        <p><strong>Management Rights:</strong> Provider will host, maintain, and manage the website until this Agreement is terminated in accordance with Section 7.</p>
        <p><strong>Maintenance Terms:</strong> Client agrees to pay the recurring Monthly Maintenance Fee outlined in Section 1 for continuous updates, monitoring, and administrative upkeep.</p>
      </section>

      <section class="contract-section">
        <h3>6. REVISIONS, SCOPE ADD-ONS & TECHNICAL WARRANTY</h3>
        <p><strong>Post-Delivery Window:</strong> Client is granted a two (2) week window following site delivery to request minor aesthetic adjustments and simple corrections at no additional charge.</p>
        <p><strong>Paid Add-Ons:</strong> Requested revisions involving new features, expanded functionality, or work beyond the initial scope are treated as paid add-ons and require an updated contract. Any deposit previously paid will be deducted from the revised total balance.</p>
        <p><strong>Provider Code Warranty:</strong> Any bugs or technical errors originating directly from Provider's original code carry no time limit and will be fixed at no extra charge.</p>
        <p><strong>Tamper Fee (Client / Third-Party Interference):</strong> Any bugs, errors, or outages caused by Client intervention, unauthorized modifications, or third-party interference will incur a repair fee of $150 per incident OR $75/hour, whichever is greater.</p>
      </section>

      <section class="contract-section">
        <h3>7. TERMINATION & REFUND POLICY</h3>
        <p><strong>Termination for Misconduct:</strong> Provider reserves the right to terminate this Agreement immediately for client misconduct, harassment, or disrespectful behavior. If terminated for misconduct prior to site handoff, the Client will receive a refund of payments made, but Provider retains 100% ownership of the website and code.</p>
        <p><strong>Client-Initiated Termination:</strong> If the Client chooses to terminate this Agreement prior to paying off the full build balance, no refunds will be issued for any deposits or payments previously made.</p>
      </section>

      <section class="contract-section">
        <h3>8. SPECIAL OPERATIONAL AGREEMENTS & SPECIFICATIONS</h3>
        <p style="font-size:9pt; color:#555;">The following non-standard terms, custom agreements, or operational exceptions have been agreed upon by both parties and override standard provisions where applicable:</p>
        <textarea id="edit-custom-specs" class="doc-input doc-table-input" rows="3">${escapeHtml(customSpecs)}</textarea>
      </section>

      <section class="contract-section">
        <h3>9. ELECTRONIC SIGNATURE & ACKNOWLEDGMENT</h3>
        <p style="font-size:9.5pt;">By signing electronically below, both parties agree to all terms and conditions of this Agreement.</p>
        
        <div class="contract-sig-grid">
          <div class="contract-sig-block">
            <h4>PROVIDER (LUNARCRAFT)</h4>
            <div class="contract-sig-box">Signature Pending Final Review</div>
            <div style="font-size:9pt; margin-top:6px;"><strong>Title:</strong> Owner / Developer</div>
          </div>

          <div class="contract-sig-block">
            <h4>CLIENT</h4>
            <div class="contract-sig-box">Signature Pending Final Approval</div>
            <div style="font-size:9pt; margin-top:6px;"><strong>Title:</strong> Client / Authorized Representative</div>
          </div>
        </div>
      </section>

    </div>
  `;
}

async function executeProjectSequence() {
  if (!activeIntake) return;
  const db = getDb();
  setFeedback("Processing project approval & generating documents...", "#88c0d0");

  const totalCost = document.getElementById("edit-total-cost")?.value || "300";
  const projName = document.getElementById("edit-project-name")?.value || activeIntake.project_name || "New Site Project";

  // ----------------------------------------------------
  // EXTRACT ALL CLIENT EMAILS & FETCH MATCHING NAMES
  // ----------------------------------------------------
  const rawEmails = activeIntake.client_emails || [];
  const clientEmails = Array.isArray(rawEmails) 
    ? rawEmails.map(e => String(e).trim()).filter(e => e !== '') 
    : [];

  let clientNames = [];

  if (clientEmails.length > 0) {
    const { data: profiles, error: profileErr } = await db
      .from('profiles')
      .select('email, full_name')
      .in('email', clientEmails);

    if (!profileErr && profiles) {
      // Create a map for fast email-to-name lookup
      const profileMap = {};
      profiles.forEach(p => {
        if (p.email) profileMap[p.email.toLowerCase()] = p.full_name || p.email;
      });

      // Map each email in order to its resolved name (or fallback to email)
      clientNames = clientEmails.map(email => profileMap[email.toLowerCase()] || email);
    } else {
      // Fallback if profiles lookup fails
      clientNames = [...clientEmails];
    }
  }

  const primaryEmail = clientEmails[0] || "client@example.com";

  try {
    // ----------------------------------------------------
    // 1. GENERATE PDF BLOB
    // ----------------------------------------------------
    const pdfContainer = document.createElement("div");
    pdfContainer.innerHTML = buildIntakePdfHtml(activeIntake);
    
    pdfContainer.style.position = "absolute";
    pdfContainer.style.left = "-9999px";
    pdfContainer.style.width = "800px";
    document.body.appendChild(pdfContainer);

    const pdfBlob = await html2pdf()
      .set({
        margin: 10,
        filename: `Intake_Spec_${Date.now()}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .from(pdfContainer)
      .output('blob');

    document.body.removeChild(pdfContainer);

    // ----------------------------------------------------
    // 2. UPLOAD TO SUPABASE STORAGE
    // ----------------------------------------------------
    const fileName = `intake_spec_${Date.now()}.pdf`;
    const filePath = `project_intakes/${fileName}`;
    
    const { data: uploadData, error: uploadErr } = await db.storage
      .from("project-files")
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadErr) {
      console.error("Storage Upload Error:", uploadErr);
      throw new Error("PDF Upload Failed: " + uploadErr.message);
    }

    const { data: urlData } = db.storage.from("project-files").getPublicUrl(filePath);
    const intakePdfUrl = urlData?.publicUrl || "";

    // ----------------------------------------------------
    // 3. INSERT INTO PROJECTS TABLE (WITH ALL EMAILS & NAMES)
    // ----------------------------------------------------
    const { data: newProject, error: projErr } = await db
      .from("projects")
      .insert({
        name: projName,
        client_email: primaryEmail,       // Primary email for legacy single-field compatibility
        client_emails: clientEmails,      // Array of ALL client emails
        client_names: clientNames,        // Array of ALL client profile names
        status: "Active",
        total_cost: parseFloat(totalCost),
        intake_pdf_url: intakePdfUrl,
        contract_pdf_url: null
      })
      .select()
      .single();

    if (projErr) {
      console.error("Project Creation Error:", projErr);
      throw new Error("Failed to create project row: " + projErr.message);
    }

    // ----------------------------------------------------
    // 4. CONNECT CHAT ROOM
    // ----------------------------------------------------
    await handleCreateOrOpenChat();

    // ----------------------------------------------------
    // 5. DELETE INTAKE RECORD
    // ----------------------------------------------------
    const { error: deleteErr } = await db
      .from("project_intakes")
      .delete()
      .eq("id", activeIntake.id);

    if (deleteErr) {
      console.error("Delete Record Error:", deleteErr);
      throw new Error("Project created, but deletion blocked by DB policies: " + deleteErr.message);
    }

    setFeedback("Success! Project created, all clients attached, PDF stored, and intake record removed.", "#4ed1a0");
    
    setTimeout(() => { 
      switchViewStage("list"); 
      fetchPendingIntakes(); 
    }, 1800);

  } catch (err) {
    console.error("Sequence Failure:", err);
    setFeedback("Error: " + err.message, "#e74c3c");
  }
}

function setupEventListeners() {
  document.getElementById("btn-nav-back")?.addEventListener("click", () => switchViewStage("list"));
  document.getElementById("btn-create-or-open-chat")?.addEventListener("click", handleCreateOrOpenChat);

  document.getElementById("btn-action-reject")?.addEventListener("click", async () => {
    if (!activeIntake) return;

    const rawEmails = activeIntake.client_emails || [];
    const clientEmails = Array.isArray(rawEmails) 
      ? rawEmails.map(e => String(e).trim()).filter(e => e !== '') 
      : [];

    const projName = activeIntake.project_name || "Untitled Project";

    // Optional: Ask for a reason so clients know why it was rejected
    const rejectReason = prompt(`Reject and delete intake for "${projName}"?\nEnter an optional rejection reason to include in the email:`);
    if (rejectReason === null) return; // User cancelled prompt

    setFeedback("Sending rejection notices & removing intake submission...", "#f39c12");

    try {
      // 1. Trigger rejection email API endpoint (if configured)
      if (clientEmails.length > 0) {
        await fetch("/api/send-rejection-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipients: clientEmails,
            projectName: projName,
            reason: rejectReason.trim() || "The submitted intake form did not meet project criteria or was duplicate."
          })
        }).catch(err => console.warn("Email dispatch failed or endpoint not implemented:", err));
      }

      // 2. Delete the record from Supabase database
      const db = getDb();
      const { error: deleteErr } = await db
        .from("project_intakes")
        .delete()
        .eq("id", activeIntake.id);

      if (deleteErr) throw deleteErr;

      setFeedback("Intake form rejected, notification sent, and record removed.", "#e74c3c");

      setTimeout(() => {
        switchViewStage("list");
        fetchPendingIntakes();
      }, 1500);

    } catch (err) {
      console.error("Rejection Error:", err);
      setFeedback("Error rejecting form: " + err.message, "#e74c3c");
    }
  });

  document.getElementById("btn-action-review")?.addEventListener("click", async () => {
    const note = prompt("Reason for sending back to client dashboard for review:");
    if (!note) return;

    const db = getDb();
    await db.from("project_intakes").update({
      status: "awaiting_client_review",
      revision_notes: note
    }).eq("id", activeIntake.id);

    setFeedback("Form returned to client dashboard for revisions.", "#f39c12");
    setTimeout(() => { switchViewStage("list"); fetchPendingIntakes(); }, 1200);
  });

  document.getElementById("btn-action-approve")?.addEventListener("click", () => {
    switchViewStage("contract");
    renderContractPreview();
  });

  document.getElementById("btn-action-esign-initiate")?.addEventListener("click", executeProjectSequence);
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
