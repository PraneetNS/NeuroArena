# Tutorial & In-Session Telemetry Specification

## 1. Zero-Network Privacy Principle

NeuroArena's telemetry system operates under a strict **Zero-Remote Network Transmission** mandate:
- All telemetry packets, timestamps, stall indicators, and generation session metrics are stored strictly client-side.
- No analytics payloads, beacons, or user tracking cookies are ever sent over HTTP/HTTPS or WebSockets.
- Storage is managed locally via the browser's **IndexedDB** API (`neuroarena_tutorial_db`), with graceful fallback to `localStorage` in restricted sandboxes.

---

## 2. Data Structures & Session Schema

Each play session generates a `TutorialTelemetrySession` object:

```typescript
export interface TutorialTelemetrySession {
  sessionId: string;
  startedAt: number;
  completedAt?: number;
  totalDurationSec: number;
  completedSteps: StepTelemetryEntry[];
  stalledStepsCount: number;
  oracleCommunesCount?: number;
  oracleTokensGenerated?: number;
  oracleBranchesForked?: number;
  hardwareSummary?: string;
}
```

### Step Telemetry Entry
```typescript
export interface StepTelemetryEntry {
  stepId: TutorialStepId;
  startedAt: number;
  completedAt?: number;
  durationSec: number;
  stalled: boolean;
  stallSeconds: number;
  attempts: number;
}
```

---

## 3. Lifecycle Hooks & Event Tracking

1. **Step Initiation (`recordStepStart`)**:
   - Commences timing for a tutorial objective.
   - Automatically closes any previous unresolved step and tracks attempt counts.

2. **Stall Detection (`recordStall`)**:
   - Triggered when the player remains inactive or training loss does not improve for $> 60 \text{ s}$.
   - Increments `stalledStepsCount` and triggers Lumen's contextual proactive hints.

3. **Step Completion (`recordStepEnd`)**:
   - Calculates exact duration in seconds ($\Delta t = \lfloor(t_{\text{end}} - t_{\text{start}}) / 1000\rfloor$).
   - Appends entry to `completedSteps` and synchronizes with IndexedDB.

4. **Oracle Communion (`recordOracleCommune`, `recordOracleBranchFork`)**:
   - Records visits to the Oracle Stone entity.
   - Tracks total tokens sampled autoregressively and the count of alternate timeline branches forked by the player.

---

## 4. Diagnostics & Report Export

Players and researchers can inspect and extract telemetry data directly:
- **`exportTelemetryJSON()`**: Returns formatted JSON string of the active session.
- **`downloadTelemetryReport()`**: Generates an in-memory `Blob` and triggers a browser file download:
  `neuroarena_tutorial_telemetry_<timestamp>.json`
- In-game access via Lumen Subtitles button or the Observatory diagnostic panel.
