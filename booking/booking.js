document.addEventListener("DOMContentLoaded", () => {
  
  // --- 1. Cal.com Overlay Modal ---
  const modalOverlay = document.createElement("div");
  modalOverlay.id = "cal-custom-modal";
  modalOverlay.style.cssText = `
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.8);
    z-index: 99999;
    align-items: center;
    justify-content: center;
  `;

  const modalContent = document.createElement("div");
  modalContent.style.cssText = `
    position: relative;
    width: 90%;
    max-width: 900px;
    height: 85vh;
    background: #161b22;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  `;

  const closeBtn = document.createElement("button");
  closeBtn.innerText = "✕ Close";
  closeBtn.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    background: #30363d;
    color: #f0f6fc;
    border: none;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    z-index: 10;
  `;

  const iframe = document.createElement("iframe");
  <!-- Cal element-click embed code begins -->
  <script type="text/javascript">
    (function (C, A, L) { let p = function (a, ar) { a.q.push(ar); }; let d = C.document; C.Cal = C.Cal || function () { let cal = C.Cal; let ar = arguments; if (!cal.loaded) { cal.ns = {}; cal.q = cal.q || []; d.head.appendChild(d.createElement("script")).src = A; cal.loaded = true; } if (ar[0] === L) { const api = function () { p(api, arguments); }; const namespace = ar[1]; api.q = api.q || []; if(typeof namespace === "string"){cal.ns[namespace] = cal.ns[namespace] || api;p(cal.ns[namespace], ar);p(cal, ["initNamespace", namespace]);} else p(cal, ar); return;} p(cal, ar); }; })(window, "https://app.cal.com/embed/embed.js", "init");
  Cal("init", "secret", {origin:"https://app.cal.com"});
  Cal.config = Cal.config || {};
  Cal.config.forwardQueryParams = true;

  
    // Important: Please add the following attributes to the element that should trigger the calendar to open upon clicking.
    // `data-cal-link="lunarcraft/secret"`
    // data-cal-namespace="secret"
    // `data-cal-config='{"layout":"month_view","useSlotsViewOnSmallScreen":"true","theme":"auto"}'`

    Cal.ns.secret("ui", {"hideEventTypeDetails":false,"layout":"month_view"});
    </script>
    <!-- Cal element-click embed code ends -->  iframe.style.cssText = "width: 100%; height: 100%; border: none;";

  modalContent.appendChild(closeBtn);
  modalContent.appendChild(iframe);
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);

  const callBtn = document.getElementById("book-call-btn");
  if (callBtn) {
    callBtn.addEventListener("click", (e) => {
      e.preventDefault();
      modalOverlay.style.display = "flex";
    });
  }

  closeBtn.addEventListener("click", () => { modalOverlay.style.display = "none"; });
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) modalOverlay.style.display = "none";
  });

  // --- 2. Interactive Price Estimator Modal ---
  const openEstimatorBtn = document.getElementById("open-estimator-btn");
  const closeEstimatorBtn = document.getElementById("close-estimator-modal");
  const estimatorModal = document.getElementById("estimator-modal");
  
  const siteTypeSelect = document.getElementById("site-type");
  const dynamicAddonsGroup = document.getElementById("dynamic-addons");
  const addonCheckboxes = document.querySelectorAll(".addon-option");
  const totalPriceEl = document.getElementById("estimator-total-price");

  const BASE_PRICES = {
    static: 150,
    dynamic: 300
  };

  function calculateEstimate() {
    const selectedType = siteTypeSelect.value;
    let total = BASE_PRICES[selectedType] || 150;

    if (selectedType === "dynamic") {
      dynamicAddonsGroup.classList.remove("hidden");
      addonCheckboxes.forEach(checkbox => {
        if (checkbox.checked) {
          total += parseInt(checkbox.value, 10) || 0;
        }
      });
    } else {
      dynamicAddonsGroup.classList.add("hidden");
    }

    if (totalPriceEl) {
      totalPriceEl.textContent = `$${total.toLocaleString()}`;
    }
  }

  if (openEstimatorBtn && estimatorModal) {
    openEstimatorBtn.addEventListener("click", () => {
      estimatorModal.classList.remove("hidden");
    });
  }

  if (closeEstimatorBtn && estimatorModal) {
    closeEstimatorBtn.addEventListener("click", () => {
      estimatorModal.classList.add("hidden");
    });
  }

  if (estimatorModal) {
    estimatorModal.addEventListener("click", (e) => {
      if (e.target === estimatorModal) {
        estimatorModal.classList.add("hidden");
      }
    });
  }

  if (siteTypeSelect) {
    siteTypeSelect.addEventListener("change", calculateEstimate);
  }

  addonCheckboxes.forEach(checkbox => {
    checkbox.addEventListener("change", calculateEstimate);
  });

});
