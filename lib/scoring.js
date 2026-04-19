// ============================================================
// FOCUS CLASH — SCORING & XP ENGINE
// ============================================================

const FCScoring = {

  /**
   * Calculate the Focus Score for a completed session.
   * 
   * Formula:
   *   FocusScore = (Time × Engagement × Consistency) – Penalties
   *
   * @param {Object} sessionData
   * @param {number} sessionData.durationMinutes   - Total session time in minutes
   * @param {number} sessionData.activeMinutes     - Minutes with detected activity
   * @param {number} sessionData.tabSwitchCount    - Number of tab switches
   * @param {number} sessionData.skipCount         - Number of content skips
   * @param {number} sessionData.inactivityMinutes - Total inactive minutes
   * @param {number} sessionData.currentStreak     - Current daily streak
   * @param {string} sessionData.mode              - Session mode ID
   * @param {boolean} sessionData.completedFull    - Whether session ran to completion
   * @returns {Object} Detailed score breakdown
   */
  calculateScore(sessionData) {
    const {
      durationMinutes = 0,
      activeMinutes = 0,
      tabSwitchCount = 0,
      skipCount = 0,
      inactivityMinutes = 0,
      currentStreak = 0,
      mode = "competitive",
      completedFull = false,
    } = sessionData;

    // ── Time Component ──────────────────────────────────────
    const timeScore = Math.max(0, durationMinutes);

    // ── Engagement (0.0 – 1.0) ──────────────────────────────
    const engagement = durationMinutes > 0
      ? Math.min(1, activeMinutes / durationMinutes)
      : 0;

    // ── Consistency Multiplier (streak-based) ───────────────
    // 1.0 base, +0.1 per streak day, capped at 2.0
    const consistency = Math.min(2.0, 1.0 + (currentStreak * 0.1));

    // ── Penalties ───────────────────────────────────────────
    const tabPenalty = tabSwitchCount * FC_CONSTANTS.PENALTIES.TAB_SWITCH;
    const skipPenalty = skipCount * FC_CONSTANTS.PENALTIES.CONTENT_SKIP;
    const inactivityPenalty = inactivityMinutes * FC_CONSTANTS.PENALTIES.INACTIVITY_MINUTE;
    const totalPenalties = tabPenalty + skipPenalty + inactivityPenalty;

    // ── Raw Score ───────────────────────────────────────────
    const rawScore = (timeScore * engagement * consistency) - totalPenalties;
    const focusScore = Math.max(0, Math.round(rawScore));

    return {
      focusScore,
      breakdown: {
        timeScore: Math.round(timeScore),
        engagement: Math.round(engagement * 100),
        consistency: parseFloat(consistency.toFixed(1)),
        penalties: {
          tabSwitch: tabPenalty,
          contentSkip: skipPenalty,
          inactivity: inactivityPenalty,
          total: totalPenalties,
        },
      },
    };
  },

  /**
   * Calculate XP earned from a session.
   *
   * @param {Object} scoreResult - Output from calculateScore()
   * @param {Object} sessionData - Same session data
   * @returns {Object} XP breakdown
   */
  calculateXP(scoreResult, sessionData) {
    const {
      tabSwitchCount = 0,
      mode = "competitive",
      completedFull = false,
      engagement = 0,
    } = sessionData;

    const modeConfig = this.getModeConfig(mode);
    let xp = scoreResult.focusScore;
    const bonuses = [];
    const penalties = [];

    // ── Bonuses ─────────────────────────────────────────────
    if (completedFull) {
      xp += FC_CONSTANTS.XP.SESSION_COMPLETE_BONUS;
      bonuses.push({ label: "Session Completed", value: FC_CONSTANTS.XP.SESSION_COMPLETE_BONUS });
    }

    if (tabSwitchCount === 0) {
      xp += FC_CONSTANTS.XP.NO_TAB_SWITCH_BONUS;
      bonuses.push({ label: "No Tab Switch", value: FC_CONSTANTS.XP.NO_TAB_SWITCH_BONUS });
    }

    const engagementPct = scoreResult.breakdown.engagement;
    if (engagementPct >= 95) {
      xp += FC_CONSTANTS.XP.PERFECT_FOCUS_BONUS;
      bonuses.push({ label: "Perfect Focus", value: FC_CONSTANTS.XP.PERFECT_FOCUS_BONUS });
    }

    // ── Penalties ───────────────────────────────────────────
    if (!completedFull && modeConfig.earlyQuitPenalty < 0) {
      xp += modeConfig.earlyQuitPenalty;
      penalties.push({ label: "Early Quit", value: modeConfig.earlyQuitPenalty });
    }

    // ── Mode Multiplier ─────────────────────────────────────
    xp = Math.round(xp * modeConfig.xpMultiplier);

    return {
      totalXP: Math.max(0, xp),
      bonuses,
      penalties,
      multiplier: modeConfig.xpMultiplier,
    };
  },

  /**
   * Get mode configuration by ID.
   */
  getModeConfig(modeId) {
    const modes = FC_CONSTANTS.MODES;
    return modes[modeId.toUpperCase()] || modes.COMPETITIVE;
  },

  /**
   * Get level info for a given XP amount.
   */
  getLevel(totalXP) {
    const levels = FC_CONSTANTS.LEVELS;
    let currentLevel = levels[0];
    let nextLevel = levels[1] || null;

    for (let i = levels.length - 1; i >= 0; i--) {
      if (totalXP >= levels[i].xpRequired) {
        currentLevel = levels[i];
        nextLevel = levels[i + 1] || null;
        break;
      }
    }

    const xpInLevel = totalXP - currentLevel.xpRequired;
    const xpForNext = nextLevel 
      ? nextLevel.xpRequired - currentLevel.xpRequired 
      : 0;
    const progress = nextLevel 
      ? Math.min(100, Math.round((xpInLevel / xpForNext) * 100)) 
      : 100;

    return {
      current: currentLevel,
      next: nextLevel,
      xpInLevel,
      xpForNext,
      progress,
      levelIndex: FC_CONSTANTS.LEVELS.indexOf(currentLevel),
    };
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FCScoring = FCScoring;
}
