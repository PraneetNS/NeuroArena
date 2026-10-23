/**
 * WebGPU GPT Model Implementation (Float32).
 * Mirrors the pure CPU Float64 reference model architecture exactly.
 *
 * - Parameters and Gradients stored in flat Float32Array storage buffers.
 * - Single offset table matching the CPU reference model.
 * - Compiles all compute pipelines and allocates all bind groups upfront at construction.
 * - Zero GPU allocations inside forward, backward, or optimization steps.
 * - Complete analytical backward pass + GPU-side global norm clipping + fused AdamW optimizer.
 */

import { GPTConfig, ParamMeta } from '../types.js';
import { Xoshiro128StarStar } from '../rng.js';
import { GpuContext } from './context.js';
import { createPipelines, GpuPipelines } from './pipelines.js';

export interface GpuForwardResult {
  loss: number | null;
  logits?: Float32Array;
  blockOutputs?: Float32Array[];
}

export interface GpuForwardOptions {
  readbackLoss?: boolean;
  readbackLogits?: boolean;
  readbackBlockOutputs?: boolean;
}

export class GpuModel {
  public config: GPTConfig;
  public context: GpuContext;
  public pipelines: GpuPipelines;
  public B: number;
  public T: number;
  public totalParams: number;

  // Parameters, Gradients & Optimizer State Buffers
  public paramsBuffer: GPUBuffer;
  public gradsBuffer: GPUBuffer;
  public mBuffer: GPUBuffer;
  public vBuffer: GPUBuffer;
  public decayMaskBuffer: GPUBuffer;
  public partialNormsBuffer: GPUBuffer;
  public normClipBuffer: GPUBuffer; // [0] = globalNorm, [1] = clipScale

  public offsets: Map<string, ParamMeta> = new Map();
  public paramList: ParamMeta[] = [];

  // Activation & Forward Buffers
  public inputIdsBuffer: GPUBuffer;
  public targetsBuffer: GPUBuffer;
  public embeddingsBuffer: GPUBuffer;

  public blockBuffers: Array<{
    ln1Out: GPUBuffer;
    ln1MeanRstd: GPUBuffer;
    q: GPUBuffer;
    k: GPUBuffer;
    v: GPUBuffer;
    probs: GPUBuffer;
    attnOut: GPUBuffer;
    attnProj: GPUBuffer;
    mid: GPUBuffer;
    ln2Out: GPUBuffer;
    ln2MeanRstd: GPUBuffer;
    fcOut: GPUBuffer;
    geluOut: GPUBuffer;
    mlpProj: GPUBuffer;
    blockOut: GPUBuffer;

    // Backward intermediate buffers
    dAttnOut: GPUBuffer;
    dS: GPUBuffer;
    dQ: GPUBuffer;
    dK: GPUBuffer;
    dV: GPUBuffer;
    dLn1Out: GPUBuffer;
    dBlockInput: GPUBuffer;
    dGeluOut: GPUBuffer;
    dFcOut: GPUBuffer;
    dLn2Out: GPUBuffer;
    dMid: GPUBuffer;
  }> = [];

  public finalLnOutBuffer: GPUBuffer;
  public finalLnMeanRstd: GPUBuffer;
  public logitsBuffer: GPUBuffer;
  public rowLossBuffer: GPUBuffer;
  public dlogitsBuffer: GPUBuffer;
  public meanLossBuffer: GPUBuffer;

  // Backward state buffers
  public dFinalLnOutBuffer: GPUBuffer;
  public dHiddenBuffer: GPUBuffer;

  // Forward BindGroups
  private embeddingBindGroup: GPUBindGroup;
  private blockForwardBindGroups: Array<{
    ln1: GPUBindGroup;
    wq: GPUBindGroup;
    wk: GPUBindGroup;
    wv: GPUBindGroup;
    attentionScores: GPUBindGroup;
    attentionValue: GPUBindGroup;
    wo: GPUBindGroup;
    midResidual: GPUBindGroup;
    ln2: GPUBindGroup;
    w1: GPUBindGroup;
    gelu: GPUBindGroup;
    w2: GPUBindGroup;
    blockResidual: GPUBindGroup;
  }> = [];
  private finalLnBindGroup: GPUBindGroup;
  private tiedHeadBindGroup: GPUBindGroup;
  private crossEntropyBindGroup: GPUBindGroup;
  private reduceSumBindGroup: GPUBindGroup;

  // Backward BindGroups
  private zeroGradsBindGroup: GPUBindGroup;
  private tiedHeadBwdXBindGroup: GPUBindGroup;
  private tiedHeadBwdWBindGroup: GPUBindGroup;
  private finalLnBwdDxBindGroup: GPUBindGroup;
  private finalLnBwdParamsBindGroup: GPUBindGroup;
  private blockBackwardBindGroups: Array<{
    w2BwdW: GPUBindGroup;
    b2Bwd: GPUBindGroup;
    w2BwdX: GPUBindGroup;
    geluBwd: GPUBindGroup;
    w1BwdW: GPUBindGroup;
    b1Bwd: GPUBindGroup;
    w1BwdX: GPUBindGroup;
    ln2BwdDx: GPUBindGroup;
    ln2BwdParams: GPUBindGroup;
    woBwdW: GPUBindGroup;
    boBwd: GPUBindGroup;
    woBwdX: GPUBindGroup;
    attnBwdQ: GPUBindGroup;
    attnBwdKV: GPUBindGroup;
    wqBwdW: GPUBindGroup;
    bqBwd: GPUBindGroup;
    wkBwdW: GPUBindGroup;
    bkBwd: GPUBindGroup;
    wvBwdW: GPUBindGroup;
    bvBwd: GPUBindGroup;
    wqBwdX: GPUBindGroup;
    wkBwdX: GPUBindGroup;
    wvBwdX: GPUBindGroup;
    ln1BwdDx: GPUBindGroup;
    ln1BwdParams: GPUBindGroup;
  }> = [];
  private embeddingBwdBindGroup: GPUBindGroup;
  private posEmbBwdBindGroup: GPUBindGroup;

  // Optimizer BindGroups & Uniforms
  private gradNormBindGroup: GPUBindGroup;
  private reduceNormBindGroup: GPUBindGroup;
  private reduceNormUniformBuffer: GPUBuffer;
  private adamwBindGroup: GPUBindGroup;
  private adamwUniformBuffer: GPUBuffer;
  private numPartials: number;

  // Diagnostics Buffers & BindGroups
  public diagnosticsBuffer: GPUBuffer;
  public static readonly DIAG_LAYER_STRIDE = 32;
  private layerDiagBindGroups: GPUBindGroup[] = [];
  private layerDiagUniformBuffers: GPUBuffer[] = [];
  private globalDiagBindGroup: GPUBindGroup;
  private globalDiagUniformBuffer: GPUBuffer;

  constructor(
    context: GpuContext,
    config: GPTConfig,
    cpuParamsFlat?: Float64Array | Float32Array,
    B: number = 1,
    T: number = config.contextLen,
    sharedParamsBuffer?: GPUBuffer
  ) {
    this.context = context;
    this.config = config;
    this.B = B;
    this.T = T;

    const device = context.device;
    this.pipelines = createPipelines(device);

    const { vocabSize, dModel, nLayers, dFF, contextLen } = config;
    const headDim = dModel / config.nHeads;
    const M = B * T;

    // 1. Build Parameter Offset Table & Metadata (identical order to CPU model)
    this.offsets = new Map();
    this.paramList = [];
    let currentOffset = 0;

    const registerParam = (name: string, shape: number[], decay: boolean) => {
      const size = shape.reduce((a, b) => a * b, 1);
      const meta: ParamMeta = { name, offset: currentOffset, size, shape, decay };
      this.offsets.set(name, meta);
      this.paramList.push(meta);
      currentOffset += size;
    };

    registerParam('tokEmb', [vocabSize, dModel], false);
    registerParam('posEmb', [contextLen, dModel], false);
    for (let l = 0; l < nLayers; l++) {
      registerParam(`blocks.${l}.ln1.g`, [dModel], false);
      registerParam(`blocks.${l}.ln1.b`, [dModel], false);
      registerParam(`blocks.${l}.Wq`, [dModel, dModel], true);
      registerParam(`blocks.${l}.bq`, [dModel], false);
      registerParam(`blocks.${l}.Wk`, [dModel, dModel], true);
      registerParam(`blocks.${l}.bk`, [dModel], false);
      registerParam(`blocks.${l}.Wv`, [dModel, dModel], true);
      registerParam(`blocks.${l}.bv`, [dModel], false);
      registerParam(`blocks.${l}.Wo`, [dModel, dModel], true);
      registerParam(`blocks.${l}.bo`, [dModel], false);
      registerParam(`blocks.${l}.ln2.g`, [dModel], false);
      registerParam(`blocks.${l}.ln2.b`, [dModel], false);
      registerParam(`blocks.${l}.W1`, [dModel, dFF], true);
      registerParam(`blocks.${l}.b1`, [dFF], false);
      registerParam(`blocks.${l}.W2`, [dFF, dModel], true);
      registerParam(`blocks.${l}.b2`, [dModel], false);
    }
    registerParam('lnf.g', [dModel], false);
    registerParam('lnf.b', [dModel], false);
    this.totalParams = currentOffset;

    // 2. Allocate Parameters, Gradients, and Optimizer Buffers
    if (sharedParamsBuffer) {
      this.paramsBuffer = sharedParamsBuffer;
    } else {
      const f32Params = new Float32Array(this.totalParams);
      if (cpuParamsFlat) {
        for (let i = 0; i < this.totalParams; i++) {
          f32Params[i] = cpuParamsFlat[i];
        }
      } else {
        // Deterministic GPT initialization matching TinyGPT
        const rng = new Xoshiro128StarStar(42);
        const residualScale = 1.0 / Math.sqrt(2.0 * nLayers);
        for (const meta of this.paramList) {
          const offset = meta.offset;
          const size = meta.size;
          if (meta.name.endsWith('.g') || meta.name.endsWith('_gamma')) {
            f32Params.fill(1.0, offset, offset + size);
          } else if (
            meta.name.endsWith('.b') ||
            meta.name.endsWith('_bias') ||
            meta.name.endsWith('.bq') ||
            meta.name.endsWith('.bk') ||
            meta.name.endsWith('.bv') ||
            meta.name.endsWith('.bo') ||
            meta.name.endsWith('.b1') ||
            meta.name.endsWith('.b2')
          ) {
            f32Params.fill(0.0, offset, offset + size);
          } else if (meta.name.endsWith('.Wo') || meta.name.endsWith('.W2')) {
            const std = 0.02 * residualScale;
            for (let i = offset; i < offset + size; i++) {
              f32Params[i] = rng.nextNormal(0, std);
            }
          } else {
            for (let i = offset; i < offset + size; i++) {
              f32Params[i] = rng.nextNormal(0, 0.02);
            }
          }
        }
      }
      this.paramsBuffer = context.createStorageBuffer(this.totalParams * 4, 'paramsBuffer');
      device.queue.writeBuffer(this.paramsBuffer, 0, f32Params);
    }

    this.gradsBuffer = context.createStorageBuffer(this.totalParams * 4, 'gradsBuffer');
    this.mBuffer = context.createStorageBuffer(this.totalParams * 4, 'adamw_m');
    this.vBuffer = context.createStorageBuffer(this.totalParams * 4, 'adamw_v');

    // Build decay mask
    const decayMask = new Uint32Array(this.totalParams);
    for (const p of this.paramList) {
      if (p.decay) {
        for (let i = p.offset; i < p.offset + p.size; i++) {
          decayMask[i] = 1;
        }
      }
    }
    this.decayMaskBuffer = context.createStorageBuffer(this.totalParams * 4, 'decayMask');
    device.queue.writeBuffer(this.decayMaskBuffer, 0, decayMask);

    // Global gradient norm reduction buffers
    const numPartials = Math.min(1024, Math.ceil(this.totalParams / 256));
    this.numPartials = numPartials;
    this.partialNormsBuffer = context.createStorageBuffer(numPartials * 4, 'partialNorms');
    this.normClipBuffer = context.createStorageBuffer(16, 'normClip'); // [0]=globalNorm, [1]=clipScale

    // 3. Allocate Activation & Gradient Buffers for Batch (B, T)
    this.inputIdsBuffer = context.createStorageBuffer(M * 4, 'inputIds');
    this.targetsBuffer = context.createStorageBuffer(M * 4, 'targets');
    this.embeddingsBuffer = context.createStorageBuffer(M * dModel * 4, 'embeddings');

    for (let l = 0; l < nLayers; l++) {
      this.blockBuffers.push({
        ln1Out: context.createStorageBuffer(M * dModel * 4, `b${l}_ln1Out`),
        ln1MeanRstd: context.createStorageBuffer(M * 2 * 4, `b${l}_ln1MeanRstd`),
        q: context.createStorageBuffer(M * dModel * 4, `b${l}_q`),
        k: context.createStorageBuffer(M * dModel * 4, `b${l}_k`),
        v: context.createStorageBuffer(M * dModel * 4, `b${l}_v`),
        probs: context.createStorageBuffer(B * config.nHeads * T * T * 4, `b${l}_probs`),
        attnOut: context.createStorageBuffer(M * dModel * 4, `b${l}_attnOut`),
        attnProj: context.createStorageBuffer(M * dModel * 4, `b${l}_attnProj`),
        mid: context.createStorageBuffer(M * dModel * 4, `b${l}_mid`),
        ln2Out: context.createStorageBuffer(M * dModel * 4, `b${l}_ln2Out`),
        ln2MeanRstd: context.createStorageBuffer(M * 2 * 4, `b${l}_ln2MeanRstd`),
        fcOut: context.createStorageBuffer(M * dFF * 4, `b${l}_fcOut`),
        geluOut: context.createStorageBuffer(M * dFF * 4, `b${l}_geluOut`),
        mlpProj: context.createStorageBuffer(M * dModel * 4, `b${l}_mlpProj`),
        blockOut: context.createStorageBuffer(M * dModel * 4, `b${l}_blockOut`),

        // Backward intermediate buffers
        dAttnOut: context.createStorageBuffer(M * dModel * 4, `b${l}_dAttnOut`),
        dS: context.createStorageBuffer(B * config.nHeads * T * T * 4, `b${l}_dS`),
        dQ: context.createStorageBuffer(M * dModel * 4, `b${l}_dQ`),
        dK: context.createStorageBuffer(M * dModel * 4, `b${l}_dK`),
        dV: context.createStorageBuffer(M * dModel * 4, `b${l}_dV`),
        dLn1Out: context.createStorageBuffer(M * dModel * 4, `b${l}_dLn1Out`),
        dBlockInput: context.createStorageBuffer(M * dModel * 4, `b${l}_dBlockInput`),
        dGeluOut: context.createStorageBuffer(M * dFF * 4, `b${l}_dGeluOut`),
        dFcOut: context.createStorageBuffer(M * dFF * 4, `b${l}_dFcOut`),
        dLn2Out: context.createStorageBuffer(M * dModel * 4, `b${l}_dLn2Out`),
        dMid: context.createStorageBuffer(M * dModel * 4, `b${l}_dMid`)
      });
    }

    this.finalLnOutBuffer = context.createStorageBuffer(M * dModel * 4, 'finalLnOut');
    this.finalLnMeanRstd = context.createStorageBuffer(M * 2 * 4, 'finalLnMeanRstd');
    this.logitsBuffer = context.createStorageBuffer(M * vocabSize * 4, 'logits');
    this.rowLossBuffer = context.createStorageBuffer(M * 4, 'rowLoss');
    this.dlogitsBuffer = context.createStorageBuffer(M * vocabSize * 4, 'dlogits');
    this.meanLossBuffer = context.createStorageBuffer(16, 'meanLoss');

    this.dFinalLnOutBuffer = context.createStorageBuffer(M * dModel * 4, 'dFinalLnOut');
    this.dHiddenBuffer = context.createStorageBuffer(M * dModel * 4, 'dHidden');

    // 4. Create Uniform Buffers and Helper Factory Functions
    const tokEmbOffset = this.offsets.get('tokEmb')!.offset;
    const posEmbOffset = this.offsets.get('posEmb')!.offset;

    // Helper: Matmul BindGroup
    const createMatmulBindGroup = (
      label: string,
      bufA: GPUBuffer,
      bufB: GPUBuffer,
      bufBias: GPUBuffer,
      bufC: GPUBuffer,
      M_val: number,
      N_val: number,
      K_val: number,
      offsetA: number = 0,
      offsetB: number = 0,
      offsetBias: number = 0,
      offsetC: number = 0,
      hasBias: boolean = false,
      mode: number = 0,
      accumulate: boolean = false
    ) => {
      const uBuf = context.createUniformBuffer(48, `${label}_uniforms`);
      device.queue.writeBuffer(
        uBuf,
        0,
        new Uint32Array([
          M_val,
          N_val,
          K_val,
          mode,
          hasBias ? 1 : 0,
          accumulate ? 1 : 0,
          offsetA,
          offsetB,
          offsetBias,
          offsetC,
          0,
          0
        ])
      );
      return device.createBindGroup({
        label: `${label}_bindGroup`,
        layout: this.pipelines.matmul.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufA } },
          { binding: 1, resource: { buffer: bufB } },
          { binding: 2, resource: { buffer: bufBias } },
          { binding: 3, resource: { buffer: bufC } },
          { binding: 4, resource: { buffer: uBuf } }
        ]
      });
    };

    // Helper: Bias Backward BindGroup
    const createBiasBwdBindGroup = (
      label: string,
      bufDy: GPUBuffer,
      bufGrads: GPUBuffer,
      M_val: number,
      N_val: number,
      offsetGradBias: number
    ) => {
      const uBuf = context.createUniformBuffer(16, `${label}_uniforms`);
      device.queue.writeBuffer(uBuf, 0, new Uint32Array([M_val, N_val, offsetGradBias, 0]));
      return device.createBindGroup({
        label: `${label}_bindGroup`,
        layout: this.pipelines.biasBackward.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufDy } },
          { binding: 1, resource: { buffer: bufGrads } },
          { binding: 2, resource: { buffer: uBuf } }
        ]
      });
    };

    // Helper: LayerNorm Forward BindGroup
    const createLnFwdBindGroup = (
      label: string,
      bufIn: GPUBuffer,
      bufOut: GPUBuffer,
      bufMeanRstd: GPUBuffer,
      gammaOffset: number,
      biasOffset: number
    ) => {
      const uBuf = context.createUniformBuffer(32, `${label}_uniforms`);
      const uData = new ArrayBuffer(32);
      const u32 = new Uint32Array(uData);
      const f32 = new Float32Array(uData);
      u32[0] = M;
      u32[1] = dModel;
      u32[2] = gammaOffset;
      u32[3] = biasOffset;
      f32[4] = 1e-5; // eps
      device.queue.writeBuffer(uBuf, 0, uData);

      return device.createBindGroup({
        label: `${label}_bindGroup`,
        layout: this.pipelines.layernorm.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufIn } },
          { binding: 1, resource: { buffer: this.paramsBuffer } },
          { binding: 2, resource: { buffer: bufOut } },
          { binding: 3, resource: { buffer: bufMeanRstd } },
          { binding: 4, resource: { buffer: uBuf } }
        ]
      });
    };

    // Helper: LayerNorm Backward Dx BindGroup
    const createLnBwdDxBindGroup = (
      label: string,
      bufDy: GPUBuffer,
      bufInX: GPUBuffer,
      bufMeanRstd: GPUBuffer,
      bufDx: GPUBuffer,
      gammaOffset: number,
      hasResidual: boolean
    ) => {
      const uBuf = context.createUniformBuffer(16, `${label}_uniforms`);
      device.queue.writeBuffer(
        uBuf,
        0,
        new Uint32Array([M, dModel, gammaOffset, hasResidual ? 1 : 0])
      );
      return device.createBindGroup({
        label: `${label}_bindGroup`,
        layout: this.pipelines.layernormBackwardDx.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufDy } },
          { binding: 1, resource: { buffer: bufInX } },
          { binding: 2, resource: { buffer: this.paramsBuffer } },
          { binding: 3, resource: { buffer: bufMeanRstd } },
          { binding: 4, resource: { buffer: bufDx } },
          { binding: 5, resource: { buffer: uBuf } }
        ]
      });
    };

    // Helper: LayerNorm Backward Params BindGroup
    const createLnBwdParamsBindGroup = (
      label: string,
      bufDy: GPUBuffer,
      bufInX: GPUBuffer,
      bufMeanRstd: GPUBuffer,
      offsetDgamma: number,
      offsetDbeta: number
    ) => {
      const uBuf = context.createUniformBuffer(16, `${label}_uniforms`);
      device.queue.writeBuffer(uBuf, 0, new Uint32Array([M, dModel, offsetDgamma, offsetDbeta]));
      return device.createBindGroup({
        label: `${label}_bindGroup`,
        layout: this.pipelines.layernormBackwardParams.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bufDy } },
          { binding: 1, resource: { buffer: bufInX } },
          { binding: 2, resource: { buffer: bufMeanRstd } },
          { binding: 3, resource: { buffer: this.gradsBuffer } },
          { binding: 4, resource: { buffer: uBuf } }
        ]
      });
    };

    // 5. Pre-create ALL Forward BindGroups
    const embUniformBuf = context.createUniformBuffer(32, 'embeddingUniforms');
    device.queue.writeBuffer(
      embUniformBuf,
      0,
      new Uint32Array([M, T, dModel, tokEmbOffset, posEmbOffset, 0, 0, 0])
    );
    this.embeddingBindGroup = device.createBindGroup({
      label: 'embeddingBindGroup',
      layout: this.pipelines.embedding.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.inputIdsBuffer } },
        { binding: 2, resource: { buffer: this.embeddingsBuffer } },
        { binding: 3, resource: { buffer: embUniformBuf } }
      ]
    });

    const scale = 1.0 / Math.sqrt(headDim);
    const attnUniformBuf = context.createUniformBuffer(32, 'attentionUniforms');
    const attnUData = new ArrayBuffer(32);
    const attnU32 = new Uint32Array(attnUData);
    const attnF32 = new Float32Array(attnUData);
    attnU32[0] = B;
    attnU32[1] = config.nHeads;
    attnU32[2] = T;
    attnU32[3] = headDim;
    attnF32[4] = scale;
    device.queue.writeBuffer(attnUniformBuf, 0, attnUData);

    let currentInput = this.embeddingsBuffer;

    for (let l = 0; l < nLayers; l++) {
      const bBuf = this.blockBuffers[l];
      const ln1G = this.offsets.get(`blocks.${l}.ln1.g`)!.offset;
      const ln1B = this.offsets.get(`blocks.${l}.ln1.b`)!.offset;
      const WqOff = this.offsets.get(`blocks.${l}.Wq`)!.offset;
      const bqOff = this.offsets.get(`blocks.${l}.bq`)!.offset;
      const WkOff = this.offsets.get(`blocks.${l}.Wk`)!.offset;
      const bkOff = this.offsets.get(`blocks.${l}.bk`)!.offset;
      const WvOff = this.offsets.get(`blocks.${l}.Wv`)!.offset;
      const bvOff = this.offsets.get(`blocks.${l}.bv`)!.offset;
      const WoOff = this.offsets.get(`blocks.${l}.Wo`)!.offset;
      const boOff = this.offsets.get(`blocks.${l}.bo`)!.offset;

      const ln2G = this.offsets.get(`blocks.${l}.ln2.g`)!.offset;
      const ln2B = this.offsets.get(`blocks.${l}.ln2.b`)!.offset;
      const W1Off = this.offsets.get(`blocks.${l}.W1`)!.offset;
      const b1Off = this.offsets.get(`blocks.${l}.b1`)!.offset;
      const W2Off = this.offsets.get(`blocks.${l}.W2`)!.offset;
      const b2Off = this.offsets.get(`blocks.${l}.b2`)!.offset;

      // LN1
      const ln1 = createLnFwdBindGroup(
        `b${l}_ln1`,
        currentInput,
        bBuf.ln1Out,
        bBuf.ln1MeanRstd,
        ln1G,
        ln1B
      );

      // Q, K, V
      const wq = createMatmulBindGroup(
        `b${l}_wq`,
        bBuf.ln1Out,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.q,
        M,
        dModel,
        dModel,
        0,
        WqOff,
        bqOff,
        0,
        true,
        0
      );
      const wk = createMatmulBindGroup(
        `b${l}_wk`,
        bBuf.ln1Out,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.k,
        M,
        dModel,
        dModel,
        0,
        WkOff,
        bkOff,
        0,
        true,
        0
      );
      const wv = createMatmulBindGroup(
        `b${l}_wv`,
        bBuf.ln1Out,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.v,
        M,
        dModel,
        dModel,
        0,
        WvOff,
        bvOff,
        0,
        true,
        0
      );

      // Attention Scores & Softmax
      const attentionScores = device.createBindGroup({
        label: `b${l}_causalAttn_bindGroup`,
        layout: this.pipelines.causalAttention.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bBuf.q } },
          { binding: 1, resource: { buffer: bBuf.k } },
          { binding: 2, resource: { buffer: bBuf.probs } },
          { binding: 3, resource: { buffer: attnUniformBuf } }
        ]
      });

      // Attention Value (P @ V)
      const attentionValue = device.createBindGroup({
        label: `b${l}_attnValue_bindGroup`,
        layout: this.pipelines.attentionValue.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bBuf.probs } },
          { binding: 1, resource: { buffer: bBuf.v } },
          { binding: 2, resource: { buffer: bBuf.attnOut } },
          { binding: 3, resource: { buffer: attnUniformBuf } }
        ]
      });

      // Wo
      const wo = createMatmulBindGroup(
        `b${l}_wo`,
        bBuf.attnOut,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.attnProj,
        M,
        dModel,
        dModel,
        0,
        WoOff,
        boOff,
        0,
        true,
        0
      );

      // Mid Residual: mid = input + attnProj
      const midResUBuf = context.createUniformBuffer(16, `b${l}_midRes_u`);
      device.queue.writeBuffer(midResUBuf, 0, new Uint32Array([M * dModel, 0, 0, 0]));
      const midResidual = device.createBindGroup({
        label: `b${l}_midRes_bindGroup`,
        layout: this.pipelines.residual.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: currentInput } },
          { binding: 1, resource: { buffer: bBuf.attnProj } },
          { binding: 2, resource: { buffer: bBuf.mid } },
          { binding: 3, resource: { buffer: midResUBuf } }
        ]
      });

      // LN2
      const ln2 = createLnFwdBindGroup(
        `b${l}_ln2`,
        bBuf.mid,
        bBuf.ln2Out,
        bBuf.ln2MeanRstd,
        ln2G,
        ln2B
      );

      // W1
      const w1 = createMatmulBindGroup(
        `b${l}_w1`,
        bBuf.ln2Out,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.fcOut,
        M,
        dFF,
        dModel,
        0,
        W1Off,
        b1Off,
        0,
        true,
        0
      );

      // GELU
      const geluUBuf = context.createUniformBuffer(16, `b${l}_gelu_u`);
      device.queue.writeBuffer(geluUBuf, 0, new Uint32Array([M * dFF, 0, 0, 0]));
      const gelu = device.createBindGroup({
        label: `b${l}_gelu_bindGroup`,
        layout: this.pipelines.gelu.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bBuf.fcOut } },
          { binding: 1, resource: { buffer: bBuf.geluOut } },
          { binding: 2, resource: { buffer: geluUBuf } }
        ]
      });

      // W2
      const w2 = createMatmulBindGroup(
        `b${l}_w2`,
        bBuf.geluOut,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.mlpProj,
        M,
        dModel,
        dFF,
        0,
        W2Off,
        b2Off,
        0,
        true,
        0
      );

      // Block Residual: blockOut = mid + mlpProj
      const blockResUBuf = context.createUniformBuffer(16, `b${l}_blockRes_u`);
      device.queue.writeBuffer(blockResUBuf, 0, new Uint32Array([M * dModel, 0, 0, 0]));
      const blockResidual = device.createBindGroup({
        label: `b${l}_blockRes_bindGroup`,
        layout: this.pipelines.residual.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bBuf.mid } },
          { binding: 1, resource: { buffer: bBuf.mlpProj } },
          { binding: 2, resource: { buffer: bBuf.blockOut } },
          { binding: 3, resource: { buffer: blockResUBuf } }
        ]
      });

      this.blockForwardBindGroups.push({
        ln1,
        wq,
        wk,
        wv,
        attentionScores,
        attentionValue,
        wo,
        midResidual,
        ln2,
        w1,
        gelu,
        w2,
        blockResidual
      });

      currentInput = bBuf.blockOut;
    }

    // Final LN
    const lnfG = this.offsets.get('lnf.g')!.offset;
    const lnfB = this.offsets.get('lnf.b')!.offset;
    this.finalLnBindGroup = createLnFwdBindGroup(
      'finalLn',
      currentInput,
      this.finalLnOutBuffer,
      this.finalLnMeanRstd,
      lnfG,
      lnfB
    );

    // Tied Output Head: logits = finalLnOut @ tokEmb^T
    this.tiedHeadBindGroup = createMatmulBindGroup(
      'tiedHead',
      this.finalLnOutBuffer,
      this.paramsBuffer,
      this.paramsBuffer,
      this.logitsBuffer,
      M,
      vocabSize,
      dModel,
      0,
      tokEmbOffset,
      0,
      0,
      false,
      1
    );

    // Cross Entropy
    const ceUBuf = context.createUniformBuffer(16, 'ceUniforms');
    device.queue.writeBuffer(ceUBuf, 0, new Uint32Array([M, vocabSize, 1, 0]));
    this.crossEntropyBindGroup = device.createBindGroup({
      label: 'crossEntropy_bindGroup',
      layout: this.pipelines.crossEntropy.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.logitsBuffer } },
        { binding: 1, resource: { buffer: this.targetsBuffer } },
        { binding: 2, resource: { buffer: this.rowLossBuffer } },
        { binding: 3, resource: { buffer: this.dlogitsBuffer } },
        { binding: 4, resource: { buffer: ceUBuf } }
      ]
    });

    // Reduce Mean Loss
    const reduceUBuf = context.createUniformBuffer(16, 'reduceUniforms');
    device.queue.writeBuffer(reduceUBuf, 0, new Uint32Array([M, 0, 0, 0]));
    this.reduceSumBindGroup = device.createBindGroup({
      label: 'reduceSum_bindGroup',
      layout: this.pipelines.reduceSum.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.rowLossBuffer } },
        { binding: 1, resource: { buffer: this.meanLossBuffer } },
        { binding: 2, resource: { buffer: reduceUBuf } }
      ]
    });

    // 6. Pre-create ALL Backward BindGroups
    // Zero Grads BindGroup
    const zeroGradsUBuf = context.createUniformBuffer(16, 'zeroGrads_u');
    device.queue.writeBuffer(zeroGradsUBuf, 0, new Uint32Array([this.totalParams, 0, 0, 0]));
    this.zeroGradsBindGroup = device.createBindGroup({
      label: 'zeroGrads_bindGroup',
      layout: this.pipelines.zeroBuffer.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.gradsBuffer } },
        { binding: 1, resource: { buffer: zeroGradsUBuf } }
      ]
    });

    // Tied Head Backward:
    // a) dFinalLnOut = dLogits [M, V] @ tokEmb [V, D] (Mode 0)
    this.tiedHeadBwdXBindGroup = createMatmulBindGroup(
      'tiedHeadBwdX',
      this.dlogitsBuffer,
      this.paramsBuffer,
      this.paramsBuffer,
      this.dFinalLnOutBuffer,
      M,
      dModel,
      vocabSize,
      0,
      tokEmbOffset,
      0,
      0,
      false,
      0
    );

    // b) dTokEmb = dLogits^T [V, M] @ finalLnOut [M, D] (Mode 2) -> write directly to gradsBuffer[tokEmbOffset]
    this.tiedHeadBwdWBindGroup = createMatmulBindGroup(
      'tiedHeadBwdW',
      this.dlogitsBuffer,
      this.finalLnOutBuffer,
      this.paramsBuffer,
      this.gradsBuffer,
      vocabSize,
      dModel,
      M,
      0,
      0,
      0,
      tokEmbOffset,
      false,
      2
    );

    // Final LN Backward:
    const lastBlockOut =
      nLayers > 0 ? this.blockBuffers[nLayers - 1].blockOut : this.embeddingsBuffer;
    this.finalLnBwdDxBindGroup = createLnBwdDxBindGroup(
      'finalLnBwdDx',
      this.dFinalLnOutBuffer,
      lastBlockOut,
      this.finalLnMeanRstd,
      this.dHiddenBuffer,
      lnfG,
      false
    );
    this.finalLnBwdParamsBindGroup = createLnBwdParamsBindGroup(
      'finalLnBwdParams',
      this.dFinalLnOutBuffer,
      lastBlockOut,
      this.finalLnMeanRstd,
      lnfG,
      lnfB
    );

    // Transformer Blocks Backward BindGroups
    for (let l = nLayers - 1; l >= 0; l--) {
      const bBuf = this.blockBuffers[l];
      const prevBlockOut = l > 0 ? this.blockBuffers[l - 1].blockOut : this.embeddingsBuffer;
      const dCurr = l === nLayers - 1 ? this.dHiddenBuffer : this.blockBuffers[l + 1].dBlockInput;

      const ln1G = this.offsets.get(`blocks.${l}.ln1.g`)!.offset;
      const ln1B = this.offsets.get(`blocks.${l}.ln1.b`)!.offset;
      const WqOff = this.offsets.get(`blocks.${l}.Wq`)!.offset;
      const bqOff = this.offsets.get(`blocks.${l}.bq`)!.offset;
      const WkOff = this.offsets.get(`blocks.${l}.Wk`)!.offset;
      const bkOff = this.offsets.get(`blocks.${l}.bk`)!.offset;
      const WvOff = this.offsets.get(`blocks.${l}.Wv`)!.offset;
      const bvOff = this.offsets.get(`blocks.${l}.bv`)!.offset;
      const WoOff = this.offsets.get(`blocks.${l}.Wo`)!.offset;
      const boOff = this.offsets.get(`blocks.${l}.bo`)!.offset;

      const ln2G = this.offsets.get(`blocks.${l}.ln2.g`)!.offset;
      const ln2B = this.offsets.get(`blocks.${l}.ln2.b`)!.offset;
      const W1Off = this.offsets.get(`blocks.${l}.W1`)!.offset;
      const b1Off = this.offsets.get(`blocks.${l}.b1`)!.offset;
      const W2Off = this.offsets.get(`blocks.${l}.W2`)!.offset;
      const b2Off = this.offsets.get(`blocks.${l}.b2`)!.offset;

      // W2: dW2 = geluOut^T @ dCurr (Mode 2)
      const w2BwdW = createMatmulBindGroup(
        `b${l}_w2BwdW`,
        bBuf.geluOut,
        dCurr,
        this.paramsBuffer,
        this.gradsBuffer,
        dFF,
        dModel,
        M,
        0,
        0,
        0,
        W2Off,
        false,
        2
      );
      const b2Bwd = createBiasBwdBindGroup(`b${l}_b2Bwd`, dCurr, this.gradsBuffer, M, dModel, b2Off);

      // dGeluOut = dCurr @ W2^T (Mode 1)
      const w2BwdX = createMatmulBindGroup(
        `b${l}_w2BwdX`,
        dCurr,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.dGeluOut,
        M,
        dFF,
        dModel,
        0,
        W2Off,
        0,
        0,
        false,
        1
      );

      // GELU Backward
      const geluBwdUBuf = context.createUniformBuffer(16, `b${l}_geluBwd_u`);
      device.queue.writeBuffer(geluBwdUBuf, 0, new Uint32Array([M * dFF, 0, 0, 0]));
      const geluBwd = device.createBindGroup({
        label: `b${l}_geluBwd_bindGroup`,
        layout: this.pipelines.geluBackward.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bBuf.dGeluOut } },
          { binding: 1, resource: { buffer: bBuf.fcOut } },
          { binding: 2, resource: { buffer: bBuf.dFcOut } },
          { binding: 3, resource: { buffer: geluBwdUBuf } }
        ]
      });

      // W1: dW1 = ln2Out^T @ dFcOut (Mode 2)
      const w1BwdW = createMatmulBindGroup(
        `b${l}_w1BwdW`,
        bBuf.ln2Out,
        bBuf.dFcOut,
        this.paramsBuffer,
        this.gradsBuffer,
        dModel,
        dFF,
        M,
        0,
        0,
        0,
        W1Off,
        false,
        2
      );
      const b1Bwd = createBiasBwdBindGroup(`b${l}_b1Bwd`, bBuf.dFcOut, this.gradsBuffer, M, dFF, b1Off);

      // dLn2Out = dFcOut @ W1^T (Mode 1)
      const w1BwdX = createMatmulBindGroup(
        `b${l}_w1BwdX`,
        bBuf.dFcOut,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.dLn2Out,
        M,
        dModel,
        dFF,
        0,
        W1Off,
        0,
        0,
        false,
        1
      );

      // LN2 Backward: dMid = dCurr + ln2Dx (hasResidual = true accumulates dCurr directly!)
      const ln2BwdDx = createLnBwdDxBindGroup(
        `b${l}_ln2BwdDx`,
        bBuf.dLn2Out,
        bBuf.mid,
        bBuf.ln2MeanRstd,
        bBuf.dMid,
        ln2G,
        true // We copy dCurr into dMid first, then accumulate
      );
      const ln2BwdParams = createLnBwdParamsBindGroup(
        `b${l}_ln2BwdParams`,
        bBuf.dLn2Out,
        bBuf.mid,
        bBuf.ln2MeanRstd,
        ln2G,
        ln2B
      );

      // Wo: dWo = attnOut^T @ dMid (Mode 2)
      const woBwdW = createMatmulBindGroup(
        `b${l}_woBwdW`,
        bBuf.attnOut,
        bBuf.dMid,
        this.paramsBuffer,
        this.gradsBuffer,
        dModel,
        dModel,
        M,
        0,
        0,
        0,
        WoOff,
        false,
        2
      );
      const boBwd = createBiasBwdBindGroup(`b${l}_boBwd`, bBuf.dMid, this.gradsBuffer, M, dModel, boOff);

      // dAttnOut = dMid @ Wo^T (Mode 1)
      const woBwdX = createMatmulBindGroup(
        `b${l}_woBwdX`,
        bBuf.dMid,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.dAttnOut,
        M,
        dModel,
        dModel,
        0,
        WoOff,
        0,
        0,
        false,
        1
      );

      // Attention Backward: dS & dQ, then dK & dV
      const attnBwdQ = device.createBindGroup({
        label: `b${l}_attnBwdQ_bindGroup`,
        layout: this.pipelines.causalAttentionBackwardQ.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bBuf.dAttnOut } },
          { binding: 1, resource: { buffer: bBuf.probs } },
          { binding: 2, resource: { buffer: bBuf.k } },
          { binding: 3, resource: { buffer: bBuf.v } },
          { binding: 4, resource: { buffer: bBuf.dS } },
          { binding: 5, resource: { buffer: bBuf.dQ } },
          { binding: 6, resource: { buffer: attnUniformBuf } }
        ]
      });

      const attnBwdKV = device.createBindGroup({
        label: `b${l}_attnBwdKV_bindGroup`,
        layout: this.pipelines.causalAttentionBackwardKv.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: bBuf.dAttnOut } },
          { binding: 1, resource: { buffer: bBuf.probs } },
          { binding: 2, resource: { buffer: bBuf.q } },
          { binding: 3, resource: { buffer: bBuf.dS } },
          { binding: 4, resource: { buffer: bBuf.dK } },
          { binding: 5, resource: { buffer: bBuf.dV } },
          { binding: 6, resource: { buffer: attnUniformBuf } }
        ]
      });

      // Wq, Wk, Wv: dW = ln1Out^T @ d(Q/K/V) (Mode 2)
      const wqBwdW = createMatmulBindGroup(
        `b${l}_wqBwdW`,
        bBuf.ln1Out,
        bBuf.dQ,
        this.paramsBuffer,
        this.gradsBuffer,
        dModel,
        dModel,
        M,
        0,
        0,
        0,
        WqOff,
        false,
        2
      );
      const bqBwd = createBiasBwdBindGroup(`b${l}_bqBwd`, bBuf.dQ, this.gradsBuffer, M, dModel, bqOff);

      const wkBwdW = createMatmulBindGroup(
        `b${l}_wkBwdW`,
        bBuf.ln1Out,
        bBuf.dK,
        this.paramsBuffer,
        this.gradsBuffer,
        dModel,
        dModel,
        M,
        0,
        0,
        0,
        WkOff,
        false,
        2
      );
      const bkBwd = createBiasBwdBindGroup(`b${l}_bkBwd`, bBuf.dK, this.gradsBuffer, M, dModel, bkOff);

      const wvBwdW = createMatmulBindGroup(
        `b${l}_wvBwdW`,
        bBuf.ln1Out,
        bBuf.dV,
        this.paramsBuffer,
        this.gradsBuffer,
        dModel,
        dModel,
        M,
        0,
        0,
        0,
        WvOff,
        false,
        2
      );
      const bvBwd = createBiasBwdBindGroup(`b${l}_bvBwd`, bBuf.dV, this.gradsBuffer, M, dModel, bvOff);

      // dLn1Out = dQ @ Wq^T + dK @ Wk^T + dV @ Wv^T (Mode 1)
      const wqBwdX = createMatmulBindGroup(
        `b${l}_wqBwdX`,
        bBuf.dQ,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.dLn1Out,
        M,
        dModel,
        dModel,
        0,
        WqOff,
        0,
        0,
        false,
        1,
        false // overwrite
      );
      const wkBwdX = createMatmulBindGroup(
        `b${l}_wkBwdX`,
        bBuf.dK,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.dLn1Out,
        M,
        dModel,
        dModel,
        0,
        WkOff,
        0,
        0,
        false,
        1,
        true // accumulate
      );
      const wvBwdX = createMatmulBindGroup(
        `b${l}_wvBwdX`,
        bBuf.dV,
        this.paramsBuffer,
        this.paramsBuffer,
        bBuf.dLn1Out,
        M,
        dModel,
        dModel,
        0,
        WvOff,
        0,
        0,
        false,
        1,
        true // accumulate
      );

      // LN1 Backward: dBlockInput = dMid + ln1Dx
      const ln1BwdDx = createLnBwdDxBindGroup(
        `b${l}_ln1BwdDx`,
        bBuf.dLn1Out,
        prevBlockOut,
        bBuf.ln1MeanRstd,
        bBuf.dBlockInput,
        ln1G,
        true
      );
      const ln1BwdParams = createLnBwdParamsBindGroup(
        `b${l}_ln1BwdParams`,
        bBuf.dLn1Out,
        prevBlockOut,
        bBuf.ln1MeanRstd,
        ln1G,
        ln1B
      );

      this.blockBackwardBindGroups.push({
        w2BwdW,
        b2Bwd,
        w2BwdX,
        geluBwd,
        w1BwdW,
        b1Bwd,
        w1BwdX,
        ln2BwdDx,
        ln2BwdParams,
        woBwdW,
        boBwd,
        woBwdX,
        attnBwdQ,
        attnBwdKV,
        wqBwdW,
        bqBwd,
        wkBwdW,
        bkBwd,
        wvBwdW,
        bvBwd,
        wqBwdX,
        wkBwdX,
        wvBwdX,
        ln1BwdDx,
        ln1BwdParams
      });
    }

    // Embedding Backward BindGroup
    const embBwdUBuf = context.createUniformBuffer(32, 'embBwd_u');
    device.queue.writeBuffer(
      embBwdUBuf,
      0,
      new Uint32Array([M, T, dModel, tokEmbOffset, posEmbOffset, 0, 0, 0])
    );
    const dCurrForEmb =
      nLayers > 0 ? this.blockBuffers[0].dBlockInput : this.dHiddenBuffer;
    this.embeddingBwdBindGroup = device.createBindGroup({
      label: 'embeddingBwd_bindGroup',
      layout: this.pipelines.embeddingBackward.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: dCurrForEmb } },
        { binding: 1, resource: { buffer: this.inputIdsBuffer } },
        { binding: 2, resource: { buffer: this.gradsBuffer } },
        { binding: 3, resource: { buffer: embBwdUBuf } }
      ]
    });

    const posEmbBwdUBuf = context.createUniformBuffer(16, 'posEmbBwd_u');
    device.queue.writeBuffer(
      posEmbBwdUBuf,
      0,
      new Uint32Array([this.B, this.T, dModel, posEmbOffset])
    );
    this.posEmbBwdBindGroup = device.createBindGroup({
      label: 'posEmbBwd_bindGroup',
      layout: this.pipelines.positionEmbeddingBackward.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: dCurrForEmb } },
        { binding: 1, resource: { buffer: this.gradsBuffer } },
        { binding: 2, resource: { buffer: posEmbBwdUBuf } }
      ]
    });

    // 7. Optimizer BindGroups & Buffers
    const gradNormUBuf = context.createUniformBuffer(16, 'gradNorm_u');
    device.queue.writeBuffer(gradNormUBuf, 0, new Uint32Array([this.totalParams, 0, 0, 0]));
    this.gradNormBindGroup = device.createBindGroup({
      label: 'gradNorm_bindGroup',
      layout: this.pipelines.gradNorm.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.gradsBuffer } },
        { binding: 1, resource: { buffer: this.partialNormsBuffer } },
        { binding: 2, resource: { buffer: gradNormUBuf } }
      ]
    });

    this.reduceNormUniformBuffer = context.createUniformBuffer(16, 'reduceNorm_u');
    const rnData = new ArrayBuffer(16);
    const rnU32 = new Uint32Array(rnData);
    const rnF32 = new Float32Array(rnData);
    rnU32[0] = numPartials;
    rnF32[1] = 1.0; // maxGradNorm default
    device.queue.writeBuffer(this.reduceNormUniformBuffer, 0, rnData);

    this.reduceNormBindGroup = device.createBindGroup({
      label: 'reduceNorm_bindGroup',
      layout: this.pipelines.reduceNorm.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.partialNormsBuffer } },
        { binding: 1, resource: { buffer: this.normClipBuffer } },
        { binding: 2, resource: { buffer: this.reduceNormUniformBuffer } }
      ]
    });

    this.adamwUniformBuffer = context.createUniformBuffer(32, 'adamw_u');
    this.adamwBindGroup = device.createBindGroup({
      label: 'adamw_bindGroup',
      layout: this.pipelines.adamw.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.gradsBuffer } },
        { binding: 2, resource: { buffer: this.mBuffer } },
        { binding: 3, resource: { buffer: this.vBuffer } },
        { binding: 4, resource: { buffer: this.decayMaskBuffer } },
        { binding: 5, resource: { buffer: this.normClipBuffer } },
        { binding: 6, resource: { buffer: this.adamwUniformBuffer } }
      ]
    });

    // 10. Allocate Diagnostics Buffer, Uniforms & BindGroups
    const diagBytes = Math.max(2048, (nLayers * GpuModel.DIAG_LAYER_STRIDE + 32) * 4);
    this.diagnosticsBuffer = context.createStorageBuffer(diagBytes, 'diagnosticsBuffer');

    this.layerDiagBindGroups = [];
    this.layerDiagUniformBuffers = [];
    for (let l = 0; l < nLayers; l++) {
      const pStart = this.offsets.get(`blocks.${l}.ln1.g`)!.offset;
      const pEnd = this.offsets.get(`blocks.${l}.b2`)!.offset + this.offsets.get(`blocks.${l}.b2`)!.size;
      const pCount = pEnd - pStart;

      const uBuf = context.createUniformBuffer(48, `diag_layer_${l}_u`);
      const uData = new Uint32Array([
        pStart,
        pCount,
        M * dModel,
        dFF,
        M,
        this.T,
        config.nHeads,
        l,
        GpuModel.DIAG_LAYER_STRIDE,
        0, // lr (f32)
        0, // clipScale (f32)
        0  // pad
      ]);
      device.queue.writeBuffer(uBuf, 0, uData);
      this.layerDiagUniformBuffers.push(uBuf);

      const bg = device.createBindGroup({
        label: `diag_layer_${l}_bg`,
        layout: this.pipelines.reduceLayerDiagnostics.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.paramsBuffer } },
          { binding: 1, resource: { buffer: this.gradsBuffer } },
          { binding: 2, resource: { buffer: this.blockBuffers[l].blockOut } },
          { binding: 3, resource: { buffer: this.blockBuffers[l].geluOut } },
          { binding: 4, resource: { buffer: this.blockBuffers[l].probs } },
          { binding: 5, resource: { buffer: this.diagnosticsBuffer } },
          { binding: 6, resource: { buffer: uBuf } }
        ]
      });
      this.layerDiagBindGroups.push(bg);
    }

    const gOffset = nLayers * GpuModel.DIAG_LAYER_STRIDE;
    this.globalDiagUniformBuffer = context.createUniformBuffer(32, 'diag_global_u');
    const gData = new Uint32Array([
      this.totalParams,
      M,
      vocabSize,
      gOffset,
      0, // clipScale (f32)
      0,
      0,
      0
    ]);
    device.queue.writeBuffer(this.globalDiagUniformBuffer, 0, gData);

    this.globalDiagBindGroup = device.createBindGroup({
      label: 'diag_global_bg',
      layout: this.pipelines.reduceGlobalDiagnostics.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.logitsBuffer } },
        { binding: 1, resource: { buffer: this.meanLossBuffer } },
        { binding: 2, resource: { buffer: this.normClipBuffer } },
        { binding: 3, resource: { buffer: this.paramsBuffer } },
        { binding: 4, resource: { buffer: this.gradsBuffer } },
        { binding: 5, resource: { buffer: this.diagnosticsBuffer } },
        { binding: 6, resource: { buffer: this.globalDiagUniformBuffer } }
      ]
    });
  }

  /**
   * Encodes GPU-side diagnostics reduction pass into the given command encoder.
   */
  public encodeDiagnostics(encoder: GPUCommandEncoder): void {
    const pass = encoder.beginComputePass({ label: 'DiagnosticsReductionPass' });
    pass.setPipeline(this.pipelines.reduceLayerDiagnostics);
    for (let l = 0; l < this.config.nLayers; l++) {
      pass.setBindGroup(0, this.layerDiagBindGroups[l]);
      pass.dispatchWorkgroups(1);
    }

    pass.setPipeline(this.pipelines.reduceGlobalDiagnostics);
    pass.setBindGroup(0, this.globalDiagBindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
  }

  /**
   * Encoders for compute passes without host-device synchronization.
   */
  public encodeForward(pass: GPUComputePassEncoder, options: { hasTargets?: boolean } = {}): void {
    const { dModel, nLayers, dFF, vocabSize } = this.config;
    const M = this.B * this.T;

    // Embedding
    pass.setPipeline(this.pipelines.embedding);
    pass.setBindGroup(0, this.embeddingBindGroup);
    pass.dispatchWorkgroups(Math.ceil((M * dModel) / 256));

    // Transformer Blocks
    for (let l = 0; l < nLayers; l++) {
      const bg = this.blockForwardBindGroups[l];

      // LN1
      pass.setPipeline(this.pipelines.layernorm);
      pass.setBindGroup(0, bg.ln1);
      pass.dispatchWorkgroups(M);

      // Q, K, V
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wq);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.setBindGroup(0, bg.wk);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.setBindGroup(0, bg.wv);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      // Attention
      pass.setPipeline(this.pipelines.causalAttention);
      pass.setBindGroup(0, bg.attentionScores);
      pass.dispatchWorkgroups(this.B * this.config.nHeads * this.T);

      pass.setPipeline(this.pipelines.attentionValue);
      pass.setBindGroup(0, bg.attentionValue);
      pass.dispatchWorkgroups(this.B * this.config.nHeads * this.T);

      // Wo
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wo);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      // Mid Residual
      pass.setPipeline(this.pipelines.residual);
      pass.setBindGroup(0, bg.midResidual);
      pass.dispatchWorkgroups(Math.ceil((M * dModel) / 256));

      // LN2
      pass.setPipeline(this.pipelines.layernorm);
      pass.setBindGroup(0, bg.ln2);
      pass.dispatchWorkgroups(M);

      // W1
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w1);
      pass.dispatchWorkgroups(Math.ceil(dFF / 64), Math.ceil(M / 64));

      // GELU
      pass.setPipeline(this.pipelines.gelu);
      pass.setBindGroup(0, bg.gelu);
      pass.dispatchWorkgroups(Math.ceil((M * dFF) / 256));

      // W2
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w2);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      // Block Residual
      pass.setPipeline(this.pipelines.residual);
      pass.setBindGroup(0, bg.blockResidual);
      pass.dispatchWorkgroups(Math.ceil((M * dModel) / 256));
    }

    // Final LN
    pass.setPipeline(this.pipelines.layernorm);
    pass.setBindGroup(0, this.finalLnBindGroup);
    pass.dispatchWorkgroups(M);

    // Tied Output Head
    pass.setPipeline(this.pipelines.matmul);
    pass.setBindGroup(0, this.tiedHeadBindGroup);
    pass.dispatchWorkgroups(Math.ceil(vocabSize / 64), Math.ceil(M / 64));

    // Cross Entropy & Loss
    if (options.hasTargets !== false) {
      pass.setPipeline(this.pipelines.crossEntropy);
      pass.setBindGroup(0, this.crossEntropyBindGroup);
      pass.dispatchWorkgroups(M);

      pass.setPipeline(this.pipelines.reduceSum);
      pass.setBindGroup(0, this.reduceSumBindGroup);
      pass.dispatchWorkgroups(1);
    }
  }

  /**
   * Full forward + backward pass execution with optional optimizer step.
   */
  public async forward(
    ids: Uint16Array | number[],
    targets?: Uint16Array | number[] | null,
    options: GpuForwardOptions = {}
  ): Promise<GpuForwardResult> {
    const M = this.B * this.T;
    const device = this.context.device;

    const u32Ids = new Uint32Array(M);
    for (let i = 0; i < M; i++) u32Ids[i] = ids[i];
    device.queue.writeBuffer(this.inputIdsBuffer, 0, u32Ids);

    const hasTargets = Boolean(targets && targets.length >= M);
    if (hasTargets) {
      const u32Targets = new Uint32Array(M);
      for (let i = 0; i < M; i++) u32Targets[i] = targets![i];
      device.queue.writeBuffer(this.targetsBuffer, 0, u32Targets);
    }

    const encoder = device.createCommandEncoder({ label: 'GpuForwardEncoder' });
    const pass = encoder.beginComputePass({ label: 'GpuForwardPass' });
    this.encodeForward(pass, { hasTargets });
    pass.end();
    device.queue.submit([encoder.finish()]);

    const result: GpuForwardResult = { loss: null };
    if (hasTargets && options.readbackLoss !== false) {
      const lossArr = await this.context.readBufferFloat32(this.meanLossBuffer, 1);
      result.loss = lossArr[0];
    }
    if (options.readbackLogits) {
      result.logits = await this.context.readBufferFloat32(
        this.logitsBuffer,
        M * this.config.vocabSize
      );
    }
    if (options.readbackBlockOutputs) {
      result.blockOutputs = [];
      for (let l = 0; l < this.config.nLayers; l++) {
        const out = await this.context.readBufferFloat32(
          this.blockBuffers[l].blockOut,
          M * this.config.dModel
        );
        result.blockOutputs.push(out);
      }
    }
    return result;
  }

  /**
   * Full backward pass execution on GPU.
   */
  public async backward(): Promise<void> {
    const { dModel, nLayers, dFF, vocabSize } = this.config;
    const M = this.B * this.T;
    const device = this.context.device;

    const encoder = device.createCommandEncoder({ label: 'GpuBackwardEncoder' });

    // 0. Zero Grads
    let pass = encoder.beginComputePass({ label: 'ZeroGradsPass' });
    pass.setPipeline(this.pipelines.zeroBuffer);
    pass.setBindGroup(0, this.zeroGradsBindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.totalParams / 256));

    // 1. Tied Head Backward: dFinalLnOut = dLogits @ tokEmb, dTokEmb = dLogits^T @ finalLnOut
    pass.setPipeline(this.pipelines.matmul);
    pass.setBindGroup(0, this.tiedHeadBwdXBindGroup);
    pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

    pass.setBindGroup(0, this.tiedHeadBwdWBindGroup);
    pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(vocabSize / 64));

    // 2. Final LN Backward
    pass.setPipeline(this.pipelines.layernormBackwardDx);
    pass.setBindGroup(0, this.finalLnBwdDxBindGroup);
    pass.dispatchWorkgroups(M);

    pass.setPipeline(this.pipelines.layernormBackwardParams);
    pass.setBindGroup(0, this.finalLnBwdParamsBindGroup);
    pass.dispatchWorkgroups(dModel);
    pass.end();

    // 3. Blocks Backward in reverse order
    for (let l = nLayers - 1; l >= 0; l--) {
      const bg = this.blockBackwardBindGroups[nLayers - 1 - l];
      const bBuf = this.blockBuffers[l];
      const dCurr = l === nLayers - 1 ? this.dHiddenBuffer : this.blockBuffers[l + 1].dBlockInput;

      // Copy dCurr into dMid: dMid = dCurr (residual skip connection)
      encoder.copyBufferToBuffer(dCurr, 0, bBuf.dMid, 0, M * dModel * 4);

      pass = encoder.beginComputePass({ label: `Block_${l}_BackwardPass` });

      // W2: dW2 = geluOut^T @ dCurr
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w2BwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dFF / 64));

      // b2: db2 = sum_m dCurr[m]
      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.b2Bwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      // dGeluOut = dCurr @ W2^T
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w2BwdX);
      pass.dispatchWorkgroups(Math.ceil(dFF / 64), Math.ceil(M / 64));

      // GELU Backward: dFcOut = dGeluOut * gelu'(fcOut)
      pass.setPipeline(this.pipelines.geluBackward);
      pass.setBindGroup(0, bg.geluBwd);
      pass.dispatchWorkgroups(Math.ceil((M * dFF) / 256));

      // W1: dW1 = ln2Out^T @ dFcOut
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w1BwdW);
      pass.dispatchWorkgroups(Math.ceil(dFF / 64), Math.ceil(dModel / 64));

      // b1: db1 = sum_m dFcOut[m]
      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.b1Bwd);
      pass.dispatchWorkgroups(Math.ceil(dFF / 16));

      // dLn2Out = dFcOut @ W1^T
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w1BwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      // LN2 Backward: accumulates into dMid (dMid already has dCurr, so dx is added into it)
      pass.setPipeline(this.pipelines.layernormBackwardDx);
      pass.setBindGroup(0, bg.ln2BwdDx);
      pass.dispatchWorkgroups(M);

      pass.setPipeline(this.pipelines.layernormBackwardParams);
      pass.setBindGroup(0, bg.ln2BwdParams);
      pass.dispatchWorkgroups(dModel);

      // Wo: dWo = attnOut^T @ dMid
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.woBwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dModel / 64));

      // bo: dbo = sum_m dMid[m]
      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.boBwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      // dAttnOut = dMid @ Wo^T
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.woBwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      // Attention Backward: dS & dQ, then dK & dV
      pass.setPipeline(this.pipelines.causalAttentionBackwardQ);
      pass.setBindGroup(0, bg.attnBwdQ);
      pass.dispatchWorkgroups(this.B * this.config.nHeads * this.T);

      pass.setPipeline(this.pipelines.causalAttentionBackwardKv);
      pass.setBindGroup(0, bg.attnBwdKV);
      pass.dispatchWorkgroups(this.B * this.config.nHeads * this.T);

      // Wq, Wk, Wv: dW = ln1Out^T @ d(Q/K/V)
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wqBwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dModel / 64));

      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.bqBwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wkBwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dModel / 64));

      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.bkBwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wvBwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dModel / 64));

      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.bvBwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      // dLn1Out = dQ @ Wq^T + dK @ Wk^T + dV @ Wv^T
      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wqBwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.setBindGroup(0, bg.wkBwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.setBindGroup(0, bg.wvBwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.end();

      // Copy dMid into dBlockInput: dBlockInput = dMid (residual skip connection)
      encoder.copyBufferToBuffer(bBuf.dMid, 0, bBuf.dBlockInput, 0, M * dModel * 4);

      // LN1 Backward: accumulates into dBlockInput
      pass = encoder.beginComputePass({ label: `Block_${l}_LN1_Pass` });
      pass.setPipeline(this.pipelines.layernormBackwardDx);
      pass.setBindGroup(0, bg.ln1BwdDx);
      pass.dispatchWorkgroups(M);

      pass.setPipeline(this.pipelines.layernormBackwardParams);
      pass.setBindGroup(0, bg.ln1BwdParams);
      pass.dispatchWorkgroups(dModel);
      pass.end();
    }

    // 4. Embedding Backward: scatter-add into dTokEmb, and direct reduce into dPosEmb
    pass = encoder.beginComputePass({ label: 'EmbeddingBackwardPass' });
    pass.setPipeline(this.pipelines.embeddingBackward);
    pass.setBindGroup(0, this.embeddingBwdBindGroup);
    pass.dispatchWorkgroups(Math.ceil((M * dModel) / 256));

    pass.setPipeline(this.pipelines.positionEmbeddingBackward);
    pass.setBindGroup(0, this.posEmbBwdBindGroup);
    pass.dispatchWorkgroups(Math.ceil((this.T * dModel) / 256));
    pass.end();

    device.queue.submit([encoder.finish()]);
  }

  /**
   * Encodes the complete forward + backward + gradNorm + clip + AdamW step into ONE command encoder.
   */
  public encodeFullStep(
    encoder: GPUCommandEncoder,
    lr: number,
    stepCount: number,
    weightDecay: number = 0.1,
    maxGradNorm: number = 1.0,
    beta1: number = 0.9,
    beta2: number = 0.95,
    eps: number = 1e-8
  ): void {
    const { dModel, nLayers, dFF, vocabSize } = this.config;
    const M = this.B * this.T;
    const device = this.context.device;

    // Update AdamW uniforms
    const uData = new ArrayBuffer(32);
    const f32 = new Float32Array(uData);
    const u32 = new Uint32Array(uData);
    f32[0] = lr;
    f32[1] = beta1;
    f32[2] = beta2;
    f32[3] = eps;
    f32[4] = weightDecay;
    u32[5] = stepCount;
    u32[6] = this.totalParams;
    device.queue.writeBuffer(this.adamwUniformBuffer, 0, uData);

    // Update ReduceNorm uniforms
    const rnData = new ArrayBuffer(16);
    const rnU32 = new Uint32Array(rnData);
    const rnF32 = new Float32Array(rnData);
    rnU32[0] = this.numPartials;
    rnF32[1] = maxGradNorm;
    device.queue.writeBuffer(this.reduceNormUniformBuffer, 0, rnData);

    // 1. Forward Pass
    let pass = encoder.beginComputePass({ label: 'ForwardPass' });
    this.encodeForward(pass, { hasTargets: true });
    pass.end();

    // 2. Backward Pass
    pass = encoder.beginComputePass({ label: 'ZeroGradsPass' });
    pass.setPipeline(this.pipelines.zeroBuffer);
    pass.setBindGroup(0, this.zeroGradsBindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.totalParams / 256));

    // Tied Head Backward
    pass.setPipeline(this.pipelines.matmul);
    pass.setBindGroup(0, this.tiedHeadBwdXBindGroup);
    pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

    pass.setBindGroup(0, this.tiedHeadBwdWBindGroup);
    pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(vocabSize / 64));

    // Final LN Backward
    pass.setPipeline(this.pipelines.layernormBackwardDx);
    pass.setBindGroup(0, this.finalLnBwdDxBindGroup);
    pass.dispatchWorkgroups(M);

    pass.setPipeline(this.pipelines.layernormBackwardParams);
    pass.setBindGroup(0, this.finalLnBwdParamsBindGroup);
    pass.dispatchWorkgroups(dModel);
    pass.end();

    // Blocks Backward
    for (let l = nLayers - 1; l >= 0; l--) {
      const bg = this.blockBackwardBindGroups[nLayers - 1 - l];
      const bBuf = this.blockBuffers[l];
      const dCurr = l === nLayers - 1 ? this.dHiddenBuffer : this.blockBuffers[l + 1].dBlockInput;

      encoder.copyBufferToBuffer(dCurr, 0, bBuf.dMid, 0, M * dModel * 4);

      pass = encoder.beginComputePass({ label: `Block_${l}_BackwardPass` });

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w2BwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dFF / 64));

      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.b2Bwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w2BwdX);
      pass.dispatchWorkgroups(Math.ceil(dFF / 64), Math.ceil(M / 64));

      pass.setPipeline(this.pipelines.geluBackward);
      pass.setBindGroup(0, bg.geluBwd);
      pass.dispatchWorkgroups(Math.ceil((M * dFF) / 256));

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w1BwdW);
      pass.dispatchWorkgroups(Math.ceil(dFF / 64), Math.ceil(dModel / 64));

      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.b1Bwd);
      pass.dispatchWorkgroups(Math.ceil(dFF / 16));

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.w1BwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.setPipeline(this.pipelines.layernormBackwardDx);
      pass.setBindGroup(0, bg.ln2BwdDx);
      pass.dispatchWorkgroups(M);

      pass.setPipeline(this.pipelines.layernormBackwardParams);
      pass.setBindGroup(0, bg.ln2BwdParams);
      pass.dispatchWorkgroups(dModel);

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.woBwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dModel / 64));

      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.boBwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.woBwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.setPipeline(this.pipelines.causalAttentionBackwardQ);
      pass.setBindGroup(0, bg.attnBwdQ);
      pass.dispatchWorkgroups(this.B * this.config.nHeads * this.T);

      pass.setPipeline(this.pipelines.causalAttentionBackwardKv);
      pass.setBindGroup(0, bg.attnBwdKV);
      pass.dispatchWorkgroups(this.B * this.config.nHeads * this.T);

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wqBwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dModel / 64));

      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.bqBwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wkBwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dModel / 64));

      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.bkBwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wvBwdW);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(dModel / 64));

      pass.setPipeline(this.pipelines.biasBackward);
      pass.setBindGroup(0, bg.bvBwd);
      pass.dispatchWorkgroups(Math.ceil(dModel / 16));

      pass.setPipeline(this.pipelines.matmul);
      pass.setBindGroup(0, bg.wqBwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.setBindGroup(0, bg.wkBwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.setBindGroup(0, bg.wvBwdX);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64), Math.ceil(M / 64));

      pass.end();

      encoder.copyBufferToBuffer(bBuf.dMid, 0, bBuf.dBlockInput, 0, M * dModel * 4);

      pass = encoder.beginComputePass({ label: `Block_${l}_LN1_Pass` });
      pass.setPipeline(this.pipelines.layernormBackwardDx);
      pass.setBindGroup(0, bg.ln1BwdDx);
      pass.dispatchWorkgroups(M);

      pass.setPipeline(this.pipelines.layernormBackwardParams);
      pass.setBindGroup(0, bg.ln1BwdParams);
      pass.dispatchWorkgroups(dModel);
      pass.end();
    }

    // Embedding Backward: scatter-add into dTokEmb and direct reduce into dPosEmb
    pass = encoder.beginComputePass({ label: 'EmbeddingBackwardPass' });
    pass.setPipeline(this.pipelines.embeddingBackward);
    pass.setBindGroup(0, this.embeddingBwdBindGroup);
    pass.dispatchWorkgroups(Math.ceil((M * dModel) / 256));

    pass.setPipeline(this.pipelines.positionEmbeddingBackward);
    pass.setBindGroup(0, this.posEmbBwdBindGroup);
    pass.dispatchWorkgroups(Math.ceil((this.T * dModel) / 256));
    pass.end();


    // 3. Optimizer: Grad Norm, Clip & AdamW
    pass = encoder.beginComputePass({ label: 'OptimizerPass' });
    pass.setPipeline(this.pipelines.gradNorm);
    pass.setBindGroup(0, this.gradNormBindGroup);
    pass.dispatchWorkgroups(this.numPartials);

    pass.setPipeline(this.pipelines.reduceNorm);
    pass.setBindGroup(0, this.reduceNormBindGroup);
    pass.dispatchWorkgroups(1);

    pass.setPipeline(this.pipelines.adamw);
    pass.setBindGroup(0, this.adamwBindGroup);
    pass.dispatchWorkgroups(Math.ceil(this.totalParams / 256));
    pass.end();
  }

  /**
   * Downloads flat parameter weights from GPU.
   */
  public async getParams(): Promise<Float32Array> {
    return this.context.readBufferFloat32(this.paramsBuffer, this.totalParams);
  }

  /**
   * Uploads flat parameter weights to GPU.
   */
  public setParams(params: Float32Array | Float64Array): void {
    const f32 = params instanceof Float32Array ? params : new Float32Array(params);
    this.context.device.queue.writeBuffer(this.paramsBuffer, 0, f32 as unknown as BufferSource);
  }

  /**
   * Downloads flat gradients from GPU.
   */
  public async getGrads(): Promise<Float32Array> {
    return this.context.readBufferFloat32(this.gradsBuffer, this.totalParams);
  }

  /**
   * Pre-allocated download staging buffer for reading back only the last token's logits
   */
  private lastLogitsStagingBuffer: GPUBuffer | null = null;

  /**
   * Reads back only the last position's logits (one row of vocabSize floats).
   * Fast, low-latency zero-copy slice transfer.
   */
  public async readLastLogits(seqLen: number): Promise<Float32Array> {
    const vocabSize = this.config.vocabSize;
    const lastPos = Math.max(0, Math.min(this.T - 1, seqLen - 1));
    const offsetBytes = lastPos * vocabSize * 4;
    const sizeBytes = vocabSize * 4;

    if (!this.lastLogitsStagingBuffer) {
      this.lastLogitsStagingBuffer = this.context.device.createBuffer({
        label: 'last_logits_staging',
        size: sizeBytes,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
      });
    }

    const encoder = this.context.device.createCommandEncoder({ label: 'CopyLastLogitsEncoder' });
    encoder.copyBufferToBuffer(this.logitsBuffer, offsetBytes, this.lastLogitsStagingBuffer, 0, sizeBytes);
    this.context.device.queue.submit([encoder.finish()]);

    await this.lastLogitsStagingBuffer.mapAsync(GPUMapMode.READ);
    const copy = new Float32Array(vocabSize);
    copy.set(new Float32Array(this.lastLogitsStagingBuffer.getMappedRange(0, sizeBytes)));
    this.lastLogitsStagingBuffer.unmap();
    return copy;
  }
}

