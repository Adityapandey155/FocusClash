// ============================================================
// FOCUS CLASH — ACTIVITY TRACKER (Content Script)
// Tracks mouse, keyboard, and video behavior
// ============================================================

(function() {
  "use strict";

  // Prevent double injection
  if (window.__fc_tracker_loaded) return;
  window.__fc_tracker_loaded = true;

  let isTracking = false;
  let hasMouseActivity = false;
  let hasKeyActivity = false;
  let pingInterval = null;

  // ── Mouse Tracking ───────────────────────────────────────
  let mouseDebounceTimer = null;

  document.addEventListener("mousemove", () => {
    if (!isTracking) return;
    clearTimeout(mouseDebounceTimer);
    mouseDebounceTimer = setTimeout(() => {
      hasMouseActivity = true;
    }, 500); // debounce 500ms
  }, { passive: true });

  document.addEventListener("click", () => {
    if (!isTracking) return;
    hasMouseActivity = true;
  }, { passive: true });

  document.addEventListener("scroll", () => {
    if (!isTracking) return;
    hasMouseActivity = true;
  }, { passive: true });

  // ── Keyboard Tracking ────────────────────────────────────
  document.addEventListener("keydown", () => {
    if (!isTracking) return;
    hasKeyActivity = true;
  }, { passive: true });

  // ── Video Tracking ───────────────────────────────────────
  let trackedVideos = new WeakSet();

  function trackVideos() {
    const videos = document.querySelectorAll("video");
    videos.forEach(video => {
      if (trackedVideos.has(video)) return;
      trackedVideos.add(video);

      // Track playback speed changes
      let lastRate = video.playbackRate;
      video.addEventListener("ratechange", () => {
        if (!isTracking) return;
        if (video.playbackRate !== lastRate) {
          lastRate = video.playbackRate;
          chrome.runtime.sendMessage({
            type: "VIDEO_EVENT",
            data: { event: "speedchange", speed: video.playbackRate },
          }).catch(() => {});
        }
      });

      // Track seeking (skip detection)
      let lastTime = video.currentTime;
      video.addEventListener("seeking", () => {
        if (!isTracking) return;
        const diff = Math.abs(video.currentTime - lastTime);
        if (diff > 10) { // More than 10 seconds skip
          chrome.runtime.sendMessage({
            type: "VIDEO_EVENT",
            data: { event: "seek", diff },
          }).catch(() => {});
        }
      });

      video.addEventListener("timeupdate", () => {
        lastTime = video.currentTime;
      }, { passive: true });
    });
  }

  // Observe for dynamically added videos
  const observer = new MutationObserver(() => {
    if (isTracking) trackVideos();
  });

  // ── Activity Ping ────────────────────────────────────────
  function startPinging() {
    if (pingInterval) return;

    pingInterval = setInterval(() => {
      if (!isTracking) return;

      const isVisible = document.visibilityState === "visible";

      chrome.runtime.sendMessage({
        type: "ACTIVITY_PING",
        data: {
          hasMouseActivity,
          hasKeyActivity,
          isVisible,
        },
      }).catch(() => {});

      // Reset flags
      hasMouseActivity = false;
      hasKeyActivity = false;
    }, 30000); // Every 30 seconds
  }

  function stopPinging() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  // ── Visibility Change ────────────────────────────────────
  document.addEventListener("visibilitychange", () => {
    if (!isTracking) return;

    if (document.visibilityState === "hidden") {
      chrome.runtime.sendMessage({
        type: "ACTIVITY_PING",
        data: { hasMouseActivity: false, hasKeyActivity: false, isVisible: false },
      }).catch(() => {});
    }
  });

  // ── Start/Stop Tracking ──────────────────────────────────
  function startTracking() {
    isTracking = true;
    startPinging();
    trackVideos();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopTracking() {
    isTracking = false;
    stopPinging();
    observer.disconnect();
  }

  // ── Message Listener ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case "SESSION_STARTED":
        startTracking();
        break;
      case "SESSION_COMPLETED":
        stopTracking();
        break;
      case "SESSION_PAUSED":
        stopTracking();
        break;
      case "SESSION_RESUMED":
        startTracking();
        break;
    }
  });

  // ── Initialize ───────────────────────────────────────────
  // Check if there's an active session on page load
  chrome.runtime.sendMessage({ type: "GET_SESSION_STATE" }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.state === "active") {
      startTracking();
    }
  });
})();
