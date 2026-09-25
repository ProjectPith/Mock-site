(function () {
  const baseUrl = (window.LUNARCRAFT_HERMES_BASE_URL || "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  const endpoint = window.LUNARCRAFT_AI_ENDPOINT || `${baseUrl}/chat/completions`;
  const model = window.LUNARCRAFT_HERMES_MODEL || "qwen2.5-coder-64k";
  let conversation = [];

  function initAssistant() {
    const assistantButton = document.getElementById("ai-assistant-btn");
    if (!assistantButton || document.getElementById("lc-ai-overlay")) return;

    const overlayMarkup = `
      <div id="lc-ai-overlay" class="lc-ai-backdrop" role="presentation" hidden>
        <section class="lc-ai-panel" role="dialog" aria-modal="true" aria-labelledby="lc-ai-title">
          <header class="lc-ai-header">
            <div>
              <p class="lc-ai-eyebrow">LUNARCRAFT</p>
              <h2 id="lc-ai-title">AI Assistant</h2>
            </div>
            <div class="lc-ai-header-actions">
              <button id="lc-ai-clear" class="lc-ai-icon-button" type="button" aria-label="Clear conversation" title="Clear conversation">↺</button>
              <button id="lc-ai-close" class="lc-ai-icon-button" type="button" aria-label="Close assistant" title="Close assistant">×</button>
            </div>
          </header>
          <div id="lc-ai-messages" class="lc-ai-messages" aria-live="polite" aria-relevant="additions">
            <div class="lc-ai-message assistant">Hi. What can I help you with?</div>
          </div>
          <form id="lc-ai-form" class="lc-ai-composer">
            <label class="lc-ai-sr-only" for="lc-ai-input">Message the AI assistant</label>
            <textarea id="lc-ai-input" rows="1" placeholder="Ask a question..." required></textarea>
            <button id="lc-ai-send" type="submit" aria-label="Send message" title="Send message">↑</button>
          </form>
          <p id="lc-ai-status" class="lc-ai-status"></p>
        </section>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", overlayMarkup);

    const overlay = document.getElementById("lc-ai-overlay");
    const messages = document.getElementById("lc-ai-messages");
    const form = document.getElementById("lc-ai-form");
    const input = document.getElementById("lc-ai-input");
    const sendButton = document.getElementById("lc-ai-send");
    const status = document.getElementById("lc-ai-status");
    let previousFocus = null;

    function setAdminVisibility(isAdmin) {
      assistantButton.hidden = !isAdmin;
      if (!isAdmin && !overlay.hidden) closeAssistant();
    }

    function openAssistant() {
      if (!window.lunarCraftIsAdmin) return;
      previousFocus = document.activeElement;
      overlay.hidden = false;
      requestAnimationFrame(() => input.focus());
      document.body.style.overflow = "hidden";
    }

    function closeAssistant() {
      overlay.hidden = true;
      document.body.style.overflow = "";
      previousFocus?.focus();
    }

    function addMessage(content, role) {
      const message = document.createElement("div");
      message.className = `lc-ai-message ${role}`;
      message.textContent = content;
      messages.appendChild(message);
      messages.scrollTop = messages.scrollHeight;
    }

    assistantButton.addEventListener("click", openAssistant);
    document.getElementById("lc-ai-close").addEventListener("click", closeAssistant);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeAssistant();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) closeAssistant();
    });

    document.getElementById("lc-ai-clear").addEventListener("click", () => {
      conversation = [];
      messages.innerHTML = '<div class="lc-ai-message assistant">Conversation cleared. What can I help you with?</div>';
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const content = input.value.trim();
      if (!content || sendButton.disabled) return;

      if (!window.lunarCraftIsAdmin) {
        closeAssistant();
        return;
      }

      addMessage(content, "user");
      conversation.push({ role: "user", content });
      input.value = "";

      if (!endpoint) {
        addMessage("The AI service is not configured yet.", "assistant");
        status.textContent = "Configure the Hermes endpoint to connect the assistant.";
        return;
      }

      sendButton.disabled = true;
      status.textContent = "Thinking...";
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "omit",
          body: JSON.stringify({ model, messages: conversation, stream: false })
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error?.message || result.error || `Request failed (${response.status})`);
        }

        const reply = result.choices?.[0]?.message?.content || result.reply || result.message || result.content;
        if (typeof reply !== "string" || !reply.trim()) throw new Error("The assistant returned an empty response.");
        conversation.push({ role: "assistant", content: reply });
        addMessage(reply, "assistant");
        status.textContent = "";
      } catch (error) {
        addMessage("I couldn't reach the AI service. Please try again.", "assistant");
        status.textContent = error.message;
      } finally {
        sendButton.disabled = false;
        input.focus();
      }
    });

    setAdminVisibility(Boolean(window.lunarCraftIsAdmin));
    window.addEventListener("lunarcraft:account-updated", (event) => {
      setAdminVisibility(Boolean(event.detail?.isAdmin));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAssistant, { once: true });
  } else {
    initAssistant();
  }
})();
