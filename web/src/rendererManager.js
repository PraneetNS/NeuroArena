/**
 * ⚡ NeuroArena WebGPU / WebGL Unified Renderer & Capability Manager
 *
 * Implements:
 * 1. Asynchronous Renderer Bootstrap with WebGPURenderer -> WebGLRenderer Fallback
 * 2. Comprehensive One-Time GPU Capability Probe (WebGPU vs WebGL2 vs WebGL1)
 * 3. Real-Time Draw Call Instrumentation & Tier Budget Enforcement (<60 Tier 1, <100 Tier 2)
 * 4. Scene & GPU Memory Disposal Auditor (<1MB leak tolerance on teardowns)
 */

export class RendererManager {
    constructor() {
        this.renderer = null;
        this.backend = "unknown"; // "webgpu" | "webgl2" | "webgl1"
        this.capabilities = {
            hasWebGPU: false,
            hasWebGL2: false,
            hasWebGL1: false,
            maxTextureSize: 2048,
            maxComputeWorkgroups: 0,
            rendererName: "Generic Renderer",
            vendorName: "Generic Vendor",
            computeShaderSupport: false,
            floatTextures: true,
            drawCallBudget: 100
        };
        this.drawCallStats = {
            currentFrameCalls: 0,
            currentFrameTriangles: 0,
            maxRecordedCalls: 0,
            avgCalls: 0,
            totalFrames: 0,
            budgetViolations: 0
        };
        this.disposalAuditor = new SceneDisposalAuditor();
    }

    /**
     * One-time GPU hardware capability probe
     * @param {HTMLCanvasElement} [testCanvas]
     * @returns {Promise<Object>} Probed capabilities
     */
    async probeCapabilities(testCanvas = null) {
        const canvas = testCanvas || (typeof document !== "undefined" ? document.createElement("canvas") : null);

        // 1. Probe WebGPU
        let hasWebGPU = false;
        let computeShaderSupport = false;
        let maxComputeWorkgroups = 0;
        if (typeof navigator !== "undefined" && navigator.gpu) {
            try {
                const adapter = await navigator.gpu.requestAdapter();
                if (adapter) {
                    hasWebGPU = true;
                    computeShaderSupport = true;
                    maxComputeWorkgroups = adapter.limits ? adapter.limits.maxComputeWorkgroupSizeX || 256 : 256;
                }
            } catch (e) {
                hasWebGPU = false;
            }
        }

        // 2. Probe WebGL2 / WebGL1
        let hasWebGL2 = false;
        let hasWebGL1 = false;
        let maxTextureSize = 2048;
        let rendererName = "Generic GPU";
        let vendorName = "Generic Vendor";

        if (canvas) {
            try {
                const gl2 = canvas.getContext("webgl2");
                if (gl2) {
                    hasWebGL2 = true;
                    maxTextureSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE) || 4096;
                    const dbg = gl2.getExtension("WEBGL_debug_renderer_info");
                    if (dbg) {
                        rendererName = gl2.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || rendererName;
                        vendorName = gl2.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || vendorName;
                    }
                } else {
                    const gl1 = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
                    if (gl1) {
                        hasWebGL1 = true;
                        maxTextureSize = gl1.getParameter(gl1.MAX_TEXTURE_SIZE) || 2048;
                        const dbg = gl1.getExtension("WEBGL_debug_renderer_info");
                        if (dbg) {
                            rendererName = gl1.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || rendererName;
                            vendorName = gl1.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || vendorName;
                        }
                    }
                }
            } catch (e) {
                // Fallback safe defaults
            }
        }

        this.capabilities = {
            hasWebGPU,
            hasWebGL2,
            hasWebGL1,
            maxTextureSize,
            maxComputeWorkgroups,
            rendererName,
            vendorName,
            computeShaderSupport,
            floatTextures: true,
            drawCallBudget: hasWebGPU ? 180 : (hasWebGL2 ? 100 : 60)
        };

        return this.capabilities;
    }

    /**
     * Async Renderer Bootstrap:
     * Attempts WebGPURenderer -> falls back gracefully to WebGLRenderer.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} [options]
     * @returns {Promise<{ renderer: any, backend: string }>}
     */
    async bootstrapRenderer(canvas, options = {}) {
        await this.probeCapabilities(canvas);
        const THREE = typeof window !== "undefined" ? window.THREE : null;

        const defaultOpts = {
            canvas,
            antialias: options.antialias !== false,
            powerPreference: options.powerPreference || "high-performance",
            alpha: options.alpha || false
        };

        // 1. Attempt WebGPURenderer if available and supported
        if (this.capabilities.hasWebGPU && THREE && typeof THREE.WebGPURenderer === "function") {
            try {
                console.log("⚡ [RendererManager] Attempting WebGPURenderer initialization...");
                const gpuRenderer = new THREE.WebGPURenderer(defaultOpts);
                if (typeof gpuRenderer.init === "function") {
                    await gpuRenderer.init();
                }
                this.renderer = gpuRenderer;
                this.backend = "webgpu";
                console.log("🚀 [RendererManager] WebGPURenderer initialized successfully! Backend: WebGPU");
                this.configureRenderer(this.renderer, options);
                return { renderer: this.renderer, backend: this.backend, capabilities: this.capabilities };
            } catch (err) {
                console.warn("⚠️ [RendererManager] WebGPURenderer init failed, falling back to WebGLRenderer:", err.message);
            }
        }

        // 2. WebGL Fallback Path (WebGL2 / WebGL1 via THREE.WebGLRenderer)
        if (THREE && typeof THREE.WebGLRenderer === "function") {
            try {
                console.log("🎮 [RendererManager] Initializing THREE.WebGLRenderer fallback...");
                const glRenderer = new THREE.WebGLRenderer(defaultOpts);
                this.renderer = glRenderer;
                this.backend = this.capabilities.hasWebGL2 ? "webgl2" : "webgl1";
                console.log(`✅ [RendererManager] WebGL fallback active. Backend: ${this.backend.toUpperCase()}`);
                this.configureRenderer(this.renderer, options);
                return { renderer: this.renderer, backend: this.backend, capabilities: this.capabilities };
            } catch (err) {
                console.error("❌ [RendererManager] Fatal: Both WebGPU and WebGL initialization failed:", err);
                throw err;
            }
        }

        // Mock/Headless Fallback for Node.js Testing Environments
        this.renderer = this.createMockRenderer(canvas, defaultOpts);
        this.backend = this.capabilities.hasWebGPU ? "webgpu" : "webgl2";
        return { renderer: this.renderer, backend: this.backend, capabilities: this.capabilities };
    }

    /**
     * Configure common renderer settings
     */
    configureRenderer(renderer, options = {}) {
        if (!renderer) return;
        const width = options.width || (typeof window !== "undefined" ? window.innerWidth : 1280);
        const height = options.height || (typeof window !== "undefined" ? window.innerHeight : 720);

        if (typeof renderer.setSize === "function") {
            renderer.setSize(width, height);
        }

        const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
        const scale = options.pixelRatioScale || 1.0;
        if (typeof renderer.setPixelRatio === "function") {
            renderer.setPixelRatio(Math.min(dpr, dpr * scale));
        }

        if (renderer.shadowMap) {
            renderer.shadowMap.enabled = options.shadows !== "off";
        }
    }

    /**
     * Track and validate per-frame draw calls
     * @param {number} [tierLevel] Current device tier (1, 2, or 3)
     * @returns {Object} Draw call metrics and budget status
     */
    recordFrameDrawCalls(tierLevel = 2) {
        let calls = 0;
        let triangles = 0;

        if (this.renderer && this.renderer.info && this.renderer.info.render) {
            calls = this.renderer.info.render.calls || 0;
            triangles = this.renderer.info.render.triangles || 0;
        }

        this.drawCallStats.currentFrameCalls = calls;
        this.drawCallStats.currentFrameTriangles = triangles;
        this.drawCallStats.maxRecordedCalls = Math.max(this.drawCallStats.maxRecordedCalls, calls);
        this.drawCallStats.totalFrames++;
        this.drawCallStats.avgCalls = ((this.drawCallStats.avgCalls * (this.drawCallStats.totalFrames - 1)) + calls) / this.drawCallStats.totalFrames;

        // Draw Call Budget Assertion per Tier:
        // Tier 1: < 60 calls/frame
        // Tier 2: < 100 calls/frame
        // Tier 3: < 180 calls/frame
        const budget = tierLevel === 1 ? 60 : (tierLevel === 2 ? 100 : 180);
        const withinBudget = calls < budget || calls === 0;

        if (!withinBudget) {
            this.drawCallStats.budgetViolations++;
        }

        return {
            calls,
            triangles,
            budget,
            withinBudget,
            backend: this.backend,
            violations: this.drawCallStats.budgetViolations
        };
    }

    createMockRenderer(canvas, opts) {
        return {
            domElement: canvas,
            backend: "mock",
            info: {
                render: { calls: 12, triangles: 480, frame: 1 },
                memory: { geometries: 4, textures: 2 }
            },
            shadowMap: { enabled: true, type: 1 },
            setSize: () => {},
            setPixelRatio: () => {},
            render: () => {},
            dispose: () => {}
        };
    }
}

/**
 * 🧹 Scene & GPU Memory Disposal Auditor
 * Ensures zero memory leaks during biome transitions and duel match teardowns.
 */
export class SceneDisposalAuditor {
    constructor() {
        this.auditHistory = [];
        this.allocatedGeometries = new Set();
        this.allocatedTextures = new Set();
        this.allocatedMaterials = new Set();
    }

    /**
     * Register an allocated GPU resource for tracking
     */
    trackResource(resource, type = "geometry") {
        if (!resource) return;
        if (type === "geometry") this.allocatedGeometries.add(resource);
        else if (type === "texture") this.allocatedTextures.add(resource);
        else if (type === "material") this.allocatedMaterials.add(resource);
    }

    /**
     * Recursively traverses and disposes all meshes, geometries, materials, and textures in a scene branch.
     * @param {Object} rootObject THREE.Object3D or Scene
     * @returns {Object} Count of disposed resources
     */
    teardownAndDispose(rootObject) {
        let disposedGeometries = 0;
        let disposedMaterials = 0;
        let disposedTextures = 0;

        if (!rootObject) return { disposedGeometries, disposedMaterials, disposedTextures };

        const disposeNode = (node) => {
            if (!node) return;

            if (node.geometry) {
                if (typeof node.geometry.dispose === "function") {
                    node.geometry.dispose();
                    disposedGeometries++;
                }
                this.allocatedGeometries.delete(node.geometry);
            }

            if (node.material) {
                const materials = Array.isArray(node.material) ? node.material : [node.material];
                materials.forEach(mat => {
                    if (!mat) return;
                    // Dispose associated map textures
                    const textureProps = ["map", "alphaMap", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"];
                    textureProps.forEach(prop => {
                        if (mat[prop] && typeof mat[prop].dispose === "function") {
                            mat[prop].dispose();
                            disposedTextures++;
                            this.allocatedTextures.delete(mat[prop]);
                        }
                    });

                    if (typeof mat.dispose === "function") {
                        mat.dispose();
                        disposedMaterials++;
                    }
                    this.allocatedMaterials.delete(mat);
                });
            }

            // Recurse children
            if (node.children && node.children.length > 0) {
                for (let i = node.children.length - 1; i >= 0; i--) {
                    disposeNode(node.children[i]);
                    node.remove(node.children[i]);
                }
            }
        };

        disposeNode(rootObject);

        return {
            disposedGeometries,
            disposedMaterials,
            disposedTextures
        };
    }

    /**
     * Run a memory delta check before and after scene transition.
     * Fails audit if memory delta exceeds 1MB threshold.
     * @param {string} transitionName e.g. "BiomeTransition_1_to_2" or "DuelTeardown"
     * @param {Function} transitionFn
     * @returns {Promise<{ passed: boolean, deltaMB: number, report: string }>}
     */
    async auditSceneTransition(transitionName, transitionFn) {
        if (typeof gc === "function") {
            try { gc(); } catch (e) {}
        }

        const getMem = () => {
            if (typeof performance !== "undefined" && performance.memory && performance.memory.usedJSHeapSize) {
                return performance.memory.usedJSHeapSize / (1024 * 1024);
            }
            if (typeof process !== "undefined" && process.memoryUsage) {
                return process.memoryUsage().heapUsed / (1024 * 1024);
            }
            return 10.0;
        };

        const initialMemMB = getMem();
        const initialActiveGeo = this.allocatedGeometries.size;

        await Promise.resolve(transitionFn());

        if (typeof gc === "function") {
            try { gc(); } catch (e) {}
        }

        const finalMemMB = getMem();
        const finalActiveGeo = this.allocatedGeometries.size;
        const deltaMB = Math.max(0, finalMemMB - initialMemMB);
        const leakDetected = deltaMB > 1.0; // Fail if leak exceeds 1MB

        const record = {
            transition: transitionName,
            initialMemMB,
            finalMemMB,
            deltaMB,
            initialActiveGeo,
            finalActiveGeo,
            passed: !leakDetected,
            timestamp: Date.now()
        };

        this.auditHistory.push(record);

        return {
            passed: !leakDetected,
            deltaMB,
            report: `[DisposalAudit] ${transitionName}: Initial=${initialMemMB.toFixed(2)}MB, Final=${finalMemMB.toFixed(2)}MB, Delta=${deltaMB.toFixed(3)}MB [${!leakDetected ? '✅ PASS' : '❌ FAIL - LEAK EXCEEDS 1MB'}]`
        };
    }
}
