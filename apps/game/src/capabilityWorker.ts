/**
 * Web Worker for testing WebGPU availability inside Worker contexts.
 */

self.onmessage = async () => {
  try {
    const nav = self.navigator as any;
    if (!nav || !nav.gpu || typeof nav.gpu.requestAdapter !== 'function') {
      self.postMessage({
        available: false,
        error: 'navigator.gpu is not available in Web Worker scope'
      });
      return;
    }

    const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      self.postMessage({
        available: false,
        error: 'navigator.gpu.requestAdapter() returned null in Web Worker'
      });
      return;
    }

    const info = adapter.info || (await adapter.requestAdapterInfo?.()) || {};
    self.postMessage({
      available: true,
      vendor: info.vendor || 'Unknown',
      architecture: info.architecture || 'Unknown',
      device: info.device || 'Unknown',
      description: info.description || 'WebGPU Adapter in Worker'
    });
  } catch (err: any) {
    self.postMessage({
      available: false,
      error: err?.message || String(err)
    });
  }
};
