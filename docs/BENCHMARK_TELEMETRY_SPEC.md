# WebGPU Benchmark & Empirical Verification Specification

## 1. Headless Chrome CDP Execution Protocol

To verify discrete WebGPU compute pipelines and matrix-vector autoregressive decoding without manual browser interaction, NeuroArena employs a Chrome DevTools Protocol (CDP) headless runner.

### Invocation Flags
```bash
chrome.exe \
  --headless=new \
  --remote-debugging-port=9222 \
  --enable-unsafe-webgpu \
  --use-angle=d3d11 \
  --no-sandbox \
  --disable-gpu-watchdog \
  http://localhost:3001
```

### Security & Origin Invariants
WebGPU is restricted to **Secure Contexts** (`http://localhost:*` or `https://*`). Launching `about:blank` disables `navigator.gpu`. The test suite serves `apps/bench` over HTTP to ensure `navigator.gpu.requestAdapter()` resolves to the discrete GPU.

---

## 2. Hardware Adapter Profile: NVIDIA GeForce RTX 3050 Laptop GPU

Verified adapter characteristics measured via `adapter.info`:
- **Vendor**: `nvidia` (Vendor ID: `0x10de`)
- **Architecture**: `ampere`
- **Device ID**: `0x25a2` (Discrete Mobile GPU)
- **VRAM**: 4,096 MiB Dedicated GDDR6
- **Driver Version**: 621.24
- **Max Buffer Size**: 2,147,483,648 bytes (2.00 GB)
- **Max Storage Buffer Binding Size**: 2,147,483,644 bytes

---

## 3. Strict Parity Verification Gates

### A. KV-Cache Autoregressive Generation Parity
- **Gate**: Relative $L_\infty$ logit error $\frac{\|z_{\text{cached}} - z_{\text{uncached}}\|_\infty}{\|z_{\text{uncached}}\|_\infty} < 10^{-3}$ evaluated continuously over 200 generated tokens.
- **Measured Parity**:
  - Scout Model ($L=4, H=4, D=128$): $\mathbf{4.363 \times 10^{-7}}$ (PASS).
  - Preset S / Elder Model ($L=6, H=6, D=192$): $\mathbf{1.903 \times 10^{-6}}$ (PASS).

### B. Loss Masking Gradient Parity (`target = -1`)
- **Gate**: Relative gradient error per parameter group between CPU and GPU cross-entropy with masked targets $< 10^{-3}$.
- **Worst-case Group**: `blocks.1.W2` at $\mathbf{1.370 \times 10^{-6}}$ (PASS). All 20 parameter groups matched.

---

## 4. Benchmark Telemetry Schema

The exported telemetry archive contains:
1. `adapterInfo`: Vendor, architecture, device limits.
2. `kvParity`: Scout and Elder relative error, cached vs uncached tokens/sec.
3. `lossMasking`: Gradients, max relative errors across all weight matrices.
4. `dialogueStats`: Turn counts, token volumes, holdout distributions for all 6 target speakers.
5. `finetuningMetrics`: Pre- and post-adaptation loss, general validation drift.
6. `transcripts`: Generated continuation samples across Shakespearean characters.
