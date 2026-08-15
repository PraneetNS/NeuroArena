# 🔒 NeuroArena: Privacy Policy & Data Integrity Statement
### *Effective Date: August 2026 | Version 2.0 (Stage 43 Compliance)*

**NeuroArena: Gradients of the Wild** is built upon a strict **100% Offline, Privacy-First Architecture**. This document explicitly discloses our data practices, local diagnostics scope, and verification standards.

---

## 1. Zero Network Transmission & 100% Offline Operation
- **Zero Automatic Network Calls:** NeuroArena does NOT contain any network tracking SDKs, advertising frameworks, third-party analytics libraries, or automatic telemetry uploaders.
- **Airplane Mode Operation:** Full gameplay, including procedural world generation, machine learning optimization, daily seeded challenges, and ghost multiplayer duels, runs entirely locally on your device with no active internet connection required.
- **No User Account Requirement:** You are never asked for email addresses, passwords, phone numbers, or personally identifiable information (PII).

---

## 2. Opt-In Local Diagnostics Logging (Stage 43)

NeuroArena contains an optional, local-only diagnostics system designed to assist with manual bug reporting.

### A. Strict Opt-In & Explicit Consent
- Diagnostics logging is **DISABLED by default**.
- It is only activated after the player explicitly reviews and approves the in-game Consent Dialog (**Settings ➔ Logs**).

### B. What is Logged Locally (When Opted In)
1. **Session Metrics:** Application version, platform, and session elapsed playtime.
2. **Screen & Biome Context:** Navigation transitions (e.g. *Navigated to Formula Terminal in Biome #2*).
3. **Performance Spikes:** Frame durations exceeding $\ge 50$ms ($<20$ FPS drops) to pinpoint graphics bottlenecks.
4. **Local Exceptions & Crash Traces:** Unity/JS runtime errors and call stacks.

### C. What is NEVER Logged or Transmitted
- ❌ NO geographic location or GPS data.
- ❌ NO unique device identifiers (IMEI, MAC address, Android ID, IDFA).
- ❌ NO microphone, camera, or personal contact data.
- ❌ NO network communication or background uploads.

### D. Manual Export & Player Control
- All diagnostic entries are stored locally on your device in `neuroarena_diagnostics.log` / `neuroarena_diagnostics.txt`.
- Players have complete control to **View**, **Copy to Clipboard**, **Export/Download**, or permanently **Clear** the log file at any time.

---

## 3. Local Data Storage & Saves
- Game progress, custom-trained models, settings, and player profiles are serialized strictly to local device storage (`PlayerPrefs`, `Application.persistentDataPath`, or browser `localStorage`).
- Destructive actions (such as resetting progress or deleting profiles) enforce a mandatory **Confirm-Twice** security protocol with a 5-second countdown timer.

---

## 4. Store Listing & Real Device Screenshot Standards
- All store listing promotional assets and screenshots are captured directly from **real physical device hardware builds** (Android & WebGL targets) with genuine HUD and screen-safe margins, never from simulated or artificial mockups.
