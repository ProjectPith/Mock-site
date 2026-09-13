// ==========================================
// BOOKING & ESTIMATOR MODULE LOGIC
// ==========================================
const servicesData = [
  { id: 's1', title: 'Architecture Review', price: 150, desc: '90-min session reviewing system layout and frontend specs.' },
  { id: 's2', title: 'Full Web Build Package', price: 1200, desc: 'Turnkey development of responsive enterprise sites.' },
  { id: 's3', title: 'Performance & Audit', price: 300, desc: 'Detailed Web Vitals analysis and UI/UX optimization report.' }
];

document.addEventListener("DOMContentLoaded", () => {
  renderServices();

  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', handleBooking);
  }
});

function renderServices() {
  const container = document.getElementById('services-list');
  if (!container) return;

  container.innerHTML = servicesData.map(service => `
    <div class="service-card ${state.selectedService?.id === service.id ? 'selected' : ''}" 
         onclick="selectService('${service.id}')">
      <h3>${service.title}</h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">${service.desc}</p>
      <strong style="color: var(--accent-red);">$${service.price}</strong>
    </div>
  `).join('');
}

function selectService(id) {
  state.selectedService = servicesData.find(s => s.id === id);
  
  const displayInput = document.getElementById('selected-service-display');
  if (displayInput && state.selectedService) {
    displayInput.value = `${state.selectedService.title} ($${state.selectedService.price})`;
  }
  
  renderServices();
}

function handleBooking(e) {
  e.preventDefault();
  
  if (!state.selectedService) {
    alert('Please select a service from the list first.');
    return;
  }

  const dateEl = document.getElementById('booking-date');
  const timeEl = document.getElementById('booking-time');

  if (!dateEl || !timeEl) return;

  const booking = {
    id: 'BK-' + Date.now().toString().slice(-4),
    service: state.selectedService.title,
    price: state.selectedService.price,
    date: dateEl.value,
    time: timeEl.value,
    status: 'Confirmed'
  };

  state.bookings.push(booking);
  localStorage.setItem('bookings', JSON.stringify(state.bookings));

  alert(`Success! Reservation confirmed for ${booking.service} on ${booking.date} at ${booking.time}.`);
  
  // Reset form state
  e.target.reset();
  state.selectedService = null;
  
  const displayInput = document.getElementById('selected-service-display');
  if (displayInput) {
    displayInput.value = 'Select a service from the left';
  }
  
  renderServices();
}
