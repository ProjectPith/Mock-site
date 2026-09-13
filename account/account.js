document.addEventListener("DOMContentLoaded", () => {
  renderAccountTab();
});

function renderAccountTab() {
  const view = document.getElementById('account-view');
  if (!view) return;

  if (!state.currentUser) {
    view.innerHTML = `
      <div style="text-align: center; margin-top: 3rem;">
        <h2>Account Access Required</h2>
        <p style="color: var(--text-muted); margin: 1rem 0;">Please log in or register to view your dashboard, past orders, and bookings.</p>
        <button class="btn btn-primary" onclick="openAuthModal()">Sign In / Register</button>
      </div>
    `;
    return;
  }

  view.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <h2>User Portal</h2>
      <button class="btn btn-secondary" onclick="logout()">Sign Out</button>
    </div>
    <div class="account-card">
      <h3>Profile Details</h3>
      <p style="margin-top: 0.5rem;"><strong>Name:</strong> ${state.currentUser.name}</p>
      <p><strong>Email:</strong> ${state.currentUser.email}</p>
    </div>

    <h3 style="margin-bottom: 0.5rem;">Service Bookings</h3>
    ${state.bookings.length === 0 ? '<p style="color:var(--text-muted); margin-bottom: 2rem;">No active bookings.</p>' : 
      state.bookings.map(b => `
        <div class="history-item">
          <strong>${b.service}</strong> — ${b.date} at ${b.time}
          <div style="color:var(--accent-red); font-size: 0.85rem; margin-top: 4px;">Status: ${b.status} ($${b.price})</div>
        </div>
      `).join('')}

    <h3 style="margin-bottom: 0.5rem; margin-top: 2rem;">Order History</h3>
    ${state.orders.length === 0 ? '<p style="color:var(--text-muted);">No orders placed yet.</p>' : 
      state.orders.map(o => `
        <div class="history-item">
          <strong>Order #${o.id}</strong> — Total: $${o.total.toFixed(2)} (${o.date})
          <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px;">
            ${o.items.map(i => `${i.title} (x${i.qty})`).join(', ')}
          </div>
        </div>
      `).join('')}
  `;
}
