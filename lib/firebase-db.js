// ============================================================
// FOCUS CLASH — FIRESTORE DATABASE WRAPPER
// ============================================================

const FCDB = {
  _db: null,

  // ── Initialization ─────────────────────────────────────────

  ensure() {
    if (!this._db) {
      initFirebaseApp();
      this._db = firebase.firestore();
    }
    return this;
  },

  // ── Save Session to Global Leaderboard ─────────────────────

  async saveSession(sessionResult, userInfo) {
    this.ensure();
    if (!userInfo || !userInfo.uid || !sessionResult) return;

    // Compute date labels for efficient querying
    const endDate = new Date(sessionResult.endedAt || Date.now());
    const dateStr = endDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const weekStart = new Date(endDate);
    weekStart.setDate(endDate.getDate() - endDate.getDay()); // Sunday = week start
    const weekStr = weekStart.toISOString().slice(0, 10);

    const sessionData = {
      userId: userInfo.uid,
      username: userInfo.username,
      focusScore: sessionResult.focusScore || 0,
      xpEarned: sessionResult.xpEarned || 0,
      durationMinutes: sessionResult.durationMinutes || 0,
      mode: sessionResult.mode || "competitive",
      completedFull: sessionResult.completedFull || false,
      goal: sessionResult.goal || "Focus Session",
      endedAt: sessionResult.endedAt || Date.now(),
      dateStr,
      weekStr,
    };

    // Write session doc
    await this._db
      .collection("sessions")
      .doc(sessionResult.id || `session_${Date.now()}`)
      .set(sessionData);

    // Increment user aggregate stats atomically
    await this._db
      .collection("users")
      .doc(userInfo.uid)
      .update({
        totalXP: firebase.firestore.FieldValue.increment(sessionResult.xpEarned || 0),
        totalSessions: firebase.firestore.FieldValue.increment(1),
        totalFocusMinutes: firebase.firestore.FieldValue.increment(sessionResult.durationMinutes || 0),
      });
  },

  // ── Global Leaderboard Queries ─────────────────────────────

  async getGlobalLeaderboard(type = "alltime") {
    this.ensure();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStr = weekStart.toISOString().slice(0, 10);

    const LIMIT = 20;
    let snapshot;

    switch (type) {
      case "daily":
        // Query by dateStr (single-field index, auto-created by Firestore)
        snapshot = await this._db
          .collection("sessions")
          .where("dateStr", "==", todayStr)
          .limit(50)
          .get();
        break;

      case "weekly":
        snapshot = await this._db
          .collection("sessions")
          .where("weekStr", ">=", weekStr)
          .limit(100)
          .get();
        break;

      default: // "alltime"
        snapshot = await this._db
          .collection("sessions")
          .orderBy("focusScore", "desc")
          .limit(LIMIT)
          .get();
        // Already sorted — return immediately
        return snapshot.docs.map((doc) => doc.data());
    }

    // Client-side sort for daily/weekly (avoids composite index requirement)
    const entries = snapshot.docs.map((doc) => doc.data());
    entries.sort((a, b) => b.focusScore - a.focusScore);
    return entries.slice(0, LIMIT);
  },

  // ── Update User Profile Doc ────────────────────────────────

  async updateUserProfile(uid, updates) {
    this.ensure();
    await this._db.collection("users").doc(uid).update(updates);
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FCDB = FCDB;
}
