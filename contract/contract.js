// contract.js - Auto-fill, Signature Pad, PDF Compiler & Supabase Upload

(function () {
  if (!window.supabaseClient && window.supabase) {
    const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTYyMzA0MywiZXhwIjoyMTA1MTk5MDQzfQ.b-QuyXcDsSF0heCqbs29Rp8whNxGqsA8ASTtlm6_HHk";
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
})();

let signaturePad;
let currentIntakeId = null;

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get("mode");
  const intakeId = urlParams.get("intake_id");

  if (mode === 'review') {
    document.getElementById("review-banner")?.classList.remove("hidden");
  }

  // Handle "Edit Intake" button action
  document.getElementById("btn-edit-intake")?.addEventListener("click", () => {
    window.location.href = `/intake/intake.html?intake_id=${intakeId}`;
  });

  // Handle "Send to Provider for Review" action
  document.getElementById("btn-submit-to-admin")?.addEventListener("click", async () => {
    const msgEl = document.getElementById("contract-msg");
    msgEl.textContent = "Submitting intake and contract draft to provider...";
    msgEl.style.color = "#87ceeb";

    const db = window.supabaseClient;
    const { error } = await db
      .from('project_intakes')
      .update({ status: 'pending_admin_review' })
      .eq('id', intakeId);

    if (error) {
      msgEl.textContent = "Error submitting: " + error.message;
      msgEl.style.color = "#ff6b6b";
    } else {
      msgEl.textContent = "Submitted successfully! Your provider will review and respond shortly.";
      msgEl.style.color = "#4ed1a0";
      setTimeout(() => {
        window.location.href = "/dashboard.html";
      }, 2000);
    }
  });
});

function initSignaturePad() {
  const canvas = document.getElementById("signature-pad");
  if (canvas) {
    signaturePad = new SignaturePad(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(15, 28, 46)'
    });

    document.getElementById("btn-clear-sig")?.addEventListener("click", () => signaturePad.clear());
  }
}

async function parseQueryParamsAndLoadData() {
  const urlParams = new URLSearchParams(window.location.search);
  currentIntakeId = urlParams.get("intake_id");

  if (!currentIntakeId) return;

  const db = window.supabaseClient;
  const { data: intake } = await db.from('project_intakes').select('*').eq('id', currentIntakeId).single();

  if (intake) {
    // Populate Document Fields
    document.getElementById("val-client-names").textContent = (intake.client_emails || []).join(", ");
    document.getElementById("val-project-name").textContent = intake.project_name || "Custom Web App";
    document.getElementById("val-domain-name").textContent = intake.custom_domain || "Pending Client Selection";
    document.getElementById("val-maintenance-scope").textContent = intake.maintenance_needs || "Ongoing Updates";
    
    // Auto fill date
    document.getElementById("val-provider-date").textContent = new Date().toISOString().split('T')[0];
  }
}

function generatePDFPreview() {
  const element = document.getElementById("contract-document");
  const opt = {
    margin: [0.3, 0.3, 0.3, 0.3],
    filename: 'LunarCraft_Agreement_Preview.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(element).save();
}

async function handleExecuteContract() {
  const msgEl = document.getElementById("contract-msg");
  const printedName = document.getElementById("input-printed-name").value.trim();

  if (signaturePad.isEmpty() || !printedName) {
    msgEl.textContent = "Please provide both a signature and your printed name.";
    msgEl.style.color = "#ff6b6b";
    return;
  }

  msgEl.textContent = "Compiling signed contract and uploading PDF...";
  msgEl.style.color = "#87ceeb";

  // Set sign date
  document.getElementById("val-client-date").textContent = new Date().toISOString().split('T')[0];

  // Hide clear button for PDF rendering
  document.getElementById("btn-clear-sig").style.display = "none";

  const element = document.getElementById("contract-document");
  const opt = {
    margin: [0.3, 0.3, 0.3, 0.3],
    filename: `LunarCraft_Agreement_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  // Generate PDF Blob
  const pdfBlob = await html2pdf().set(opt).from(element).output('blob');

  // Upload to Supabase Storage Bucket
  const db = window.supabaseClient;
  const fileName = `contracts/intake-${currentIntakeId || Date.now()}.pdf`;

  const { data: storageData, error: storageErr } = await db.storage
    .from('contracts')
    .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

  if (storageErr) {
    msgEl.textContent = "Error saving PDF: " + storageErr.message;
    msgEl.style.color = "#ff6b6b";
    document.getElementById("btn-clear-sig").style.display = "block";
    return;
  }

  const { data: publicUrlData } = db.storage.from('contracts').getPublicUrl(fileName);

  // Update Status Badge
  document.getElementById("contract-status-badge").textContent = "Executed & Filed";
  document.getElementById("contract-status-badge").style.background = "rgba(78, 209, 160, 0.2)";
  document.getElementById("contract-status-badge").style.color = "#4ed1a0";

  msgEl.textContent = "Agreement executed successfully! PDF attached to project file.";
  msgEl.style.color = "#4ed1a0";
}
