document.addEventListener("DOMContentLoaded", () => {
  // 1. Inject Account Workspace Overlay into body
  const accountHTML = `
    <div id="account-overlay" class="account-overlay-backdrop hidden">
      <aside class="account-overlay-panel">
        <div class="account-overlay-header">
          <h3>Client Workspace Sign In</h3>
          <button id="close-account-overlay" class="account-close-btn">✕</button>
        </div>
        <div class="account-overlay-body">
          <form onsubmit="event.preventDefault();">
            <div class="account-form-group">
              <label for="client-email">Client Email</label>
              <input type="email" id="client-email" class="account-input" placeholder="client@company.com" required>
            </div>
            <div class="account-form-group">
              <label for="client-pass">Password / Project Passcode</label>
              <input type="password" id="client-pass" class="account-input" placeholder="••••••••" required>
            </div>
            <button type="submit" class="nav-btn" style="width: 100%; justify-content: center; margin-top: 0.5rem;">Access Workspace</button>
          </form>
        </div>
      </aside>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", accountHTML);

  const accountOverlay = document.getElementById("account-overlay");
  const closeBtn = document.getElementById("close-account-overlay");

  // 2. Global Event Delegation: Intercept clicks anywhere on the document
  document.addEventListener("click", (e) => {
    // Check if the clicked element (or its parent) matches #account-btn
    const accountButton = e.target.closest("#account-btn");
    if (accountButton) {
      e.preventDefault();
      accountOverlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }
  });

  // 3. Close Overlay Handlers
  function closeAccount() {
    accountOverlay.classList.add("hidden");
    document.body.style.overflow = "";
  }

  if (closeBtn) closeBtn.addEventListener("click", closeAccount);
  if (accountOverlay) {
    accountOverlay.addEventListener("click", (e) => {
      if (e.target === accountOverlay) closeAccount();
    });
  }
});
