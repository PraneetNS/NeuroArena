/**
 * OPFS (Origin Private File System) Checkpoint Storage for ML-Core.
 *
 * Persists training checkpoints in browser-native sandboxed OPFS:
 * Directory layout:
 *   neuroarena_runs/
 *     <runId>/
 *       manifest.json   (Latest manifest: config, tokenizer, hyperparams, metrics history, seed, RNG state)
 *       weights.bin     (Latest flat float32 weights)
 *       optimizer.bin   (Latest flat float32 optimizer m & v moments)
 *       best/
 *         manifest.json
 *         weights.bin
 *         optimizer.bin
 *       step_<N>/
 *         manifest.json
 *         weights.bin
 *         optimizer.bin
 *
 * Retention: Keeps the last K checkpoints plus the best-by-val-loss checkpoint.
 * Supports transparent fallback to memory/in-process storage when navigator.storage is not present.
 */

import { CheckpointMetadata, RunManifest } from './types.js';

export interface CheckpointData {
  manifest: RunManifest;
  weights: Float32Array;
  optimizer?: Float32Array;
}

export class OpfsCheckpointStorage {
  private memoryStore = new Map<string, Uint8Array>();

  /**
   * Checks if OPFS is supported in the current environment.
   */
  public static isOpfsAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.storage !== 'undefined' &&
      typeof navigator.storage.getDirectory === 'function'
    );
  }

  /**
   * Retrieves or creates a directory handle inside OPFS.
   */
  private async getDirectory(pathParts: string[]): Promise<FileSystemDirectoryHandle | null> {
    if (!OpfsCheckpointStorage.isOpfsAvailable()) return null;
    let dir = await navigator.storage.getDirectory();
    for (const part of pathParts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
    return dir;
  }

  /**
   * Writes binary or text data to an OPFS file path or memory fallback.
   */
  private async writeFile(
    pathParts: string[],
    fileName: string,
    data: Uint8Array | string
  ): Promise<void> {
    const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const dir = await this.getDirectory(pathParts);
    if (dir) {
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      // Use createWritable (supported in worker and window)
      const writable = await fileHandle.createWritable();
      await writable.write(bytes as unknown as BufferSource);
      await writable.close();
    } else {
      const key = [...pathParts, fileName].join('/');
      this.memoryStore.set(key, bytes);
    }
  }

  /**
   * Reads a file as binary data from OPFS or memory fallback.
   */
  private async readFile(pathParts: string[], fileName: string): Promise<Uint8Array | null> {
    const dir = await this.getDirectory(pathParts);
    if (dir) {
      try {
        const fileHandle = await dir.getFileHandle(fileName);
        const file = await fileHandle.getFile();
        const buf = await file.arrayBuffer();
        return new Uint8Array(buf);
      } catch {
        return null;
      }
    } else {
      const key = [...pathParts, fileName].join('/');
      return this.memoryStore.get(key) || null;
    }
  }

  /**
   * Deletes a directory and its contents from OPFS or memory fallback.
   */
  private async removeDirectory(parentPath: string[], dirName: string): Promise<void> {
    const dir = await this.getDirectory(parentPath);
    if (dir) {
      try {
        await dir.removeEntry(dirName, { recursive: true });
      } catch {
        // ignore if already deleted
      }
    } else {
      const prefix = [...parentPath, dirName].join('/') + '/';
      for (const k of Array.from(this.memoryStore.keys())) {
        if (k.startsWith(prefix)) {
          this.memoryStore.delete(k);
        }
      }
    }
  }

  /**
   * Saves a checkpoint for the given run:
   * 1. Saves step_<N> checkpoint.
   * 2. If best-by-val-loss, updates best/ checkpoint.
   * 3. Updates latest manifest, weights, and optimizer in the root run directory.
   * 4. Prunes older checkpoints, retaining the last K plus best.
   */
  public async saveCheckpoint(
    runId: string,
    manifest: RunManifest,
    weights: Float32Array,
    optimizer?: Float32Array
  ): Promise<string> {
    const step = manifest.step;
    const runPath = ['neuroarena_runs', runId];
    const stepPath = [...runPath, `step_${step}`];

    const weightsBytes = new Uint8Array(weights.buffer, weights.byteOffset, weights.byteLength);
    const optBytes = optimizer
      ? new Uint8Array(optimizer.buffer, optimizer.byteOffset, optimizer.byteLength)
      : undefined;

    // Record checkpoint in manifest
    const ckptMeta: CheckpointMetadata = {
      step,
      valLoss: manifest.metricHistory[manifest.metricHistory.length - 1]?.valLoss,
      trainLoss: manifest.metricHistory[manifest.metricHistory.length - 1]?.trainLoss,
      timestamp: Date.now(),
      weightsFile: 'weights.bin',
      optimizerFile: optBytes ? 'optimizer.bin' : undefined
    };

    // Update manifest's checkpoint list (prevent duplicate steps)
    manifest.checkpoints = manifest.checkpoints.filter(c => c.step !== step);
    manifest.checkpoints.push(ckptMeta);

    const manifestJson = JSON.stringify(manifest, null, 2);

    // 1. Write step_<step>
    await this.writeFile(stepPath, 'manifest.json', manifestJson);
    await this.writeFile(stepPath, 'weights.bin', weightsBytes);
    if (optBytes) {
      await this.writeFile(stepPath, 'optimizer.bin', optBytes);
    }

    // 2. If best-by-val-loss, write to best/
    if (manifest.bestStep === step) {
      const bestPath = [...runPath, 'best'];
      await this.writeFile(bestPath, 'manifest.json', manifestJson);
      await this.writeFile(bestPath, 'weights.bin', weightsBytes);
      if (optBytes) {
        await this.writeFile(bestPath, 'optimizer.bin', optBytes);
      }
    }

    // 3. Write latest to run root
    await this.writeFile(runPath, 'manifest.json', manifestJson);
    await this.writeFile(runPath, 'weights.bin', weightsBytes);
    if (optBytes) {
      await this.writeFile(runPath, 'optimizer.bin', optBytes);
    }

    // 4. Prune older checkpoints (keep last K plus best)
    await this.pruneCheckpoints(runId, manifest);

    return stepPath.join('/');
  }

  /**
   * Prunes old checkpoints keeping the last K plus the best step.
   */
  public async pruneCheckpoints(runId: string, manifest: RunManifest): Promise<void> {
    const keepK = manifest.hyperparameters.keepCheckpoints ?? 3;
    const bestStep = manifest.bestStep;

    const allSteps = manifest.checkpoints.map(c => c.step).sort((a, b) => a - b);
    if (allSteps.length <= keepK) return;

    // Last K steps
    const keepSteps = new Set(allSteps.slice(-keepK));
    // Plus best step
    if (bestStep != null) {
      keepSteps.add(bestStep);
    }

    const runPath = ['neuroarena_runs', runId];
    const prunedSteps: number[] = [];

    for (const s of allSteps) {
      if (!keepSteps.has(s)) {
        await this.removeDirectory(runPath, `step_${s}`);
        prunedSteps.push(s);
      }
    }

    if (prunedSteps.length > 0) {
      manifest.checkpoints = manifest.checkpoints.filter(c => !prunedSteps.includes(c.step));
      const manifestJson = JSON.stringify(manifest, null, 2);
      await this.writeFile(runPath, 'manifest.json', manifestJson);
    }
  }

  /**
   * Loads a checkpoint for a given runId.
   * If checkpointId is not specified or 'latest', loads latest checkpoint.
   * If 'best', loads best checkpoint.
   * If a number, loads step_<number>.
   */
  public async loadCheckpoint(
    runId: string,
    checkpointId?: string | number
  ): Promise<CheckpointData | null> {
    const runPath = ['neuroarena_runs', runId];
    let targetPath = runPath;

    if (checkpointId === 'best') {
      targetPath = [...runPath, 'best'];
    } else if (typeof checkpointId === 'number' || (typeof checkpointId === 'string' && /^\d+$/.test(checkpointId))) {
      targetPath = [...runPath, `step_${checkpointId}`];
    } else if (typeof checkpointId === 'string' && checkpointId !== 'latest') {
      targetPath = [...runPath, checkpointId];
    }

    const manifestBytes = await this.readFile(targetPath, 'manifest.json');
    if (!manifestBytes) {
      // Fallback to run root if step dir not found
      if (targetPath !== runPath) {
        return this.loadCheckpoint(runId, 'latest');
      }
      return null;
    }

    const manifestText = new TextDecoder().decode(manifestBytes);
    const manifest: RunManifest = JSON.parse(manifestText);

    const weightsBytes = await this.readFile(targetPath, 'weights.bin');
    if (!weightsBytes) return null;

    const weights = new Float32Array(
      weightsBytes.buffer.slice(
        weightsBytes.byteOffset,
        weightsBytes.byteOffset + weightsBytes.byteLength
      )
    );

    let optimizer: Float32Array | undefined;
    const optBytes = await this.readFile(targetPath, 'optimizer.bin');
    if (optBytes) {
      optimizer = new Float32Array(
        optBytes.buffer.slice(
          optBytes.byteOffset,
          optBytes.byteOffset + optBytes.byteLength
        )
      );
    }

    return { manifest, weights, optimizer };
  }

  /**
   * Lists available runs in OPFS.
   */
  public async listRuns(): Promise<string[]> {
    if (!OpfsCheckpointStorage.isOpfsAvailable()) {
      const runs = new Set<string>();
      for (const k of this.memoryStore.keys()) {
        const parts = k.split('/');
        if (parts[0] === 'neuroarena_runs' && parts[1]) {
          runs.add(parts[1]);
        }
      }
      return Array.from(runs);
    }

    const rootDir = await this.getDirectory(['neuroarena_runs']);
    if (!rootDir) return [];

    const runs: string[] = [];
    for await (const [name, handle] of (rootDir as any).entries()) {
      if (handle.kind === 'directory') {
        runs.push(name);
      }
    }
    return runs;
  }

  /**
   * Reads the manifest for a given runId.
   */
  public async getRunManifest(runId: string): Promise<RunManifest | null> {
    const bytes = await this.readFile(['neuroarena_runs', runId], 'manifest.json');
    if (!bytes) return null;
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
  }

  /**
   * Deletes a run and all its checkpoints from OPFS.
   */
  public async deleteRun(runId: string): Promise<void> {
    if (!OpfsCheckpointStorage.isOpfsAvailable()) {
      for (const k of Array.from(this.memoryStore.keys())) {
        if (k.startsWith(`neuroarena_runs/${runId}`)) {
          this.memoryStore.delete(k);
        }
      }
      return;
    }
    await this.removeDirectory(['neuroarena_runs'], runId);
  }
}

