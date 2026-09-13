document.addEventListener("DOMContentLoaded", () => {
  renderServices();
  setupBookingEvents();
});

const availableServices = [
  { id: 'arch-rev', title: 'Architecture Review', price: 150, desc: '90-min session reviewing system layout and frontend specs.' },
  { id: 'full-build', title: 'Full Web Build Package', price: 1200, desc: 'Turnkey development of responsive enterprise sites.' },
  { id: 'perf-audit', title: 'Performance & Audit', price: 300, desc: 'Detailed Web Vitals analysis and UI/UX optimization report.' }
];

// Mock available daily slots for automated scheduling
const timeSlots = [
  "09:00 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"
];

function renderServices() {
  const container = document.getElementById('services-list');
  if (!container) return;

  container.innerHTML = availableServices.map(s => `
    <div class="card service-card" onclick="selectService('${s.id}', '${s.title}', ${s.price})" style="cursor: pointer; margin-bottom: 1rem; transition: border-color 0.2s ease;" id="card-${s.id}">
      <h4 style="font-size: 1.1rem; margin-bottom: 0.35rem;">${s.title}</h4>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 0.75rem;">${s.desc}</p>
      <strong style="color: var(--accent-red); font-size: 1rem;">$${s.price}</strong>
    </div>
  `).join('');
}

function selectService(id, title, price) {
  // Highlight active card
  document.querySelectorAll('.service-card').forEach(c => c.style.borderColor = 'var(--card-border)');
  document.getElementById(`card-${id}`).style.borderColor = 'var(--accent-red)';

  // Store selection
  document.getElementById('selected-service-id').value = id;
  
  // Update UI Status Badge
  const statusBadge = document.getElementById('service-selection-status');
  statusBadge.style.background = 'rgba(59, 130, 246, 0.15)';
  statusBadge.style.borderColor = '#3b82f6';
  statusBadge.innerHTML = `<strong style="color: #fff;">Selected:</strong> ${title} ($${price})`;

  // Enable Date Picker & Set minimum date to today
  const dateInput = document.getElementById('booking-date');
  dateInput.disabled = false;
  dateInput.min = new Date().toISOString().split('T')[0];
}

function setupBookingEvents() {
  const dateInput = document.getElementById('booking-date');
  const timeSelect = document.getElementById('booking-time');
  const submitBtn = document.getElementById('submit-booking-btn');

  // When date is selected, populate dynamic time slots dropdown
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;

    timeSelect.disabled = false;
    timeSelect.innerHTML = '<option value="">Select an available time...</option>' + 
      timeSlots.map(slot => `<option value="${slot}">${slot}</option>`).join('');
  });

  // Enable submit button once time is chosen
  timeSelect.addEventListener('change', () => {
    if (timeSelect.value) {
      submitBtn.disabled = false;
    }
  });

  // Handle Form Submission
  document.getElementById('booking-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const serviceId = document.getElementById('selected-service-id').value;
    const serviceObj = availableServices.find(s => s.id === serviceId);
    const date = dateInput.value;
    const time = timeSelect.value;

    alert(`Reservation Confirmed!\n\nService: ${serviceObj.title}\nDate: ${date}\nTime: ${time}`);
  });
}
