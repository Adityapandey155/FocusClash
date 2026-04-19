// ============================================================
// FOCUS CLASH — ACHIEVEMENTS SYSTEM
// ============================================================

const FC_ACHIEVEMENTS = [
  {
    id: "no_tab_switch",
    name: "Laser Focus",
    description: "Complete a session with zero tab switches",
    icon: "🎯",
    category: "focus",
    check: (session, _profile) => session.tabSwitchCount === 0 && session.completedFull,
  },
  {
    id: "two_hour_lock",
    name: "2 Hour Lock",
    description: "Complete a session lasting 2+ hours",
    icon: "🔒",
    category: "endurance",
    check: (session, _profile) => session.durationMinutes >= 120 && session.completedFull,
  },
  {
    id: "perfect_focus_day",
    name: "Perfect Focus Day",
    description: "Accumulate 4+ hours of focus in one day",
    icon: "⭐",
    category: "daily",
    check: (_session, _profile, dailyStats) => dailyStats && dailyStats.focusMinutes >= 240,
  },
  {
    id: "iron_will",
    name: "Iron Will",
    description: "Maintain a 7-day streak",
    icon: "🔥",
    category: "streak",
    check: (_session, profile) => profile.currentStreak >= 7,
  },
  {
    id: "speed_demon",
    name: "Speed Demon",
    description: "Complete 5 sessions in one day",
    icon: "⚡",
    category: "daily",
    check: (_session, _profile, dailyStats) => dailyStats && dailyStats.sessions >= 5,
  },
  {
    id: "zen_master",
    name: "Zen Master",
    description: "Reach Monk level (10,000 XP)",
    icon: "🧘",
    category: "level",
    check: (_session, profile) => profile.totalXP >= 10000,
  },
  {
    id: "first_session",
    name: "First Steps",
    description: "Complete your very first focus session",
    icon: "👣",
    category: "milestone",
    check: (_session, profile) => profile.totalSessions >= 1,
  },
  {
    id: "ten_sessions",
    name: "Getting Serious",
    description: "Complete 10 focus sessions",
    icon: "💪",
    category: "milestone",
    check: (_session, profile) => profile.totalSessions >= 10,
  },
  {
    id: "fifty_sessions",
    name: "Focus Warrior",
    description: "Complete 50 focus sessions",
    icon: "⚔️",
    category: "milestone",
    check: (_session, profile) => profile.totalSessions >= 50,
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Complete 100 focus sessions",
    icon: "🏛️",
    category: "milestone",
    check: (_session, profile) => profile.totalSessions >= 100,
  },
  {
    id: "deep_dive",
    name: "Deep Dive",
    description: "Complete a Deep Focus mode session",
    icon: "🧠",
    category: "mode",
    check: (session) => session.mode === "deep_focus" && session.completedFull,
  },
  {
    id: "high_scorer",
    name: "High Scorer",
    description: "Achieve a Focus Score of 200+ in a single session",
    icon: "🏆",
    category: "score",
    check: (session) => session.focusScore >= 200,
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    description: "Maintain a 30-day streak",
    icon: "🌟",
    category: "streak",
    check: (_session, profile) => profile.currentStreak >= 30,
  },
  {
    id: "early_bird",
    name: "Early Bird",
    description: "Start a session before 7 AM",
    icon: "🌅",
    category: "time",
    check: (session) => {
      const hour = new Date(session.startedAt).getHours();
      return hour < 7;
    },
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Complete a session after 11 PM",
    icon: "🦉",
    category: "time",
    check: (session) => {
      const hour = new Date(session.endedAt).getHours();
      return hour >= 23 && session.completedFull;
    },
  },
];

const FCAchievements = {
  /**
   * Check all achievements against current session/profile state.
   * Returns array of newly unlocked achievement IDs.
   */
  async checkAll(sessionResult, profile, dailyStats) {
    const unlocked = await FCStorage.getAchievements();
    const newlyUnlocked = [];

    for (const achievement of FC_ACHIEVEMENTS) {
      if (unlocked[achievement.id]) continue; // already unlocked

      try {
        if (achievement.check(sessionResult, profile, dailyStats)) {
          const isNew = await FCStorage.unlockAchievement(achievement.id);
          if (isNew) {
            newlyUnlocked.push(achievement);
          }
        }
      } catch (e) {
        console.warn(`Achievement check failed for ${achievement.id}:`, e);
      }
    }

    return newlyUnlocked;
  },

  /**
   * Get all achievement definitions with unlock status.
   */
  async getAll() {
    const unlocked = await FCStorage.getAchievements();
    return FC_ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: !!unlocked[a.id],
      unlockedAt: unlocked[a.id]?.unlockedAt || null,
      check: undefined, // remove function for serialization
    }));
  },

  /**
   * Get achievement by ID.
   */
  getById(id) {
    return FC_ACHIEVEMENTS.find(a => a.id === id) || null;
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FCAchievements = FCAchievements;
  globalThis.FC_ACHIEVEMENTS = FC_ACHIEVEMENTS;
}
