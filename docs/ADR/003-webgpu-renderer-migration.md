# ADR-003: Migrate Three.js Rendering Backend to WebGPURenderer with WebGL Fallback

**Date:** 2026-09-02  
**Status:** Accepted  
**Authors:** NeuroArena Web Team

---

## Context

NeuroArena's Three.js web client used `THREE.WebGLRenderer` as its sole rendering backend.
As WebGPU becomes widely available (Chrome 113+, Firefox Nightly, Edge 113+), it offers:

- **GPU Compute Shaders** — allowing particle systems to run entirely on the GPU pipeline
- **Lower CPU overhead** — reduced driver-side CPU work for draw call submission
- **Modern pipeline model** — explicit resource management aligned with Vulkan/Metal/DX12
- **Higher draw call ceilings** — WebGPU can sustain >180 draw calls/frame vs WebGL2's ~100

Simultaneously, the existing Multi-Tier Mobile Profiler (Tier 1–3) was based purely on RAM
and CPU core count. This ignored a crucial axis: whether the browser has WebGPU, WebGL2, or
only WebGL1 support — a significant performance differentiator.

---

## Decision

**Migrate the default renderer to `WebGPURenderer` with automatic `WebGLRenderer` fallback.**

Specifics:
1. **Async bootstrap pattern**: `new THREE.WebGPURenderer()` → `await renderer.init()` inside
   a try/catch. On any error, fall back to `new THREE.WebGLRenderer()` with identical options.
2. **No visual regression on fallback**: Both renderers receive the same `configureRenderer()`
   call (size, DPR, shadow settings), ensuring identical visual output.
3. **GPU compute particles**: `GPUParticleEngine.update(dt)` dispatches to `simulateGPUCompute()`
   on WebGPU and `simulateCPUFallback()` on WebGL — same Float32Array buffers, same math.
4. **Capability probe as a tier axis**: `probeCapabilities()` adds `gpuBackend` to the profiler.
   WebGL1 → forced Tier 1; WebGPU + ≥8GB + ≥8 cores → Tier 3 (Ultra); otherwise Tier 2.
5. **Draw call budget instrumentation**: `recordFrameDrawCalls(tierLevel)` reads
   `renderer.info.render.calls` each frame and asserts budgets: <60 (T1), <100 (T2), <180 (T3).
6. **Scene disposal auditing**: `SceneDisposalAuditor.auditSceneTransition()` measures heap
   delta on biome transitions and duel teardowns; fails if delta exceeds 1 MB.

---

## Consequences

### Positive
- ⚡ WebGPU users (Chrome 113+ desktop) gain GPU-compute particle physics at 0 CPU cost
- 🎮 WebGL users retain 100% identical behavior via the CPU fallback path
- 📊 Tier profiler now more accurately reflects real GPU capability (not just RAM/cores)
- 🧹 Disposal auditor catches memory leaks before they cause frame-rate degradation
- 🔍 Per-frame draw call tracking enables proactive optimization before budget violations

### Negative / Risks
- Three.js `WebGPURenderer` is in active development; API may change in minor versions
- `navigator.gpu` probe adds ~5–10ms to initial load (mitigated: one-time, async)
- GPU compute path currently mirrors CPU math deterministically (no divergence benefit yet)

### Neutral
- `THREE.WebGPURenderer` is only used when both `navigator.gpu` AND `THREE.WebGPURenderer`
  exist; the fallback guarantees zero breakage on WebGL-only browsers (Safari, older Chrome)

---

## Alternatives Considered

| Option | Reason Rejected |
|--------|----------------|
| Keep WebGLRenderer only | Misses GPU compute gains; growing browser support makes WebGPU adoption low-risk |
| Hard-require WebGPU | Breaks Safari, mobile Chrome <113, Firefox stable; unacceptable reach regression |
| Use raw WebGPU API | Three.js abstraction saves 3000+ LoC of boilerplate; not worth bypassing for now |
| Babylon.js WebGPU | Would require full engine migration; unjustified given Three.js investment |

---

## References
- [Three.js WebGPURenderer](https://threejs.org/docs/#api/en/renderers/WebGPURenderer)
- [WebGPU Spec (W3C)](https://gpuweb.github.io/gpuweb/)
- [Chrome WebGPU Status](https://chromestatus.com/feature/6213121689518080)
- ADR-001: Hybrid Client-Authoritative Netcode
- ADR-002: Custom Neural Tensor Engine
