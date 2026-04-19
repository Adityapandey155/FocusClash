// ============================================================
// FOCUS CLASH — FIREBASE CONFIGURATION
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDCldBOsE1uJk_dbDp9YQLHGzfISPQFmxY",
  authDomain: "focusclash-5b09c.firebaseapp.com",
  projectId: "focusclash-5b09c",
  storageBucket: "focusclash-5b09c.firebasestorage.app",
  messagingSenderId: "315830668210",
  appId: "1:315830668210:web:9b8f7783a6826e9b8e32ab",
};

/**
 * Initialize Firebase app (safe to call multiple times — guards against duplicate init).
 * Returns the default app instance.
 */
function initFirebaseApp() {
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  return firebase.app();
}

if (typeof globalThis !== "undefined") {
  globalThis.FIREBASE_CONFIG = FIREBASE_CONFIG;
  globalThis.initFirebaseApp = initFirebaseApp;
}
