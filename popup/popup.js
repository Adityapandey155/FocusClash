// ============================================================
// FOCUS CLASH — POPUP CONTROLLER
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const app = new PopupApp();
  app.init();
});

class PopupApp {
  constructor() {
    // Screens
    this.screens = {
      idle: document.getElementById("screen-idle"),
      setup: document.getElementById("screen-setup"),
      active: document.getElementById("screen-active"),
      results: document.getElementById("screen-results"),
    };

    // State
    this.selectedMode = "competitive";
    this.selectedMinutes = 60;
    this.selectedTimerType = "countdown";
    this.tickInterval = null;
    this.sessionStartTime = null;
    this.sessionPausedMs = 0;
  }

  async init() {
    this.bindEvents();
    await this.loadProfile();
    await this.checkActiveSession();
    this.startLiveTimer();

    // Listen for background messages
    chrome.runtime.onMessage.addListener((msg) => this.handleMessage(msg));
  }

  // ── Event Binding ──────────────────────────────────────────

  bindEvents() {
    // Mode buttons
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.selectMode(btn));
    });

    // New Session
    document.getElementById("btn-new-session").addEventListener("click", () => {
      this.showScreen("setup");
    });

    // Back to idle
    document.getElementById("btn-back-idle").addEventListener("click", () => {
      this.showScreen("idle");
    });

    // Preset buttons
    document.querySelectorAll(".preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.selectPreset(btn));
    });

    // Custom minutes
    document.getElementById("input-custom-minutes").addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      if (val > 0) {
        this.selectedMinutes = val;
        document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("selected"));
      }
    });

    // Timer type
    document.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.selectTimerType(btn));
    });

    // Start Session
    document.getElementById("btn-start-session").addEventListener("click", () => this.startSession());

    // Session controls
    document.getElementById("btn-pause").addEventListener("click", () => this.pauseSession());
    document.getElementById("btn-resume").addEventListener("click", () => this.resumeSession());
    document.getElementById("btn-end").addEventListener("click", () => this.endSession());

    // Results actions
    document.getElementById("btn-new-after-result").addEventListener("click", () => {
      this.showScreen("setup");
    });

    // Dashboard buttons
    document.getElementById("btn-dashboard").addEventListener("click", () => this.openDashboard());
    document.getElementById("btn-dashboard-result").addEventListener("click", () => this.openDashboard());
  }

  // ── Screen Management ──────────────────────────────────────

  showScreen(name) {
    Object.values(this.screens).forEach(s => s.classList.remove("active"));
    if (this.screens[name]) {
      this.screens[name].classList.add("active");
    }
  }

  // ── Profile Loading ────────────────────────────────────────

  async loadProfile() {
    try {
      const profile = await this.sendMessage({ type: "GET_PROFILE" });
      const settings = await this.sendMessage({ type: "GET_SETTINGS" });
      const dailyStats = await this.sendMessage({ type: "GET_DAILY_STATS" });

      if (profile) {
        this.updateProfileUI(profile);
      }

      if (settings) {
        this.selectedMode = settings.mode || "competitive";
        document.querySelectorAll(".mode-btn").forEach(btn => {
          btn.classList.toggle("selected", btn.dataset.mode === this.selectedMode);
        });
      }

      if (dailyStats) {
        document.getElementById("stat-today").textContent =
          dailyStats.focusMinutes > 0 ? `${dailyStats.focusMinutes}m` : "0m";
      }
    } catch (e) {
      console.warn("Failed to load profile:", e);
    }
  }

  updateProfileUI(profile) {
    const levelInfo = this.getLevel(profile.totalXP);

    document.getElementById("level-icon").textContent = levelInfo.current.icon;
    document.getElementById("level-name").textContent = levelInfo.current.name;
    document.getElementById("xp-fill").style.width = `${levelInfo.progress}%`;

    const xpText = levelInfo.next
      ? `${profile.totalXP} / ${levelInfo.next.xpRequired} XP`
      : `${profile.totalXP} XP (MAX)`;
    document.getElementById("xp-text").textContent = xpText;
    document.getElementById("stat-streak").textContent = profile.currentStreak || 0;
  }

  getLevel(totalXP) {
    const levels = FC_CONSTANTS.LEVELS;
    let current = levels[0];
    let next = levels[1] || null;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (totalXP >= levels[i].xpRequired) {
        current = levels[i];
        next = levels[i + 1] || null;
        break;
      }
    }

    const xpInLevel = totalXP - current.xpRequired;
    const xpForNext = next ? next.xpRequired - current.xpRequired : 0;
    const progress = next ? Math.min(100, Math.round((xpInLevel / xpForNext) * 100)) : 100;

    return { current, next, progress };
  }

  // ── Check Active Session ───────────────────────────────────

  async checkActiveSession() {
    try {
      const state = await this.sendMessage({ type: "GET_SESSION_STATE" });
      if (state && state.state === "active") {
        this.sessionStartTime = state.startedAt;
        this.sessionPausedMs = state.totalPausedMs || 0;
        this.selectedMinutes = state.goalMinutes;
        this.selectedTimerType = state.timerType;
        document.getElementById("session-goal").textContent = state.goal || "Focus Session";
        this.showScreen("active");
        this.updateActiveUI(state);
        document.getElementById("btn-pause").style.display = "";
        document.getElementById("btn-resume").style.display = "none";
      } else if (state && state.state === "paused") {
        this.sessionStartTime = state.startedAt;
        this.sessionPausedMs = state.totalPausedMs || 0;
        this.selectedMinutes = state.goalMinutes;
        this.selectedTimerType = state.timerType;
        document.getElementById("session-goal").textContent = state.goal || "Focus Session";
        this.showScreen("active");
        this.updateActiveUI(state);
        document.getElementById("btn-pause").style.display = "none";
        document.getElementById("btn-resume").style.display = "";
      }
    } catch (e) {
      console.warn("No active session");
    }
  }

  // ── Mode Selection ─────────────────────────────────────────

  selectMode(btn) {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    this.selectedMode = btn.dataset.mode;
    this.sendMessage({ type: "UPDATE_SETTINGS", data: { mode: this.selectedMode } });
  }

  // ── Preset Selection ───────────────────────────────────────

  selectPreset(btn) {
    document.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    this.selectedMinutes = parseInt(btn.dataset.minutes);
    document.getElementById("input-custom-minutes").value = "";
  }

  // ── Timer Type ─────────────────────────────────────────────

  selectTimerType(btn) {
    document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    this.selectedTimerType = btn.dataset.timer;
  }

  // ── Session Control ────────────────────────────────────────

  async startSession() {
    const goal = document.getElementById("input-goal").value.trim() || "Focus Session";
    const customMin = parseInt(document.getElementById("input-custom-minutes").value);
    const minutes = customMin > 0 ? customMin : this.selectedMinutes;

    try {
      const result = await this.sendMessage({
        type: "START_SESSION",
        data: {
          goal,
          goalMinutes: minutes,
          timerType: this.selectedTimerType,
          mode: this.selectedMode,
        },
      });

      if (result && result.success) {
        this.sessionStartTime = result.session.startedAt;
        this.sessionPausedMs = 0;
        this.selectedMinutes = minutes;
        document.getElementById("session-goal").textContent = goal;
        document.getElementById("btn-pause").style.display = "";
        document.getElementById("btn-resume").style.display = "none";
        this.showScreen("active");
      }
    } catch (e) {
      console.error("Failed to start session:", e);
    }
  }

  async pauseSession() {
    const result = await this.sendMessage({ type: "PAUSE_SESSION" });
    if (result && result.success) {
      document.getElementById("btn-pause").style.display = "none";
      document.getElementById("btn-resume").style.display = "";
    }
  }

  async resumeSession() {
    const result = await this.sendMessage({ type: "RESUME_SESSION" });
    if (result && result.success) {
      document.getElementById("btn-pause").style.display = "";
      document.getElementById("btn-resume").style.display = "none";
    }
  }

  async endSession() {
    const confirmed = confirm("⚔️ End session now? Ending early may incur an XP penalty.");
    if (!confirmed) return;
    const result = await this.sendMessage({ type: "END_SESSION" });
    if (result && result.success) {
      this.showResults(result);
    }
  }

  // ── Live Timer ─────────────────────────────────────────────

  startLiveTimer() {
    this.tickInterval = setInterval(async () => {
      if (!this.screens.active.classList.contains("active")) return;

      try {
        const state = await this.sendMessage({ type: "GET_SESSION_STATE" });
        if (state && (state.state === "active" || state.state === "paused")) {
          this.updateActiveUI(state);
        }
      } catch (e) {
        // Popup might close, that's fine
      }
    }, 1000);
  }

  updateActiveUI(state) {
    const elapsed = state.elapsedMinutes || 0;
    const goal = state.goalMinutes || this.selectedMinutes;
    const timerType = state.timerType || this.selectedTimerType;

    let displaySeconds;
    if (timerType === "countdown") {
      let elapsedSoFarMs;
      if (state.state === "paused" && state.pausedAt) {
        // When paused, calculate elapsed up to the moment it was paused
        elapsedSoFarMs = (state.pausedAt - state.startedAt) - (state.totalPausedMs || 0);
      } else {
        elapsedSoFarMs = (Date.now() - state.startedAt) - (state.totalPausedMs || 0);
      }
      const remainingMs = Math.max(0, (goal * 60000) - elapsedSoFarMs);
      displaySeconds = Math.ceil(remainingMs / 1000);
      document.getElementById("timer-label").textContent = "remaining";
    } else {
      let elapsedMs;
      if (state.state === "paused" && state.pausedAt) {
        elapsedMs = (state.pausedAt - state.startedAt) - (state.totalPausedMs || 0);
      } else {
        elapsedMs = (Date.now() - state.startedAt) - (state.totalPausedMs || 0);
      }
      displaySeconds = Math.floor(Math.max(0, elapsedMs) / 1000);
      document.getElementById("timer-label").textContent = "elapsed";
    }

    const mins = Math.floor(displaySeconds / 60);
    const secs = displaySeconds % 60;
    document.getElementById("timer-display").textContent =
      `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    // Update ring progress
    const circumference = 2 * Math.PI * 88; // r=88
    let progress;
    if (timerType === "countdown") {
      progress = Math.max(0, Math.min(1, 1 - (displaySeconds / (goal * 60))));
    } else {
      progress = Math.min(1, elapsed / goal);
    }
    const offset = circumference * (1 - progress);
    document.getElementById("timer-ring-progress").style.strokeDashoffset = offset;

    // Update stats
    const activityPct = state.activityPct || 100;
    document.getElementById("stat-activity").textContent = `${activityPct}%`;
    document.getElementById("stat-tabs").textContent = state.tabSwitchCount || 0;

    // Live score estimate
    const liveScore = Math.max(0, Math.round(elapsed * (activityPct / 100)));
    document.getElementById("stat-score-live").textContent = liveScore;

    // Activity indicator color
    const indicator = document.getElementById("activity-indicator");
    indicator.className = "session-stat-icon activity-pulse";
    if (activityPct >= 80) indicator.classList.add("green");
    else if (activityPct >= 50) indicator.classList.add("yellow");
    else indicator.classList.add("red");
  }

  // ── Results ────────────────────────────────────────────────

  showResults(result) {
    const { sessionResult, xpResult, profile, levelInfo, newAchievements } = result;

    // Animate score count-up
    this.animateNumber("result-score", 0, sessionResult.focusScore, 1200);

    // Breakdown
    document.getElementById("result-time").textContent = `${sessionResult.durationMinutes} min`;
    document.getElementById("result-engagement").textContent = `${sessionResult.scoreBreakdown.engagement}%`;
    document.getElementById("result-consistency").textContent = `${sessionResult.scoreBreakdown.consistency}x`;
    document.getElementById("result-penalties").textContent = `-${sessionResult.scoreBreakdown.penalties.total}`;

    // XP
    document.getElementById("result-xp").textContent = xpResult.totalXP;

    // XP bonuses/penalties tags
    const bonusesContainer = document.getElementById("xp-bonuses");
    bonusesContainer.innerHTML = "";
    xpResult.bonuses.forEach(b => {
      const tag = document.createElement("span");
      tag.className = "xp-bonus-tag";
      tag.textContent = `+${b.value} ${b.label}`;
      bonusesContainer.appendChild(tag);
    });
    xpResult.penalties.forEach(p => {
      const tag = document.createElement("span");
      tag.className = "xp-penalty-tag";
      tag.textContent = `${p.value} ${p.label}`;
      bonusesContainer.appendChild(tag);
    });

    // Achievements
    const achieveSection = document.getElementById("achievements-section");
    const achieveList = document.getElementById("achievements-list");
    if (newAchievements && newAchievements.length > 0) {
      achieveSection.style.display = "";
      achieveList.innerHTML = "";
      newAchievements.forEach(a => {
        const item = document.createElement("div");
        item.className = "achievement-item";
        item.innerHTML = `
          <span class="achievement-icon">${a.icon}</span>
          <div class="achievement-info">
            <div class="achievement-name">${a.name}</div>
            <div class="achievement-desc">${a.description}</div>
          </div>
        `;
        achieveList.appendChild(item);
      });
    } else {
      achieveSection.style.display = "none";
    }

    // Update profile bar
    if (profile) this.updateProfileUI(profile);

    this.showScreen("results");
  }

  // ── Animation Helper ───────────────────────────────────────

  animateNumber(elementId, from, to, duration) {
    const el = document.getElementById(elementId);
    const start = performance.now();
    const diff = to - from;

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.round(from + diff * eased);
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // ── Message Handling ───────────────────────────────────────

  handleMessage(msg) {
    switch (msg.type) {
      case "SESSION_COMPLETED":
        this.showResults(msg);
        break;
      case "SESSION_PAUSED":
        document.getElementById("btn-pause").style.display = "none";
        document.getElementById("btn-resume").style.display = "";
        break;
      case "SESSION_RESUMED":
        document.getElementById("btn-pause").style.display = "";
        document.getElementById("btn-resume").style.display = "none";
        break;
    }
  }

  // ── Dashboard ──────────────────────────────────────────────

  openDashboard() {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  }

  // ── Communication ──────────────────────────────────────────

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }
}
