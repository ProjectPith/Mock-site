document.addEventListener("DOMContentLoaded", () => {
  const callBtn = document.getElementById("book-call-btn");
  const calendarModal = document.getElementById("cal-custom-modal");
  const closeCalendarBtn = document.getElementById("close-calendar-modal");

  if (callBtn && calendarModal instanceof HTMLDialogElement) {
    callBtn.addEventListener("click", () => {
      calendarModal.showModal();
    });

    closeCalendarBtn?.addEventListener("click", () => {
      calendarModal.close();
    });

    calendarModal.addEventListener("click", (event) => {
      if (event.target === calendarModal) {
        calendarModal.close();
      }
    });
  }

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
