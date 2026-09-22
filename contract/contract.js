(function () {
  if (!window.supabaseClient && window.supabase) {
    const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
})();

let currentIntakeId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentIntakeId = urlParams.get("intake_id");
  const mode = urlParams.get("mode");

  if (mode === 'review') {
    document.getElementById("review-banner")?.classList.remove("hidden");
  }

  if (currentIntakeId) {
    await loadIntakeAndProfileData(currentIntakeId);
  } else {
    console.warn("No intake_id provided in URL parameters.");
  }

  document.getElementById("btn-edit-intake")?.addEventListener("click", () => {
    if (currentIntakeId) {
      window.location.href = `/intake/intake.html?intake_id=${currentIntakeId}`;
    } else {
      window.location.href = `/intake/intake.html`;
    }
  });

  document.getElementById("btn-submit-to-admin")?.addEventListener("click", handleSendToAdmin);
  document.getElementById("btn-download-preview")?.addEventListener("click", generatePDFPreview);
});

async function loadIntakeAndProfileData(intakeId) {
  const db = window.supabaseClient;

  // 1. Fetch Intake Record
  const { data: intake, error: intakeErr } = await db
    .from('project_intakes')
    .select('*')
    .eq('id', intakeId)
    .single();

  if (intakeErr || !intake) {
    console.error("Error fetching intake:", intakeErr);
    return;
  }

  // Section 1 Fill
  document.getElementById("val-project-name").textContent = intake.project_name || "Custom Web Project";
  document.getElementById("val-domain-name").textContent = intake.custom_domain || "Pending / Not Provided";
  document.getElementById("val-maintenance-scope").textContent = intake.maintenance_needs || "Ongoing Updates";

  // Financial values if pre-populated in contract_terms JSONB
  if (intake.contract_terms) {
    if (intake.contract_terms.total_cost) document.getElementById("val-total-cost").textContent = `$${intake.contract_terms.total_cost}`;
    if (intake.contract_terms.deposit) document.getElementById("val-deposit").textContent = `$${intake.contract_terms.deposit}`;
    if (intake.contract_terms.monthly_build) document.getElementById("val-build-monthly").textContent = intake.contract_terms.monthly_build;
    if (intake.contract_terms.monthly_maint) document.getElementById("val-maintenance-cost").textContent = `$${intake.contract_terms.monthly_maint} / month`;
  }

  // Section 3 Technical Specs Fill
  const siteTypeDisplay = intake.site_type === 'dynamic' 
    ? 'Dynamic Web Application (Interactive Backend & Custom Web Tools)' 
    : 'Static Web Presence (Informational Responsive Layout)';
  document.getElementById("val-site-type").textContent = siteTypeDisplay;

  const features = intake.selected_features || [];
  if (features.length > 0) {
    document.getElementById("val-selected-features").innerHTML = `
      <ul style="margin: 0; padding-left: 18px;">
        ${features.map(f => `<li>${f}</li>`).join('')}
      </ul>
    `;
  } else {
    document.getElementById("val-selected-features").textContent = "Standard Core Layout (No custom dynamic modules selected)";
  }

  let colorDisplay = "";
  if (intake.color_mode === 'hex' && intake.color_details) {
    const c = intake.color_details;
    const parts = [`BG: ${c.background || 'N/A'}`, `Primary: ${c.primary || 'N/A'}`];
    if (c.accent1) parts.push(`Accent 1: ${c.accent1}`);
    if (c.accent2) parts.push(`Accent 2: ${c.accent2}`);
    colorDisplay = `Custom Hex Palette (${parts.join(', ')})`;
  } else if (intake.color_mode === 'preset' && intake.color_details) {
    colorDisplay = `Preset Theme: ${intake.color_details.preset || 'Standard'}`;
  } else if (intake.color_mode === 'vibe' && intake.color_details) {
    colorDisplay = `Custom Aesthetic Vibe: "${intake.color_details.vibe || 'Specified by client'}"`;
  } else {
    colorDisplay = "Standard Brand Aesthetic";
  }
  document.getElementById("val-color-specs").textContent = colorDisplay;

  // Profile Name Fetching
  const emails = intake.client_emails || [];
  if (emails.length > 0) {
    const { data: profiles, error: profileErr } = await db
      .from('profiles')
      .select('email, full_name, first_name, last_name')
      .in('email', emails);

    if (!profileErr && profiles && profiles.length > 0) {
      const resolvedNames = emails.map(email => {
        const match = profiles.find(p => p.email?.toLowerCase() === email.toLowerCase());
        if (match) {
          if (match.full_name) return match.full_name;
          if (match.first_name || match.last_name) return `${match.first_name || ''} ${match.last_name || ''}`.trim();
        }
        return email;
      });

      const nameDisplay = resolvedNames.join(", ");
      document.getElementById("val-client-names").textContent = nameDisplay;
      document.getElementById("sig-client-printed").textContent = nameDisplay;
    } else {
      document.getElementById("val-client-names").textContent = emails.join(", ");
      document.getElementById("sig-client-printed").textContent = emails.join(", ");
    }
  }
}

async function handleSendToAdmin() {
  const msgEl = document.getElementById("contract-msg");
  
  if (!currentIntakeId) {
    msgEl.textContent = "Error: Missing intake record ID. Please return to the intake form and resubmit.";
    msgEl.style.color = "#ff6b6b";
    return;
  }

  msgEl.textContent = "Saving and submitting intake package to provider for review...";
  msgEl.style.color = "#87ceeb";

  const db = window.supabaseClient;

  // Save current status AND ensure the record update completes in Supabase
  const { error } = await db
    .from('project_intakes')
    .update({ 
      status: 'pending_admin_review',
      updated_at: new Date().toISOString()
    })
    .eq('id', currentIntakeId);

  if (error) {
    console.error("Supabase Submission Error:", error);
    msgEl.textContent = "Error submitting to database: " + error.message;
    msgEl.style.color = "#ff6b6b";
  } else {
    msgEl.textContent = "Submitted successfully! Your provider will review financial terms and respond shortly.";
    msgEl.style.color = "#4ed1a0";

    // Disable button to prevent duplicate submissions
    const btn = document.getElementById("btn-submit-to-admin");
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.cursor = "not-allowed";
    }
  }
}

function generatePDFPreview() {
  const element = document.getElementById("contract-document");
  const opt = {
    margin: [0.3, 0.3, 0.3, 0.3],
    filename: 'LunarCraft_Agreement_Draft.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
}
