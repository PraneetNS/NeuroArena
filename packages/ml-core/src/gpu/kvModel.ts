/**
 * GpuKvModel: High-Performance GPU Autoregressive KV-Cache Inference & Sampling Engine.
 * 
 * - Per-layer K and V cache buffers [nLayers, 2, nHeads, contextLen, headDim].
 * - Single-token matrix-vector compute passes with zero redundant re-computation.
 * - Prompt prefill pass populating KV cache for prompt tokens.
 * - Context window rollover: re-prefills last T-1 tokens when context reaches limit.
 * - Shares trainer parameters or loads standalone FP16/FP32 checkpoints.
 */

import { GPTConfig } from '../types.js';
import { GpuContext } from './context.js';
import { Xoshiro128StarStar } from '../rng.js';
import { TokenizerInterface } from './sampler.js';
import kvShaderCode from './shaders/kv_generator.wgsl?raw';

export interface KvGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  topK?: number;
  topP?: number;
  seed?: number;
  stopTokens?: number[];
  signal?: AbortSignal;
}

export interface CandidateToken {
  id: number;
  prob: number;
  logit: number;
  tokenStr?: string;
}

export interface KvTokenResult {
  token: string;
  tokenId: number;
  step: number;
  isLast: boolean;
  fullText: string;
  entropy: number;
  surprise: number;
  top5: CandidateToken[];
}

interface ParamMeta {
  name: string;
  offset: number;
  size: number;
  shape: number[];
}

export class GpuKvModel {
  public context: GpuContext;
  public config: GPTConfig;
  public paramsBuffer: GPUBuffer;
  public kvCacheBuf: GPUBuffer;
  public totalParams: number;
  public offsets: Map<string, ParamMeta> = new Map();
  public tokenizer?: TokenizerInterface;

  // Compute Pipelines
  private pipeEmbed: GPUComputePipeline;
  private pipeLn: GPUComputePipeline;
  private pipeQkv: GPUComputePipeline;
  private pipeAttn: GPUComputePipeline;
  private pipeGemv: GPUComputePipeline;
  private pipeGelu: GPUComputePipeline;
  private pipeTiedLogits: GPUComputePipeline;

  // Work Buffers
  private xBuf: GPUBuffer;
  private ln1Buf: GPUBuffer;
  private qBuf: GPUBuffer;
  private attnOutBuf: GPUBuffer;
  private midBuf: GPUBuffer;
  private ln2Buf: GPUBuffer;
  private w1Buf: GPUBuffer;
  private finalLnBuf: GPUBuffer;
  public logitsBuf: GPUBuffer;
  private logitsStagingBuf: GPUBuffer;

  // Uniform Buffers
  private modelDimsBuf: GPUBuffer;
  private embedUniBuf: GPUBuffer;
  private ln1UniBuffers: GPUBuffer[] = [];
  private qkvUniBuffers: GPUBuffer[] = [];
  private attnUniBuffers: GPUBuffer[] = [];
  private woUniBuffers: GPUBuffer[] = [];
  private ln2UniBuffers: GPUBuffer[] = [];
  private w1UniBuffers: GPUBuffer[] = [];
  private geluCountBuf: GPUBuffer;
  private w2UniBuffers: GPUBuffer[] = [];
  private finalLnUniBuf: GPUBuffer;
  private tiedHeadUniBuf: GPUBuffer;

  // BindGroups
  private embedBindGroup: GPUBindGroup;
  private ln1BindGroups: GPUBindGroup[] = [];
  private qkvBindGroups: GPUBindGroup[] = [];
  private attnBindGroups: GPUBindGroup[] = [];
  private woBindGroups: GPUBindGroup[] = [];
  private ln2BindGroups: GPUBindGroup[] = [];
  private w1BindGroups: GPUBindGroup[] = [];
  private geluBindGroup: GPUBindGroup;
  private w2BindGroups: GPUBindGroup[] = [];
  private finalLnBindGroup: GPUBindGroup;
  private tiedHeadBindGroup: GPUBindGroup;

  // Pre-allocated scratch buffers to eliminate per-step heap garbage collection
  private scratchEmbedData = new Uint32Array(4);
  private scratchQkvData = new Uint32Array(8);
  private scratchAttnData = new Uint32Array(4);

  constructor(
    context: GpuContext,
    config: GPTConfig,
    weights?: Float32Array | Float64Array | GPUBuffer,
    tokenizer?: TokenizerInterface
  ) {
    this.context = context;
    this.config = config;
    this.tokenizer = tokenizer;
    const device = context.device;

    const { vocabSize, dModel, nLayers, dFF, contextLen, nHeads } = config;
    const headDim = dModel / nHeads;

    // 1. Build Parameter Offset Table
    let curOffset = 0;
    const registerParam = (name: string, shape: number[]) => {
      const size = shape.reduce((a, b) => a * b, 1);
      const meta: ParamMeta = { name, offset: curOffset, size, shape };
      this.offsets.set(name, meta);
      curOffset += size;
    };

    registerParam('tokEmb', [vocabSize, dModel]);
    registerParam('posEmb', [contextLen, dModel]);
    for (let l = 0; l < nLayers; l++) {
      registerParam(`blocks.${l}.ln1.g`, [dModel]);
      registerParam(`blocks.${l}.ln1.b`, [dModel]);
      registerParam(`blocks.${l}.Wq`, [dModel, dModel]);
      registerParam(`blocks.${l}.bq`, [dModel]);
      registerParam(`blocks.${l}.Wk`, [dModel, dModel]);
      registerParam(`blocks.${l}.bk`, [dModel]);
      registerParam(`blocks.${l}.Wv`, [dModel, dModel]);
      registerParam(`blocks.${l}.bv`, [dModel]);
      registerParam(`blocks.${l}.Wo`, [dModel, dModel]);
      registerParam(`blocks.${l}.bo`, [dModel]);
      registerParam(`blocks.${l}.ln2.g`, [dModel]);
      registerParam(`blocks.${l}.ln2.b`, [dModel]);
      registerParam(`blocks.${l}.W1`, [dModel, dFF]);
      registerParam(`blocks.${l}.b1`, [dFF]);
      registerParam(`blocks.${l}.W2`, [dFF, dModel]);
      registerParam(`blocks.${l}.b2`, [dModel]);
    }
    registerParam('lnf.g', [dModel]);
    registerParam('lnf.b', [dModel]);
    this.totalParams = curOffset;

    // 2. Set up Params Buffer
    if (weights instanceof GPUBuffer) {
      this.paramsBuffer = weights;
    } else {
      this.paramsBuffer = context.createStorageBuffer(this.totalParams * 4, 'kv_params');
      if (weights) {
        const f32 = weights instanceof Float32Array ? weights : new Float32Array(weights);
        device.queue.writeBuffer(this.paramsBuffer, 0, f32 as unknown as BufferSource);
      }
    }

    // 3. Allocate Unified KV Cache Buffer
    // Size: nLayers * 2 (K & V) * nHeads * contextLen * headDim * 4 bytes
    const kvTotalFloats = nLayers * 2 * nHeads * contextLen * headDim;
    this.kvCacheBuf = context.createStorageBuffer(kvTotalFloats * 4, 'kv_cache');

    // 4. Allocate Scratch Work Buffers
    this.xBuf = context.createStorageBuffer(dModel * 4, 'kv_x');
    this.ln1Buf = context.createStorageBuffer(dModel * 4, 'kv_ln1');
    this.qBuf = context.createStorageBuffer(dModel * 4, 'kv_q');
    this.attnOutBuf = context.createStorageBuffer(dModel * 4, 'kv_attn_out');
    this.midBuf = context.createStorageBuffer(dModel * 4, 'kv_mid');
    this.ln2Buf = context.createStorageBuffer(dModel * 4, 'kv_ln2');
    this.w1Buf = context.createStorageBuffer(dFF * 4, 'kv_w1');
    this.finalLnBuf = context.createStorageBuffer(dModel * 4, 'kv_final_ln');
    this.logitsBuf = context.createStorageBuffer(vocabSize * 4, 'kv_logits');
    this.logitsStagingBuf = device.createBuffer({
      size: vocabSize * 4,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      label: 'kv_logits_staging'
    });

    // 5. Compile Shader & Pipelines
    const shaderModule = device.createShaderModule({
      code: kvShaderCode,
      label: 'kv_generator_module'
    });

    this.pipeEmbed = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'embed_step_main' }
    });
    this.pipeLn = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'layernorm_step_main' }
    });
    this.pipeQkv = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'qkv_step_main' }
    });
    this.pipeAttn = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'kv_attention_step_main' }
    });
    this.pipeGemv = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'gemv_step_main' }
    });
    this.pipeGelu = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'gelu_step_main' }
    });
    this.pipeTiedLogits = device.createComputePipeline({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'tied_logits_step_main' }
    });

    // 6. Setup Uniform Buffers & BindGroups
    this.modelDimsBuf = context.createUniformBuffer(32, 'model_dims');
    device.queue.writeBuffer(
      this.modelDimsBuf,
      0,
      new Uint32Array([dModel, nHeads, headDim, contextLen, vocabSize, dFF, nLayers, 0])
    );

    // Embed BindGroup
    this.embedUniBuf = context.createUniformBuffer(16, 'embed_uni');
    this.embedBindGroup = device.createBindGroup({
      layout: this.pipeEmbed.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.xBuf } },
        { binding: 2, resource: { buffer: this.embedUniBuf } },
        { binding: 3, resource: { buffer: this.modelDimsBuf } }
      ]
    });

    // Per-Layer Uniforms & BindGroups
    for (let l = 0; l < nLayers; l++) {
      // LN1
      const ln1G = this.offsets.get(`blocks.${l}.ln1.g`)!;
      const ln1B = this.offsets.get(`blocks.${l}.ln1.b`)!;
      const ln1UBuf = context.createUniformBuffer(16, `ln1_u_${l}`);
      const ln1Data = new ArrayBuffer(16);
      new Uint32Array(ln1Data, 0, 3).set([ln1G.offset, ln1B.offset, dModel]);
      new Float32Array(ln1Data, 12, 1).set([1e-5]);
      device.queue.writeBuffer(ln1UBuf, 0, ln1Data);
      this.ln1UniBuffers.push(ln1UBuf);

      this.ln1BindGroups.push(
        device.createBindGroup({
          layout: this.pipeLn.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.paramsBuffer } },
            { binding: 1, resource: { buffer: this.xBuf } },
            { binding: 2, resource: { buffer: this.ln1Buf } },
            { binding: 3, resource: { buffer: ln1UBuf } }
          ]
        })
      );

      // QKV + Append
      const qkvUBuf = context.createUniformBuffer(32, `qkv_u_${l}`);
      this.qkvUniBuffers.push(qkvUBuf);

      this.qkvBindGroups.push(
        device.createBindGroup({
          layout: this.pipeQkv.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.paramsBuffer } },
            { binding: 1, resource: { buffer: this.ln1Buf } },
            { binding: 2, resource: { buffer: this.qBuf } },
            { binding: 3, resource: { buffer: this.kvCacheBuf } },
            { binding: 4, resource: { buffer: qkvUBuf } },
            { binding: 5, resource: { buffer: this.modelDimsBuf } }
          ]
        })
      );

      // KV Attention
      const attnUBuf = context.createUniformBuffer(16, `attn_u_${l}`);
      this.attnUniBuffers.push(attnUBuf);

      this.attnBindGroups.push(
        device.createBindGroup({
          layout: this.pipeAttn.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.qBuf } },
            { binding: 1, resource: { buffer: this.kvCacheBuf } },
            { binding: 2, resource: { buffer: this.attnOutBuf } },
            { binding: 3, resource: { buffer: attnUBuf } },
            { binding: 4, resource: { buffer: this.modelDimsBuf } }
          ]
        })
      );

      // Wo (GEMV + bias + residual against xBuf -> midBuf)
      const wo = this.offsets.get(`blocks.${l}.Wo`)!;
      const bo = this.offsets.get(`blocks.${l}.bo`)!;
      const woUBuf = context.createUniformBuffer(32, `wo_u_${l}`);
      device.queue.writeBuffer(
        woUBuf,
        0,
        new Uint32Array([wo.offset, bo.offset, dModel, dModel, 1, 1, 0, 0])
      );
      this.woUniBuffers.push(woUBuf);

      this.woBindGroups.push(
        device.createBindGroup({
          layout: this.pipeGemv.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.paramsBuffer } },
            { binding: 1, resource: { buffer: this.attnOutBuf } },
            { binding: 2, resource: { buffer: this.midBuf } },
            { binding: 3, resource: { buffer: this.xBuf } }, // residual in
            { binding: 4, resource: { buffer: woUBuf } }
          ]
        })
      );

      // LN2
      const ln2G = this.offsets.get(`blocks.${l}.ln2.g`)!;
      const ln2B = this.offsets.get(`blocks.${l}.ln2.b`)!;
      const ln2UBuf = context.createUniformBuffer(16, `ln2_u_${l}`);
      const ln2Data = new ArrayBuffer(16);
      new Uint32Array(ln2Data, 0, 3).set([ln2G.offset, ln2B.offset, dModel]);
      new Float32Array(ln2Data, 12, 1).set([1e-5]);
      device.queue.writeBuffer(ln2UBuf, 0, ln2Data);
      this.ln2UniBuffers.push(ln2UBuf);

      this.ln2BindGroups.push(
        device.createBindGroup({
          layout: this.pipeLn.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.paramsBuffer } },
            { binding: 1, resource: { buffer: this.midBuf } },
            { binding: 2, resource: { buffer: this.ln2Buf } },
            { binding: 3, resource: { buffer: ln2UBuf } }
          ]
        })
      );

      // W1 (GEMV: ln2Buf -> w1Buf)
      const w1 = this.offsets.get(`blocks.${l}.W1`)!;
      const b1 = this.offsets.get(`blocks.${l}.b1`)!;
      const w1UBuf = context.createUniformBuffer(32, `w1_u_${l}`);
      device.queue.writeBuffer(
        w1UBuf,
        0,
        new Uint32Array([w1.offset, b1.offset, dModel, dFF, 1, 0, 0, 0])
      );
      this.w1UniBuffers.push(w1UBuf);

      this.w1BindGroups.push(
        device.createBindGroup({
          layout: this.pipeGemv.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.paramsBuffer } },
            { binding: 1, resource: { buffer: this.ln2Buf } },
            { binding: 2, resource: { buffer: this.w1Buf } },
            { binding: 3, resource: { buffer: this.xBuf } },
            { binding: 4, resource: { buffer: w1UBuf } }
          ]
        })
      );

      // W2 (GEMV + bias + residual against midBuf -> xBuf)
      const w2 = this.offsets.get(`blocks.${l}.W2`)!;
      const b2 = this.offsets.get(`blocks.${l}.b2`)!;
      const w2UBuf = context.createUniformBuffer(32, `w2_u_${l}`);
      device.queue.writeBuffer(
        w2UBuf,
        0,
        new Uint32Array([w2.offset, b2.offset, dFF, dModel, 1, 1, 0, 0])
      );
      this.w2UniBuffers.push(w2UBuf);

      this.w2BindGroups.push(
        device.createBindGroup({
          layout: this.pipeGemv.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.paramsBuffer } },
            { binding: 1, resource: { buffer: this.w1Buf } },
            { binding: 2, resource: { buffer: this.xBuf } },
            { binding: 3, resource: { buffer: this.midBuf } }, // residual in
            { binding: 4, resource: { buffer: w2UBuf } }
          ]
        })
      );
    }

    // GELU BindGroup
    this.geluCountBuf = context.createUniformBuffer(16, 'gelu_count');
    device.queue.writeBuffer(this.geluCountBuf, 0, new Uint32Array([dFF, 0, 0, 0]));
    this.geluBindGroup = device.createBindGroup({
      layout: this.pipeGelu.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.w1Buf } },
        { binding: 1, resource: { buffer: this.geluCountBuf } }
      ]
    });

    // Final LN
    const lnfG = this.offsets.get('lnf.g')!;
    const lnfB = this.offsets.get('lnf.b')!;
    this.finalLnUniBuf = context.createUniformBuffer(16, 'final_ln_u');
    const finalLnData = new ArrayBuffer(16);
    new Uint32Array(finalLnData, 0, 3).set([lnfG.offset, lnfB.offset, dModel]);
    new Float32Array(finalLnData, 12, 1).set([1e-5]);
    device.queue.writeBuffer(this.finalLnUniBuf, 0, finalLnData);

    this.finalLnBindGroup = device.createBindGroup({
      layout: this.pipeLn.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.xBuf } },
        { binding: 2, resource: { buffer: this.finalLnBuf } },
        { binding: 3, resource: { buffer: this.finalLnUniBuf } }
      ]
    });

    // Tied Head Logits
    const tokMeta = this.offsets.get('tokEmb')!;
    this.tiedHeadUniBuf = context.createUniformBuffer(16, 'tied_head_u');
    device.queue.writeBuffer(
      this.tiedHeadUniBuf,
      0,
      new Uint32Array([tokMeta.offset, dModel, vocabSize, 0])
    );

    this.tiedHeadBindGroup = device.createBindGroup({
      layout: this.pipeTiedLogits.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
        { binding: 1, resource: { buffer: this.finalLnBuf } },
        { binding: 2, resource: { buffer: this.logitsBuf } },
        { binding: 3, resource: { buffer: this.tiedHeadUniBuf } }
      ]
    });
  }

  /**
   * Encodes a single-token step into the given command encoder.
   */
  public encodeStep(encoder: GPUCommandEncoder, tokenId: number, pos: number): void {
    const { dModel, nLayers, dFF, vocabSize } = this.config;
    const tokMeta = this.offsets.get('tokEmb')!;
    const posMeta = this.offsets.get('posEmb')!;

    // 1. Update Uniforms for this step using pre-allocated typed arrays
    this.scratchEmbedData[0] = tokenId;
    this.scratchEmbedData[1] = pos;
    this.scratchEmbedData[2] = tokMeta.offset;
    this.scratchEmbedData[3] = posMeta.offset;
    this.context.device.queue.writeBuffer(this.embedUniBuf, 0, this.scratchEmbedData);

    for (let l = 0; l < nLayers; l++) {
      const wq = this.offsets.get(`blocks.${l}.Wq`)!;
      const bq = this.offsets.get(`blocks.${l}.bq`)!;
      const wk = this.offsets.get(`blocks.${l}.Wk`)!;
      const bk = this.offsets.get(`blocks.${l}.bk`)!;
      const wv = this.offsets.get(`blocks.${l}.Wv`)!;
      const bv = this.offsets.get(`blocks.${l}.bv`)!;

      this.scratchQkvData[0] = l;
      this.scratchQkvData[1] = pos;
      this.scratchQkvData[2] = wq.offset;
      this.scratchQkvData[3] = bq.offset;
      this.scratchQkvData[4] = wk.offset;
      this.scratchQkvData[5] = bk.offset;
      this.scratchQkvData[6] = wv.offset;
      this.scratchQkvData[7] = bv.offset;
      this.context.device.queue.writeBuffer(this.qkvUniBuffers[l], 0, this.scratchQkvData);

      this.scratchAttnData[0] = l;
      this.scratchAttnData[1] = pos;
      this.scratchAttnData[2] = 0;
      this.scratchAttnData[3] = 0;
      this.context.device.queue.writeBuffer(this.attnUniBuffers[l], 0, this.scratchAttnData);
    }

    // 2. Dispatch Passes
    const pass = encoder.beginComputePass({ label: `KvStep_${pos}` });

    // Embed
    pass.setPipeline(this.pipeEmbed);
    pass.setBindGroup(0, this.embedBindGroup);
    pass.dispatchWorkgroups(Math.ceil(dModel / 64));

    // Blocks
    for (let l = 0; l < nLayers; l++) {
      // LN1
      pass.setPipeline(this.pipeLn);
      pass.setBindGroup(0, this.ln1BindGroups[l]);
      pass.dispatchWorkgroups(1);

      // QKV + Cache Append
      pass.setPipeline(this.pipeQkv);
      pass.setBindGroup(0, this.qkvBindGroups[l]);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64));

      // Multi-Head KV Attention
      pass.setPipeline(this.pipeAttn);
      pass.setBindGroup(0, this.attnBindGroups[l]);
      pass.dispatchWorkgroups(this.config.nHeads);

      // Wo
      pass.setPipeline(this.pipeGemv);
      pass.setBindGroup(0, this.woBindGroups[l]);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64));

      // LN2
      pass.setPipeline(this.pipeLn);
      pass.setBindGroup(0, this.ln2BindGroups[l]);
      pass.dispatchWorkgroups(1);

      // W1
      pass.setPipeline(this.pipeGemv);
      pass.setBindGroup(0, this.w1BindGroups[l]);
      pass.dispatchWorkgroups(Math.ceil(dFF / 64));

      // GELU
      pass.setPipeline(this.pipeGelu);
      pass.setBindGroup(0, this.geluBindGroup);
      pass.dispatchWorkgroups(Math.ceil(dFF / 64));

      // W2
      pass.setPipeline(this.pipeGemv);
      pass.setBindGroup(0, this.w2BindGroups[l]);
      pass.dispatchWorkgroups(Math.ceil(dModel / 64));
    }

    // Final LN
    pass.setPipeline(this.pipeLn);
    pass.setBindGroup(0, this.finalLnBindGroup);
    pass.dispatchWorkgroups(1);

    // Tied Head Logits
    pass.setPipeline(this.pipeTiedLogits);
    pass.setBindGroup(0, this.tiedHeadBindGroup);
    pass.dispatchWorkgroups(Math.ceil(vocabSize / 64));

    pass.end();
  }

  /**
   * Runs a single-token step.
   * If readback = true (default), copies logits and maps them asynchronously.
   * If readback = false, dispatches the step asynchronously without blocking on staging readback,
   * avoiding pipeline bubbles during multi-token prompt prefill.
   */
  public async step(tokenId: number, pos: number, readback: false): Promise<null>;
  public async step(tokenId: number, pos: number, readback?: true): Promise<Float32Array>;
  public async step(tokenId: number, pos: number, readback?: boolean): Promise<Float32Array | null>;
  public async step(tokenId: number, pos: number, readback = true): Promise<Float32Array | null> {
    const device = this.context.device;
    const encoder = device.createCommandEncoder({ label: `GpuKvStepEncoder_${pos}` });
    this.encodeStep(encoder, tokenId, pos);

    if (readback) {
      encoder.copyBufferToBuffer(
        this.logitsBuf,
        0,
        this.logitsStagingBuf,
        0,
        this.config.vocabSize * 4
      );
      device.queue.submit([encoder.finish()]);

      await this.logitsStagingBuf.mapAsync(GPUMapMode.READ);
      const mapped = new Float32Array(this.logitsStagingBuf.getMappedRange());
      const result = new Float32Array(mapped);
      this.logitsStagingBuf.unmap();
      return result;
    } else {
      device.queue.submit([encoder.finish()]);
      return null;
    }
  }

  /**
   * Ingests a prompt sequence of length L, populating the KV cache
   * for tokens 0 .. L-1, returning the logits for the last token (L-1).
   * Asynchronously streams intermediate tokens without CPU readback stalls.
   */
  public async prefill(promptIds: number[] | Uint32Array | Uint16Array): Promise<Float32Array> {
    const L = promptIds.length;
    if (L === 0) throw new Error('Cannot prefill empty prompt');
    if (L > this.config.contextLen) {
      throw new Error(`Prompt length ${L} exceeds context length ${this.config.contextLen}`);
    }

    // Fast asynchronous prefill: dispatch tokens 0 .. L-2 without CPU readback stalls
    for (let p = 0; p < L - 1; p++) {
      await this.step(promptIds[p], p, false);
    }
    const lastLogits = await this.step(promptIds[L - 1], L - 1, true);
    return lastLogits;
  }

  /**
   * Samples a token from logits on CPU using temperature, Top-K, and Top-P filtering.
   */
  public static sampleNextToken(
    logits: Float32Array,
    temperature = 0.8,
    topK = 10,
    topP = 0.9,
    rng: Xoshiro128StarStar
  ): { nextToken: number; entropy: number; surprise: number; top5: CandidateToken[] } {
    const vocabSize = logits.length;
    const temp = Math.max(1e-4, temperature);

    // 1. Temperature scaling
    let maxLogit = -Infinity;
    for (let i = 0; i < vocabSize; i++) {
      if (logits[i] > maxLogit) maxLogit = logits[i];
    }

    let sumExp = 0;
    const allProbs = new Float32Array(vocabSize);
    for (let i = 0; i < vocabSize; i++) {
      const expVal = Math.exp((logits[i] - maxLogit) / temp);
      allProbs[i] = expVal;
      sumExp += expVal;
    }
    const invSum = 1.0 / (sumExp + 1e-12);
    let entropy = 0;
    for (let i = 0; i < vocabSize; i++) {
      allProbs[i] *= invSum;
      const p = allProbs[i];
      if (p > 1e-12) entropy -= p * Math.log2(p);
    }

    // 2. Extract Top 5 and sort candidates for Top-K / Top-P
    const candidates: Array<{ id: number; prob: number; logit: number }> = [];
    for (let i = 0; i < vocabSize; i++) {
      candidates.push({ id: i, prob: allProbs[i], logit: logits[i] });
    }
    candidates.sort((a, b) => b.prob - a.prob);

    const top5 = candidates.slice(0, 5);

    // Top-K filter
    const kFiltered = topK > 0 ? candidates.slice(0, Math.min(topK, vocabSize)) : candidates;

    // Top-P filter
    let cumProb = 0;
    const nucleus: typeof candidates = [];
    for (const item of kFiltered) {
      nucleus.push(item);
      cumProb += item.prob;
      if (cumProb >= topP) break;
    }

    let nSum = 0;
    for (const item of nucleus) nSum += item.prob;
    const invNSum = 1.0 / (nSum + 1e-12);

    // Sample
    const r = rng.nextFloat();
    let acc = 0;
    let chosenId = nucleus[0].id;
    let chosenProb = nucleus[0].prob;

    for (const item of nucleus) {
      const normProb = item.prob * invNSum;
      acc += normProb;
      if (r <= acc) {
        chosenId = item.id;
        chosenProb = item.prob;
        break;
      }
    }

    // Surprise: -log2(P(token))
    const surprise = -Math.log2(Math.max(chosenProb, 1e-6));

    return { nextToken: chosenId, entropy, surprise, top5 };
  }

  /**
   * High-Performance Autoregressive Token Generator streaming each token with Top-5 metadata.
   */
  public async *generate(
    prompt: string | number[] | Uint32Array | Uint16Array,
    options: KvGenerateOptions = {}
  ): AsyncGenerator<KvTokenResult, void, unknown> {
    const maxTokens = options.maxTokens ?? 100;
    const temperature = options.temperature ?? 0.8;
    const topK = options.topK ?? 10;
    const topP = options.topP ?? 0.9;
    const seed = options.seed ?? (Date.now() & 0xffffffff);
    const rng = new Xoshiro128StarStar(seed);

    let promptIds: number[] = [];
    if (typeof prompt === 'string') {
      if (this.tokenizer) {
        promptIds = Array.from(this.tokenizer.encode(prompt));
      } else {
        promptIds = Array.from(new TextEncoder().encode(prompt));
      }
    } else {
      promptIds = Array.from(prompt);
    }
    if (promptIds.length === 0) promptIds.push(0);

    const history: number[] = [...promptIds];
    const contextLen = this.config.contextLen;

    // Prefill prompt
    let logits = await this.prefill(history.slice(-contextLen));
    let currentPos = Math.min(history.length, contextLen);

    let fullGeneratedText = typeof prompt === 'string' ? prompt : '';

    for (let step = 0; step < maxTokens; step++) {
      if (options.signal?.aborted) break;

      // Sample next token from latest logits
      const sampled = GpuKvModel.sampleNextToken(logits, temperature, topK, topP, rng);
      const nextToken = sampled.nextToken;

      // Check stop tokens
      if (options.stopTokens && options.stopTokens.includes(nextToken)) break;

      history.push(nextToken);

      let tokenStr = '';
      if (this.tokenizer) {
        tokenStr = this.tokenizer.decode([nextToken]);
      } else {
        tokenStr = String.fromCharCode(nextToken);
      }
      fullGeneratedText += tokenStr;

      // Populate string representations for top 5 candidates
      const top5WithStr = sampled.top5.map(c => ({
        ...c,
        tokenStr: this.tokenizer ? this.tokenizer.decode([c.id]) : String.fromCharCode(c.id)
      }));

      const isLast = step === maxTokens - 1;

      yield {
        token: tokenStr,
        tokenId: nextToken,
        step,
        isLast,
        fullText: fullGeneratedText,
        entropy: sampled.entropy,
        surprise: sampled.surprise,
        top5: top5WithStr
      };

      if (isLast) break;

      // Advance to next position
      if (currentPos >= contextLen) {
        // Context window full: re-prefill the last T-1 tokens preceding nextToken
        const trailing = history.slice(-contextLen, -1);
        await this.prefill(trailing);
        // Step nextToken at pos contextLen - 1
        logits = await this.step(nextToken, contextLen - 1);
        currentPos = contextLen;
      } else {
        logits = await this.step(nextToken, currentPos);
        currentPos++;
      }
    }
  }

  /**
   * Returns precise GPU memory allocation stats for this KV generator instance.
   */
  public getMemoryFootprintBytes(): {
    paramsBytes: number;
    kvCacheBytes: number;
    activationWorkBytes: number;
    uniformBytes: number;
    totalGpuBytes: number;
  } {
    const { dModel, nLayers, contextLen, dFF, vocabSize } = this.config;
    const kvTotalFloats = nLayers * 2 * contextLen * dModel;
    const kvCacheBytes = kvTotalFloats * 4;
    const paramsBytes = this.paramsBuffer.size;
    const activationWorkBytes = (dModel * 6 + dFF + vocabSize * 2) * 4;
    const uniformBytes = (nLayers * 7 + 5) * 64; // Approximated uniform buffer sizes
    const totalGpuBytes = paramsBytes + kvCacheBytes + activationWorkBytes + uniformBytes;

    return {
      paramsBytes,
      kvCacheBytes,
      activationWorkBytes,
      uniformBytes,
      totalGpuBytes
    };
  }

  /**
   * Returns cache capacity and head dimension geometry.
   */
  public getCacheCapacityInfo(): {
    contextLen: number;
    headDim: number;
    nHeads: number;
    nLayers: number;
    kvCacheFloatsPerToken: number;
  } {
    const { contextLen, dModel, nHeads, nLayers } = this.config;
    const headDim = dModel / nHeads;
    const kvCacheFloatsPerToken = nLayers * 2 * dModel;

    return {
      contextLen,
      headDim,
      nHeads,
      nLayers,
      kvCacheFloatsPerToken
    };
  }

  /**
   * Releases all allocated WebGPU buffers and uniform storage to prevent VRAM memory leaks.
   */
  public destroy(): void {
    const buffers = [
      this.paramsBuffer,
      this.kvCacheBuf,
      this.xBuf,
      this.ln1Buf,
      this.qBuf,
      this.attnOutBuf,
      this.midBuf,
      this.ln2Buf,
      this.w1Buf,
      this.finalLnBuf,
      this.logitsBuf,
      this.logitsStagingBuf,
      this.modelDimsBuf,
      this.embedUniBuf,
      this.geluCountBuf,
      this.finalLnUniBuf,
      this.tiedHeadUniBuf,
      ...this.ln1UniBuffers,
      ...this.qkvUniBuffers,
      ...this.attnUniBuffers,
      ...this.woUniBuffers,
      ...this.ln2UniBuffers,
      ...this.w1UniBuffers,
      ...this.w2UniBuffers
    ];

    for (const buf of buffers) {
      if (buf) {
        try {
          buf.destroy();
        } catch {
          // Ignore if already destroyed
        }
      }
    }
  }
}
