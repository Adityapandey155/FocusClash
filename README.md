# ⚔️ Focus Clash – Chrome Extension

> **"We don't force focus, we make breaking focus costly."**

Focus Clash is a **gamified productivity Chrome extension** designed to help students stay focused using **competition, scoring, and intelligent anti-cheat tracking**.

Instead of forcing discipline, Focus Clash makes focus **engaging, measurable, and addictive**.

---

## 🚀 Overview

Focus Clash combines:

* 🎯 Focus sessions
* ⚔️ Competitive scoring system
* 🧠 Smart activity tracking
* 🚫 Website blocking
* 🎮 Gamification (XP, levels, achievements)

All packed into a **Manifest V3 Chrome Extension** with a modern UI and real-time feedback.

---

## 🧩 Core Features

### ⏱️ Focus Sessions

* Set goals (e.g., *“Complete 2-hour lecture”*)
* Countdown or stopwatch mode
* Pause / Resume / End session

---

### 🚫 Website Blocker

* Blocks distracting sites during active sessions
* Custom blocked page with motivation
* Dynamic rules using `declarativeNetRequest`

---

### 🧠 Smart Activity Tracking

* Mouse & keyboard activity tracking (privacy-safe)
* Tab switching detection
* Active vs inactive window tracking
* Video behavior tracking:

  * Playback speed (e.g., 2× detection)
  * Seek / skip detection
  * Pause/play monitoring

---

### ⚠️ Anti-Cheat System

* Detects suspicious patterns:

  * Long inactivity
  * Continuous playback without interaction
* Smart popup:

  > “Still with the lecture? 👀”
* Auto-pause + penalties if ignored
* Adaptive frequency based on user behavior

---

### 🎮 Gamification System

#### 🧠 Focus Score

```
Focus Score = (Time × Engagement × Consistency) – Penalties
```

#### ⚡ XP System

* Earn XP for completing sessions
* Bonus XP for:

  * No tab switching
  * Perfect focus
* Penalties for:

  * Quitting early
  * Inactivity

---

### 🏆 Levels & Ranks

| Level | Rank   | XP Required |
| ----- | ------ | ----------- |
| 1     | Bronze | 0           |
| 2     | Silver | 500         |
| 3     | Gold   | 1500        |
| 4     | Elite  | 4000        |
| 5     | Monk   | 10000       |

---

### 🎖️ Achievements

* No Tab Switch
* 2 Hour Lock
* Perfect Focus Day
* Iron Will (7-day streak)
* Speed Demon
* Zen Master

---

### 📊 Dashboard

* Daily & weekly stats
* Focus time charts
* Session history
* Personal leaderboards:

  * Daily Clash ⚡
  * Weekly Clash 💪
  * Streak Clash 🔥
  * Deep Focus 🧠

---

### 🧘 Modes System

| Feature       | Chill | Competitive | Deep Focus |
| ------------- | ----- | ----------- | ---------- |
| Blocker       | OFF   | ON          | Strict     |
| Anti-Cheat    | OFF   | Normal      | Aggressive |
| XP Multiplier | 0.5×  | 1×          | 1.5×       |
| Penalties     | None  | Medium      | High       |

---

## 🏗️ Architecture

```
Focus_Clash/
├── manifest.json
├── rules.json
├── blocked.html
├── popup/
├── background/
├── content/
├── dashboard/
├── assets/
├── lib/
└── _agents/
```

---

## ⚙️ Tech Stack

* Chrome Extension (Manifest V3)
* JavaScript (Vanilla)
* HTML / CSS (UI)
* Chrome APIs:

  * `tabs`
  * `storage`
  * `alarms`
  * `declarativeNetRequest`
  * `idle`

---

## 💾 Data Storage

* Uses `chrome.storage.local` and `chrome.storage.sync`
* No backend required in MVP
* Stores:

  * Session data
  * XP & levels
  * Achievements
  * History & stats

---

## 🚀 Installation (Development)

1. Download or clone this repo
2. Open Chrome
3. Go to:

   ```
   chrome://extensions/
   ```
4. Enable **Developer Mode**
5. Click **Load Unpacked**
6. Select project folder

---

## 🧪 Testing Checklist

* ✅ Start / End session
* ✅ Website blocking works
* ✅ Tab switching detection
* ✅ Overlay widget display
* ✅ Anti-cheat popup trigger
* ✅ XP & score calculation
* ✅ Dashboard stats accuracy

---

## ⚠️ Limitations (MVP)

* No multi-user leaderboard (local only)
* Overlay may not work on some CSP-restricted sites
* No backend (Firebase planned for V2)

---

## 🔮 Future Plans

* 🌐 Firebase integration (global leaderboard)
* 👥 Friends / group competition
* 📱 Mobile sync
* 🧠 AI-based focus insights
* 🔔 Sound effects & notifications
* 📊 Advanced analytics

---

## 🧠 Philosophy

Focus Clash is built on one core idea:

> Discipline shouldn’t be forced.
> It should be **earned, measured, and competed for**.

---

## 👨‍💻 Author

**Aditya Pandey**

---

## 📜 License

MIT License
