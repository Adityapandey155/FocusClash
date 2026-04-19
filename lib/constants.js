// ============================================================
// FOCUS CLASH — CONSTANTS & CONFIGURATION
// ============================================================

const FC_CONSTANTS = {

  // ── Blocked Domains (during session) ───────────────────────
  BLOCKED_DOMAINS: [
    "facebook.com",
    "www.facebook.com",
    "instagram.com",
    "www.instagram.com",
    "twitter.com",
    "www.twitter.com",
    "x.com",
    "www.x.com",
    "tiktok.com",
    "www.tiktok.com",
    "reddit.com",
    "www.reddit.com",
    "twitch.tv",
    "www.twitch.tv",
    "discord.com",
    "www.discord.com",
    "snapchat.com",
    "pinterest.com",
    "tumblr.com",
    "9gag.com",
    "imgur.com",
    "netflix.com",
    "www.netflix.com",
    "primevideo.com",
    "disneyplus.com",
    "hotstar.com",
    "store.steampowered.com",
    "epicgames.com",
    "miniclip.com",
    "poki.com",
    "crazygames.com",
    "games.google.com"
  ],

  // ── Allowed Study Domains ──────────────────────────────────
  ALLOWED_DOMAINS: [
    "youtube.com",
    "udemy.com",
    "coursera.org",
    "khanacademy.org",
    "edx.org",
    "docs.google.com",
    "drive.google.com",
    "classroom.google.com",
    "notion.so",
    "stackoverflow.com",
    "github.com",
    "leetcode.com",
    "geeksforgeeks.org",
    "w3schools.com",
    "mdn.mozilla.org",
    "wikipedia.org",
    "scholar.google.com"
  ],

  // ── Timer Presets (minutes) ────────────────────────────────
  TIMER_PRESETS: [25, 45, 60, 90, 120],

  // ── XP & Scoring ──────────────────────────────────────────
  XP: {
    SESSION_COMPLETE_BONUS: 20,
    NO_TAB_SWITCH_BONUS: 15,
    PERFECT_FOCUS_BONUS: 25,
    EARLY_QUIT_PENALTY: -30,
    DEEP_FOCUS_EARLY_QUIT: -50,
    LONG_INACTIVITY_PENALTY: -10,
  },

  // ── Penalty Weights ────────────────────────────────────────
  PENALTIES: {
    TAB_SWITCH: 2,
    CONTENT_SKIP: 5,
    INACTIVITY_MINUTE: 3,
  },

  // ── Level Thresholds ───────────────────────────────────────
  LEVELS: [
    { name: "Bronze",  icon: "🥉", xpRequired: 0 },
    { name: "Silver",  icon: "🥈", xpRequired: 500 },
    { name: "Gold",    icon: "🥇", xpRequired: 1500 },
    { name: "Elite",   icon: "💎", xpRequired: 4000 },
    { name: "Monk",    icon: "🧘", xpRequired: 10000 },
  ],

  // ── Modes ──────────────────────────────────────────────────
  MODES: {
    CHILL: {
      id: "chill",
      name: "Chill Mode",
      icon: "🟢",
      blocker: false,
      tabSwitchPenalty: 0,
      antiCheat: false,
      leaderboard: false,
      xpMultiplier: 0.5,
      earlyQuitPenalty: 0,
      popupFrequency: 0,      // never
    },
    COMPETITIVE: {
      id: "competitive",
      name: "Competitive",
      icon: "🔴",
      blocker: true,
      tabSwitchPenalty: 2,
      antiCheat: true,
      leaderboard: true,
      xpMultiplier: 1.0,
      earlyQuitPenalty: -30,
      popupFrequency: 15,     // minutes
    },
    DEEP_FOCUS: {
      id: "deep_focus",
      name: "Deep Focus",
      icon: "🧘",
      blocker: true,
      tabSwitchPenalty: 5,
      antiCheat: true,
      leaderboard: true,
      xpMultiplier: 1.5,
      earlyQuitPenalty: -50,
      popupFrequency: 10,     // minutes
    },
  },

  // ── Activity Tracking ─────────────────────────────────────
  TRACKING: {
    ACTIVITY_PING_INTERVAL: 30000,  // 30 seconds
    INACTIVITY_THRESHOLD: 120000,   // 2 minutes
    MOUSE_DEBOUNCE: 2000,           // 2 seconds
    VIDEO_CHECK_INTERVAL: 5000,     // 5 seconds
  },

  // ── Anti-Cheat ─────────────────────────────────────────────
  ANTI_CHEAT: {
    POPUP_TIMEOUT: 30000,           // 30s before auto-pause
    BASE_POPUP_INTERVAL: 15,        // minutes
    MIN_POPUP_INTERVAL: 5,          // minutes
    MAX_POPUP_INTERVAL: 30,         // minutes
    RESPONSE_HISTORY_SIZE: 10,
  },

  // ── Storage Keys ───────────────────────────────────────────
  STORAGE_KEYS: {
    PROFILE: "fc_profile",
    SESSION: "fc_current_session",
    HISTORY: "fc_session_history",
    SETTINGS: "fc_settings",
    ACHIEVEMENTS: "fc_achievements",
    STATS: "fc_daily_stats",
    BLOCKED_SITES: "fc_blocked_sites",
    ALLOWED_SITES: "fc_allowed_sites",
  },

  // ── Default Profile ────────────────────────────────────────
  DEFAULT_PROFILE: {
    totalXP: 0,
    level: 0,
    totalSessions: 0,
    totalFocusMinutes: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastSessionDate: null,
    createdAt: null,
  },

  // ── Session States ─────────────────────────────────────────
  SESSION_STATES: {
    IDLE: "idle",
    ACTIVE: "active",
    PAUSED: "paused",
    COMPLETED: "completed",
  },
};

// Make available in both contexts (content script & service worker)
if (typeof globalThis !== "undefined") {
  globalThis.FC_CONSTANTS = FC_CONSTANTS;
}
