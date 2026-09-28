(() => {
  const SUPABASE_URL = "https://rpfclpfipqspbdbanobj.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_bT739cvrORLIrJYQmUVO2Q_9qe25hOU";
  const confirmEndpoint = `${SUPABASE_URL}/functions/v1/confirm-account-action`;

  document.addEventListener("DOMContentLoaded", async () => {
    const title = document.getElementById("confirmation-title");
    const description = document.getElementById("confirmation-description");
    const form = document.getElementById("confirmation-form");
    const passwordFields = document.getElementById("password-fields");
    const passwordInput = document.getElementById("new-password");
    const confirmPasswordInput = document.getElementById("confirm-password");
    const submitButton = document.getElementById("confirmation-submit");
    const status = document.getElementById("confirmation-status");
    const token = new URLSearchParams(window.location.search).get("token") || "";

    const setError = message => {
      status.textContent = message;
    };

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      title.textContent = "Invalid confirmation link";
      description.textContent = "This link is incomplete or invalid. Request a fresh confirmation email from Account Details.";
      return;
    }

    try {
      const response = await fetch(`${confirmEndpoint}?token=${encodeURIComponent(token)}&inspect=1`, {
        headers: { apikey: SUPABASE_ANON_KEY }
      });
      const pending = await response.json();
      if (!response.ok) throw new Error(pending.error || "This confirmation link is expired or has already been used.");

      const isDelete = pending.action_type === "delete";
      title.textContent = isDelete ? "Confirm account deletion" : "Confirm account changes";
      description.textContent = isDelete
        ? "Confirm below to permanently delete your account. This cannot be undone."
        : "Confirm below to apply the account changes requested in your email.";
      submitButton.textContent = isDelete ? "Permanently Delete Account" : "Confirm Changes";
      if (pending.password_change) {
        passwordFields.classList.remove("hidden");
        passwordInput.required = true;
        confirmPasswordInput.required = true;
      }
      form.classList.remove("hidden");

      form.addEventListener("submit", async event => {
        event.preventDefault();
        const password = passwordInput.value;
        if (pending.password_change && password !== confirmPasswordInput.value) {
          setError("The passwords do not match.");
          return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Confirming...";
        status.textContent = "";
        try {
          const result = await fetch(`${confirmEndpoint}?token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_ANON_KEY,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ token, password: password || undefined })
          });
          const resultBody = await result.json();
          if (!result.ok) throw new Error(resultBody.error || "Confirmation failed.");

          title.textContent = "Confirmed";
          description.textContent = resultBody.message;
          form.classList.add("hidden");
          status.textContent = "";
        } catch (error) {
          setError(error.message || "Could not complete confirmation. Request a new link and try again.");
          submitButton.disabled = false;
          submitButton.textContent = isDelete ? "Permanently Delete Account" : "Confirm Changes";
        }
      });
    } catch (error) {
      title.textContent = "Unable to confirm this request";
      description.textContent = "No account changes have been made.";
      setError(error.message || "This link is expired or unavailable. Request a new confirmation email.");
    }
  });
})();
