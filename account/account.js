(function () {
  function initAccount() {
    if (document.getElementById("account-overlay")) return;

    const accountHTML = `
      <div id="account-overlay" class="account-overlay-backdrop hidden">
        <aside class="account-overlay-panel">
          <div class="account-overlay-header">
            <h3>Client Workspace Sign In</h3>
            <button id="close-account-overlay" class="account-close-btn" type="button">✕</button>
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

    // Global Click Delegation
    document.addEventListener("click", (e) => {
      if (e.target.closest("#account-btn")) {
        e.preventDefault();
        accountOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
      }

      if (e.target.closest("#close-account-overlay") || e.target === accountOverlay) {
        accountOverlay.classList.add("hidden");
        document.body.style.overflow = "";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccount);
  } else {
    initAccount();
  }
})();
