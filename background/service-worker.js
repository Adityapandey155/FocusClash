// ============================================================
// FOCUS CLASH — BACKGROUND SERVICE WORKER (Core Engine)
// ============================================================

// Import libs (loaded via importScripts since we're not using ES modules for compat)
importScripts(
  "/lib/constants.js",
  "/lib/storage.js",
  "/lib/scoring.js",
  "/lib/achievements.js"
);

// ── State ──────────────────────────────────────────────────
let sessionActivityData = {
  mouseEvents: 0,
  keyEvents: 0,
  activeSeconds: 0,
  inactiveSeconds: 0,
  tabSwitchCount: 0,
  skipCount: 0,
  videoSpeedChanges: 0,
  lastActivityTime: Date.now(),
  lastPopupResponse: Date.now(),
  popupResponseHistory: [],
  antiCheatPopupShown: false,
};

// ── Installation ───────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    console.log("Focus Clash installed! ⚔️");
    await FCStorage.getProfile(); // Initialize default profile
  }
});

// ── Alarm Handler (Timer Tick) ─────────────────────────────
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "fc_session_tick") {
    await handleSessionTick();
  }
  if (alarm.name === "fc_anti_cheat_check") {
    await handleAntiCheatCheck();
  }
});

async function handleSessionTick() {
  const session = await FCStorage.getSession();
  if (!session || session.state !== FC_CONSTANTS.SESSION_STATES.ACTIVE) return;

  // Update elapsed time
  const now = Date.now();
  const elapsedMs = now - session.startedAt - (session.totalPausedMs || 0);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  // Check if countdown session completed
  if (session.timerType === "countdown" && elapsedMinutes >= session.goalMinutes) {
    await endSession(true);
    return;
  }

  // Calculate live activity metrics
  const totalSeconds = sessionActivityData.activeSeconds + sessionActivityData.inactiveSeconds;
  const activityPct = totalSeconds > 0
    ? Math.round((sessionActivityData.activeSeconds / totalSeconds) * 100)
    : 100;

  // Broadcast tick to popup and overlay
  broadcastMessage({
    type: "SESSION_TICK",
    elapsedMinutes,
    goalMinutes: session.goalMinutes,
    timerType: session.timerType,
    activityPct,
    tabSwitchCount: sessionActivityData.tabSwitchCount,
    state: session.state,
  });
}

async function handleAntiCheatCheck() {
  const session = await FCStorage.getSession();
  if (!session || session.state !== FC_CONSTANTS.SESSION_STATES.ACTIVE) return;

  const settings = await FCStorage.getSettings();
  const modeConfig = FCScoring.getModeConfig(settings.mode);
  if (!modeConfig.antiCheat) return;

  const now = Date.now();
  const timeSinceActivity = now - sessionActivityData.lastActivityTime;

  // ── Check for inactivity ─────────────────────────────────
  if (timeSinceActivity > FC_CONSTANTS.TRACKING.INACTIVITY_THRESHOLD) {
    triggerAntiCheatPopup("inactivity");
    return;
  }

  // ── Check for suspicious video behavior ──────────────────
  if (sessionActivityData.videoSpeedChanges > 0 &&
      timeSinceActivity > 60000) {
    triggerAntiCheatPopup("speed_inactivity");
    return;
  }
}

function triggerAntiCheatPopup(reason) {
  if (sessionActivityData.antiCheatPopupShown) return;
  sessionActivityData.antiCheatPopupShown = true;

  // Send to all tabs
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "SHOW_ANTI_CHEAT_POPUP",
        reason,
        timeout: FC_CONSTANTS.ANTI_CHEAT.POPUP_TIMEOUT,
      }).catch(() => {});
    }
  });
}

// ── Message Handler ────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch((err) => {
    console.error("Message handling error:", err);
    sendResponse({ error: err.message });
  });
  return true; // async response
});

async function handleMessage(message, sender) {
  switch (message.type) {

    // ── Session Control ──────────────────────────────────────
    case "START_SESSION":
      return await startSession(message.data);

    case "PAUSE_SESSION":
      return await pauseSession();

    case "RESUME_SESSION":
      return await resumeSession();

    case "END_SESSION":
      return await endSession(false);

    case "GET_SESSION_STATE":
      return await getSessionState();

    // ── Activity Tracking ────────────────────────────────────
    case "ACTIVITY_PING":
      return handleActivityPing(message.data);

    case "VIDEO_EVENT":
      return handleVideoEvent(message.data);

    // ── Anti-Cheat Response ──────────────────────────────────
    case "ANTI_CHEAT_RESPONSE":
      return handleAntiCheatResponse(message.data);

    // ── Data Queries ─────────────────────────────────────────
    case "GET_PROFILE":
      return await FCStorage.getProfile();

    case "GET_HISTORY":
      return await FCStorage.getHistory();

    case "GET_LEADERBOARD":
      return await FCStorage.getLeaderboard();

    case "GET_ACHIEVEMENTS":
      return await FCAchievements.getAll();

    case "GET_SETTINGS":
      return await FCStorage.getSettings();

    case "UPDATE_SETTINGS":
      return await FCStorage.updateSettings(message.data);

    case "GET_DAILY_STATS":
      return await FCStorage.getDailyStats();

    case "GET_ALL_STATS":
      return await FCStorage.getAllStats();

    default:
      return { error: "Unknown message type" };
  }
}

// ── Session Management ─────────────────────────────────────

async function startSession(data) {
  const { goal, goalMinutes, timerType, mode } = data;

  // Reset activity tracking
  sessionActivityData = {
    mouseEvents: 0,
    keyEvents: 0,
    activeSeconds: 0,
    inactiveSeconds: 0,
    tabSwitchCount: 0,
    skipCount: 0,
    videoSpeedChanges: 0,
    lastActivityTime: Date.now(),
    lastPopupResponse: Date.now(),
    popupResponseHistory: [],
    antiCheatPopupShown: false,
  };

  const session = {
    id: `session_${Date.now()}`,
    goal: goal || "Focus Session",
    goalMinutes: goalMinutes || 60,
    timerType: timerType || "countdown",
    mode: mode || "competitive",
    state: FC_CONSTANTS.SESSION_STATES.ACTIVE,
    startedAt: Date.now(),
    pausedAt: null,
    totalPausedMs: 0,
  };

  await FCStorage.setSession(session);

  // Chrome alarms minimum period is ~1 min in MV3, use 0.1 (~6s) for responsive ticks
  await chrome.alarms.clear("fc_session_tick");
  chrome.alarms.create("fc_session_tick", { periodInMinutes: 0.1 });

  // Start anti-cheat checks
  const modeConfig = FCScoring.getModeConfig(mode);
  if (modeConfig.antiCheat && modeConfig.popupFrequency > 0) {
    chrome.alarms.create("fc_anti_cheat_check", {
      periodInMinutes: calculatePopupInterval(),
    });
  }

  // Enable website blocker if mode requires it
  if (modeConfig.blocker) {
    await enableBlocker();
  }

  // Notify content scripts
  broadcastMessage({ type: "SESSION_STARTED", session });

  // Update badge (MV3 badge text must be short ASCII)
  chrome.action.setBadgeText({ text: "ON" });
  chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" });

  return { success: true, session };
}

async function pauseSession() {
  const session = await FCStorage.getSession();
  if (!session || session.state !== FC_CONSTANTS.SESSION_STATES.ACTIVE) {
    return { error: "No active session" };
  }

  session.state = FC_CONSTANTS.SESSION_STATES.PAUSED;
  session.pausedAt = Date.now();
  await FCStorage.setSession(session);

  chrome.alarms.clear("fc_session_tick");
  chrome.alarms.clear("fc_anti_cheat_check");

  broadcastMessage({ type: "SESSION_PAUSED" });
  chrome.action.setBadgeText({ text: "||" });

  return { success: true };
}

async function resumeSession() {
  const session = await FCStorage.getSession();
  if (!session || session.state !== FC_CONSTANTS.SESSION_STATES.PAUSED) {
    return { error: "No paused session" };
  }

  session.totalPausedMs += Date.now() - session.pausedAt;
  session.state = FC_CONSTANTS.SESSION_STATES.ACTIVE;
  session.pausedAt = null;
  await FCStorage.setSession(session);

  chrome.alarms.create("fc_session_tick", { periodInMinutes: 0.1 });

  const modeConfig = FCScoring.getModeConfig(session.mode);
  if (modeConfig.antiCheat) {
    chrome.alarms.create("fc_anti_cheat_check", {
      periodInMinutes: calculatePopupInterval(),
    });
  }

  broadcastMessage({ type: "SESSION_RESUMED" });
  chrome.action.setBadgeText({ text: "⚔️" });

  return { success: true };
}

async function endSession(completedFull) {
  const session = await FCStorage.getSession();
  if (!session) return { error: "No session to end" };

  // Clear alarms
  chrome.alarms.clear("fc_session_tick");
  chrome.alarms.clear("fc_anti_cheat_check");

  // Disable blocker
  await disableBlocker();

  // Calculate duration
  const now = Date.now();
  const totalMs = now - session.startedAt - (session.totalPausedMs || 0);
  const durationMinutes = Math.max(1, Math.round(totalMs / 60000));

  // Get profile for streak info
  const profile = await FCStorage.getProfile();

  // Calculate active/inactive minutes
  const totalTrackedSeconds = sessionActivityData.activeSeconds + sessionActivityData.inactiveSeconds;
  const activeMinutes = totalTrackedSeconds > 0
    ? Math.round((sessionActivityData.activeSeconds / totalTrackedSeconds) * durationMinutes)
    : durationMinutes;
  const inactivityMinutes = durationMinutes - activeMinutes;

  // Build session data for scoring
  const sessionData = {
    durationMinutes,
    activeMinutes,
    tabSwitchCount: sessionActivityData.tabSwitchCount,
    skipCount: sessionActivityData.skipCount,
    inactivityMinutes,
    currentStreak: profile.currentStreak,
    mode: session.mode,
    completedFull,
  };

  // Calculate score & XP
  const scoreResult = FCScoring.calculateScore(sessionData);
  const xpResult = FCScoring.calculateXP(scoreResult, sessionData);

  // Build session result
  const sessionResult = {
    id: session.id,
    goal: session.goal,
    mode: session.mode,
    startedAt: session.startedAt,
    endedAt: now,
    durationMinutes,
    activeMinutes,
    tabSwitchCount: sessionActivityData.tabSwitchCount,
    skipCount: sessionActivityData.skipCount,
    completedFull,
    focusScore: scoreResult.focusScore,
    scoreBreakdown: scoreResult.breakdown,
    xpEarned: xpResult.totalXP,
    xpBreakdown: xpResult,
  };

  // Update profile
  const todayStr = new Date().toISOString().slice(0, 10);
  const lastDate = profile.lastSessionDate;
  const isConsecutiveDay = lastDate && isNextDay(lastDate, todayStr);
  const isSameDay = lastDate === todayStr;

  let newStreak = profile.currentStreak;
  if (isConsecutiveDay) {
    newStreak += 1;
  } else if (!isSameDay) {
    newStreak = 1;
  }

  const updatedProfile = await FCStorage.updateProfile({
    totalXP: profile.totalXP + xpResult.totalXP,
    totalSessions: profile.totalSessions + 1,
    totalFocusMinutes: profile.totalFocusMinutes + durationMinutes,
    currentStreak: newStreak,
    bestStreak: Math.max(profile.bestStreak, newStreak),
    lastSessionDate: todayStr,
  });

  // Save to history
  await FCStorage.addHistory(sessionResult);

  // Update daily stats
  const dailyStats = await FCStorage.updateDailyStats(sessionResult);

  // Check achievements
  const newAchievements = await FCAchievements.checkAll(
    sessionResult, updatedProfile, dailyStats
  );

  // Clear session
  await FCStorage.clearSession();

  // Update badge
  chrome.action.setBadgeText({ text: "" });

  // Broadcast completion
  const result = {
    success: true,
    sessionResult,
    xpResult,
    profile: updatedProfile,
    levelInfo: FCScoring.getLevel(updatedProfile.totalXP),
    newAchievements,
  };

  broadcastMessage({ type: "SESSION_COMPLETED", ...result });

  return result;
}

async function getSessionState() {
  const session = await FCStorage.getSession();
  if (!session) {
    return { state: FC_CONSTANTS.SESSION_STATES.IDLE };
  }

  const now = Date.now();
  const elapsedMs = now - session.startedAt - (session.totalPausedMs || 0);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  const totalSeconds = sessionActivityData.activeSeconds + sessionActivityData.inactiveSeconds;
  const activityPct = totalSeconds > 0
    ? Math.round((sessionActivityData.activeSeconds / totalSeconds) * 100)
    : 100;

  return {
    ...session,
    elapsedMinutes,
    activityPct,
    tabSwitchCount: sessionActivityData.tabSwitchCount,
  };
}

// ── Activity Tracking ──────────────────────────────────────

function handleActivityPing(data) {
  const { hasMouseActivity, hasKeyActivity, isVisible } = data;

  sessionActivityData.lastActivityTime = Date.now();

  const interval = FC_CONSTANTS.TRACKING.ACTIVITY_PING_INTERVAL / 1000; // seconds

  if (hasMouseActivity || hasKeyActivity) {
    sessionActivityData.activeSeconds += interval;
    if (hasMouseActivity) sessionActivityData.mouseEvents++;
    if (hasKeyActivity) sessionActivityData.keyEvents++;
  } else if (!isVisible) {
    sessionActivityData.inactiveSeconds += interval;
  } else {
    // Visible but no input — possibly watching video
    sessionActivityData.activeSeconds += interval * 0.5; // half credit
    sessionActivityData.inactiveSeconds += interval * 0.5;
  }

  return { received: true };
}

function handleVideoEvent(data) {
  const { event } = data;

  switch (event) {
    case "speedchange":
      sessionActivityData.videoSpeedChanges++;
      break;
    case "seek":
      sessionActivityData.skipCount++;
      break;
  }

  return { received: true };
}

// ── Anti-Cheat Response ────────────────────────────────────

async function handleAntiCheatResponse(data) {
  const { response } = data;
  sessionActivityData.antiCheatPopupShown = false;

  if (response === "here") {
    // User confirmed they're present
    sessionActivityData.lastActivityTime = Date.now();
    sessionActivityData.lastPopupResponse = Date.now();
    sessionActivityData.popupResponseHistory.push(true);

    // Trim history
    if (sessionActivityData.popupResponseHistory.length > FC_CONSTANTS.ANTI_CHEAT.RESPONSE_HISTORY_SIZE) {
      sessionActivityData.popupResponseHistory.shift();
    }

    return { success: true, xpBonus: 5 };
  } else if (response === "pause") {
    await pauseSession();
    return { success: true, paused: true };
  } else if (response === "timeout") {
    // User didn't respond — auto pause + penalty
    sessionActivityData.inactiveSeconds += 60;
    await pauseSession();
    return { success: true, paused: true, penalty: true };
  }
}

// ── Tab Monitoring ─────────────────────────────────────────

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const session = await FCStorage.getSession();
  if (!session || session.state !== FC_CONSTANTS.SESSION_STATES.ACTIVE) return;

  sessionActivityData.tabSwitchCount++;
  sessionActivityData.lastActivityTime = Date.now();

  broadcastMessage({
    type: "TAB_SWITCH",
    count: sessionActivityData.tabSwitchCount,
  });
});

// Detect window focus changes
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const session = await FCStorage.getSession();
  if (!session || session.state !== FC_CONSTANTS.SESSION_STATES.ACTIVE) return;

  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus
    broadcastMessage({ type: "BROWSER_BLUR" });
  }
});

// ── Website Blocker ────────────────────────────────────────

async function enableBlocker() {
  const settings = await FCStorage.getSettings();
  const blockedSites = settings.blockedSites || FC_CONSTANTS.BLOCKED_DOMAINS;

  const rules = blockedSites.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: "/blocked.html" },
    },
    condition: {
      urlFilter: `||${domain}`,
      resourceTypes: ["main_frame"],
    },
  }));

  // Remove old rules and add new ones
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: rules,
  });

  console.log(`Focus Clash: Blocker enabled (${rules.length} domains)`);
}

async function disableBlocker() {
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existingRules.map(r => r.id);

  if (existingIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingIds,
    });
  }

  console.log("Focus Clash: Blocker disabled");
}

// ── Helpers ────────────────────────────────────────────────

function broadcastMessage(message) {
  // Send to popup (may fail silently if popup is closed — that's expected)
  chrome.runtime.sendMessage(message).catch(() => {});

  // Send to all real webpage tabs (skip chrome:// and extension pages)
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith("chrome") && !tab.url.startsWith("chrome-extension")) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  });
}

function calculatePopupInterval() {
  const history = sessionActivityData.popupResponseHistory;
  const responseRate = history.length > 0
    ? history.filter(Boolean).length / history.length
    : 0.5;

  // More responsive users → less frequent checks
  const base = FC_CONSTANTS.ANTI_CHEAT.BASE_POPUP_INTERVAL;
  const min = FC_CONSTANTS.ANTI_CHEAT.MIN_POPUP_INTERVAL;
  const max = FC_CONSTANTS.ANTI_CHEAT.MAX_POPUP_INTERVAL;

  const interval = base + (responseRate * (max - base));
  return Math.max(min, Math.min(max, interval));
}

function isNextDay(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diff = d2.getTime() - d1.getTime();
  return diff > 0 && diff <= 86400000 * 1.5; // within ~1.5 days
}

console.log("Focus Clash Service Worker loaded ⚔️");
