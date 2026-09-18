(function () {
  let isSignUpMode = false;
  let supabaseClient = null;

  function getSupabase() {
    if (!supabaseClient && window.supabase) {
      const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjMwNDMsImV4cCI6MjEwNTE5OTA0M30.I9oy9CDFsEPdPuq2hA6pgnhI79_m4JxsROTfAh4Jjf0";
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

      let userRole = "client"; // Explicitly defined baseline
      let fullName = user.user_metadata?.full_name || "";

      if (supabase) {
        try {
          const { data: profile, error } = await supabase
         .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (error) {
            console.warn("Error fetching profile:", error.message);
          }

          if (profile) {
            // Handles both "role" and potential typo "roll"
            const matchedRole = profile.role || profile.roll;
            if (matchedRole) userRole = String(matchedRole).toLowerCase().trim();
            if (profile.full_name) fullName = profile.full_name;
          }
        } catch (err) {
          console.warn("Could not fetch profile role, defaulting to client:", err);
        }
      }
      
      const isAdmin = userRole === "admin";

      bodyContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="border-bottom: 1px solid #30363d; padding-bottom: 1rem;">
            <p style="margin: 0; font-size: 0.8rem; color: #8b949e;">LOGGED IN AS</p>
            <h4 style="margin: 0.25rem 0 0 0; color: #f0f6fc; font-size: 1.1rem;">${fullName || user.email}</h4>
            <span style="display: inline-block; margin-top: 0.5rem; padding: 2px 8px; font-size: 0.75rem; border-radius: 12px; background: ${isAdmin ? '#238636' : '#1f6beb'}; color: white; text-transform: uppercase;">
              ${userRole}
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${isAdmin ? `
              <button class="nav-btn" style="width: 100%; justify-content: flex-start; border-color: #238636; color: #3fb950;">⚙️ Developer Dashboard</button>
              <button class="nav-btn" style="width: 100%; justify-content: flex-start;">📦 Printify Orders</button>
              <button class="nav-btn" style="width: 100%; justify-content: flex-start;">🛠️ Ongoing Builds</button>
              <button class="nav-btn" style="width: 100%; justify-content: flex-start;">📄 Contract Search Vault</button>
            ` : `
              <button class="nav-btn" style="width: 100%; justify-content: flex-start;">📦 Order History</button>
              <button class="nav-btn" style="width: 100%; justify-content: flex-start;">💬 Project Messages</button>
              <button class="nav-btn" style="width: 100%; justify-content: flex-start;">📝 Maintenance Forms</button>
              <button class="nav-btn" style="width: 100%; justify-content: flex-start;">📄 Contracts</button>
            `}
          </div>

          <button id="account-logout-btn" class="nav-btn" style="width: 100%; justify-content: center; margin-top: 2rem; border-color: #f85149; color: #f85149;">
            Sign Out
          </button>
        </div>
      `;

      document.getElementById("account-logout-btn")?.addEventListener("click", async () => {
        if (supabase) await supabase.auth.signOut();
        location.reload();
      });

    } else {
      if (panelTitle) panelTitle.textContent = "Client Workspace Access";
      if (navAccountBtn) navAccountBtn.textContent = "Sign In";

      bodyContainer.innerHTML = `
        <div style="display: flex; gap: 10px; margin-bottom: 1rem;">
          <button type="button" id="tab-signin" class="nav-btn" style="flex: 1; justify-content: center; opacity: ${isSignUpMode ? '0.6' : '1'};">Sign In</button>
          <button type="button" id="tab-signup" class="nav-btn" style="flex: 1; justify-content: center; opacity: ${isSignUpMode ? '1' : '0.6'};">Register</button>
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
        submitBtn.textContent = isSignUpMode ? "Creating Account..." : "Authenticating...";

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
