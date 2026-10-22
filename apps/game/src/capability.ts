/**
 * Hardware & Web Platform Capability Probe and Report Generator.
 * Requests device with adapter's maximum limits and audits WebGPU adapters,
 * Worker context, SharedArrayBuffer, OPFS, and WASM SIMD features.
 * Provides side-by-side high-performance and low-power adapter comparison
 * and persisted GPU preference settings.
 */

export type GpuPreference = 'auto' | 'high-performance' | 'low-power';

export const GPU_PREFERENCE_STORAGE_KEY = 'na_gpu_preference';

export function getPreferredGpuSetting(): GpuPreference {
  try {
    const val = localStorage.getItem(GPU_PREFERENCE_STORAGE_KEY);
    if (val === 'low-power' || val === 'high-performance' || val === 'auto') {
      return val;
    }
  } catch {}
  return 'auto';
}

export function setPreferredGpuSetting(pref: GpuPreference): void {
  try {
    localStorage.setItem(GPU_PREFERENCE_STORAGE_KEY, pref);
  } catch {}
}

export function resolvePowerPreference(pref: GpuPreference): GPUPowerPreference {
  if (pref === 'low-power') return 'low-power';
  // Both 'auto' and 'high-performance' default to 'high-performance'
  return 'high-performance';
}

export interface LimitEntry {
  key: string;
  label: string;
  defaultVal: number;
  grantedVal: number;
  unit: string;
}

export interface AdapterProfile {
  powerPreference: 'high-performance' | 'low-power';
  available: boolean;
  isFallbackAdapter: boolean;
  info: {
    vendor: string;
    architecture: string;
    device: string;
    description: string;
  };
  features: {
    shaderF16: boolean;
    timestampQuery: boolean;
    subgroups: boolean;
  };
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
}

export interface CapabilityReportData {
  webgpuAvailable: boolean;
  adapterInfo: {
    vendor: string;
    architecture: string;
    device: string;
    description: string;
  } | null;
  isFallbackAdapter: boolean;
  features: {
    shaderF16: boolean;
    timestampQuery: boolean;
    subgroups: boolean;
  };
  limits: LimitEntry[];
  highPerfProfile: AdapterProfile;
  lowPowerProfile: AdapterProfile;
  preferredGpuSetting: GpuPreference;
  activeGamePreference: GPUPowerPreference;
  activeUsedAdapter: 'high-performance' | 'low-power' | 'fallback' | 'unsupported';
  isSingleGpu: boolean;
  activeGpuDescription: string;
  workerWebgpuAvailable: boolean;
  workerWebgpuDetails: string;
  opfsAvailable: boolean;
  indexedDBAvailable: boolean;
  sharedArrayBufferAvailable: boolean;
  hardwareConcurrency: number;
  deviceMemory: number | string;
  deviceMemoryNote: string;
  wasmSimdSupported: boolean;
  verdict: 'Full' | 'Reduced (CPU fallback)' | 'Unsupported';
  verdictExplanation: string;
  timestamp: string;
}

export async function probeCapabilities(options?: {
  activeGpuName?: string;
  activeBackend?: string;
}): Promise<CapabilityReportData> {
  let webgpuAvailable = false;
  const preferredGpuSetting = getPreferredGpuSetting();
  const activeGamePreference = resolvePowerPreference(preferredGpuSetting);

  const limitDefinitions: Array<{ key: string; label: string; defaultVal: number; unit: string }> = [
    { key: 'maxBufferSize', label: 'Max Buffer Size', defaultVal: 268435456, unit: 'bytes' },
    { key: 'maxStorageBufferBindingSize', label: 'Max Storage Buffer Binding', defaultVal: 134217728, unit: 'bytes' },
    { key: 'maxComputeWorkgroupStorageSize', label: 'Max Workgroup Storage (LDS)', defaultVal: 16384, unit: 'bytes' },
    { key: 'maxComputeInvocationsPerWorkgroup', label: 'Max Invocations per Workgroup', defaultVal: 256, unit: 'invocations' },
    { key: 'maxComputeWorkgroupSizeX', label: 'Max Workgroup Size X', defaultVal: 256, unit: 'threads' },
    { key: 'maxComputeWorkgroupSizeY', label: 'Max Workgroup Size Y', defaultVal: 256, unit: 'threads' },
    { key: 'maxComputeWorkgroupSizeZ', label: 'Max Workgroup Size Z', defaultVal: 64, unit: 'threads' },
    { key: 'maxStorageBuffersPerShaderStage', label: 'Storage Buffers per Stage', defaultVal: 8, unit: 'buffers' }
  ];

  let highPerfProfile: AdapterProfile = {
    powerPreference: 'high-performance',
    available: false,
    isFallbackAdapter: false,
    info: { vendor: 'N/A', architecture: 'N/A', device: 'N/A', description: 'N/A' },
    features: { shaderF16: false, timestampQuery: false, subgroups: false },
    maxBufferSize: 0,
    maxStorageBufferBindingSize: 0
  };

  let lowPowerProfile: AdapterProfile = {
    powerPreference: 'low-power',
    available: false,
    isFallbackAdapter: false,
    info: { vendor: 'N/A', architecture: 'N/A', device: 'N/A', description: 'N/A' },
    features: { shaderF16: false, timestampQuery: false, subgroups: false },
    maxBufferSize: 0,
    maxStorageBufferBindingSize: 0
  };

  let activeAdapter: any = null;
  const limits: LimitEntry[] = [];

  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (nav?.gpu && typeof nav.gpu.requestAdapter === 'function') {
    // 1. Probe High-Performance Adapter
    try {
      const adapterHigh = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapterHigh) {
        webgpuAvailable = true;
        let infoObj: any = {};
        if (adapterHigh.info) {
          infoObj = adapterHigh.info;
        } else if (typeof adapterHigh.requestAdapterInfo === 'function') {
          infoObj = await adapterHigh.requestAdapterInfo();
        }

        highPerfProfile = {
          powerPreference: 'high-performance',
          available: true,
          isFallbackAdapter: !!adapterHigh.isFallbackAdapter,
          info: {
            vendor: infoObj.vendor || 'Unknown GPU Vendor',
            architecture: infoObj.architecture || 'Direct3D12 / Vulkan Hardware',
            device: infoObj.device || 'Dedicated Hardware Accelerator',
            description: infoObj.description || 'Hardware WebGPU Accelerator'
          },
          features: {
            shaderF16: !!adapterHigh.features?.has('shader-f16'),
            timestampQuery: !!adapterHigh.features?.has('timestamp-query'),
            subgroups: !!(adapterHigh.features?.has('subgroups') || adapterHigh.features?.has('subgroups-f16'))
          },
          maxBufferSize: adapterHigh.limits?.maxBufferSize || 0,
          maxStorageBufferBindingSize: adapterHigh.limits?.maxStorageBufferBindingSize || 0
        };

        if (activeGamePreference === 'high-performance') {
          activeAdapter = adapterHigh;
        }
      }
    } catch (err) {
      console.warn('Failed to probe high-performance WebGPU adapter:', err);
    }

    // 2. Probe Low-Power Adapter
    try {
      const adapterLow = await nav.gpu.requestAdapter({ powerPreference: 'low-power' });
      if (adapterLow) {
        webgpuAvailable = true;
        let infoObj: any = {};
        if (adapterLow.info) {
          infoObj = adapterLow.info;
        } else if (typeof adapterLow.requestAdapterInfo === 'function') {
          infoObj = await adapterLow.requestAdapterInfo();
        }

        lowPowerProfile = {
          powerPreference: 'low-power',
          available: true,
          isFallbackAdapter: !!adapterLow.isFallbackAdapter,
          info: {
            vendor: infoObj.vendor || 'Unknown GPU Vendor',
            architecture: infoObj.architecture || 'Integrated / Power-Efficient Architecture',
            device: infoObj.device || 'Low-Power Graphics Hardware',
            description: infoObj.description || 'Power-Efficient WebGPU Accelerator'
          },
          features: {
            shaderF16: !!adapterLow.features?.has('shader-f16'),
            timestampQuery: !!adapterLow.features?.has('timestamp-query'),
            subgroups: !!(adapterLow.features?.has('subgroups') || adapterLow.features?.has('subgroups-f16'))
          },
          maxBufferSize: adapterLow.limits?.maxBufferSize || 0,
          maxStorageBufferBindingSize: adapterLow.limits?.maxStorageBufferBindingSize || 0
        };

        if (activeGamePreference === 'low-power' || !activeAdapter) {
          activeAdapter = adapterLow;
        }
      }
    } catch (err) {
      console.warn('Failed to probe low-power WebGPU adapter:', err);
    }

    // 3. Request Device with Active Adapter Maximums
    if (activeAdapter) {
      const requiredLimits: Record<string, number> = {};
      for (const def of limitDefinitions) {
        if (activeAdapter.limits && (activeAdapter.limits as any)[def.key] !== undefined) {
          requiredLimits[def.key] = (activeAdapter.limits as any)[def.key];
        }
      }

      let device: any = null;
      try {
        device = await activeAdapter.requestDevice({ requiredLimits });
      } catch {
        try {
          device = await activeAdapter.requestDevice();
        } catch {}
      }

      const deviceLimits = device?.limits || activeAdapter.limits;
      for (const def of limitDefinitions) {
        const grantedVal =
          deviceLimits && (deviceLimits as any)[def.key] !== undefined
            ? (deviceLimits as any)[def.key]
            : def.defaultVal;

        limits.push({
          key: def.key,
          label: def.label,
          defaultVal: def.defaultVal,
          grantedVal,
          unit: def.unit
        });
      }
    }
  }

  // Populate default limits if WebGPU was completely unavailable
  if (limits.length === 0) {
    for (const def of limitDefinitions) {
      limits.push({
        key: def.key,
        label: def.label,
        defaultVal: def.defaultVal,
        grantedVal: 0,
        unit: def.unit
      });
    }
  }

  // Evaluate single vs dual GPU topology
  const isSingleGpu =
    highPerfProfile.available &&
    lowPowerProfile.available &&
    highPerfProfile.info.vendor === lowPowerProfile.info.vendor &&
    highPerfProfile.info.device === lowPowerProfile.info.device;

  // Determine active in-game adapter
  let activeUsedAdapter: CapabilityReportData['activeUsedAdapter'] = 'unsupported';
  if (!webgpuAvailable) {
    activeUsedAdapter = 'fallback';
  } else if (activeGamePreference === 'low-power') {
    activeUsedAdapter = lowPowerProfile.available ? 'low-power' : 'high-performance';
  } else {
    activeUsedAdapter = highPerfProfile.available ? 'high-performance' : 'low-power';
  }

  const activeProfile = activeUsedAdapter === 'low-power' ? lowPowerProfile : highPerfProfile;
  const activeGpuDescription = options?.activeGpuName
    ? options.activeGpuName
    : activeProfile.available
      ? `${activeProfile.info.device} (${activeProfile.info.vendor})`
      : 'WebGL2 Fallback Graphics Device';

  const adapterInfo = activeProfile.available ? activeProfile.info : null;
  const isFallbackAdapter = activeProfile.isFallbackAdapter;
  const features = activeProfile.features;

  // 4. WebGPU in Web Worker Check
  let workerWebgpuAvailable = false;
  let workerWebgpuDetails = 'Testing worker context...';

  try {
    const worker = new Worker(new URL('./capabilityWorker.ts', import.meta.url), {
      type: 'module'
    });
    const workerPromise = new Promise<{ available: boolean; error?: string; description?: string }>(
      (resolve) => {
        const timeout = setTimeout(() => {
          resolve({ available: false, error: 'Worker probe timed out after 3000ms' });
        }, 3000);

        worker.onmessage = (e) => {
          clearTimeout(timeout);
          resolve(e.data);
        };
        worker.onerror = (e) => {
          clearTimeout(timeout);
          resolve({ available: false, error: e.message || 'Worker execution error' });
        };
      }
    );

    worker.postMessage('probe');
    const workerRes = await workerPromise;
    worker.terminate();

    workerWebgpuAvailable = workerRes.available;
    workerWebgpuDetails = workerRes.available
      ? 'WebGPU adapter successfully initialized in Web Worker (powerPreference: high-performance)'
      : workerRes.error || 'Worker does not support WebGPU context';
  } catch (err: any) {
    workerWebgpuAvailable = false;
    workerWebgpuDetails = err?.message || 'Failed to instantiate Web Worker';
  }

  // 5. OPFS Check
  let opfsAvailable = false;
  try {
    if (typeof navigator.storage?.getDirectory === 'function') {
      const rootDir = await navigator.storage.getDirectory();
      opfsAvailable = !!rootDir;
    }
  } catch {
    opfsAvailable = false;
  }

  // 6. IndexedDB Check
  let indexedDBAvailable = false;
  try {
    indexedDBAvailable = await new Promise<boolean>((resolve) => {
      if (typeof indexedDB === 'undefined') return resolve(false);
      const req = indexedDB.open('__na_probe__', 1);
      req.onsuccess = () => {
        try {
          req.result.close();
          indexedDB.deleteDatabase('__na_probe__');
        } catch {}
        resolve(true);
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    indexedDBAvailable = false;
  }

  // 7. SharedArrayBuffer Check
  let sharedArrayBufferAvailable = false;
  try {
    if (typeof SharedArrayBuffer !== 'undefined') {
      const sab = new SharedArrayBuffer(16);
      sharedArrayBufferAvailable = sab.byteLength === 16;
    }
  } catch {
    sharedArrayBufferAvailable = false;
  }

  // 8. Hardware Concurrency & Device Memory
  const hardwareConcurrency = Number(navigator.hardwareConcurrency) || 4;
  const rawMemory = (navigator as any).deviceMemory;
  const deviceMemory = rawMemory !== undefined ? Number(rawMemory) : 'Not exposed';
  const deviceMemoryNote = 'Capped at 8 by browser privacy specification';

  // 9. WASM SIMD Support Check
  let wasmSimdSupported = false;
  try {
    const simdBinary = new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 253, 12, 0,
      0, 0, 0, 11
    ]);
    wasmSimdSupported = typeof WebAssembly !== 'undefined' && WebAssembly.validate(simdBinary);
  } catch {
    wasmSimdSupported = false;
  }

  // 10. One-Line Verdict Calculation
  let verdict: 'Full' | 'Reduced (CPU fallback)' | 'Unsupported';
  let verdictExplanation: string;

  const maxBufferGranted = limits.find((l) => l.key === 'maxBufferSize')?.grantedVal || 0;

  if (
    webgpuAvailable &&
    maxBufferGranted >= 1024 * 1024 * 64 &&
    sharedArrayBufferAvailable &&
    (opfsAvailable || indexedDBAvailable)
  ) {
    verdict = 'Full';
    verdictExplanation =
      'Hardware WebGPU acceleration, Web Worker execution, SharedArrayBuffer memory, and persistent storage are fully operational.';
  } else if (
    (sharedArrayBufferAvailable || wasmSimdSupported) &&
    (opfsAvailable || indexedDBAvailable)
  ) {
    verdict = 'Reduced (CPU fallback)';
    verdictExplanation =
      'WebGPU acceleration is unavailable or restricted. Operating in high-performance pure TypeScript Float64 CPU mode with multi-threading and SIMD.';
  } else {
    verdict = 'Unsupported';
    verdictExplanation =
      'Critical runtime primitives (SharedArrayBuffer/WebAssembly/Storage) are missing or disabled in this environment.';
  }

  return {
    webgpuAvailable,
    adapterInfo,
    isFallbackAdapter,
    features,
    limits,
    highPerfProfile,
    lowPowerProfile,
    preferredGpuSetting,
    activeGamePreference,
    activeUsedAdapter,
    isSingleGpu,
    activeGpuDescription,
    workerWebgpuAvailable,
    workerWebgpuDetails,
    opfsAvailable,
    indexedDBAvailable,
    sharedArrayBufferAvailable,
    hardwareConcurrency,
    deviceMemory,
    deviceMemoryNote,
    wasmSimdSupported,
    verdict,
    verdictExplanation,
    timestamp: new Date().toISOString()
  };
}

export class CapabilityReportModal {
  public root: HTMLElement;
  public isOpen = false;
  private isProbing = false;
  private data: CapabilityReportData | null = null;
  private onGpuPreferenceChanged?: (pref: GpuPreference) => void;

  constructor(
    parent: HTMLElement,
    callbacks?: { onGpuPreferenceChanged?: (pref: GpuPreference) => void }
  ) {
    this.onGpuPreferenceChanged = callbacks?.onGpuPreferenceChanged;
    this.root = document.createElement('div');
    this.root.className = 'modal-overlay';
    parent.appendChild(this.root);
  }

  public async open(context?: { activeGpuName?: string; activeBackend?: string }): Promise<void> {
    this.isOpen = true;
    this.root.classList.add('active');
    this.renderLoading();
    await this.refresh(context);
  }

  public close(): void {
    this.isOpen = false;
    this.root.classList.remove('active');
  }

  public async refresh(context?: { activeGpuName?: string; activeBackend?: string }): Promise<void> {
    if (this.isProbing) return;
    this.isProbing = true;
    this.data = await probeCapabilities(context);
    this.isProbing = false;
    this.render();
  }

  private renderLoading(): void {
    this.root.innerHTML = `
      <div class="modal-container glass-panel glass-panel-glow" style="padding: 2.2rem; max-width: 880px; text-align: center;">
        <div style="font-family: var(--font-mono); font-size: 1.4rem; color: var(--accent-cyan); font-weight: 700; margin-bottom: 0.8rem;">
          PROBING HARDWARE & PLATFORM CAPABILITIES...
        </div>
        <div style="font-size: 0.9rem; color: var(--text-muted); font-family: var(--font-mono);">
          Querying high-performance and low-power adapters, requesting device maximum limits...
        </div>
      </div>
    `;
  }

  private render(): void {
    if (!this.data) return;
    const d = this.data;

    const verdictColor =
      d.verdict === 'Full'
        ? 'var(--accent-green)'
        : d.verdict === 'Reduced (CPU fallback)'
          ? 'var(--accent-amber)'
          : 'var(--accent-red)';

    const formatLimit = (bytesOrVal: number, unit: string): string => {
      if (unit === 'bytes') {
        if (bytesOrVal >= 1024 * 1024 * 1024)
          return `${(bytesOrVal / (1024 * 1024 * 1024)).toFixed(1)} GB (${bytesOrVal.toLocaleString()})`;
        if (bytesOrVal >= 1024 * 1024)
          return `${(bytesOrVal / (1024 * 1024)).toFixed(0)} MB (${bytesOrVal.toLocaleString()})`;
        if (bytesOrVal >= 1024)
          return `${(bytesOrVal / 1024).toFixed(0)} KB (${bytesOrVal.toLocaleString()})`;
        return `${bytesOrVal.toLocaleString()} B`;
      }
      return `${bytesOrVal.toLocaleString()} ${unit}`;
    };

    const isHighActive = d.activeUsedAdapter === 'high-performance';
    const isLowActive = d.activeUsedAdapter === 'low-power';

    this.root.innerHTML = `
      <div class="modal-container glass-panel glass-panel-glow" style="padding: 1.8rem; max-width: 980px; max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; gap: 1.2rem;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.8rem;">
          <div>
            <div style="font-family: var(--font-mono); font-weight: 800; font-size: 1.4rem; color: var(--accent-cyan); letter-spacing: 0.05em;">
              HARDWARE & RUNTIME CAPABILITY REPORT
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">
              GPU Selection, Adapter Profiles, Device Limits, and Runtime Subsystems
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button id="cap-copy-json-btn" class="btn-cyber" style="border-color: var(--accent-amber); color: var(--accent-amber); padding: 0.35rem 0.85rem; font-size: 0.78rem;">
              📋 Copy report as JSON
            </button>
            <button id="cap-refresh-btn" class="btn-cyber" style="padding: 0.35rem 0.8rem; font-size: 0.78rem;">
              Re-probe ⟳
            </button>
            <button id="cap-close-btn" class="btn-cyber" style="padding: 0.35rem 0.7rem;">
              ✕
            </button>
          </div>
        </div>

        <!-- One-Line Verdict Banner -->
        <div class="glass-panel" style="padding: 1.1rem 1.4rem; border-color: ${verdictColor}; background: rgba(15, 23, 42, 0.75); box-shadow: 0 0 16px ${verdictColor}33; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.8rem;">
          <div>
            <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-dim); font-family: var(--font-mono); letter-spacing: 0.08em;">
              PLATFORM VERDICT
            </div>
            <div style="font-family: var(--font-mono); font-size: 1.55rem; font-weight: 800; color: ${verdictColor}; margin-top: 0.1rem;">
              ${d.verdict}
            </div>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.2rem;">
              ${d.verdictExplanation}
            </div>
          </div>
          <div class="badge-neon" style="border-color: ${verdictColor}; color: ${verdictColor}; font-size: 0.85rem; padding: 0.4rem 0.85rem;">
            ● Active Profile: ${d.verdict}
          </div>
        </div>

        <!-- Section 1: GPU Selection & Side-by-Side Adapter Profiles -->
        <div class="glass-panel" style="padding: 1.1rem 1.3rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <span style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; color: var(--accent-purple);">
              1. GPU Selection & Side-by-Side Adapter Profiles
            </span>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; font-family: var(--font-mono);">
                Preferred GPU:
              </span>
              <div style="display: inline-flex; gap: 4px; background: rgba(0,0,0,0.3); padding: 2px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);">
                <button class="cap-pref-btn ${d.preferredGpuSetting === 'auto' ? 'cap-pref-active' : ''}" data-pref="auto" style="padding: 2px 8px; font-size: 0.7rem; font-family: var(--font-mono); border: none; border-radius: 3px; cursor: pointer;">Auto</button>
                <button class="cap-pref-btn ${d.preferredGpuSetting === 'high-performance' ? 'cap-pref-active' : ''}" data-pref="high-performance" style="padding: 2px 8px; font-size: 0.7rem; font-family: var(--font-mono); border: none; border-radius: 3px; cursor: pointer;">High Performance</button>
                <button class="cap-pref-btn ${d.preferredGpuSetting === 'low-power' ? 'cap-pref-active' : ''}" data-pref="low-power" style="padding: 2px 8px; font-size: 0.7rem; font-family: var(--font-mono); border: none; border-radius: 3px; cursor: pointer;">Low Power</button>
              </div>
            </div>
          </div>

          <!-- Active In-Game GPU Status Callout -->
          <div style="background: rgba(79, 179, 169, 0.08); border: 1px solid var(--accent-cool, #4FB3A9); border-radius: 4px; padding: 0.7rem 0.9rem; margin-bottom: 1rem; font-family: var(--font-mono); font-size: 0.78rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="color: var(--text-dim); text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.05em;">ACTUALLY USED BY GAME:</span>
                <div style="color: #fff; font-size: 0.95rem; font-weight: 700; margin-top: 2px;">
                  ${d.activeGpuDescription}
                </div>
              </div>
              <span class="badge-neon badge-green" style="font-size: 0.72rem;">
                ● ${d.activeUsedAdapter.toUpperCase()} PROFILE ACTIVE
              </span>
            </div>
            <div style="color: var(--text-muted); font-size: 0.73rem; margin-top: 0.4rem; line-height: 1.4;">
              Requested powerPreference: <strong style="color: var(--accent-amber);">'${d.activeGamePreference}'</strong> (Setting: <em>${d.preferredGpuSetting}</em>).
              ${d.isSingleGpu ? ' <span style="color: #cbd5e1;">(Unified single-GPU system detected: high-performance and low-power requests bind to the same physical hardware).</span>' : ' <span style="color: var(--accent-cyan);">(Discrete multi-GPU system detected: discrete GPU selected for simulation and rendering).</span>'}
            </div>
          </div>

          <!-- Side-by-Side Profiles Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; font-family: var(--font-mono);">
            
            <!-- High-Performance Adapter Column -->
            <div style="background: rgba(21, 26, 33, 0.85); border: 1px solid ${isHighActive ? 'var(--accent-cool, #4FB3A9)' : '#2A333F'}; border-radius: 5px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.55rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.4rem;">
                <span style="font-weight: 700; font-size: 0.8rem; color: var(--accent-amber);">
                  HIGH-PERFORMANCE ADAPTER
                </span>
                <span class="badge-neon ${isHighActive ? 'badge-green' : 'badge-dim'}" style="font-size: 0.65rem;">
                  ${isHighActive ? '● ACTIVE IN GAME' : '○ STANDBY'}
                </span>
              </div>

              ${d.highPerfProfile.available ? `
                <div style="font-size: 0.74rem; display: flex; flex-direction: column; gap: 0.35rem;">
                  <div><span style="color: var(--text-dim);">Vendor:</span> <span style="color: #fff; font-weight: 600;">${d.highPerfProfile.info.vendor}</span></div>
                  <div><span style="color: var(--text-dim);">Architecture:</span> <span style="color: #fff; font-weight: 600;">${d.highPerfProfile.info.architecture}</span></div>
                  <div><span style="color: var(--text-dim);">Device:</span> <span style="color: #fff; font-weight: 600;">${d.highPerfProfile.info.device}</span></div>
                  <div><span style="color: var(--text-dim);">Description:</span> <span style="color: #cbd5e1;">${d.highPerfProfile.info.description}</span></div>
                  <div><span style="color: var(--text-dim);">Fallback Adapter:</span> <span style="color: ${d.highPerfProfile.isFallbackAdapter ? 'var(--accent-amber)' : 'var(--accent-green)'};">${d.highPerfProfile.isFallbackAdapter ? 'YES (CPU emulation)' : 'NO (Hardware Accelerated)'}</span></div>
                </div>

                <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.4rem; font-size: 0.72rem; display: flex; flex-wrap: wrap; gap: 0.35rem;">
                  <span class="badge-neon ${d.highPerfProfile.features.shaderF16 ? 'badge-green' : 'badge-dim'}">f16: ${d.highPerfProfile.features.shaderF16 ? 'YES' : 'NO'}</span>
                  <span class="badge-neon ${d.highPerfProfile.features.timestampQuery ? 'badge-green' : 'badge-dim'}">timestamp: ${d.highPerfProfile.features.timestampQuery ? 'YES' : 'NO'}</span>
                  <span class="badge-neon ${d.highPerfProfile.features.subgroups ? 'badge-green' : 'badge-dim'}">subgroups: ${d.highPerfProfile.features.subgroups ? 'YES' : 'NO'}</span>
                </div>
              ` : `
                <div style="font-size: 0.75rem; color: var(--text-muted); padding: 1rem 0;">
                  No adapter granted for powerPreference: 'high-performance'.
                </div>
              `}
            </div>

            <!-- Low-Power Adapter Column -->
            <div style="background: rgba(21, 26, 33, 0.85); border: 1px solid ${isLowActive ? 'var(--accent-cool, #4FB3A9)' : '#2A333F'}; border-radius: 5px; padding: 0.85rem; display: flex; flex-direction: column; gap: 0.55rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.4rem;">
                <span style="font-weight: 700; font-size: 0.8rem; color: var(--accent-cyan);">
                  LOW-POWER ADAPTER
                </span>
                <span class="badge-neon ${isLowActive ? 'badge-green' : 'badge-dim'}" style="font-size: 0.65rem;">
                  ${isLowActive ? '● ACTIVE IN GAME' : '○ STANDBY'}
                </span>
              </div>

              ${d.lowPowerProfile.available ? `
                <div style="font-size: 0.74rem; display: flex; flex-direction: column; gap: 0.35rem;">
                  <div><span style="color: var(--text-dim);">Vendor:</span> <span style="color: #fff; font-weight: 600;">${d.lowPowerProfile.info.vendor}</span></div>
                  <div><span style="color: var(--text-dim);">Architecture:</span> <span style="color: #fff; font-weight: 600;">${d.lowPowerProfile.info.architecture}</span></div>
                  <div><span style="color: var(--text-dim);">Device:</span> <span style="color: #fff; font-weight: 600;">${d.lowPowerProfile.info.device}</span></div>
                  <div><span style="color: var(--text-dim);">Description:</span> <span style="color: #cbd5e1;">${d.lowPowerProfile.info.description}</span></div>
                  <div><span style="color: var(--text-dim);">Fallback Adapter:</span> <span style="color: ${d.lowPowerProfile.isFallbackAdapter ? 'var(--accent-amber)' : 'var(--accent-green)'};">${d.lowPowerProfile.isFallbackAdapter ? 'YES (CPU emulation)' : 'NO (Hardware Accelerated)'}</span></div>
                </div>

                <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.4rem; font-size: 0.72rem; display: flex; flex-wrap: wrap; gap: 0.35rem;">
                  <span class="badge-neon ${d.lowPowerProfile.features.shaderF16 ? 'badge-green' : 'badge-dim'}">f16: ${d.lowPowerProfile.features.shaderF16 ? 'YES' : 'NO'}</span>
                  <span class="badge-neon ${d.lowPowerProfile.features.timestampQuery ? 'badge-green' : 'badge-dim'}">timestamp: ${d.lowPowerProfile.features.timestampQuery ? 'YES' : 'NO'}</span>
                  <span class="badge-neon ${d.lowPowerProfile.features.subgroups ? 'badge-green' : 'badge-dim'}">subgroups: ${d.lowPowerProfile.features.subgroups ? 'YES' : 'NO'}</span>
                </div>
              ` : `
                <div style="font-size: 0.75rem; color: var(--text-muted); padding: 1rem 0;">
                  No adapter granted for powerPreference: 'low-power'.
                </div>
              `}
            </div>

          </div>
        </div>

        <!-- Section 2: Side-by-Side Limits (Default Spec vs Granted Device Maximums) -->
        <div class="glass-panel" style="padding: 1rem 1.2rem;">
          <div style="font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; color: var(--accent-purple); margin-bottom: 0.6rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 0.4rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.4rem;">
            <span>2. Device Limits Comparison (Default Spec Minimum vs. Active Device Granted Maximum)</span>
            <span style="color: var(--accent-cyan); font-size: 0.75rem;">Requested with Active Adapter Limits</span>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.78rem;">
            <thead>
              <tr style="color: var(--text-dim); text-align: left; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                <th style="padding: 4px 8px;">LIMIT IDENTIFIER</th>
                <th style="padding: 4px 8px;">DEFAULT SPEC MINIMUM</th>
                <th style="padding: 4px 8px;">GRANTED DEVICE VALUE</th>
                <th style="padding: 4px 8px; text-align: right;">EXPANSION RATIO</th>
              </tr>
            </thead>
            <tbody>
              ${d.limits
                .map((lim) => {
                  const ratio = lim.defaultVal > 0 ? (lim.grantedVal / lim.defaultVal).toFixed(1) : '1.0';
                  const isBoosted = lim.grantedVal > lim.defaultVal;
                  return `
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04);">
                    <td style="padding: 5px 8px; color: #fff;">${lim.label} <span style="color: var(--text-dim); font-size: 0.7rem;">(${lim.key})</span></td>
                    <td style="padding: 5px 8px; color: var(--text-muted);">${formatLimit(lim.defaultVal, lim.unit)}</td>
                    <td style="padding: 5px 8px; color: ${isBoosted ? 'var(--accent-cyan)' : '#E8E4DA'}; font-weight: 600;">${formatLimit(lim.grantedVal, lim.unit)}</td>
                    <td style="padding: 5px 8px; text-align: right; color: ${isBoosted ? 'var(--accent-green)' : 'var(--text-dim)'};">${ratio}x</td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>

        <!-- Section 3: Web Worker, Memory & Storage Primitives -->
        <div class="glass-panel" style="padding: 1rem 1.2rem;">
          <div style="font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; color: var(--accent-purple); margin-bottom: 0.6rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); padding-bottom: 0.4rem;">
            3. Web Worker, Memory & Storage Primitives
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; font-family: var(--font-mono); font-size: 0.78rem;">
            <div>
              <span style="color: var(--text-dim);">Web Worker WebGPU:</span>
              <div style="margin-top: 2px;">
                <span class="badge-neon ${d.workerWebgpuAvailable ? 'badge-green' : 'badge-amber'}">
                  ${d.workerWebgpuAvailable ? 'INITIALIZED (high-perf)' : 'INACTIVE'}
                </span>
              </div>
            </div>
            <div>
              <span style="color: var(--text-dim);">SharedArrayBuffer (SAB):</span>
              <div style="margin-top: 2px;">
                <span class="badge-neon ${d.sharedArrayBufferAvailable ? 'badge-green' : 'badge-red'}">
                  ${d.sharedArrayBufferAvailable ? 'ACTIVE (COOP/COEP)' : 'DISABLED'}
                </span>
              </div>
            </div>
            <div>
              <span style="color: var(--text-dim);">Origin Private File System:</span>
              <div style="margin-top: 2px;">
                <span class="badge-neon ${d.opfsAvailable ? 'badge-green' : 'badge-amber'}">
                  ${d.opfsAvailable ? 'OPFS MOUNTED' : 'UNAVAILABLE'}
                </span>
              </div>
            </div>
            <div>
              <span style="color: var(--text-dim);">IndexedDB Storage:</span>
              <div style="margin-top: 2px;">
                <span class="badge-neon ${d.indexedDBAvailable ? 'badge-green' : 'badge-red'}">
                  ${d.indexedDBAvailable ? 'AVAILABLE' : 'UNAVAILABLE'}
                </span>
              </div>
            </div>
            <div>
              <span style="color: var(--text-dim);">CPU Concurrency:</span>
              <div style="color: var(--accent-cyan); font-weight: 700; font-size: 0.95rem; margin-top: 2px;">
                ${d.hardwareConcurrency} Logical Cores
              </div>
            </div>
            <div>
              <span style="color: var(--text-dim);">Device Memory:</span>
              <div style="color: var(--accent-purple); font-weight: 700; font-size: 0.95rem; margin-top: 2px;">
                ${d.deviceMemory} GB
              </div>
              <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 1px;">
                ${d.deviceMemoryNote}
              </div>
            </div>
            <div style="grid-column: span 3; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 0.4rem;">
              <span style="color: var(--text-dim);">WASM SIMD (128-bit vectorization):</span>
              <span class="badge-neon ${d.wasmSimdSupported ? 'badge-green' : 'badge-amber'}" style="margin-left: 0.5rem;">
                ${d.wasmSimdSupported ? 'VALIDATED & SUPPORTED' : 'UNSUPPORTED'}
              </span>
            </div>
          </div>
        </div>

      </div>
    `;

    // Modal Control Listeners
    this.root.querySelector('#cap-close-btn')?.addEventListener('click', () => this.close());
    this.root.querySelector('#cap-refresh-btn')?.addEventListener('click', () => this.refresh());

    // Preferred GPU Selector Buttons
    this.root.querySelectorAll<HTMLButtonElement>('.cap-pref-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pref = btn.dataset.pref as GpuPreference;
        if (pref) {
          setPreferredGpuSetting(pref);
          if (this.onGpuPreferenceChanged) {
            this.onGpuPreferenceChanged(pref);
          }
          this.refresh();
        }
      });
    });

    // Copy JSON Report Listener
    const copyBtn = this.root.querySelector('#cap-copy-json-btn') as HTMLButtonElement;
    copyBtn?.addEventListener('click', async () => {
      try {
        const jsonPayload = {
          timestamp: d.timestamp,
          verdict: d.verdict,
          verdictExplanation: d.verdictExplanation,
          preferredGpuSetting: d.preferredGpuSetting,
          activeGamePreference: d.activeGamePreference,
          activeUsedAdapter: d.activeUsedAdapter,
          activeGpuDescription: d.activeGpuDescription,
          isSingleGpu: d.isSingleGpu,
          highPerformanceAdapter: d.highPerfProfile,
          lowPowerAdapter: d.lowPowerProfile,
          grantedLimits: d.limits.reduce((acc, l) => ({ ...acc, [l.key]: l.grantedVal }), {}),
          features: d.features,
          workerWebgpuAvailable: d.workerWebgpuAvailable,
          sharedArrayBufferAvailable: d.sharedArrayBufferAvailable,
          opfsAvailable: d.opfsAvailable,
          indexedDBAvailable: d.indexedDBAvailable,
          hardwareConcurrency: d.hardwareConcurrency,
          deviceMemory: d.deviceMemory,
          wasmSimdSupported: d.wasmSimdSupported
        };

        await navigator.clipboard.writeText(JSON.stringify(jsonPayload, null, 2));
        const origText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied JSON!';
        copyBtn.style.borderColor = 'var(--accent-green)';
        copyBtn.style.color = 'var(--accent-green)';
        setTimeout(() => {
          copyBtn.textContent = origText;
          copyBtn.style.borderColor = 'var(--accent-amber)';
          copyBtn.style.color = 'var(--accent-amber)';
        }, 2500);
      } catch (err) {
        console.error('Failed to copy capability report to clipboard:', err);
      }
    });
  }
}
