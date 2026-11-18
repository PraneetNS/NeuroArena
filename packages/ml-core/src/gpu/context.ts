/**
 * WebGPU Execution Context.
 * Requests high-performance adapter, sets maximal limits, enables optional features,
 * and manages device lifecycle & device.lost events.
 */

export class GpuContext {
  public adapter: GPUAdapter;
  public device: GPUDevice;
  public onDeviceLost?: (info: GPUDeviceLostInfo) => void;

  private constructor(
    adapter: GPUAdapter,
    device: GPUDevice,
    onDeviceLost?: (info: GPUDeviceLostInfo) => void
  ) {
    this.adapter = adapter;
    this.device = device;
    this.onDeviceLost = onDeviceLost;
  }

  public static async create(
    onDeviceLost?: (info: GPUDeviceLostInfo) => void
  ): Promise<GpuContext> {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      throw new Error('WebGPU is not supported in this environment (navigator.gpu undefined).');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    });

    if (!adapter) {
      throw new Error('Failed to acquire WebGPU adapter with powerPreference: high-performance');
    }

    // Enable optional features if present
    const requiredFeatures: GPUFeatureName[] = [];
    if (adapter.features.has('shader-f16')) {
      requiredFeatures.push('shader-f16');
    }
    if (adapter.features.has('timestamp-query')) {
      requiredFeatures.push('timestamp-query');
    }

    // Request maximum limits provided by adapter
    const requiredLimits: Record<string, number> = {};
    const adapterLimits = adapter.limits as unknown as Record<string, number>;
    const targetLimits = [
      'maxBufferSize',
      'maxStorageBufferBindingSize',
      'maxComputeWorkgroupStorageSize',
      'maxComputeInvocationsPerWorkgroup',
      'maxComputeWorkgroupSizeX',
      'maxComputeWorkgroupSizeY',
      'maxComputeWorkgroupSizeZ',
      'maxStorageBuffersPerShaderStage'
    ];

    for (const key of targetLimits) {
      if (typeof adapterLimits[key] === 'number') {
        requiredLimits[key] = adapterLimits[key];
      }
    }

    const device = await adapter.requestDevice({
      requiredFeatures,
      requiredLimits
    });

    // Handle device.lost by emitting callback
    device.lost.then((info: GPUDeviceLostInfo) => {
      console.warn(`[GpuContext] WebGPU Device Lost (${info.reason}): ${info.message}`);
      if (onDeviceLost) {
        onDeviceLost(info);
      }
    });

    return new GpuContext(adapter, device, onDeviceLost);
  }

  public createStorageBuffer(sizeBytes: number, label?: string): GPUBuffer {
    return this.device.createBuffer({
      label,
      size: Math.max(16, (sizeBytes + 3) & ~3), // Ensure 4-byte multiple
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
  }

  public createUniformBuffer(sizeBytes: number, label?: string): GPUBuffer {
    return this.device.createBuffer({
      label,
      size: Math.max(16, (sizeBytes + 15) & ~15), // Ensure 16-byte multiple
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  public writeBuffer(buffer: GPUBuffer, data: BufferSource, offset = 0): void {
    this.device.queue.writeBuffer(buffer, offset, data);
  }

  /**
   * Reads data back from a GPUBuffer asynchronously using a staging buffer.
   */
  public async readBufferFloat32(buffer: GPUBuffer, count: number): Promise<Float32Array> {
    const sizeBytes = count * 4;
    const staging = this.device.createBuffer({
      size: sizeBytes,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });

    const encoder = this.device.createCommandEncoder();
    encoder.copyBufferToBuffer(buffer, 0, staging, 0, sizeBytes);
    this.device.queue.submit([encoder.finish()]);

    await staging.mapAsync(GPUMapMode.READ, 0, sizeBytes);
    const mapped = new Float32Array(staging.getMappedRange(0, sizeBytes).slice(0));
    staging.unmap();
    staging.destroy();
    return mapped;
  }

  public destroy(): void {
    this.device.destroy();
  }
}
