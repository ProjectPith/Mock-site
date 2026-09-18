    (function () {
  let isSignUpMode = false;
  let supabaseClient = null;

  // Hardcoded Primary Admin Fallback
  const PRIMARY_ADMIN_UID = "a854c1f9-292f-49ac-89c0-37dd509e683d";

  function getSupabase() {
    if (!supabaseClient && window.supabase) {
      const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
      const SUPABASE_ANON_KEY = "";
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
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

    if (user) {
      if (panelTitle) panelTitle.textContent = "My Account";
      if (navAccountBtn) navAccountBtn.textContent = "Account";

      let userRole = "client";
      let fullName = user.user_metadata?.full_name || "";

      if (user.id === PRIMARY_ADMIN_UID) {
        userRole = "admin";
      } else if (supabase) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", user.id)
            .maybeSingle();

          if (profile) {
            if (profile.role) userRole = profile.role;
            if (profile.full_name) fullName = profile.full_name;
          }
        } catch (err) {
          console.warn("Could not fetch profile role:", err);
        }
      }

      const isAdmin = userRole === "admin";

      bodyContainer.innerHTML = `
        <div class="account-user-card">
          <p class="account-subtext">LOGGED IN AS</p>
          <h4 class="account-user-name">${fullName || user.email}</h4>
          <span class="account-role-badge ${isAdmin ? 'admin' : 'client'}">
            ${userRole}
          </span>
        </div>

        <div class="account-tab-stack">
          ${isAdmin ? `
            <button class="nav-btn" style="border-color: #238636; color: #3fb950;">⚙️ Developer Dashboard</button>
            <button class="nav-btn">📦 Printify Orders Queue</button>
            <button class="nav-btn">🛠️ Ongoing Builds</button>
            <button class="nav-btn">💳 Client Invoicing</button>
            <button class="nav-btn">🗓️ Maintenance Schedule</button>
            <button class="nav-btn">📄 Contract Vault & Search</button>
            <button class="nav-btn">💬 Global Communications</button>

            <div class="account-promotion-box">
                <p class="account-subtext" style="margin-bottom: 0.5rem;">QUICK ROLE PROMOTION</p>
                <div class="account-promotion-row">
                    <input type="email" id="promote-user-email" class="account-input" placeholder="User Email" style="font-size: 0.85rem;">
                    <button id="promote-btn" type="button" class="account-promote-btn" title="Promote to Admin">✓</button>
                </div>
            </div>
          ` : `
            <button class="nav-btn">📦 Order History</button>
            <button class="nav-btn">🚀 Project History & Status</button>
            <button class="nav-btn">💳 Billing & Payments</button>
            <button class="nav-btn">📝 Maintenance Forms</button>
            <button class="nav-btn">📄 My Contracts</button>
            <button class="nav-btn">💬 Project Communications</button>
          `}
        </div>

        <button id="account-logout-btn" class="nav-btn account-logout-btn">
          Sign Out
        </button>
      `;

      document.getElementById("account-logout-btn")?.addEventListener("click", async () => {
        if (supabase) await supabase.auth.signOut();
        location.reload();
      });

      // Role Promotion Handler via Email
      document.getElementById("promote-btn")?.addEventListener("click", async () => {
          const targetEmail = document.getElementById("promote-user-email")?.value?.trim();
          if (!targetEmail) return alert("Please enter a user email address.");

          const promoteBtn = document.getElementById("promote-btn");
          promoteBtn.disabled = true;
          promoteBtn.textContent = "…";

          // Directly update the role for the existing account matching that email
          const { data, error: updateErr } = await supabase
            .from("profiles")
            .update({ role: "admin" })
            .eq("email", targetEmail)
            .select();

          if (updateErr) {
            alert(`Failed to elevate role: ${updateErr.message}`);
          } else if (!data || data.length === 0) {
            alert(`No existing account found with email: ${targetEmail}`);
          } else {
            alert(`User ${targetEmail} elevated to Admin!`);
            document.getElementById("promote-user-email").value = "";
          }
          promoteBtn.disabled = false;
          promoteBtn.textContent = "✓";
      });

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
            <input type="email" id="client-email" class="account-input" placeholder="you@company.com" required>
          </div>
          <div class="account-form-group">
            <label for="client-pass">Password / Passcode</label>
            <input type="password" id="client-pass" class="account-input" placeholder="••••••••" required>
          </div>
          <button type="submit" id="auth-submit-btn" class="nav-btn" style="width: 100%; justify-content: center; margin-top: 0.75rem;">
            ${isSignUpMode ? 'Create Account' : 'Access Workspace'}
          </button>
        </form>
      `;

      bindAuthFormEvents();
    }
  }

  function bindAuthFormEvents() {
    const tabSignIn = document.getElementById("tab-signin");
    const tabSignUp = document.getElementById("tab-signup");
    const nameGroup = document.getElementById("name-group");
    const submitBtn = document.getElementById("auth-submit-btn");

    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener("click", () => {
        isSignUpMode = false;
        tabSignIn.style.opacity = "1";
        tabSignUp.style.opacity = "0.6";
        if (nameGroup) nameGroup.style.display = "none";
        if (submitBtn) submitBtn.textContent = "Access Workspace";
      });

      tabSignUp.addEventListener("click", () => {
        isSignUpMode = true;
        tabSignUp.style.opacity = "1";
        tabSignIn.style.opacity = "0.6";
        if (nameGroup) nameGroup.style.display = "flex";
        if (submitBtn) submitBtn.textContent = "Create Account";
      });
    }

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
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName || '' } }
          });

          if (error) {
            alert(`Registration failed: ${error.message}`);
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Account";
          } else {
            alert("Account created! Check your email to confirm.");
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
            document.getElementById("account-overlay")?.classList.add("hidden");
            document.body.style.overflow = "";
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

    setTimeout(() => updateAccountPanelUI(), 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccount);
  } else {
    initAccount();
  }
})();
