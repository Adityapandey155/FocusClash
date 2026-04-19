// ============================================================
// FOCUS CLASH — STORAGE ABSTRACTION LAYER
// ============================================================

const FCStorage = {

  // ── Generic Helpers ────────────────────────────────────────

  async get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },

  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  async remove(key) {
    await chrome.storage.local.remove(key);
  },

  // ── Profile ────────────────────────────────────────────────

  async getProfile() {
    const profile = await this.get(FC_CONSTANTS.STORAGE_KEYS.PROFILE);
    if (!profile) {
      const defaultProfile = {
        ...FC_CONSTANTS.DEFAULT_PROFILE,
        createdAt: Date.now(),
      };
      await this.set(FC_CONSTANTS.STORAGE_KEYS.PROFILE, defaultProfile);
      return defaultProfile;
    }
    return profile;
  },

  async updateProfile(updates) {
    const profile = await this.getProfile();
    const updated = { ...profile, ...updates };
    await this.set(FC_CONSTANTS.STORAGE_KEYS.PROFILE, updated);
    return updated;
  },

  // ── Current Session ────────────────────────────────────────

  async getSession() {
    return await this.get(FC_CONSTANTS.STORAGE_KEYS.SESSION);
  },

  async setSession(session) {
    await this.set(FC_CONSTANTS.STORAGE_KEYS.SESSION, session);
  },

  async clearSession() {
    await this.remove(FC_CONSTANTS.STORAGE_KEYS.SESSION);
  },

  // ── Session History ────────────────────────────────────────

  async getHistory() {
    return (await this.get(FC_CONSTANTS.STORAGE_KEYS.HISTORY)) || [];
  },

  async addHistory(sessionResult) {
    const history = await this.getHistory();
    history.unshift(sessionResult);
    // Keep last 100 sessions
    if (history.length > 100) history.length = 100;
    await this.set(FC_CONSTANTS.STORAGE_KEYS.HISTORY, history);
  },

  // ── Achievements ───────────────────────────────────────────

  async getAchievements() {
    return (await this.get(FC_CONSTANTS.STORAGE_KEYS.ACHIEVEMENTS)) || {};
  },

  async unlockAchievement(id) {
    const achievements = await this.getAchievements();
    if (!achievements[id]) {
      achievements[id] = { unlockedAt: Date.now() };
      await this.set(FC_CONSTANTS.STORAGE_KEYS.ACHIEVEMENTS, achievements);
      return true; // newly unlocked
    }
    return false; // already unlocked
  },

  // ── Daily Stats ────────────────────────────────────────────

  async getDailyStats(dateStr) {
    const allStats = (await this.get(FC_CONSTANTS.STORAGE_KEYS.STATS)) || {};
    const key = dateStr || new Date().toISOString().slice(0, 10);
    return allStats[key] || { focusMinutes: 0, sessions: 0, totalScore: 0, bestScore: 0 };
  },

  async updateDailyStats(sessionResult) {
    const allStats = (await this.get(FC_CONSTANTS.STORAGE_KEYS.STATS)) || {};
    const key = new Date().toISOString().slice(0, 10);
    const today = allStats[key] || { focusMinutes: 0, sessions: 0, totalScore: 0, bestScore: 0 };

    today.focusMinutes += sessionResult.durationMinutes || 0;
    today.sessions += 1;
    today.totalScore += sessionResult.focusScore || 0;
    today.bestScore = Math.max(today.bestScore, sessionResult.focusScore || 0);

    allStats[key] = today;

    // Prune stats older than 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    for (const k of Object.keys(allStats)) {
      if (k < cutoffStr) delete allStats[k];
    }

    await this.set(FC_CONSTANTS.STORAGE_KEYS.STATS, allStats);
    return today;
  },

  async getAllStats() {
    return (await this.get(FC_CONSTANTS.STORAGE_KEYS.STATS)) || {};
  },

  // ── Settings ───────────────────────────────────────────────

  async getSettings() {
    const settings = await this.get(FC_CONSTANTS.STORAGE_KEYS.SETTINGS);
    return settings || {
      mode: "competitive",
      blockedSites: [...FC_CONSTANTS.BLOCKED_DOMAINS],
      allowedSites: [...FC_CONSTANTS.ALLOWED_DOMAINS],
    };
  },

  async updateSettings(updates) {
    const settings = await this.getSettings();
    const updated = { ...settings, ...updates };
    await this.set(FC_CONSTANTS.STORAGE_KEYS.SETTINGS, updated);
    return updated;
  },

  // ── Leaderboard (Personal Bests) ───────────────────────────

  async getLeaderboard() {
    const history = await this.getHistory();
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const weekStr = startOfWeek.toISOString().slice(0, 10);

    const todaySessions = history.filter(s =>
      new Date(s.endedAt).toISOString().slice(0, 10) === todayStr
    );
    const weekSessions = history.filter(s =>
      new Date(s.endedAt).toISOString().slice(0, 10) >= weekStr
    );

    return {
      dailyClash: todaySessions
        .sort((a, b) => b.focusScore - a.focusScore)
        .slice(0, 5),
      weeklyClash: weekSessions
        .sort((a, b) => b.focusScore - a.focusScore)
        .slice(0, 10),
      deepFocus: [...history]
        .sort((a, b) => b.durationMinutes - a.durationMinutes)
        .slice(0, 5),
    };
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FCStorage = FCStorage;
}
