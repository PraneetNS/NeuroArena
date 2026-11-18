# Legacy Codebase: Frozen Unity & Colyseus Prototype

This directory contains the archived, frozen prototype components of NeuroArena prior to the modern pure WebGPU in-browser rewrite:

- `Assets/`: Unity C# game client assets, scripts, shaders, prefabs, materials, and scenes.
- `ProjectSettings/`: Unity project settings, input mappings, and quality tiers.
- `neuroarena-server/`: Node.js / Colyseus authoritative multiplayer game server prototype.
- `web/`: Earlier client web integration and canvas hosting files.
- `src/`: Initial prototype server/client utility routines.
- `tests/`: Prototype integration test scripts.
- `deploy/`: Server and cloud deployment infrastructure manifests (Docker, Kubernetes).
- `supabase/`: Database schema migrations and persistence for the initial multiplayer backend.

These components are preserved for archival history. The modern active game and machine learning architecture resides entirely in `packages/` and `apps/`.
