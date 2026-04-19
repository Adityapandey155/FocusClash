// ============================================================
// FOCUS CLASH — FIREBASE AUTH WRAPPER
// ============================================================

const FCAuth = {
  _auth: null,
  _db: null,

  // ── Initialization ─────────────────────────────────────────

  ensure() {
    if (!this._auth) {
      initFirebaseApp();
      this._auth = firebase.auth();
      this._db = firebase.firestore();
      // Use local persistence so auth survives popup close/reopen
      this._auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
    }
    return this;
  },

  // ── Username Uniqueness Check ──────────────────────────────

  async checkUsernameAvailable(username) {
    this.ensure();
    const lower = username.toLowerCase().trim();
    try {
      const doc = await this._db.collection("usernames").doc(lower).get();
      return !doc.exists;
    } catch (e) {
      console.warn("Username check error:", e);
      return true; // fail open — signup will catch any real conflicts
    }
  },

  // ── Sign Up ────────────────────────────────────────────────

  async signUp(email, password, username) {
    this.ensure();
    const lower = username.toLowerCase().trim();

    // 1. Verify username is available
    const available = await this.checkUsernameAvailable(username);
    if (!available) {
      throw new Error("Username is already taken. Please choose another.");
    }

    // 2. Create Firebase Auth user
    const cred = await this._auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    const now = Date.now();

    // 3. Batch write: user doc + username reservation (atomic)
    const batch = this._db.batch();
    const userRef = this._db.collection("users").doc(uid);
    const usernameRef = this._db.collection("usernames").doc(lower);

    batch.set(userRef, {
      uid,
      email,
      username,
      usernameLower: lower,
      totalXP: 0,
      totalSessions: 0,
      totalFocusMinutes: 0,
      createdAt: now,
    });
    batch.set(usernameRef, { uid });

    await batch.commit();

    const userData = { uid, email, username, usernameLower: lower, totalXP: 0, totalSessions: 0, totalFocusMinutes: 0 };
    await chrome.storage.local.set({ fc_auth_user: userData });
    return userData;
  },

  // ── Sign In ────────────────────────────────────────────────

  async signIn(email, password) {
    this.ensure();
    const cred = await this._auth.signInWithEmailAndPassword(email, password);
    const userDoc = await this._db.collection("users").doc(cred.user.uid).get();

    if (!userDoc.exists) {
      throw new Error("User profile not found. Please contact support.");
    }

    const userData = userDoc.data();
    await chrome.storage.local.set({ fc_auth_user: userData });
    return userData;
  },

  // ── Sign Out ───────────────────────────────────────────────

  async signOut() {
    this.ensure();
    await this._auth.signOut();
    await chrome.storage.local.remove("fc_auth_user");
  },

  // ── Auth State Listener ────────────────────────────────────

  onAuthChange(callback) {
    this.ensure();
    return this._auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await this._db.collection("users").doc(firebaseUser.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            await chrome.storage.local.set({ fc_auth_user: userData });
            callback(userData);
          } else {
            callback(null);
          }
        } catch (e) {
          // Network error — fall back to cached data
          const cached = await this.getCurrentUserFromStorage();
          callback(cached);
        }
      } else {
        await chrome.storage.local.remove("fc_auth_user");
        callback(null);
      }
    });
  },

  // ── Cache Helpers ──────────────────────────────────────────

  async getCurrentUserFromStorage() {
    try {
      const result = await chrome.storage.local.get("fc_auth_user");
      return result.fc_auth_user || null;
    } catch (e) {
      return null;
    }
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FCAuth = FCAuth;
}
