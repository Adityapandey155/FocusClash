// ============================================================
// FOCUS CLASH — OVERLAY WIDGET (Content Script)
// Floating pill UI injected on all pages during active session
// ============================================================

(function() {
  "use strict";

  // Prevent double injection
  if (document.getElementById("fc-overlay-root")) return;

  let isMinimized = false;
  let overlayRoot = null;
  let isSessionActive = false;
  let currentState = { timer: "00:00", score: 0, activity: 100, paused: false };

  // ── Create Overlay DOM ───────────────────────────────────
  function createOverlay() {
    overlayRoot = document.createElement("div");
    overlayRoot.id = "fc-overlay-root";
    overlayRoot.classList.add("fc-hidden");
    document.body.appendChild(overlayRoot);
    renderPill();
  }

  function renderPill() {
    if (!overlayRoot) return;

    if (isMinimized) {
      overlayRoot.innerHTML = `<div class="fc-overlay-dot" id="fc-dot"></div>`;
      document.getElementById("fc-dot").addEventListener("click", () => {
        isMinimized = false;
        renderPill();
      });
    } else {
      const pausedClass = currentState.paused ? " paused" : "";
      const activityClass = currentState.activity >= 80 ? "green" 
                          : currentState.activity >= 50 ? "yellow" 
                          : "red";

      overlayRoot.innerHTML = `
        <div class="fc-overlay-pill${pausedClass}">
          <span class="fc-overlay-icon">${currentState.paused ? "⏸" : "⚔️"}</span>
          <span class="fc-overlay-timer" id="fc-timer">${currentState.timer}</span>
          <div class="fc-overlay-divider"></div>
          <span class="fc-overlay-score" id="fc-score">🎯 ${currentState.score}</span>
          <div class="fc-overlay-activity ${activityClass}" id="fc-activity"></div>
          <button class="fc-overlay-minimize" id="fc-minimize" title="Minimize">−</button>
        </div>
      `;

      document.getElementById("fc-minimize").addEventListener("click", (e) => {
        e.stopPropagation();
        isMinimized = true;
        renderPill();
      });
    }
  }

  function showOverlay() {
    if (overlayRoot) {
      overlayRoot.classList.remove("fc-hidden");
      isSessionActive = true;
    }
  }

  function hideOverlay() {
    if (overlayRoot) {
      overlayRoot.classList.add("fc-hidden");
      isSessionActive = false;
    }
  }

  function updateOverlay(data) {
    if (!isSessionActive || isMinimized) return;

    if (data.timer !== undefined) {
      currentState.timer = data.timer;
      const timerEl = document.getElementById("fc-timer");
      if (timerEl) timerEl.textContent = data.timer;
    }

    if (data.score !== undefined) {
      currentState.score = data.score;
      const scoreEl = document.getElementById("fc-score");
      if (scoreEl) scoreEl.textContent = `🎯 ${data.score}`;
    }

    if (data.activity !== undefined) {
      currentState.activity = data.activity;
      const actEl = document.getElementById("fc-activity");
      if (actEl) {
        actEl.className = "fc-overlay-activity " + 
          (data.activity >= 80 ? "green" : data.activity >= 50 ? "yellow" : "red");
      }
    }

    if (data.paused !== undefined) {
      currentState.paused = data.paused;
      renderPill();
    }
  }

  // ── Message Listener ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case "SESSION_STARTED":
        showOverlay();
        break;

      case "SESSION_TICK":
        if (!isSessionActive) showOverlay();
        const elapsed = msg.elapsedMinutes || 0;
        const goal = msg.goalMinutes || 60;
        const timerType = msg.timerType || "countdown";

        let timerStr;
        if (timerType === "countdown") {
          const remaining = Math.max(0, goal - elapsed);
          const mins = Math.floor(remaining);
          const secs = 0; // We get minute-level updates from alarm
          timerStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        } else {
          const mins = Math.floor(elapsed);
          timerStr = `${String(mins).padStart(2, "0")}:00`;
        }

        const liveScore = Math.max(0, Math.round(elapsed * (msg.activityPct || 100) / 100));

        updateOverlay({
          timer: timerStr,
          score: liveScore,
          activity: msg.activityPct || 100,
        });
        break;

      case "SESSION_PAUSED":
        updateOverlay({ paused: true });
        break;

      case "SESSION_RESUMED":
        updateOverlay({ paused: false });
        break;

      case "SESSION_COMPLETED":
        hideOverlay();
        break;

      case "TAB_SWITCH":
        // Could flash the overlay
        break;
    }
  });

  // ── Initialize ───────────────────────────────────────────
  function init() {
    createOverlay();

    // Check if there's an active session on load
    chrome.runtime.sendMessage({ type: "GET_SESSION_STATE" }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && (response.state === "active" || response.state === "paused")) {
        showOverlay();
        if (response.state === "paused") {
          updateOverlay({ paused: true });
        }
      }
    });
  }

  // Wait for body
  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
