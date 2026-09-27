(function () {
  let isSignUpMode = false;
  let supabaseClient = null;
  let passwordRecoveryActive = false;

  function getSupabase() {
    if (!window.supabaseClient && window.supabase) {
      const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
      const SUPABASE_ANON_KEY = "sb_publishable_bT739cvrORLIrJYQmUVO2Q_9qe25hOU";
      window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.supabaseClient;
  }
  
  async function updateAccountPanelUI(user = null) {
    const bodyContainer = document.querySelector(".account-overlay-body");
    const panelTitle = document.getElementById("account-panel-title");
    const navAccountBtn = document.getElementById("account-btn");
    if (!bodyContainer) return;

    const supabase = getSupabase();

    if (!user && supabase) {
      const { data } = await supabase.auth.getSession();
      user = data?.session?.user || null;
    }

    // --- LOGGED-IN VIEW ---
    if (user) {
      if (panelTitle) panelTitle.textContent = "My Account";
      if (navAccountBtn) navAccountBtn.textContent = "Account";

      const roleInfo = await window.resolveUserRole(user);
      const userRole = roleInfo.role;
      const isAdmin = roleInfo.isAdmin;
      window.lunarCraftIsAdmin = isAdmin;
      window.dispatchEvent(new CustomEvent("lunarcraft:account-updated", { detail: { isAdmin } }));
      const currentFullName = user.user_metadata?.full_name || '';
      const currentPhone = user.user_metadata?.phone || user.phone || '';
      const displayName = currentFullName || user.email;
      const safeDisplayName = window.escapeHtml ? window.escapeHtml(displayName) : String(displayName || '');
      const safeFullName = window.escapeHtml ? window.escapeHtml(currentFullName) : String(currentFullName || '');
      const safeEmail = window.escapeHtml ? window.escapeHtml(user.email || '') : String(user.email || '');

      bodyContainer.innerHTML = `
        <div class="account-user-card">
          <p class="account-subtext">LOGGED IN AS</p>
          <h4 class="account-user-name">${safeDisplayName}</h4>
          <span class="account-role-badge ${isAdmin ? 'admin' : 'client'}">
            ${userRole}
          </span>
        </div>

        <!-- Edit Profile Form (Hidden by default) -->
        <form id="account-profile-form" style="display: none; flex-direction: column; gap: 0.85rem; margin-bottom: 1.5rem;">
          <div class="account-form-group">
            <label for="edit-full-name">Full Name</label>
            <input type="text" id="edit-full-name" class="account-input" value="${safeFullName}" placeholder="Jane Doe">
          </div>
          <div class="account-form-group">
            <label for="edit-email">Email Address</label>
            <input type="email" id="edit-email" class="account-input" value="${safeEmail}" placeholder="you@company.com" autocomplete="username">
          </div>
          <div class="account-form-group">
            <label for="edit-phone">Phone Number (Optional)</label>
            <input type="tel" id="edit-phone" class="account-input" value="${window.escapeHtml ? window.escapeHtml(currentPhone) : String(currentPhone || '')}" placeholder="(555) 000-0000">
          </div>
          <div class="account-form-group">
            <label for="edit-password">New Password (Enter again after email confirmation)</label>
            <input type="password" id="edit-password" class="account-input" placeholder="Leave blank to keep current" autocomplete="new-password">
          </div>
          <!-- Scaled-Up Action Buttons matching the Sign-In UI -->
          <button type="button" id="save-profile-btn" class="nav-btn" style="background-color: var(--accent-blue, #87ceeb); color: #000; width: 100%; justify-content: center; margin-top: 0.5rem; padding: 0.85rem 1.25rem; font-size: 1.05rem; font-weight: 600;">
            Save Changes
          </button>
          <button type="button" id="cancel-profile-btn" class="nav-btn" style="width: 100%; justify-content: center; opacity: 0.8; padding: 0.85rem 1.25rem; font-size: 1.05rem; font-weight: 600;">
            Cancel
          </button>
          <button type="button" id="account-delete-btn" class="nav-btn" style="width: 100%; justify-content: center; margin-top: 0.25rem; padding: 0.85rem 1.25rem; font-size: 1.05rem; font-weight: 600; color: #f85149; border: 1px solid #f85149;">
            Delete My Account
          </button>
        </form>

        <!-- Navigation Stack -->
        <div id="account-menu-stack" class="account-tab-stack">
          <button id="account-settings-btn" class="nav-btn">👤 Account Details</button>
          ${isAdmin ? `
            <button class="nav-btn" style="border-color: #238636; color: #3fb950;">⚙️ Developer Dashboard</button>
            <button class="nav-btn">📦 Printify Orders Queue</button>
            <button class="nav-btn">💳 Client Invoicing</button>
            <button class="nav-btn">📄 Contract Vault & Search</button>
            <button class="nav-btn">💬 Project Communications</button>
          ` : `
            <button class="nav-btn">📦 Order History</button>
            <button class="nav-btn">🚀 Project Dashboard</button>
            <button class="nav-btn">💳 Billing & Payments</button>
            <button class="nav-btn">📄 My Contracts</button>
            <button class="nav-btn">💬 Project Communications</button>
          `}
        </div>

        <button id="account-logout-btn" class="nav-btn account-logout-btn">
          Sign Out
        </button>
      `;

      // Toggle View Listeners
      const menuStack = document.getElementById("account-menu-stack");
      const settingsView = document.getElementById("account-profile-form");

      document.getElementById("account-settings-btn")?.addEventListener("click", () => {
        menuStack.style.display = "none";
        settingsView.style.display = "flex";
      });

      document.getElementById("cancel-profile-btn")?.addEventListener("click", () => {
        settingsView.style.display = "none";
        menuStack.style.display = "flex";
      });

      // Save Profile Changes
      document.getElementById("save-profile-btn")?.addEventListener("click", async () => {
        const newName = document.getElementById("edit-full-name")?.value.trim();
        const newEmail = document.getElementById("edit-email")?.value.trim();
        const newPhone = document.getElementById("edit-phone")?.value.trim();
        const wantsPasswordChange = Boolean(document.getElementById("edit-password")?.value.trim());

        const saveBtn = document.getElementById("save-profile-btn");
        saveBtn.disabled = true;
        saveBtn.textContent = "Sending Confirmation...";

        const { error } = await supabase.functions.invoke("request-account-action", {
          body: {
            action: "update",
            changes: { full_name: newName, phone: newPhone, email: newEmail },
            password_change: wantsPasswordChange
          }
        });

        if (error) {
          console.error("Account change request failed:", error);
          alert(`Could not request account changes: ${error.message}`);
        } else {
          const passwordNote = wantsPasswordChange
            ? " A new password can be entered after confirming the email link."
            : "";
          alert(`We sent a confirmation link to ${newEmail || user.email}. Your changes will apply only after you open it.${passwordNote}`);
          const passwordInput = document.getElementById("edit-password");
          if (passwordInput) passwordInput.value = "";
        }

        saveBtn.disabled = false;
        saveBtn.textContent = "Save Changes";
      });

      // Logout Event Listener
      document.getElementById("account-logout-btn")?.addEventListener("click", async () => {
        if (supabase) await supabase.auth.signOut();
        location.reload();
      });

      document.getElementById("account-delete-btn")?.addEventListener("click", async (event) => {
        const deleteButton = event.currentTarget;
        const confirmed = window.confirm(
          `Permanently delete the account for ${user.email}? This cannot be undone.`
        );
        if (!confirmed) return;

        deleteButton.disabled = true;
        deleteButton.textContent = "Sending Confirmation...";

        const { error: requestError } = await supabase.functions.invoke("request-account-action", {
          body: { action: "delete" }
        });
        if (requestError) {
          console.error("Account deletion request failed:", requestError);
          alert(`Could not request account deletion: ${requestError.message}`);
        } else {
          alert(`We sent a confirmation link to ${user.email}. Your account will be deleted only after you open that link.`);
        }

        deleteButton.disabled = false;
        deleteButton.textContent = "Delete My Account";
      });

    // --- LOGGED-OUT VIEW (SIGN IN / REGISTER FORM) ---
    } else {
      window.lunarCraftIsAdmin = false;
      window.dispatchEvent(new CustomEvent("lunarcraft:account-updated", { detail: { isAdmin: false } }));
      if (panelTitle) panelTitle.textContent = "Client Workspace Access";
      if (navAccountBtn) navAccountBtn.textContent = "Sign In";

      bodyContainer.innerHTML = `
        <div class="account-tab-toggle">
          <button type="button" id="tab-signin" class="nav-btn" style="opacity: ${isSignUpMode ? '0.6' : '1'};">Sign In</button>
          <button type="button" id="tab-signup" class="nav-btn" style="opacity: ${isSignUpMode ? '1' : '0.6'};">Register</button>
        </div>

        <form id="account-auth-form">
          <div class="account-form-group" id="name-group" style="display: ${isSignUpMode ? 'flex' : 'none'};">
            <label for="client-name">Full Name</label>
            <input type="text" id="client-name" class="account-input" placeholder="Jane Doe">
          </div>
          <div class="account-form-group">
            <label for="client-email">Email Address</label>
            <input type="email" id="client-email" class="account-input" placeholder="you@company.com" autocomplete="email" required>
          </div>
          <div class="account-form-group">
            <label for="client-pass">Password / Passcode</label>
            <input type="password" id="client-pass" class="account-input" placeholder="••••••••" autocomplete="${isSignUpMode ? 'new-password' : 'current-password'}" required>
          </div>
            
          <button type="submit" id="auth-submit-btn" class="nav-btn" style="width: 100%; justify-content: center; margin-top: 1rem; padding: 0.85rem 1.25rem; font-size: 1.05rem; font-weight: 600;">
            ${isSignUpMode ? 'Create Account' : 'Access Workspace'}
          </button>
        </form>
        <button type="button" id="password-reset-btn" class="nav-btn" style="display: ${isSignUpMode ? 'none' : 'flex'}; width: 100%; justify-content: center; margin-top: 0.75rem;">
          Send Password Reset Email
        </button>
      `;

      bindAuthFormEvents();
    }
  }

  function bindAuthFormEvents() {
    const tabSignIn = document.getElementById("tab-signin");
    const tabSignUp = document.getElementById("tab-signup");
    const nameGroup = document.getElementById("name-group");
    const submitBtn = document.getElementById("auth-submit-btn");
    const passwordResetBtn = document.getElementById("password-reset-btn");

    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener("click", () => {
        isSignUpMode = false;
        tabSignIn.style.opacity = "1";
        tabSignUp.style.opacity = "0.6";
        if (nameGroup) nameGroup.style.display = "none";
        if (submitBtn) submitBtn.textContent = "Access Workspace";
        if (passwordResetBtn) passwordResetBtn.style.display = "flex";
      });

      tabSignUp.addEventListener("click", () => {
        isSignUpMode = true;
        tabSignUp.style.opacity = "1";
        tabSignIn.style.opacity = "0.6";
        if (nameGroup) nameGroup.style.display = "flex";
        if (submitBtn) submitBtn.textContent = "Create Account";
        if (passwordResetBtn) passwordResetBtn.style.display = "none";
      });
    }

    passwordResetBtn?.addEventListener("click", async () => {
      const email = document.getElementById("client-email")?.value.trim();
      if (!email) {
        alert("Enter your email address first.");
        document.getElementById("client-email")?.focus();
        return;
      }

      const supabase = getSupabase();
      if (!supabase) {
        alert("Account services are unavailable. Please try again later.");
        return;
      }

      passwordResetBtn.disabled = true;
      try {
        const redirectTo = ["http:", "https:"].includes(window.location.protocol)
          ? new URL("/index.html", window.location.origin).href
          : undefined;
        const { error } = await supabase.auth.resetPasswordForEmail(
          email,
          redirectTo ? { redirectTo } : undefined
        );
        if (error) throw error;
        alert("If an account exists for that email, Supabase will send a password reset message.");
      } catch (error) {
        alert(`Could not send password reset: ${error.message}`);
      } finally {
        passwordResetBtn.disabled = false;
      }
    });

    const form = document.getElementById("account-auth-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("client-email")?.value;
        const password = document.getElementById("client-pass")?.value;
        const fullName = document.getElementById("client-name")?.value;
        const supabase = getSupabase();

        if (!supabase) return;

        submitBtn.disabled = true;
        submitBtn.textContent = isSignUpMode ? "Creating..." : "Authenticating...";

        if (isSignUpMode) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName || '' } }
          });

          if (error) {
            alert(`Registration failed: ${error.message}`);
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Account";
          } else if (data.user && !data.session && (!data.user.identities || data.user.identities.length === 0)) {
            alert("An account with that email already exists. Sign in instead or use the password reset flow.");
            isSignUpMode = false;
            await updateAccountPanelUI(null);
          } else {
            const confirmationRequired = !data.session;
            alert(confirmationRequired
              ? "Account created! Check your email to confirm your account before signing in."
              : "Account created and signed in.");
            document.getElementById("account-overlay")?.classList.add("hidden");
            document.body.style.overflow = "";
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });

          if (error) {
            alert(`Sign in failed: ${error.message}`);
            submitBtn.disabled = false;
            submitBtn.textContent = "Access Workspace";
          } else {
            await updateAccountPanelUI(data.user);
          }
        }
      });
    }
  }

  function initAccount() {
    if (document.getElementById("account-overlay")) return;

    const accountHTML = `
      <div id="account-overlay" class="account-overlay-backdrop hidden">
        <aside class="account-overlay-panel">
          <div class="account-overlay-header">
            <h3 id="account-panel-title">Client Workspace Access</h3>
            <button id="close-account-overlay" class="account-close-btn" type="button">✕</button>
          </div>
          <div class="account-overlay-body"></div>
        </aside>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", accountHTML);
    const accountOverlay = document.getElementById("account-overlay");

    const supabase = getSupabase();
    supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        passwordRecoveryActive = true;
        showPasswordRecoveryForm();
      }
    });

    // --- Overlay Toggle & Close Handlers ---
    document.addEventListener("click", (e) => {
      // 1. Open overlay when Account nav button is clicked
      if (e.target.closest("#account-btn")) {
        e.preventDefault();
        accountOverlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
      }

      // 2. Close overlay when 'X' or backdrop is clicked
      if (e.target.closest("#close-account-overlay") || e.target === accountOverlay) {
        accountOverlay.classList.add("hidden");
        document.body.style.overflow = "";
      }

      // 3. Page Routing for Menu Items (Closes overlay & opens page)
      const menuBtn = e.target.closest("#account-menu-stack .nav-btn");
      if (menuBtn) {
        const btnText = menuBtn.textContent.trim();

        // Skip "Account Details" so it toggles the inline edit form instead of redirecting
        if (menuBtn.id === "account-settings-btn") return;

        // Close side overlay
        accountOverlay.classList.add("hidden");
        document.body.style.overflow = "";

        // Route to the appropriate dedicated page
        if (btnText.includes("Printify Orders Queue")) {
          window.location.href = "/queue/queue.html";
        } else if (btnText.includes("Order History")) {
          window.location.href = "/orders/orders.html";
        } else if (btnText.includes("Developer Dashboard")) {
          window.location.href = "/dashboard/dashboard.html";
        } else if (btnText.includes("Client Invoicing")) {
          window.location.href = "/admin-billing/admin-billing.html";
        } else if (btnText.includes("Billing & Payments") || btnText.includes("Invoicing")) {
          window.location.href = "/billing/billing.html";
        } else if (btnText.includes("Project Communications")) {
          window.location.href = "/messages/messages.html";
        } else if (btnText.includes("Project Dashboard")) {
          window.location.href = "/client-projects/client-projects.html";
        }
        // Add more route conditions here as you build out additional pages!
      }
    });

    setTimeout(() => {
      if (!passwordRecoveryActive) updateAccountPanelUI();
    }, 300);
  }

  function showPasswordRecoveryForm() {
    const bodyContainer = document.querySelector(".account-overlay-body");
    const accountOverlay = document.getElementById("account-overlay");
    const panelTitle = document.getElementById("account-panel-title");
    if (!bodyContainer || !accountOverlay) return;

    if (panelTitle) panelTitle.textContent = "Choose a New Password";
    bodyContainer.innerHTML = `
      <form id="password-recovery-form">
        <div class="account-form-group">
          <label for="recovery-new-password">New Password</label>
          <input type="password" id="recovery-new-password" class="account-input" autocomplete="new-password" minlength="6" required>
        </div>
        <div class="account-form-group">
          <label for="recovery-confirm-password">Confirm New Password</label>
          <input type="password" id="recovery-confirm-password" class="account-input" autocomplete="new-password" minlength="6" required>
        </div>
        <button type="submit" id="password-recovery-submit" class="nav-btn" style="width: 100%; justify-content: center;">Update Password</button>
      </form>
    `;
    accountOverlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    document.getElementById("password-recovery-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = document.getElementById("recovery-new-password")?.value;
      const confirmation = document.getElementById("recovery-confirm-password")?.value;
      const submitButton = document.getElementById("password-recovery-submit");

      if (password !== confirmation) {
        alert("The passwords do not match.");
        return;
      }

      const supabase = getSupabase();
      if (!supabase) return;

      submitButton.disabled = true;
      submitButton.textContent = "Updating...";
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) {
        alert(`Password update failed: ${error.message}`);
        submitButton.disabled = false;
        submitButton.textContent = "Update Password";
        return;
      }

      alert("Your password has been updated.");
      passwordRecoveryActive = false;
      await updateAccountPanelUI(data.user);
      accountOverlay.classList.add("hidden");
      document.body.style.overflow = "";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccount);
  } else {
    initAccount();
  }
})();
