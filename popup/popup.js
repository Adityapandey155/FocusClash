// ============================================================
// FOCUS CLASH — POPUP CONTROLLER (with Firebase Auth)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const app = new PopupApp();
  app.init();
});

class PopupApp {
  constructor() {
    this.screens = {
      auth:    document.getElementById("screen-auth"),
      idle:    document.getElementById("screen-idle"),
      setup:   document.getElementById("screen-setup"),
      active:  document.getElementById("screen-active"),
      results: document.getElementById("screen-results"),
    };

    // Session state
    this.selectedMode      = "competitive";
    this.selectedMinutes   = 60;
    this.selectedTimerType = "countdown";
    this.tickInterval      = null;

    // Auth state
    this.currentUser           = null;
    this.usernameCheckTimeout  = null;
  }

  // ── Init ───────────────────────────────────────────────────

  async init() {
    this.bindEvents();
    this.bindAuthEvents();
    await this.initAuth();

    // Listen for background messages
    chrome.runtime.onMessage.addListener((msg) => this.handleMessage(msg));
  }

  // ── Auth Initialization ────────────────────────────────────

  async initAuth() {
    FCAuth.ensure();

    // Fast path: check chrome.storage cache to avoid flash of auth screen
    const cached = await FCAuth.getCurrentUserFromStorage();

    if (cached) {
      // User was previously logged in — show app immediately, load data async
      this.currentUser = cached;
      this.showScreen("idle");            // ← hide auth screen right away
      this.applyAuthState(cached, /* firstLoad= */ true); // data loads in background
    } else {
      // No cached user → show auth screen
      this.showScreen("auth");
    }

    // Firebase Auth persistent listener (corrects cache if session expired)
    FCAuth.onAuthChange(async (user) => {
      if (user) {
        const wasLoggedOut = !this.currentUser;
        this.currentUser = user;
        this.updateHeaderUser(user);

        if (wasLoggedOut) {
          // Firebase confirmed login after we showed auth screen
          await this.applyAuthState(user, /* firstLoad= */ true);
        }
      } else {
        // Firebase says no session
        if (this.currentUser) {
          this.currentUser = null;
          this.stopLiveTimer();
          this.hideProfileBar();
          this.updateHeaderUser(null);
          this.showScreen("auth");
        }
      }
    });
  }

  async applyAuthState(user, firstLoad = false) {
    this.updateHeaderUser(user);
    this.showProfileBar();
    await this.loadProfile();
    await this.loadDailyStats();

    if (firstLoad) {
      await this.checkActiveSession();
      this.startLiveTimer();
    }
  }

  // ── Auth: Event Binding ────────────────────────────────────

  bindAuthEvents() {
    // Tab switching
    document.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchAuthTab(tab.dataset.authTab));
    });

    // Sign in
    document.getElementById("btn-signin").addEventListener("click", () => this.handleSignIn());

    // Sign up
    document.getElementById("btn-signup").addEventListener("click", () => this.handleSignUp());

    // Sign out
    document.getElementById("btn-signout").addEventListener("click", () => this.handleSignOut());

    // Username availability check (live, debounced)
    document.getElementById("auth-username").addEventListener("input", (e) => {
      clearTimeout(this.usernameCheckTimeout);
      const val = e.target.value.trim();
      const statusEl = document.getElementById("username-status");

      if (val.length < 3) {
        statusEl.textContent = "";
        statusEl.className = "username-check-status";
        return;
      }
      statusEl.textContent = "checking…";
      statusEl.className = "username-check-status";
      this.usernameCheckTimeout = setTimeout(() => this.checkUsername(val), 600);
    });

    // Enter-key shortcuts
    ["auth-email-login", "auth-password-login"].forEach((id) => {
      document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.handleSignIn();
      });
    });
    ["auth-email-signup", "auth-username", "auth-password-signup"].forEach((id) => {
      document.getElementById(id).addEventListener("keydown", (e) => {
        if (e.key === "Enter") this.handleSignUp();
      });
    });
  }

  switchAuthTab(tab) {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
    document.querySelector(`.auth-tab[data-auth-tab="${tab}"]`).classList.add("active");

    document.getElementById("auth-form-login").style.display  = tab === "login"  ? "" : "none";
    document.getElementById("auth-form-signup").style.display = tab === "signup" ? "" : "none";

    // Clear errors on switch
    document.getElementById("auth-error-login").textContent  = "";
    document.getElementById("auth-error-signup").textContent = "";
  }

  // ── Auth: Sign In ──────────────────────────────────────────

  async handleSignIn() {
    const email    = document.getElementById("auth-email-login").value.trim();
    const password = document.getElementById("auth-password-login").value;
    const errEl    = document.getElementById("auth-error-login");

    if (!email || !password) { errEl.textContent = "Please fill in all fields."; return; }

    const btn = document.getElementById("btn-signin");
    btn.disabled = true;
    btn.querySelector("span").textContent = "Signing in…";
    errEl.textContent = "";

    try {
      const user = await FCAuth.signIn(email, password);
      this.currentUser = user;
      this.showScreen("idle");            // ← hide auth screen immediately on success
      await this.applyAuthState(user, /* firstLoad= */ true);
    } catch (e) {
      errEl.textContent = this.getAuthError(e);
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Sign In ⚔️";
    }
  }

  // ── Auth: Sign Up ──────────────────────────────────────────

  async handleSignUp() {
    const email    = document.getElementById("auth-email-signup").value.trim();
    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password-signup").value;
    const errEl    = document.getElementById("auth-error-signup");

    if (!email || !username || !password) { errEl.textContent = "Please fill in all fields."; return; }
    if (username.length < 3)              { errEl.textContent = "Username must be at least 3 characters."; return; }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) { errEl.textContent = "Username: letters, numbers and underscores only."; return; }
    if (password.length < 6)              { errEl.textContent = "Password must be at least 6 characters."; return; }

    const btn = document.getElementById("btn-signup");
    btn.disabled = true;
    btn.querySelector("span").textContent = "Creating account…";
    errEl.textContent = "";

    try {
      const user = await FCAuth.signUp(email, password, username);
      this.currentUser = user;
      this.showScreen("idle");            // ← hide auth screen immediately on success
      await this.applyAuthState(user, /* firstLoad= */ true);
    } catch (e) {
      errEl.textContent = this.getAuthError(e);
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Create Account 🚀";
    }
  }

  // ── Auth: Sign Out ─────────────────────────────────────────

  async handleSignOut() {
    try {
      await FCAuth.signOut();
      this.currentUser = null;
      this.stopLiveTimer();
      this.hideProfileBar();
      this.updateHeaderUser(null);
      this.showScreen("auth");
    } catch (e) {
      console.error("Sign out error:", e);
    }
  }

  // ── Auth: Username Availability ────────────────────────────

  async checkUsername(username) {
    const statusEl = document.getElementById("username-status");

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      statusEl.textContent = "✗ Invalid characters";
      statusEl.className   = "username-check-status taken";
      return;
    }

    try {
      const available = await FCAuth.checkUsernameAvailable(username);
      statusEl.textContent = available ? "✓ Available" : "✗ Already taken";
      statusEl.className   = `username-check-status ${available ? "available" : "taken"}`;
    } catch (e) {
      statusEl.textContent = "";
      statusEl.className   = "username-check-status";
    }
  }

  // ── Auth: Helpers ──────────────────────────────────────────

  updateHeaderUser(user) {
    const nameEl = document.getElementById("header-username");
    const outBtn = document.getElementById("btn-signout");

    if (user) {
      nameEl.textContent  = `@${user.username}`;
      nameEl.style.display = "";
      outBtn.style.display = "";
    } else {
      nameEl.style.display = "none";
      outBtn.style.display = "none";
    }
  }

  showProfileBar()  { document.getElementById("profile-bar").style.display = ""; }
  hideProfileBar()  { document.getElementById("profile-bar").style.display = "none"; }

  getAuthError(e) {
    const code = e.code || "";
    if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential"))
      return "Invalid email or password.";
    if (code.includes("email-already-in-use")) return "Email is already registered.";
    if (code.includes("invalid-email"))        return "Invalid email address.";
    if (code.includes("weak-password"))        return "Password is too weak (min 6 chars).";
    if (code.includes("network-request-failed")) return "Network error. Check your connection.";
    return e.message || "An error occurred. Please try again.";
  }

  // ── Session Sync to Firebase ───────────────────────────────

  async syncSessionToFirebase(sessionResult) {
    if (!this.currentUser || !sessionResult) return false;
    try {
      FCDB.ensure();
      await FCDB.saveSession(sessionResult, this.currentUser);
      return true;
    } catch (e) {
      console.warn("Firebase sync failed:", e);
      return false;
    }
  }

  // ── Event Binding (Existing) ───────────────────────────────

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
        document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("selected"));
      }
    });

    // Timer type
    document.querySelectorAll(".toggle-btn").forEach((btn) => {
      btn.addEventListener("click", () => this.selectTimerType(btn));
    });

    // Start Session
    document.getElementById("btn-start-session").addEventListener("click", () => this.startSession());

    // Session controls
    document.getElementById("btn-pause").addEventListener("click",  () => this.pauseSession());
    document.getElementById("btn-resume").addEventListener("click", () => this.resumeSession());
    document.getElementById("btn-end").addEventListener("click",    () => this.endSession());

    // Results actions
    document.getElementById("btn-new-after-result").addEventListener("click", () => {
      this.showScreen("setup");
    });

    // Dashboard buttons
    document.getElementById("btn-dashboard").addEventListener("click",        () => this.openDashboard());
    document.getElementById("btn-dashboard-result").addEventListener("click", () => this.openDashboard());
  }

  // ── Screen Management ──────────────────────────────────────

  showScreen(name) {
    Object.values(this.screens).forEach((s) => s.classList.remove("active"));
    if (this.screens[name]) {
      this.screens[name].classList.add("active");
    }
  }

  // ── Profile Loading ────────────────────────────────────────

  async loadProfile() {
    try {
      const profile = await this.sendMessage({ type: "GET_PROFILE" });
      const settings = await this.sendMessage({ type: "GET_SETTINGS" });

      if (profile) this.updateProfileUI(profile);

      if (settings) {
        this.selectedMode = settings.mode || "competitive";
        document.querySelectorAll(".mode-btn").forEach((btn) => {
          btn.classList.toggle("selected", btn.dataset.mode === this.selectedMode);
        });
      }
    } catch (e) {
      console.warn("Failed to load profile:", e);
    }
  }

  async loadDailyStats() {
    try {
      const dailyStats = await this.sendMessage({ type: "GET_DAILY_STATS" });
      if (dailyStats) {
        document.getElementById("stat-today").textContent =
          dailyStats.focusMinutes > 0 ? `${dailyStats.focusMinutes}m` : "0m";
      }
    } catch (e) { /* non-critical */ }
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
        this.selectedMinutes   = state.goalMinutes;
        this.selectedTimerType = state.timerType;
        document.getElementById("session-goal").textContent = state.goal || "Focus Session";
        this.showScreen("active");
        this.updateActiveUI(state);
        document.getElementById("btn-pause").style.display  = "";
        document.getElementById("btn-resume").style.display = "none";
      } else if (state && state.state === "paused") {
        this.selectedMinutes   = state.goalMinutes;
        this.selectedTimerType = state.timerType;
        document.getElementById("session-goal").textContent = state.goal || "Focus Session";
        this.showScreen("active");
        this.updateActiveUI(state);
        document.getElementById("btn-pause").style.display  = "none";
        document.getElementById("btn-resume").style.display = "";
      } else {
        this.showScreen("idle");
      }
    } catch (e) {
      this.showScreen("idle");
    }
  }

  // ── Mode / Timer Selection ─────────────────────────────────

  selectMode(btn) {
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    this.selectedMode = btn.dataset.mode;
    this.sendMessage({ type: "UPDATE_SETTINGS", data: { mode: this.selectedMode } });
  }

  selectPreset(btn) {
    document.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    this.selectedMinutes = parseInt(btn.dataset.minutes);
    document.getElementById("input-custom-minutes").value = "";
  }

  selectTimerType(btn) {
    document.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("selected"));
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
        data: { goal, goalMinutes: minutes, timerType: this.selectedTimerType, mode: this.selectedMode },
      });

      if (result && result.success) {
        this.selectedMinutes   = minutes;
        document.getElementById("session-goal").textContent   = goal;
        document.getElementById("btn-pause").style.display    = "";
        document.getElementById("btn-resume").style.display   = "none";
        this.showScreen("active");
      }
    } catch (e) {
      console.error("Failed to start session:", e);
    }
  }

  async pauseSession() {
    const result = await this.sendMessage({ type: "PAUSE_SESSION" });
    if (result && result.success) {
      document.getElementById("btn-pause").style.display  = "none";
      document.getElementById("btn-resume").style.display = "";
    }
  }

  async resumeSession() {
    const result = await this.sendMessage({ type: "RESUME_SESSION" });
    if (result && result.success) {
      document.getElementById("btn-pause").style.display  = "";
      document.getElementById("btn-resume").style.display = "none";
    }
  }

  async endSession() {
    const confirmed = confirm("⚔️ End session now? Ending early may incur an XP penalty.");
    if (!confirmed) return;

    const result = await this.sendMessage({ type: "END_SESSION" });
    if (result && result.success) {
      const synced = await this.syncSessionToFirebase(result.sessionResult);
      this.showResults(result, synced);
    }
  }

  // ── Live Timer ─────────────────────────────────────────────

  startLiveTimer() {
    if (this.tickInterval) return;
    this.tickInterval = setInterval(async () => {
      if (!this.screens.active.classList.contains("active")) return;
      try {
        const state = await this.sendMessage({ type: "GET_SESSION_STATE" });
        if (state && (state.state === "active" || state.state === "paused")) {
          this.updateActiveUI(state);
        }
      } catch (e) { /* popup may be closing */ }
    }, 1000);
  }

  stopLiveTimer() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  updateActiveUI(state) {
    const elapsed  = state.elapsedMinutes || 0;
    const goal     = state.goalMinutes    || this.selectedMinutes;
    const timerType = state.timerType    || this.selectedTimerType;

    let displaySeconds;
    if (timerType === "countdown") {
      let elapsedMs;
      if (state.state === "paused" && state.pausedAt) {
        elapsedMs = (state.pausedAt - state.startedAt) - (state.totalPausedMs || 0);
      } else {
        elapsedMs = (Date.now() - state.startedAt) - (state.totalPausedMs || 0);
      }
      displaySeconds = Math.ceil(Math.max(0, (goal * 60000) - elapsedMs) / 1000);
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

    const circumference = 2 * Math.PI * 88;
    const progress = timerType === "countdown"
      ? Math.max(0, Math.min(1, 1 - (displaySeconds / (goal * 60))))
      : Math.min(1, elapsed / goal);
    document.getElementById("timer-ring-progress").style.strokeDashoffset = circumference * (1 - progress);

    const activityPct = state.activityPct || 100;
    document.getElementById("stat-activity").textContent = `${activityPct}%`;
    document.getElementById("stat-tabs").textContent     = state.tabSwitchCount || 0;
    document.getElementById("stat-score-live").textContent = Math.max(0, Math.round(elapsed * (activityPct / 100)));

    const indicator = document.getElementById("activity-indicator");
    indicator.className = "session-stat-icon activity-pulse";
    if (activityPct >= 80)      indicator.classList.add("green");
    else if (activityPct >= 50) indicator.classList.add("yellow");
    else                        indicator.classList.add("red");
  }

  // ── Results ────────────────────────────────────────────────

  showResults(result, synced = false) {
    const { sessionResult, xpResult, profile, newAchievements } = result;

    this.animateNumber("result-score", 0, sessionResult.focusScore, 1200);
    document.getElementById("result-time").textContent        = `${sessionResult.durationMinutes} min`;
    document.getElementById("result-engagement").textContent  = `${sessionResult.scoreBreakdown.engagement}%`;
    document.getElementById("result-consistency").textContent = `${sessionResult.scoreBreakdown.consistency}x`;
    document.getElementById("result-penalties").textContent   = `-${sessionResult.scoreBreakdown.penalties.total}`;
    document.getElementById("result-xp").textContent          = xpResult.totalXP;

    const bonusesContainer = document.getElementById("xp-bonuses");
    bonusesContainer.innerHTML = "";
    xpResult.bonuses.forEach((b) => {
      const tag = document.createElement("span");
      tag.className = "xp-bonus-tag";
      tag.textContent = `+${b.value} ${b.label}`;
      bonusesContainer.appendChild(tag);
    });
    xpResult.penalties.forEach((p) => {
      const tag = document.createElement("span");
      tag.className = "xp-penalty-tag";
      tag.textContent = `${p.value} ${p.label}`;
      bonusesContainer.appendChild(tag);
    });

    // Firebase sync badge
    const syncedBadge = document.getElementById("synced-badge");
    syncedBadge.style.display = synced ? "" : "none";

    // Achievements
    const achieveSection = document.getElementById("achievements-section");
    const achieveList    = document.getElementById("achievements-list");
    if (newAchievements && newAchievements.length > 0) {
      achieveSection.style.display = "";
      achieveList.innerHTML = "";
      newAchievements.forEach((a) => {
        const item = document.createElement("div");
        item.className = "achievement-item";
        item.innerHTML = `
          <span class="achievement-icon">${a.icon}</span>
          <div class="achievement-info">
            <div class="achievement-name">${a.name}</div>
            <div class="achievement-desc">${a.description}</div>
          </div>`;
        achieveList.appendChild(item);
      });
    } else {
      achieveSection.style.display = "none";
    }

    if (profile) this.updateProfileUI(profile);
    this.showScreen("results");
  }

  // ── Animation ──────────────────────────────────────────────

  animateNumber(elementId, from, to, duration) {
    const el    = document.getElementById(elementId);
    const start = performance.now();
    const diff  = to - from;

    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + diff * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ── Message Handling ───────────────────────────────────────

  handleMessage(msg) {
    switch (msg.type) {
      case "SESSION_COMPLETED":
        // Sync to Firebase then show results
        this.syncSessionToFirebase(msg.sessionResult).then((synced) => {
          this.showResults(msg, synced);
        });
        break;
      case "SESSION_PAUSED":
        document.getElementById("btn-pause").style.display  = "none";
        document.getElementById("btn-resume").style.display = "";
        break;
      case "SESSION_RESUMED":
        document.getElementById("btn-pause").style.display  = "";
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
