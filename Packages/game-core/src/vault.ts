/**
 * Vault State & Storage Manager.
 * 
 * Manages harvested shards, keep/discard statuses, running metrics,
 * dataset fingerprinting, token stream serialization for Workbench/GpuTrainer,
 * JSON export/import, IndexedDB persistence, and gated Autopsy tag reveal.
 */

import { Shard, VaultEntry, VaultStats, VaultState, CapacityTier, VAULT_CAPACITY_TIERS } from './types.js';
import { VALIDATION_CORPUS_TEXT } from './data/corpus.js';

const DB_NAME = 'NeuroArenaVault';
const DB_VERSION = 1;
const STORE_NAME = 'vault_entries';

/**
 * Computes deterministic 64-bit hexadecimal dataset fingerprint
 * over kept shard IDs and texts.
 */
export function computeDatasetFingerprint(entries: VaultEntry[]): string {
  const kept = entries.filter(e => e.status === 'keep').sort((a, b) => a.shardId.localeCompare(b.shardId));
  if (kept.length === 0) return '0000000000000000';

  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;

  for (const e of kept) {
    const str = `${e.shardId}:${e.text}\n`;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ (c >> 8), 0x01000193);
    }
  }

  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export class VaultManager {
  private entries: VaultEntry[] = [];
  private onUpdateCallbacks: Array<(state: VaultState) => void> = [];
  private db: IDBDatabase | null = null;
  private isDbReady = false;

  private completedRunsCount = 0;
  private hasPerformedAutopsy = false;
  private bestValLoss = Infinity;

  public getCompletedRunsCount(): number {
    return this.completedRunsCount;
  }

  public getHasPerformedAutopsy(): boolean {
    return this.hasPerformedAutopsy;
  }

  public recordRunCompleted(valLoss?: number): void {
    this.completedRunsCount++;
    if (valLoss !== undefined && valLoss < this.bestValLoss) {
      this.bestValLoss = valLoss;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('na_vault_best_val_loss', String(this.bestValLoss));
        localStorage.setItem('na_vault_completed_runs', String(this.completedRunsCount));
      } catch {}
    }
    this.notify();
  }

  public recordAutopsyPerformed(): void {
    this.hasPerformedAutopsy = true;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('na_vault_autopsy_performed', 'true');
      } catch {}
    }
    this.notify();
  }

  public getCapacityTier(): CapacityTier {
    if (this.bestValLoss <= 2.834) {
      return VAULT_CAPACITY_TIERS[2]; // Tier 3: Grand Archive (beats Trigram 2.834)
    }
    if (this.bestValLoss <= 3.286) {
      return VAULT_CAPACITY_TIERS[1]; // Tier 2: Journeyman Vault (beats Bigram 3.286)
    }
    return VAULT_CAPACITY_TIERS[0]; // Tier 1: Novice Ledger (350 pages)
  }

  constructor() {
    if (typeof localStorage !== 'undefined') {
      try {
        const savedLoss = localStorage.getItem('na_vault_best_val_loss');
        if (savedLoss) this.bestValLoss = parseFloat(savedLoss);
        const savedRuns = localStorage.getItem('na_vault_completed_runs');
        if (savedRuns) this.completedRunsCount = parseInt(savedRuns, 10);
        const savedAutopsy = localStorage.getItem('na_vault_autopsy_performed');
        if (savedAutopsy) this.hasPerformedAutopsy = savedAutopsy === 'true';
      } catch {}
    }
    this.initDb();
  }

  private async initDb(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'shardId' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('collectedTime', 'collectedTime', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.isDbReady = true;
        this.loadFromDb();
      };
    } catch {
      // Fallback to in-memory mode if IndexedDB is blocked
    }
  }

  private async loadFromDb(): Promise<void> {
    if (!this.db || !this.isDbReady) return;

    try {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        if (Array.isArray(req.result) && req.result.length > 0) {
          this.entries = req.result;
          this.notify();
        }
      };
    } catch {
      // Ignore load errors
    }
  }

  private async saveEntryToDb(entry: VaultEntry): Promise<void> {
    if (!this.db || !this.isDbReady) return;
    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
    } catch {
      // Ignore DB write errors
    }
  }

  private async removeEntryFromDb(shardId: string): Promise<void> {
    if (!this.db || !this.isDbReady) return;
    try {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(shardId);
    } catch {
      // Ignore DB delete errors
    }
  }

  public subscribe(cb: (state: VaultState) => void): () => void {
    this.onUpdateCallbacks.push(cb);
    cb(this.getState());
    return () => {
      this.onUpdateCallbacks = this.onUpdateCallbacks.filter(c => c !== cb);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const cb of this.onUpdateCallbacks) {
      cb(state);
    }
  }

  public getState(): VaultState {
    return {
      entries: [...this.entries],
      stats: this.computeStats()
    };
  }

  public hasShard(shardId: string): boolean {
    return this.entries.some(e => e.shardId === shardId);
  }

  /**
   * Harvests a shard and adds it to the vault.
   */
  public harvest(shard: Shard): VaultEntry | null {
    const existing = this.entries.find(e => e.shardId === shard.id);
    if (existing) return existing;

    const maxCapacity = this.getCapacityTier().maxPages;
    if (this.entries.length >= maxCapacity) {
      return null;
    }

    const entry: VaultEntry = {
      shardId: shard.id,
      text: shard.text,
      collectedTime: Date.now(),
      status: 'keep',
      sourceId: shard.sourceId,
      regionId: shard.regionId,
      tag: shard.tag,
      isRevealed: false
    };

    this.entries.push(entry);
    this.saveEntryToDb(entry);
    this.notify();
    return entry;
  }

  public toggleStatus(shardId: string): void {
    const entry = this.entries.find(e => e.shardId === shardId);
    if (entry) {
      entry.status = entry.status === 'keep' ? 'discard' : 'keep';
      this.saveEntryToDb(entry);
      this.notify();
    }
  }

  public keepAll(): void {
    for (const entry of this.entries) {
      entry.status = 'keep';
      this.saveEntryToDb(entry);
    }
    this.notify();
  }

  public discardAll(): void {
    for (const entry of this.entries) {
      entry.status = 'discard';
      this.saveEntryToDb(entry);
    }
    this.notify();
  }

  public setEntryStatus(shardId: string, status: 'keep' | 'discard'): void {
    const entry = this.entries.find(e => e.shardId === shardId);
    if (entry) {
      entry.status = status;
      this.saveEntryToDb(entry);
      this.notify();
    }
  }

  public removeEntry(shardId: string): void {
    const idx = this.entries.findIndex(e => e.shardId === shardId);
    if (idx !== -1) {
      this.entries.splice(idx, 1);
      this.removeEntryFromDb(shardId);
      this.notify();
    }
  }

  public revealAllTags(): void {
    for (const e of this.entries) {
      e.isRevealed = true;
    }
    this.notify();
  }

  /**
   * Autopsy API: reveals ground-truth tags only after verifying that a completed
   * training run exists in OPFS storage.
   */
  public async revealTagsFor(runId: string): Promise<VaultState> {
    const isCompleted = await this.checkRunCompletedInOpfs(runId);
    if (!isCompleted) {
      throw new Error(
        `Autopsy API precondition failed: Training run '${runId}' does not exist as a completed training run in OPFS. Ground-truth quality tags remain gated.`
      );
    }
    this.revealAllTags();
    return this.getState();
  }

  private async checkRunCompletedInOpfs(runId: string): Promise<boolean> {
    if ((globalThis as any).__completedRuns && (globalThis as any).__completedRuns.has(runId)) {
      return true;
    }
    if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.getDirectory) {
      return Boolean((globalThis as any).__completedRuns?.has(runId));
    }
    try {
      const root = await navigator.storage.getDirectory();
      let runsDir: FileSystemDirectoryHandle;
      try {
        runsDir = await root.getDirectoryHandle('neuroarena_runs');
      } catch {
        try {
          runsDir = await root.getDirectoryHandle('runs');
        } catch {
          runsDir = await root.getDirectoryHandle('training_runs');
        }
      }
      const runDir = await runsDir.getDirectoryHandle(runId);
      const manifestFile = await runDir.getFileHandle('manifest.json');
      const file = await manifestFile.getFile();
      const text = await file.text();
      const manifest = JSON.parse(text);
      return Boolean(
        manifest &&
          (manifest.status === 'finished' ||
            manifest.status === 'completed' ||
            manifest.completed === true ||
            (typeof manifest.step === 'number' && manifest.step > 0))
      );
    } catch {
      return false;
    }
  }

  public clear(): void {
    this.entries = [];
    if (this.db && this.isDbReady) {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
      } catch {}
    }
    this.notify();
  }

  /**
   * Exports the entire vault as a formatted JSON document.
   */
  public exportToJson(): string {
    const state = this.getState();
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      fingerprint: state.stats.fingerprint,
      stats: state.stats,
      entries: state.entries
    };
    return JSON.stringify(payload, null, 2);
  }

  /**
   * Imports vault entries from a JSON file string.
   */
  public async importFromJson(jsonStr: string): Promise<VaultState> {
    const payload = JSON.parse(jsonStr);
    if (!payload || !Array.isArray(payload.entries)) {
      throw new Error('Invalid vault JSON payload: missing entries array');
    }

    this.entries = payload.entries;
    if (this.db && this.isDbReady) {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        for (const entry of this.entries) {
          store.put(entry);
        }
      } catch {}
    }
    this.notify();
    return this.getState();
  }

  /**
   * Computes current running stats across vault entries.
   */
  public computeStats(tokenizer?: { encode: (text: string) => number[] | Uint32Array }): VaultStats {
    const kept = this.entries.filter(e => e.status === 'keep');
    let totalTokens = 0;
    const all3Grams = new Set<string>();
    let total3Grams = 0;
    const sourceCounts: Record<string, number> = {};

    for (const e of kept) {
      if (tokenizer) {
        totalTokens += tokenizer.encode(e.text).length;
      } else {
        totalTokens += Math.max(1, Math.round(e.text.length / 4));
      }

      const words = e.text.toLowerCase().match(/[a-zA-Z0-9]+/g) || [];
      for (let i = 0; i <= words.length - 3; i++) {
        total3Grams++;
        all3Grams.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }

      const src = e.regionId || e.sourceId || 'unknown';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    }

    const uniqueRatio = total3Grams > 0 ? all3Grams.size / total3Grams : 1.0;

    const sourceMix: Record<string, number> = {};
    if (kept.length > 0) {
      for (const [src, count] of Object.entries(sourceCounts)) {
        sourceMix[src] = Number((count / kept.length).toFixed(3));
      }
    }

    const fingerprint = computeDatasetFingerprint(this.entries);
    const activeTier = this.getCapacityTier();
    let nextTierUnlock: string | undefined = undefined;
    if (activeTier.tier === 1) {
      nextTierUnlock = `Beat BIGRAM baseline on VAL (val loss ≤ 3.286) to unlock Tier 2 (${VAULT_CAPACITY_TIERS[1].maxPages} pages)`;
    } else if (activeTier.tier === 2) {
      nextTierUnlock = `Beat TRIGRAM baseline on VAL (val loss ≤ 2.834) to unlock Tier 3 (${VAULT_CAPACITY_TIERS[2].maxPages} pages)`;
    }

    return {
      count: this.entries.length,
      keptCount: kept.length,
      discardedCount: this.entries.length - kept.length,
      tokens: totalTokens,
      uniqueRatio: Number(uniqueRatio.toFixed(3)),
      sourceMix,
      fingerprint,
      maxCapacity: activeTier.maxPages,
      tier: activeTier.tier,
      tierTitle: activeTier.title,
      nextTierUnlock
    };
  }

  /**
   * Converts kept vault entries to a tokenized training stream,
   * paired with a fixed, independent validation split from the 10% VAL region.
   */
  public vaultToTokenStream(tokenizer: { encode: (text: string) => number[] | Uint32Array }): {
    trainTokens: Uint32Array;
    valTokens: Uint32Array;
    rawText: string;
    fingerprint: string;
  } {
    const kept = this.entries.filter(e => e.status === 'keep');
    let trainText = '';
    if (kept.length > 0) {
      trainText = kept.map(e => e.text).join('\n\n');
    } else {
      trainText = 'The empty vault whispers silence across the gradient hills.';
    }

    // Fixed held-out validation split independent of collection (last 10% of input.txt)
    const valText = VALIDATION_CORPUS_TEXT;

    const trainEncoded = tokenizer.encode(trainText);
    const valEncoded = tokenizer.encode(valText);
    const fingerprint = computeDatasetFingerprint(this.entries);

    return {
      trainTokens: new Uint32Array(trainEncoded),
      valTokens: new Uint32Array(valEncoded),
      rawText: trainText,
      fingerprint
    };
  }

  /**
   * Debug command: Fills the vault with N random shards from the world state.
   */
  public fillRandomShards(count: number, worldShards: Shard[]): number {
    let added = 0;
    const available = worldShards.filter(s => !this.hasShard(s.id));
    const shuffled = [...available].sort(() => Math.random() - 0.5);

    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      this.harvest(shuffled[i]);
      added++;
    }
    return added;
  }
}
