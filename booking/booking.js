document.addEventListener("DOMContentLoaded", () => {
  setupPhoneBooking();
});

// Dynamic available call slots
const availableTimes = ["09:00 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"];

function setupPhoneBooking() {
  const dateInput = document.getElementById('booking-date');
  const timeSelect = document.getElementById('booking-time');
  const submitBtn = document.getElementById('schedule-btn');

  // Set min date to today
  dateInput.min = new Date().toISOString().split('T')[0];

  // Enable time slots when date is picked
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    timeSelect.disabled = false;
    timeSelect.innerHTML = '<option value="">Select an available time...</option>' + 
      availableTimes.map(t => `<option value="${t}">${t}</option>`).join('');
  });

  timeSelect.addEventListener('change', () => {
    if (timeSelect.value) submitBtn.disabled = false;
  });

  // Handle Automated Booking Form Submission
  document.getElementById('phone-booking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = document.getElementById('client-phone').value;
    const email = document.getElementById('client-email').value;
    const date = dateInput.value;
    const time = timeSelect.value;

    alert(`Success! Your phone consultation is set for ${date} at ${time}.\n\nAn automated confirmation email with your pre-appointment worksheet has been sent to ${email}.`);
  });
}

// ESTIMATOR CALCULATOR LOGIC
function openCalculatorModal() {
  document.getElementById('calc-modal').style.display = 'flex';
}

function calculateEstimate() {
  const basePrice = parseInt(document.getElementById('calc-type').value, 10);
  let total = basePrice;
  
  document.querySelectorAll('.calc-addon:checked').forEach(cb => {
    total += parseInt(cb.value, 10);
  });

  document.getElementById('calc-total').innerText = `$${total.toLocaleString()}`;
}

// CONTRACT MODAL LOGIC
function openContractModal() {
  document.getElementById('contract-modal').style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}
