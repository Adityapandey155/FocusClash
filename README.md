# ⚔️ Focus Clash — Gamified Focus Chrome Extension

A cyberpunk-styled Chrome Extension (Manifest V3) that helps students stay focused using a **commitment system, anti-cheat engine, and gamified scoring**.

> *"We don't force focus, we make breaking focus costly."*

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🎯 **Focus Session Timer** | Countdown or stopwatch modes |
| 🚫 **Website Blocker** | Blocks distracting sites during sessions |
| 🎮 **Gamified Scoring** | `FocusScore = (Time × Engagement × Consistency) – Penalties` |
| ⚔️ **Anti-Cheat Engine** | Detects inactivity, video skipping, tab switching |
| 🏆 **Personal Leaderboard** | Daily / Weekly / Deep Focus rankings |
| 🎖️ **15 Achievements** | Unlock badges for milestones |
| 📊 **Full Dashboard** | Weekly chart, history, settings |
| 💎 **Cyberpunk UI** | Neon glows, scanlines, HUD aesthetics |

---

## 🚀 Install (Developer Mode)

1. Clone or download this repo
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked**
5. Select the `Focus_Clash` folder
6. Click the ⚔️ icon in your toolbar!

---

## 🗂️ Project Structure

```
Focus_Clash/
├── manifest.json              # MV3 config
├── rules.json                 # Default blocked sites
├── blocked.html / .css        # Blocked page
├── background/
│   └── service-worker.js      # Core engine
├── popup/
│   ├── popup.html/css/js      # Extension popup (4 screens)
├── dashboard/
│   ├── dashboard.html/css/js  # Full analytics dashboard
├── content/
│   ├── overlay.js/css         # Floating HUD widget
│   ├── tracker.js             # Activity tracking
│   └── anti-cheat-popup.js    # Presence verification
└── lib/
    ├── constants.js           # All config constants
    ├── storage.js             # chrome.storage abstraction
    ├── scoring.js             # XP + score engine
    └── achievements.js        # 15 achievement definitions
```

---

## 🎮 Modes

| Mode | Blocker | Anti-Cheat | XP Multiplier |
|------|---------|------------|---------------|
| 🟢 Chill | ❌ | ❌ | 0.75x |
| 🔴 Competitive | ✅ | ✅ | 1.0x |
| 🧘 Deep Focus | ✅ | ✅ (aggressive) | 1.5x |

---

## 🏅 Levels

| Level | XP Required |
|-------|-------------|
| 🥉 Bronze | 0 |
| 🥈 Silver | 500 |
| 🥇 Gold | 1,500 |
| 💎 Diamond | 4,000 |
| 🧘 Monk | 10,000 |

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension API
- Vanilla JavaScript (no frameworks)
- `chrome.declarativeNetRequest` for blocking
- `chrome.alarms` for session ticks
- `chrome.storage.local` for persistence
- CSS with Orbitron font + neon cyberpunk theme

---

## 📄 License

MIT — built for students, by a student. Fork it, mod it, make it yours.
