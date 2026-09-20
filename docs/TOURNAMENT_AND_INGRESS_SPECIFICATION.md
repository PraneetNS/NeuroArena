# Esports Tournament Bracket Engine & Edge Ingress Specification

## 1. Overview
This document specifies the authoritative architecture for competitive esports tournaments and edge ingress infrastructure within NeuroArena. It details the tournament bracket state machine, double elimination mechanics with Grand Finals reset, mathematical tiebreaker scoring, automated prize distribution, and edge ingress protection policies.

---

## 2. Tournament Engine Architecture

### 2.1 Supported Tournament Formats
1. **Double Elimination (`DOUBLE_ELIM`)**:
   - Every participant must lose twice before elimination.
   - Bracket comprises:
     - **Upper Bracket (Winners Bracket)**
     - **Lower Bracket (Losers Bracket)**
     - **Grand Finals**
     - **Grand Finals Reset (Conditional)**: If the Lower Bracket champion defeats the Upper Bracket champion in Game 1 of the Grand Finals, a reset match is immediately scheduled to ensure the Upper Bracket champion receives the double-elimination privilege.
2. **Swiss System (`SWISS`)**:
   - Non-elimination multi-round tournament where participants face opponents with equivalent win/loss records.
   - Buchholz and Sonneborn-Berger tiebreakers resolve podium ties without manual intervention.
3. **Single Elimination (`SINGLE_ELIM`)**:
   - Classic knockout bracket suited for high-throughput hourly blitz events.

### 2.2 Olympic Seeding Algorithm
Given $N$ participants, the bracket expands to the nearest power of 2 ($M = 2^{\lceil \log_2 N \rceil}$). Seeds are paired using recursive Olympic tree ordering:
$$\text{Pairing}(i) = (\text{Seed}_i, M + 1 - \text{Seed}_i)$$

If $N < M$, unpopulated slots are designated as `BYE` and auto-advance the higher seed to the subsequent round without round delay.

---

## 3. Mathematical Tiebreaker Scoring

### 3.1 Buchholz System
Buchholz score measures strength of schedule by aggregating the tournament scores of all opponents a participant played against:
$$\text{Buchholz}(P) = \sum_{O \in \text{Opponents}(P)} \text{Score}(O)$$

### 3.2 Sonneborn-Berger System
Sonneborn-Berger quantifies quality wins by summing the scores of opponents defeated, plus half the score of drawn opponents:
$$\text{SonnebornBerger}(P) = \sum_{D \in \text{Defeated}(P)} \text{Score}(D) + 0.5 \sum_{T \in \text{Tied}(P)} \text{Score}(T)$$

### 3.3 Standings Priority Hierarchy
When sorting tournament standings, the engine applies lexicographical priority:
1. Conventional Score ($\text{Wins} + 0.5 \cdot \text{Draws}$)
2. Buchholz Score
3. Sonneborn-Berger Score
4. Head-to-Head Direct Encounter
5. Elo Rating

---

## 4. Authoritative Tournament Manager & Payouts

The `TournamentManager` lifecycle transitions through five deterministic states:
```
REGISTRATION  -->  CHECK_IN  -->  IN_PROGRESS  -->  COMPLETED
       |                                                ^
       +-------------------> CANCELLED -----------------+
```

### 4.1 Automated Prize Distribution
Prize pools aggregate base allocation plus per-participant entry fees:
$$\text{TotalPool} = \text{BasePool} + (\text{EntryFee} \times N)$$

Podium payouts adhere to standard tier distribution:
- **1st Place (Gold)**: $50\%$ of pool, $600\text{ EXP}$, `TOURNAMENT_CHAMPION_GOLD`
- **2nd Place (Silver)**: $30\%$ of pool, $350\text{ EXP}$, `TOURNAMENT_FINALIST_SILVER`
- **3rd Place (Bronze)**: $20\%$ of pool, $200\text{ EXP}$, `TOURNAMENT_PODIUM_BRONZE`

---

## 5. Edge Ingress Hardening & Reverse Proxy

The production Nginx ingress (`deploy/nginx-ingress.conf`) acts as the secure edge gateway for all WebSocket and REST communications:

### 5.1 Leaky-Bucket Rate Limiting
- **API Zone**: `limit_req_zone $binary_remote_addr zone=api_limit:20m rate=30r/s` with burst capacity of 20 requests (`nodelay`). Returns `429 Too Many Requests`.
- **WebSocket Gateway Zone**: `limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=15r/s` with burst capacity of 10 requests.
- **Connection Zone**: `limit_conn_zone $binary_remote_addr zone=addr_limit:20m` limiting concurrent connections to $50$ per client IP to eliminate connection starvation.

### 5.2 Slowloris & DDoS Mitigation Bounds
- `client_body_timeout 10s;`
- `client_header_timeout 10s;`
- `keepalive_timeout 30s 30s;`
- `send_timeout 10s;`
- `client_max_body_size 10M;`

### 5.3 Internal Telemetry Gating
Prometheus metrics (`/metrics`) are restricted to internal Kubernetes and monitoring CIDR ranges (`10.0.0.0/8`, `172.16.0.0/12`, `127.0.0.1`), denying all external traffic.

### 5.4 Canary Weighted Routing
Upstream node cluster integrates canary deployments:
- Primary Stable Nodes: Weight $9$
- Canary Candidate Node: Weight $2$ ($\sim 10\%$ traffic evaluation)
