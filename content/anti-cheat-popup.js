// ============================================================
// FOCUS CLASH — ANTI-CHEAT POPUP (Content Script)
// "Still with the lecture? 👀" engagement check
// ============================================================

(function() {
  "use strict";

  if (window.__fc_anticheat_loaded) return;
  window.__fc_anticheat_loaded = true;

  let popupElement = null;
  let countdownInterval = null;

  function showPopup(reason, timeout) {
    // Remove existing popup if any
    removePopup();

    let subtitle = "";
    switch (reason) {
      case "inactivity":
        subtitle = "We haven't detected any activity for a while. Are you still studying?";
        break;
      case "speed_inactivity":
        subtitle = "Video speed was changed and no activity detected. Just checking in!";
        break;
      default:
        subtitle = "Quick check — are you still focused on your session?";
    }

    popupElement = document.createElement("div");
    popupElement.id = "fc-anticheat-overlay";
    
    let timeLeft = Math.ceil(timeout / 1000);

    popupElement.innerHTML = `
      <div class="fc-anticheat-card">
        <div class="fc-anticheat-emoji">👀</div>
        <div class="fc-anticheat-title">Still with the lecture?</div>
        <div class="fc-anticheat-subtitle">${subtitle}</div>
        <div class="fc-anticheat-timer" id="fc-ac-timer">${timeLeft}s</div>
        <div class="fc-anticheat-actions">
          <button class="fc-anticheat-btn primary" id="fc-ac-here">✅ I'm here</button>
          <button class="fc-anticheat-btn secondary" id="fc-ac-pause">⏸️ Pause</button>
        </div>
      </div>
    `;

    document.body.appendChild(popupElement);

    // Countdown timer
    countdownInterval = setInterval(() => {
      timeLeft--;
      const timerEl = document.getElementById("fc-ac-timer");
      if (timerEl) timerEl.textContent = `${timeLeft}s`;

      if (timeLeft <= 0) {
        // Timeout — auto pause + penalty
        chrome.runtime.sendMessage({
          type: "ANTI_CHEAT_RESPONSE",
          data: { response: "timeout" },
        }).catch(() => {});
        removePopup();
      }
    }, 1000);

    // Button handlers
    document.getElementById("fc-ac-here").addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "ANTI_CHEAT_RESPONSE",
        data: { response: "here" },
      }).catch(() => {});
      removePopup();
    });

    document.getElementById("fc-ac-pause").addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "ANTI_CHEAT_RESPONSE",
        data: { response: "pause" },
      }).catch(() => {});
      removePopup();
    });
  }

  function removePopup() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    if (popupElement && popupElement.parentNode) {
      popupElement.parentNode.removeChild(popupElement);
      popupElement = null;
    }
  }

  // ── Message Listener ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "SHOW_ANTI_CHEAT_POPUP") {
      showPopup(msg.reason, msg.timeout || 30000);
    }
    if (msg.type === "SESSION_COMPLETED" || msg.type === "SESSION_PAUSED") {
      removePopup();
    }
  });
})();
