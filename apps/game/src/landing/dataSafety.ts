/**
 * Data Safety & Local Storage Management:
 * Handles complete save export/import, storage quota metering,
 * storage persistence requests, and safe reset with confirmation.
 */

export interface StorageEstimateInfo {
  supported: boolean;
  usedBytes: number;
  totalBytes: number;
  percentUsed: number;
  isPersistent: boolean;
  formattedUsed: string;
  formattedTotal: string;
}

export interface SaveBundle {
  version: number;
  exportedAt: string;
  app: 'NeuroArena';
  data: Record<string, string>;
}

export const NA_STORAGE_PREFIXES = [
  'na_',
  'na_vault',
  'na_tutorial',
  'na_checkpoint',
  'na_workbench',
  'na_gpu_preference',
  'na_settings'
];

/**
 * Format raw byte counts to human-readable strings.
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Get accurate local storage estimate from navigator.storage.
 */
export async function getStorageEstimate(): Promise<StorageEstimateInfo> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return {
      supported: false,
      usedBytes: 0,
      totalBytes: 0,
      percentUsed: 0,
      isPersistent: false,
      formattedUsed: 'N/A',
      formattedTotal: 'N/A'
    };
  }

  try {
    const [estimate, isPersistent] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false)
    ]);

    const used = estimate.usage || 0;
    const total = estimate.quota || 0;
    const percent = total > 0 ? (used / total) * 100 : 0;

    return {
      supported: true,
      usedBytes: used,
      totalBytes: total,
      percentUsed: parseFloat(percent.toFixed(2)),
      isPersistent: !!isPersistent,
      formattedUsed: formatBytes(used),
      formattedTotal: formatBytes(total)
    };
  } catch (err) {
    console.warn('[DataSafety] Failed to estimate storage:', err);
    return {
      supported: false,
      usedBytes: 0,
      totalBytes: 0,
      percentUsed: 0,
      isPersistent: false,
      formattedUsed: 'N/A',
      formattedTotal: 'N/A'
    };
  }
}

/**
 * Request persistent browser storage so data is never evicted under storage pressure.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      return await navigator.storage.persist();
    } catch (err) {
      console.warn('[DataSafety] Failed to request storage persistence:', err);
    }
  }
  return false;
}

/**
 * Package all player data into one JSON bundle and download it as a file.
 */
export function exportSaveFile(): void {
  const saveMap: Record<string, string> = {};

  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (NA_STORAGE_PREFIXES.some((p) => key.startsWith(p)) || key.includes('neuroarena'))) {
        saveMap[key] = localStorage.getItem(key) || '';
      }
    }
  }

  const bundle: SaveBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'NeuroArena',
    data: saveMap
  };

  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().slice(0, 10);

  const a = document.createElement('a');
  a.href = url;
  a.download = `neuroarena_save_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validate and restore a save bundle from a selected JSON file.
 */
export async function importSaveFile(file: File): Promise<{ success: boolean; keyCount: number; error?: string }> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as SaveBundle;

    if (!parsed || parsed.app !== 'NeuroArena' || !parsed.data) {
      return { success: false, keyCount: 0, error: 'Invalid NeuroArena save file format.' };
    }

    let restoredCount = 0;
    for (const [key, val] of Object.entries(parsed.data)) {
      try {
        localStorage.setItem(key, val);
        restoredCount++;
      } catch (storageErr) {
        if (isQuotaError(storageErr)) {
          return {
            success: false,
            keyCount: restoredCount,
            error: 'Storage quota exceeded while importing save. Free up space or export old checkpoints.'
          };
        }
      }
    }

    return { success: true, keyCount: restoredCount };
  } catch (err: any) {
    return { success: false, keyCount: 0, error: err?.message || 'Failed to parse JSON file.' };
  }
}

/**
 * Reset all player data with clean cleanup across localStorage and IndexedDB.
 */
export async function resetGameData(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (NA_STORAGE_PREFIXES.some((p) => key.startsWith(p)) || key.includes('neuroarena'))) {
        keysToRemove.push(key);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  }

  // Attempt to delete IndexedDB databases
  if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name && (db.name.includes('na_') || db.name.includes('neuroarena'))) {
          indexedDB.deleteDatabase(db.name);
        }
      }
    } catch {}
  }
}

/**
 * Detect browser quota exceeded errors across engines (V8, WebKit, Gecko).
 */
export function isQuotaError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  return (
    anyErr.name === 'QuotaExceededError' ||
    anyErr.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    anyErr.code === 22 ||
    anyErr.code === 1014
  );
}
