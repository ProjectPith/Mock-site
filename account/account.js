(function () {
  let isSignUpMode = false;

  function initAccount() {
    if (document.getElementById("account-overlay")) return;

    // 1. Render Account Slide-Out Panel HTML
    const accountHTML = `
      <div id="account-overlay" class="account-overlay-backdrop hidden">
        <aside class="account-overlay-panel">
          <div class="account-overlay-header">
            <h3 id="account-panel-title">Client Workspace Access</h3>
            <button id="close-account-overlay" class="account-close-btn" type="button">✕</button>
          </div>
          <div class="account-overlay-body">
            <!-- Mode Toggle Tabs -->
            <div style="display: flex; gap: 10px; margin-bottom: 1rem;">
              <button type="button" id="tab-signin" class="nav-btn" style="flex: 1; justify-content: center; background-color: #30363d;">Sign In</button>
              <button type="button" id="tab-signup" class="nav-btn" style="flex: 1; justify-content: center; opacity: 0.6;">Register</button>
            </div>

            <form id="account-auth-form">
              <div class="account-form-group" id="name-group" style="display: none;">
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
              <button type="submit" id="auth-submit-btn" class="nav-btn" style="width: 100%; justify-content: center; margin-top: 0.75rem;">Access Workspace</button>
            </form>
          </div>
        </aside>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", accountHTML);

    const accountOverlay = document.getElementById("account-overlay");

    // 2. Global Event Delegation for Opening/Closing
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

    // 3. Tab Switcher Logic
    const tabSignIn = document.getElementById("tab-signin");
    const tabSignUp = document.getElementById("tab-signup");
    const nameGroup = document.getElementById("name-group");
    const submitBtn = document.getElementById("auth-submit-btn");

    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener("click", () => {
        isSignUpMode = false;
        tabSignIn.style.opacity = "1";
        tabSignUp.style.opacity = "0.6";
        nameGroup.style.display = "none";
        submitBtn.textContent = "Access Workspace";
      });

      tabSignUp.addEventListener("click", () => {
        isSignUpMode = true;
        tabSignUp.style.opacity = "1";
        tabSignIn.style.opacity = "0.6";
        nameGroup.style.display = "flex";
        submitBtn.textContent = "Create Account";
      });
    }

    // 4. Form Submit Handler (Supabase Auth Integration)
    const form = document.getElementById("account-auth-form");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("client-email")?.value;
        const password = document.getElementById("client-pass")?.value;
        const fullName = document.getElementById("client-name")?.value;

        const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
        const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwZmNscGZpcHFzcGJkYmFub2JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjMwNDMsImV4cCI6MjEwNTE5OTA0M30.I9oy9CDFsEPdPuq2hA6pgnhI79_m4JxsROTfAh4Jjf0";

        if (!window.supabase) {
          alert("Supabase SDK is loading... Please try again in a moment.");
          return;
        }

        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        submitBtn.disabled = true;
        submitBtn.textContent = isSignUpMode ? "Creating Account..." : "Authenticating...";

        if (isSignUpMode) {
          // --- AUTOMATIC REGISTRATION FLOW ---
          const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
              data: { full_name: fullName || '' } // Automatically passed to public.profiles trigger
            }
          });

          if (error) {
            alert(`Registration failed: ${error.message}`);
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Account";
          } else {
            alert("Account registered! Please check your email for a confirmation link.");
            accountOverlay.classList.add("hidden");
            document.body.style.overflow = "";
          }
        } else {
          // --- SIGN IN FLOW ---
          const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
          });

          if (error) {
            alert(`Sign in failed: ${error.message}`);
            submitBtn.disabled = false;
            submitBtn.textContent = "Access Workspace";
          } else {
            // Check logged in user's profile role
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', data.user.id)
              .single();

            alert(`Welcome back, ${data.user.email}!`);
            
            // Redirect based on role if profile exists, otherwise default workspace
            if (profile && profile.role === 'admin') {
              window.location.href = "/admin.html";
            } else {
              window.location.href = "/workspace.html";
            }
          }
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccount);
  } else {
    initAccount();
  }
})();
