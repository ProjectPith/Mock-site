document.addEventListener("DOMContentLoaded", () => {
  setupPhoneBooking();

  // Initialize Cal.com UI theme
  if (window.Cal) {
    Cal("ui", {
      "theme": "dark",
      "hideEventTypeDetails": false,
      "layout": "month"
    });
  }
});

  // Bind the Cal.com popup modal directly to the date input field
  Cal("elementClick", {
    elementOrSelector: "#booking-date",
    calLink: "hannah-martin-h12p3m/15min"
  });
});

// Available slots for automated scheduler
const availableTimes = ["09:00 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"];

function setupPhoneBooking() {
  const form = document.getElementById('phone-booking-form');
  const dateInput = document.getElementById('booking-date');
  const timeSelect = document.getElementById('booking-time');
  const submitBtn = document.getElementById('schedule-btn');

  if (!form || !dateInput || !timeSelect) return;

  // Restrict date selector to today or future dates
  dateInput.min = new Date().toISOString().split('T')[0];

  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    timeSelect.disabled = false;
    timeSelect.innerHTML = '<option value="">Select an available time...</option>' + 
      availableTimes.map(t => `<option value="${t}">${t}</option>`).join('');
  });

  timeSelect.addEventListener('change', () => {
    if (timeSelect.value) submitBtn.disabled = false;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('client-email').value;
    const date = dateInput.value;
    const time = timeSelect.value;

    alert(`Success! Consultation set for ${date} at ${time}.\n\nConfirmation email sent to ${email}.`);
  });
}

/* ESTIMATOR CALCULATOR LOGIC */
const BASE_PRICES = {
  'static': 400,
  'non-static': 800
};

function openCalculatorModal() {
  document.getElementById('calc-modal').style.display = 'flex';
  handleArchitectureChange();
}

function handleArchitectureChange() {
  const typeSelect = document.getElementById('calc-type');
  const addonSection = document.getElementById('addon-section');
  const checkboxes = document.querySelectorAll('.calc-addon');

  if (typeSelect.value === 'static') {
    addonSection.style.opacity = '0.4';
    addonSection.style.pointerEvents = 'none';
    checkboxes.forEach(cb => cb.checked = false);
  } else {
    addonSection.style.opacity = '1';
    addonSection.style.pointerEvents = 'auto';
  }

  calculateEstimate();
}

function calculateEstimate() {
  const typeSelect = document.getElementById('calc-type').value;
  let total = BASE_PRICES[typeSelect] || BASE_PRICES['static'];

  if (typeSelect === 'non-static') {
    document.querySelectorAll('.calc-addon:checked').forEach(cb => {
      total += parseInt(cb.value, 10);
    });
  }

  document.getElementById('calc-total').innerText = `$${total.toLocaleString()}`;
}

/* CONTRACT & GENERIC MODAL LOGIC */
function openContractModal() {
  document.getElementById('contract-modal').style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}
