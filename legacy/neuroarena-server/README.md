# ⚡ NeuroArena Real-Time Multiplayer Relay Server (`neuroarena-server/`)

A lightweight, high-performance **Node.js + Colyseus** real-time multiplayer state synchronization server designed to synchronize player positions, rotations, active biome realms, character silhouettes, and live activity states across web and native clients.

---

## 🌟 Features & Schema Architecture

* **Decoupled Standalone Service:** Operates independently from the Three.js web app and Unity build. Can be deployed, scaled, or torn down without touching client source code.
* **Synchronized State Schema (`ArenaRoomState`):**
  * `id`: Unique client session identifier.
  * `name`: Display architect callsign.
  * `characterBuild`: Chosen low-poly silhouette (`explorer` | `scholar` | `engineer`).
  * `x, y, z`: Continuous 3D world coordinates.
  * `rotationY`: Yaw orientation in radians.
  * `biome`: Active biome index ($0$ = Steppes, $1$ = Marshlands, $2$ = Tundra, $3$ = Canopy, $4$ = Citadel, $5$ = Semantic Expanse).
  * `activityState`: Real-time player activity enum (`idle` | `walking` | `harvesting` | `training`).
  * `lastUpdate`: Unix timestamp for entity interpolation and timeout detection.
* **Tickrate & Patch Rate:** 20 Hz ($50\text{ms}$ tick interval) for smooth positional interpolation and minimal network bandwidth overhead.
* **Healthcheck & REST Telemetry:** Standard `/health` and `/api/status` endpoints for cloud orchestrator liveness probes.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd neuroarena-server
npm install
```

### 2. Run Locally
```bash
# Production mode
npm start

# Development watch mode
npm run dev
```
* **WebSocket Endpoint:** `ws://localhost:2567`
* **Room Name:** `"arena_room"`
* **Healthcheck Endpoint:** `http://localhost:2567/health`

### 3. Run Automated Unit Tests
```bash
npm test
```

---

## ☁️ Deployment (Docker / Railway / Fly.io / Render)

You can containerize and deploy to any cloud container platform using a simple `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 2567
CMD ["npm", "start"]
```

---

## 📜 License
MIT License • Created by [PraneetNS](https://github.com/PraneetNS)
