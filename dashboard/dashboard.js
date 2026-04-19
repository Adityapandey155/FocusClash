// ============================================================
// FOCUS CLASH — DASHBOARD CONTROLLER (with Firebase)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const dashboard = new DashboardApp();
  dashboard.init();
});

class DashboardApp {
  constructor() {
    this.currentTab       = "overview";
    this.currentLbType    = "daily";
    this.currentGlobalLb  = "alltime";
    this.currentUser      = null;
    this.db               = null;
  }

  async init() {
    this.bindNav();
    this.bindLeaderboardTabs();
    this.bindSettings();
    this.initFirebase();
    await this.loadOverview();
    await this.loadAchievements();
  }

  // ── Firebase Init ──────────────────────────────────────────

  initFirebase() {
    try {
      initFirebaseApp();
      this.db = firebase.firestore();

      // Auth state listener
      firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
          try {
            const doc = await this.db.collection("users").doc(user.uid).get();
            if (doc.exists) {
              this.currentUser = doc.data();
              document.getElementById("sidebar-username").textContent = `@${this.currentUser.username}`;
              document.getElementById("sidebar-user-email").textContent = this.currentUser.email;
              document.getElementById("sidebar-user").style.display = "";
            }
          } catch (e) {
            console.warn("Could not fetch user doc:", e);
            // Fall back to chrome.storage cache
            const cached = await chrome.storage.local.get("fc_auth_user");
            if (cached.fc_auth_user) {
              this.currentUser = cached.fc_auth_user;
              document.getElementById("sidebar-username").textContent = `@${this.currentUser.username}`;
              document.getElementById("sidebar-user-email").textContent = this.currentUser.email || "";
              document.getElementById("sidebar-user").style.display = "";
            }
          }
        } else {
          // Not signed in — try storage cache (offline)
          const cached = await chrome.storage.local.get("fc_auth_user");
          if (cached.fc_auth_user) {
            this.currentUser = cached.fc_auth_user;
            document.getElementById("sidebar-username").textContent = `@${this.currentUser.username}`;
            document.getElementById("sidebar-user").style.display = "";
          }
        }
      });

      // Sign-out button
      document.getElementById("btn-sidebar-signout").addEventListener("click", async () => {
        try {
          await firebase.auth().signOut();
          await chrome.storage.local.remove("fc_auth_user");
          this.currentUser = null;
          document.getElementById("sidebar-user").style.display = "none";
          window.close(); // Close dashboard tab — user will be prompted to log in from popup
        } catch (e) {
          console.error("Sign-out error:", e);
        }
      });
    } catch (e) {
      console.warn("Firebase not available:", e);
    }
  }

  // ── Navigation ─────────────────────────────────────────────

  bindNav() {
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const tab = btn.dataset.tab;
        this.currentTab = tab;

        document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
        document.getElementById(`tab-${tab}`).classList.add("active");

        this.onTabSwitch(tab);
      });
    });
  }

  async onTabSwitch(tab) {
    switch (tab) {
      case "overview":     await this.loadOverview();     break;
      case "leaderboard":  await this.loadLeaderboard();  break;
      case "achievements": await this.loadAchievements(); break;
      case "history":      await this.loadHistory();      break;
      case "settings":     await this.loadSettings();     break;
    }
  }

  // ── Overview ───────────────────────────────────────────────

  async loadOverview() {
    const profile    = await this.sendMessage({ type: "GET_PROFILE" });
    const dailyStats = await this.sendMessage({ type: "GET_DAILY_STATS" });
    const allStats   = await this.sendMessage({ type: "GET_ALL_STATS" });

    if (profile) {
      const levelInfo = this.getLevel(profile.totalXP);
      document.getElementById("hero-level-icon").textContent = levelInfo.current.icon;
      document.getElementById("hero-level-name").textContent = levelInfo.current.name;
      document.getElementById("hero-total-xp").textContent   = `${profile.totalXP.toLocaleString()} Total XP`;
      document.getElementById("hero-xp-fill").style.width    = `${levelInfo.progress}%`;

      const xpText = levelInfo.next
        ? `${levelInfo.xpInLevel} / ${levelInfo.xpForNext} XP to next level`
        : "Max level reached!";
      document.getElementById("hero-xp-text").textContent = xpText;

      document.getElementById("hero-sessions").textContent    = profile.totalSessions;
      const hours = Math.floor(profile.totalFocusMinutes / 60);
      const mins  = profile.totalFocusMinutes % 60;
      document.getElementById("hero-focus-hours").textContent =
        hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      document.getElementById("hero-streak").textContent      = profile.currentStreak;
      document.getElementById("hero-best-streak").textContent = profile.bestStreak;
    }

    if (dailyStats) {
      document.getElementById("overview-today-time").textContent     = `${dailyStats.focusMinutes}m`;
      document.getElementById("overview-today-sessions").textContent = `${dailyStats.sessions} sessions`;
      document.getElementById("overview-today-best").textContent     = dailyStats.bestScore;
      document.getElementById("overview-today-total").textContent    = dailyStats.totalScore;
    }

    if (allStats) this.renderWeeklyChart(allStats);
  }

  renderWeeklyChart(allStats) {
    const container = document.getElementById("weekly-chart");
    container.innerHTML = "";
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today    = new Date();
    const days     = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key   = d.toISOString().slice(0, 10);
      const stats = allStats[key] || { focusMinutes: 0 };
      days.push({ label: dayNames[d.getDay()], minutes: stats.focusMinutes, isToday: i === 0 });
    }

    const maxMinutes = Math.max(...days.map((d) => d.minutes), 30);

    days.forEach((day) => {
      const wrapper = document.createElement("div");
      wrapper.className = "chart-bar-wrapper";

      const track = document.createElement("div");
      track.className = "chart-bar-track";

      const bar = document.createElement("div");
      bar.className = "chart-bar";
      const pct = (day.minutes / maxMinutes) * 100;
      bar.style.height = `${Math.max(2, pct)}%`;

      const valueLabel = document.createElement("span");
      valueLabel.className = "chart-bar-value";
      valueLabel.textContent = day.minutes > 0 ? `${day.minutes}m` : "0";
      bar.appendChild(valueLabel);
      track.appendChild(bar);

      const label = document.createElement("span");
      label.className = "chart-label" + (day.isToday ? " today" : "");
      label.textContent = day.isToday ? "Today" : day.label;

      wrapper.appendChild(track);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }

  // ── Leaderboard ────────────────────────────────────────────

  bindLeaderboardTabs() {
    document.querySelectorAll(".lb-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".lb-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentLbType = btn.dataset.lb;

        // Show / hide global sub-tabs
        const globalSubTabs = document.getElementById("global-sub-tabs");
        if (this.currentLbType === "global") {
          globalSubTabs.style.display = "";
        } else {
          globalSubTabs.style.display = "none";
        }

        this.loadLeaderboard();
      });
    });

    // Global sub-type buttons
    document.querySelectorAll(".global-sub-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".global-sub-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.currentGlobalLb = btn.dataset.glb;
        this.loadLeaderboard();
      });
    });
  }

  async loadLeaderboard() {
    const list = document.getElementById("leaderboard-list");

    // ── Global leaderboard (from Firestore) ──────────────────
    if (this.currentLbType === "global") {
      await this.loadGlobalLeaderboard(list);
      return;
    }

    // ── Personal leaderboard (from chrome.storage.local) ─────
    const leaderboard = await this.sendMessage({ type: "GET_LEADERBOARD" });

    if (!leaderboard) {
      list.innerHTML = '<div class="lb-empty">No data available.</div>';
      return;
    }

    let entries;
    switch (this.currentLbType) {
      case "daily":  entries = leaderboard.dailyClash;  break;
      case "weekly": entries = leaderboard.weeklyClash; break;
      case "deep":   entries = leaderboard.deepFocus;   break;
      default:       entries = [];
    }

    if (!entries || entries.length === 0) {
      list.innerHTML = '<div class="lb-empty">No sessions yet. Start your first session! ⚔️</div>';
      return;
    }

    list.innerHTML = entries.map((entry, i) => {
      const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
      const rankText  = i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`;
      const date      = new Date(entry.endedAt);
      const dateStr   = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const timeStr   = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

      return `
        <div class="lb-entry">
          <span class="lb-rank ${rankClass}">${rankText}</span>
          <div class="lb-details">
            <div class="lb-goal">${entry.goal || "Focus Session"}</div>
            <div class="lb-meta">${dateStr} at ${timeStr} · ${entry.durationMinutes}m · ${entry.mode}</div>
          </div>
          <span class="lb-score">${entry.focusScore}</span>
        </div>`;
    }).join("");
  }

  async loadGlobalLeaderboard(list) {
    if (!this.db) {
      list.innerHTML = `
        <div class="lb-empty">
          🔒 Sign in via the extension popup to view the global leaderboard.<br>
          <small style="opacity:0.6;font-size:11px">Firebase not initialized.</small>
        </div>`;
      return;
    }

    list.innerHTML = '<div class="lb-empty lb-loading">⏳ Loading global leaderboard…</div>';

    try {
      const entries = await FCDB.getGlobalLeaderboard(this.currentGlobalLb);

      if (!entries.length) {
        const typeLabel = { alltime: "all-time", daily: "today", weekly: "this week" }[this.currentGlobalLb] || "";
        list.innerHTML = `<div class="lb-empty">No global sessions ${typeLabel}. Be the first! ⚔️</div>`;
        return;
      }

      const modeIcons = { chill: "🟢", competitive: "🔴", deep_focus: "🧘" };

      list.innerHTML = entries.map((entry, i) => {
        const isMe      = this.currentUser && entry.userId === this.currentUser.uid;
        const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
        const rankText  = i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`;
        const date      = new Date(entry.endedAt);
        const dateStr   = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const modeIcon  = modeIcons[entry.mode] || "🔴";

        return `
          <div class="lb-entry ${isMe ? "lb-entry-you" : ""}">
            <span class="lb-rank ${rankClass}">${rankText}</span>
            <div class="lb-details">
              <div class="lb-goal lb-global-name">
                ${modeIcon} <strong>${entry.username}</strong>
                ${isMe ? '<span class="lb-you-badge">YOU</span>' : ""}
              </div>
              <div class="lb-meta">${dateStr} · ${entry.durationMinutes}m · ${entry.goal || "Focus Session"}</div>
            </div>
            <span class="lb-score">${entry.focusScore}</span>
          </div>`;
      }).join("");
    } catch (e) {
      console.error("Global leaderboard error:", e);
      list.innerHTML = `<div class="lb-empty">Failed to load global leaderboard.<br><small style="opacity:0.6">${e.message}</small></div>`;
    }
  }

  // ── Achievements ───────────────────────────────────────────

  async loadAchievements() {
    const achievements = await this.sendMessage({ type: "GET_ACHIEVEMENTS" });
    const grid = document.getElementById("achievements-grid");

    if (!achievements || achievements.length === 0) {
      grid.innerHTML = '<div class="lb-empty">No achievements available.</div>';
      return;
    }

    grid.innerHTML = achievements.map((a) => {
      const statusClass = a.unlocked ? "unlocked" : "locked";
      const dateStr = a.unlockedAt
        ? new Date(a.unlockedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "";

      return `
        <div class="achievement-card ${statusClass}">
          <span class="achievement-card-icon">${a.icon}</span>
          <div class="achievement-card-info">
            <div class="achievement-card-name">${a.name}</div>
            <div class="achievement-card-desc">${a.description}</div>
            ${a.unlocked ? `<div class="achievement-card-date">Unlocked ${dateStr}</div>` : ""}
          </div>
        </div>`;
    }).join("");
  }

  // ── History ────────────────────────────────────────────────

  async loadHistory() {
    const history = await this.sendMessage({ type: "GET_HISTORY" });
    const list    = document.getElementById("history-list");

    if (!history || history.length === 0) {
      list.innerHTML = '<div class="lb-empty">No sessions recorded yet. Start your first session! ⚔️</div>';
      return;
    }

    const modeIcons = { chill: "🟢", competitive: "🔴", deep_focus: "🧘" };

    list.innerHTML = history.map((entry) => {
      const date          = new Date(entry.startedAt);
      const dateStr       = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      const timeStr       = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      const icon          = modeIcons[entry.mode] || "🔴";
      const completedTag  = entry.completedFull ? "✅" : "⚠️";

      return `
        <div class="history-entry">
          <span class="history-mode">${icon}</span>
          <div class="history-details">
            <div class="history-goal">${entry.goal || "Focus Session"} ${completedTag}</div>
            <div class="history-meta">${dateStr} at ${timeStr} · ${entry.durationMinutes}m · ${entry.tabSwitchCount || 0} tab switches</div>
          </div>
          <div class="history-score-col">
            <div class="history-score">${entry.focusScore}</div>
            <div class="history-xp">+${entry.xpEarned} XP</div>
          </div>
        </div>`;
    }).join("");
  }

  // ── Settings ───────────────────────────────────────────────

  bindSettings() {
    document.getElementById("btn-add-blocked").addEventListener("click", () => this.addSite("blocked"));
    document.getElementById("btn-add-allowed").addEventListener("click", () => this.addSite("allowed"));

    document.getElementById("input-add-blocked").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.addSite("blocked");
    });
    document.getElementById("input-add-allowed").addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.addSite("allowed");
    });

    document.getElementById("btn-reset-data").addEventListener("click", () => this.resetData());
  }

  async loadSettings() {
    const settings = await this.sendMessage({ type: "GET_SETTINGS" });
    if (!settings) return;

    this.renderSiteTags("blocked-sites-list", settings.blockedSites || [], "blocked");
    this.renderSiteTags("allowed-sites-list", settings.allowedSites || [], "allowed");
  }

  renderSiteTags(containerId, sites, type) {
    const container = document.getElementById(containerId);
    container.innerHTML = sites.map((site) => `
      <span class="tag">
        ${site}
        <button class="tag-remove" data-site="${site}" data-type="${type}">×</button>
      </span>`).join("");

    container.querySelectorAll(".tag-remove").forEach((btn) => {
      btn.addEventListener("click", () => this.removeSite(btn.dataset.type, btn.dataset.site));
    });
  }

  async addSite(type) {
    const inputId = type === "blocked" ? "input-add-blocked" : "input-add-allowed";
    const input   = document.getElementById(inputId);
    const site    = input.value.trim().toLowerCase();
    if (!site) return;

    const settings = await this.sendMessage({ type: "GET_SETTINGS" });
    const key      = type === "blocked" ? "blockedSites" : "allowedSites";
    const sites    = settings[key] || [];

    if (!sites.includes(site)) {
      sites.push(site);
      await this.sendMessage({ type: "UPDATE_SETTINGS", data: { [key]: sites } });
    }

    input.value = "";
    this.loadSettings();
  }

  async removeSite(type, site) {
    const settings = await this.sendMessage({ type: "GET_SETTINGS" });
    const key      = type === "blocked" ? "blockedSites" : "allowedSites";
    const sites    = (settings[key] || []).filter((s) => s !== site);
    await this.sendMessage({ type: "UPDATE_SETTINGS", data: { [key]: sites } });
    this.loadSettings();
  }

  async resetData() {
    if (!confirm("🗑️ Are you sure you want to reset ALL local data? This cannot be undone!")) return;
    if (!confirm("⚠️ This will delete all sessions, achievements, XP, and settings. Really continue?")) return;

    await chrome.storage.local.clear();
    location.reload();
  }

  // ── Helpers ────────────────────────────────────────────────

  getLevel(totalXP) {
    const levels = FC_CONSTANTS.LEVELS;
    let current  = levels[0];
    let next     = levels[1] || null;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (totalXP >= levels[i].xpRequired) {
        current = levels[i];
        next    = levels[i + 1] || null;
        break;
      }
    }

    const xpInLevel = totalXP - current.xpRequired;
    const xpForNext = next ? next.xpRequired - current.xpRequired : 0;
    const progress  = next ? Math.min(100, Math.round((xpInLevel / xpForNext) * 100)) : 100;

    return { current, next, xpInLevel, xpForNext, progress };
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Message error:", chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }
}
