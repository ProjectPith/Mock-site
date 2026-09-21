// intake.js - Intake Form Handling

(function () {
  if (!window.supabaseClient && window.supabase) {
    const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
})();

document.addEventListener("DOMContentLoaded", () => {
  setupDynamicParties();
  setupShadePickers();
  setupFormSubmission();
});

// Dynamic Email Add/Remove
function setupDynamicParties() {
  const addBtn = document.getElementById("btn-add-party");
  const container = document.getElementById("parties-container");

  addBtn.addEventListener("click", () => {
    const row = document.createElement("div");
    row.className = "party-row";
    row.innerHTML = `
      <input type="email" class="party-email" required placeholder="client@example.com">
      <button type="button" class="btn-remove-party" onclick="removePartyRow(this)">&times;</button>
    `;
    container.appendChild(row);
  });
}

window.removePartyRow = function (btn) {
  const container = document.getElementById("parties-container");
  if (container.children.length > 1) {
    btn.parentElement.remove();
  }
};

// Sync Shade Picker buttons to Hex Text Inputs
function setupShadePickers() {
  const fields = [
    { text: "hex-bg", picker: "picker-bg" },
    { text: "hex-primary", picker: "picker-primary" },
    { text: "hex-accent-1", picker: "picker-accent-1" },
    { text: "hex-accent-2", picker: "picker-accent-2" }
  ];

  fields.forEach(({ text, picker }) => {
    const textEl = document.getElementById(text);
    const pickerEl = document.getElementById(picker);

    if (textEl && pickerEl) {
      pickerEl.addEventListener("input", (e) => {
        textEl.value = e.target.value.toUpperCase();
      });
      textEl.addEventListener("input", (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
          pickerEl.value = e.target.value;
        }
      });
    }
  });
}

window.switchColorMethod = function (method) {
  const hexSec = document.getElementById("color-sec-hex");
  const presetSec = document.getElementById("color-sec-preset");
  const vibeSec = document.getElementById("color-sec-vibe");

  hexSec.classList.add("hidden");
  presetSec.classList.add("hidden");
  vibeSec.classList.add("hidden");

  const hexBg = document.getElementById("hex-bg");
  const hexPrimary = document.getElementById("hex-primary");

  if (method === 'hex') {
    hexSec.classList.remove("hidden");
    hexBg.required = true;
    hexPrimary.required = true;
  } else {
    hexBg.required = false;
    hexPrimary.required = false;
    if (method === 'preset') presetSec.classList.remove("hidden");
    if (method === 'vibe') vibeSec.classList.remove("hidden");
  }
};

// Toggle Static vs Dynamic features panel
window.toggleSiteType = function (type) {
  const panel = document.getElementById("dynamic-features-panel");
  if (type === 'dynamic') {
    panel.classList.remove("hidden");
  } else {
    panel.classList.add("hidden");
  }
};

// Submit to Supabase
// Add or replace the submit logic in intake.js
function setupFormSubmission() {
  const form = document.getElementById("intake-form");
  const msgEl = document.getElementById("intake-msg");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "Processing intake specifications...";
    msgEl.style.color = "#87ceeb";

    const emailInputs = document.querySelectorAll(".party-email");
    const emails = Array.from(emailInputs).map(i => i.value.trim()).filter(Boolean);

    const colorMethod = document.querySelector("input[name='color_method']:checked").value;
    let colorDetails = {};

    if (colorMethod === 'hex') {
      colorDetails = {
        background: document.getElementById("hex-bg").value,
        primary: document.getElementById("hex-primary").value,
        accent1: document.getElementById("hex-accent-1").value || null,
        accent2: document.getElementById("hex-accent-2").value || null
      };
    } else if (colorMethod === 'preset') {
      const selectedPreset = document.querySelector("input[name='preset_theme']:checked");
      colorDetails = { preset: selectedPreset ? selectedPreset.value : 'charcoal' };
    } else if (colorMethod === 'vibe') {
      colorDetails = { vibe: document.getElementById("vibe-text").value };
    }

    const siteType = document.querySelector("input[name='site_type']:checked").value;
    let features = [];
    if (siteType === 'dynamic') {
      const checkedBoxes = document.querySelectorAll("input[name='feature_opt']:checked");
      features = Array.from(checkedBoxes).map(cb => cb.value);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const existingIntakeId = urlParams.get("intake_id");

    const payload = {
      project_name: document.getElementById("project-name").value,
      client_emails: emails,
      all_accounts_created: document.getElementById("confirm-accounts").checked,
      custom_domain: document.getElementById("custom-domain").value.trim() || null,
      project_description: document.getElementById("project-description").value,
      color_mode: colorMethod,
      color_details: colorDetails,
      site_type: siteType,
      selected_features: features,
      maintenance_needs: document.getElementById("maintenance-notes").value,
      extra_notes: document.getElementById("extra-notes").value,
      status: 'draft_client'
    };

    const db = window.supabaseClient;
    let recordId = existingIntakeId;

    if (existingIntakeId) {
      const { error } = await db.from('project_intakes').update(payload).eq('id', existingIntakeId);
      if (error) return showError(error.message);
    } else {
      const { data, error } = await db.from('project_intakes').insert([payload]).select('id').single();
      if (error) return showError(error.message);
      recordId = data.id;
    }

    // Redirect client directly to contract draft review before submitting to admin
    window.location.href = `/contract/contract.html?intake_id=${recordId}&mode=review`;
  });

  function showError(msg) {
    msgEl.textContent = "Error saving intake: " + msg;
    msgEl.style.color = "#ff6b6b";
  }
}
