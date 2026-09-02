/**
 * ⚡ NeuroArena GPU Capability Probe
 *
 * Standalone one-time hardware capability detector.
 * Feeds results into RendererManager and DeviceTierProfile for tier assignment.
 *
 * Usage:
 *   import { probeGPUCapabilities } from './gpuCapabilityProbe.js';
 *   const caps = await probeGPUCapabilities();
 *   // caps: { hasWebGPU, hasWebGL2, hasWebGL1, maxTextureSize, gpuBackend, ... }
 */

/**
 * @typedef {Object} GPUCapabilities
 * @property {boolean} hasWebGPU          - True if navigator.gpu adapter is available
 * @property {boolean} hasWebGL2          - True if WebGL2 context is available
 * @property {boolean} hasWebGL1          - True if WebGL1 context is available
 * @property {string}  gpuBackend         - "webgpu" | "webgl2" | "webgl1" | "none"
 * @property {number}  maxTextureSize     - GPU max texture dimension (default 2048)
 * @property {number}  maxComputeWorkgroups - WebGPU max compute workgroup X size
 * @property {string}  rendererName       - Unmasked GPU renderer string (if available)
 * @property {string}  vendorName         - Unmasked GPU vendor string (if available)
 * @property {boolean} computeShaderSupport - True if WebGPU compute shaders are available
 * @property {number}  drawCallBudget     - Recommended draw call budget per frame
 */

/**
 * Run a one-time GPU capability probe.
 * Safe to call in browser and Node.js (returns conservative defaults in Node.js).
 *
 * @param {HTMLCanvasElement|null} [canvas] - Optional canvas for WebGL context probing
 * @returns {Promise<GPUCapabilities>}
 */
export async function probeGPUCapabilities(canvas = null) {
    const testCanvas = canvas ||
        (typeof document !== "undefined" ? document.createElement("canvas") : null);

    // ── 1. WebGPU Probe ──────────────────────────────────────────────────────
    let hasWebGPU = false;
    let computeShaderSupport = false;
    let maxComputeWorkgroups = 0;

    if (typeof navigator !== "undefined" && navigator.gpu) {
        try {
            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: "high-performance"
            });
            if (adapter) {
                hasWebGPU = true;
                computeShaderSupport = true;
                maxComputeWorkgroups =
                    adapter.limits?.maxComputeWorkgroupSizeX ?? 256;
            }
        } catch {
            hasWebGPU = false;
        }
    }

    // ── 2. WebGL2 / WebGL1 Probe ─────────────────────────────────────────────
    let hasWebGL2 = false;
    let hasWebGL1 = false;
    let maxTextureSize = 2048;
    let rendererName = "Generic GPU";
    let vendorName = "Generic Vendor";

    if (testCanvas) {
        try {
            const gl2 = testCanvas.getContext("webgl2");
            if (gl2) {
                hasWebGL2 = true;
                maxTextureSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE) ?? 4096;
                const dbg = gl2.getExtension("WEBGL_debug_renderer_info");
                if (dbg) {
                    rendererName = gl2.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || rendererName;
                    vendorName   = gl2.getParameter(dbg.UNMASKED_VENDOR_WEBGL)   || vendorName;
                }
            } else {
                const gl1 = testCanvas.getContext("webgl") ||
                            testCanvas.getContext("experimental-webgl");
                if (gl1) {
                    hasWebGL1 = true;
                    maxTextureSize = gl1.getParameter(gl1.MAX_TEXTURE_SIZE) ?? 2048;
                    const dbg = gl1.getExtension("WEBGL_debug_renderer_info");
                    if (dbg) {
                        rendererName = gl1.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || rendererName;
                        vendorName   = gl1.getParameter(dbg.UNMASKED_VENDOR_WEBGL)   || vendorName;
                    }
                }
            }
        } catch {
            // Headless / test environment — use safe defaults
        }
    }

    // ── 3. Determine backend string ───────────────────────────────────────────
    const gpuBackend = hasWebGPU ? "webgpu"
                     : hasWebGL2 ? "webgl2"
                     : hasWebGL1 ? "webgl1"
                     : "none";

    // ── 4. Draw call budget recommendation ───────────────────────────────────
    const drawCallBudget = hasWebGPU ? 180 : (hasWebGL2 ? 100 : 60);

    return {
        hasWebGPU,
        hasWebGL2,
        hasWebGL1,
        gpuBackend,
        maxTextureSize,
        maxComputeWorkgroups,
        rendererName,
        vendorName,
        computeShaderSupport,
        drawCallBudget
    };
}

/**
 * Synchronous convenience accessor for last probed capabilities.
 * Returns null if probeGPUCapabilities() has not yet been awaited.
 *
 * @type {GPUCapabilities|null}
 */
export let lastCapabilities = null;

/**
 * Run the probe and cache the result in lastCapabilities.
 * Subsequent calls return the cached value without re-probing.
 *
 * @param {boolean} [force=false] Force re-probe even if already cached
 * @returns {Promise<GPUCapabilities>}
 */
export async function getOrProbeCapabilities(force = false) {
    if (!lastCapabilities || force) {
        lastCapabilities = await probeGPUCapabilities();
    }
    return lastCapabilities;
}
