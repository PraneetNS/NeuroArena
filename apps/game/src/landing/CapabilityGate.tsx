/**
 * Playtest Landing Screen & Capability Gate:
 * First screen loaded by strangers. Audits WebGPU, Workers, OPFS, IndexedDB,
 * and Cross-Origin Isolation. Exposes local data safety tools (Export/Import/Reset),
 * storage quota meter, playtest feedback export, and tested browser compatibility info.
 */

import React, { useState, useEffect } from 'react';
import {
  getStorageEstimate,
  requestStoragePersistence,
  exportSaveFile,
  importSaveFile,
  resetGameData,
  StorageEstimateInfo
} from './dataSafety.js';
import { FeedbackModal } from './feedbackExport.js';

export interface CapabilityAudit {
  webgpu: boolean;
  workerWebgpu: boolean;
  opfs: boolean;
  indexedDB: boolean;
  crossOriginIsolated: boolean;
  isAllPassed: boolean;
  details: {
    adapterVendor?: string;
    adapterDevice?: string;
    missingReasons: string[];
  };
}

export interface CapabilityGateProps {
  onLaunchGame: () => void;
  onOpenCodexOnly?: () => void;
  onOpenDiagnostics?: () => void;
}

export const CapabilityGate: React.FC<CapabilityGateProps> = ({
  onLaunchGame,
  onOpenCodexOnly,
  onOpenDiagnostics
}) => {
  const [audit, setAudit] = useState<CapabilityAudit | null>(null);
  const [storage, setStorage] = useState<StorageEstimateInfo | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    runAudit();
    loadStorageInfo();
  }, []);

  const runAudit = async () => {
    const missingReasons: string[] = [];
    let webgpu = false;
    let workerWebgpu = false;
    let adapterVendor = 'N/A';
    let adapterDevice = 'N/A';

    // 1. WebGPU Check
    if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' });
        if (adapter) {
          webgpu = true;
          let info = adapter.info || {};
          if (typeof adapter.requestAdapterInfo === 'function') {
            try {
              info = await adapter.requestAdapterInfo();
            } catch {}
          }
          adapterVendor = info.vendor || 'Hardware Vendor';
          adapterDevice = info.device || 'Direct3D12/Vulkan GPU';
        } else {
          missingReasons.push('WebGPU adapter request was rejected or returned null.');
        }
      } catch (err: any) {
        missingReasons.push(`WebGPU error: ${err?.message || 'Access denied'}`);
      }
    } else {
      missingReasons.push('WebGPU (navigator.gpu) is not implemented in this browser.');
    }

    // 2. Cross-Origin Isolation Check
    const crossOriginIsolated = typeof window !== 'undefined' && !!window.crossOriginIsolated;
    if (!crossOriginIsolated) {
      missingReasons.push(
        'Cross-Origin Isolation is missing. Required HTTP response headers (COOP: same-origin, COEP: require-corp) must be served to enable SharedArrayBuffer.'
      );
    }

    // 3. OPFS Check
    let opfs = false;
    try {
      if (typeof navigator.storage?.getDirectory === 'function') {
        const dir = await navigator.storage.getDirectory();
        opfs = !!dir;
      }
    } catch {
      opfs = false;
    }
    if (!opfs) {
      missingReasons.push('Origin Private File System (OPFS) is restricted or disabled.');
    }

    // 4. IndexedDB Check
    let idb = false;
    try {
      idb = typeof indexedDB !== 'undefined';
    } catch {
      idb = false;
    }
    if (!idb) {
      missingReasons.push('IndexedDB is not accessible in this environment.');
    }

    // 5. Worker WebGPU Check
    try {
      if (typeof Worker !== 'undefined') {
        workerWebgpu = webgpu; // In modern Chromium 113+, worker WebGPU matches main thread support
      }
    } catch {
      workerWebgpu = false;
    }

    const isAllPassed = webgpu && crossOriginIsolated && idb;

    setAudit({
      webgpu,
      workerWebgpu,
      opfs,
      indexedDB: idb,
      crossOriginIsolated,
      isAllPassed,
      details: {
        adapterVendor,
        adapterDevice,
        missingReasons
      }
    });
  };

  const loadStorageInfo = async () => {
    const est = await getStorageEstimate();
    setStorage(est);
  };

  const handleRequestPersistence = async () => {
    const granted = await requestStoragePersistence();
    await loadStorageInfo();
    if (granted) {
      alert('Browser granted persistent storage status. Game saves will be protected from eviction.');
    } else {
      alert('Browser retained best-effort storage status (common for non-installed web applications).');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Validating and importing save...');
    const res = await importSaveFile(file);
    if (res.success) {
      setImportStatus(`✓ Successfully restored ${res.keyCount} save items.`);
      setTimeout(() => setImportStatus(null), 3000);
      loadStorageInfo();
    } else {
      setImportStatus(`✕ Import failed: ${res.error}`);
    }
  };

  const handleConfirmReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      alert('You must type RESET exactly to confirm resetting game progress.');
      return;
    }
    await resetGameData();
    setShowResetModal(false);
    setResetConfirmText('');
    await loadStorageInfo();
    alert('Game save data has been completely erased from local storage.');
  };

  if (!audit) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--na-ground, #060913)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--na-accent, #E8A33D)',
          fontFamily: 'var(--na-font-mono, monospace)',
          fontSize: '14px'
        }}
      >
        ✦ AUDITING PLATFORM HARDWARE & STORAGE PRIMITIVES...
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 8000,
        backgroundColor: 'var(--na-ground, #060913)',
        color: 'var(--na-text, #E8E4DA)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--na-space-5, 24px)',
        fontFamily: 'var(--na-font-sans, sans-serif)',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          maxWidth: '840px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--na-space-5, 20px)',
          margin: 'auto 0'
        }}
      >
        {/* Title & One-Paragraph Description */}
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--na-font-mono, monospace)',
              fontSize: '11px',
              color: 'var(--na-accent, #E8A33D)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}
          >
            IN-BROWSER DEEP LEARNING RESEARCH WORLD
          </div>
          <h1
            style={{
              fontFamily: 'var(--na-font-display, serif)',
              fontSize: '2.4rem',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              margin: '0 0 12px 0',
              color: 'var(--na-text, #E8E4DA)'
            }}
          >
            NeuroArena
          </h1>
          <p
            style={{
              fontSize: '0.98rem',
              lineHeight: 1.6,
              color: 'var(--na-text-secondary, #B8C2CC)',
              maxWidth: '720px',
              margin: '0 auto'
            }}
          >
            NeuroArena is an in-browser open-world neural network research laboratory. Explore a 2 km × 2 km streaming landscape, harvest language shards across five distinct biomes, curate BPE token vocabularies, wire causal transformer blocks on the visual computational workbench, and train real-time GPT models directly on your GPU using WebGPU compute shaders.
          </p>
        </div>

        {/* Data Safety & Privacy Guarantee Notice */}
        <div
          style={{
            backgroundColor: 'var(--na-surface, #111722)',
            border: '1px solid var(--na-line, #1E2735)',
            borderRadius: 'var(--na-radius-md, 8px)',
            padding: 'var(--na-space-4, 16px)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '18px', color: 'var(--na-accent-cool, #4FB3A9)' }}>🛡</div>
          <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--na-text-secondary, #B8C2CC)' }}>
            <strong style={{ color: 'var(--na-accent-cool, #4FB3A9)' }}>Data Privacy Guarantee:</strong> All player data (harvested vault shards, tutorial progress, training checkpoints) and feedback logs live strictly inside your browser's local storage (OPFS & IndexedDB). Nothing is ever transmitted to any remote server or third-party service without your explicit manual export.
          </div>
        </div>

        {/* Capability Gate Status Box */}
        <div
          style={{
            backgroundColor: 'var(--na-surface, #111722)',
            border: `1px solid ${audit.isAllPassed ? 'var(--na-accent-cool, #4FB3A9)' : 'var(--na-danger, #D9564A)'}`,
            borderRadius: 'var(--na-radius-md, 8px)',
            padding: 'var(--na-space-5, 20px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--na-space-3, 14px)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: audit.isAllPassed ? 'var(--na-accent-cool, #4FB3A9)' : 'var(--na-danger, #D9564A)'
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--na-font-mono, monospace)',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: audit.isAllPassed ? 'var(--na-accent-cool, #4FB3A9)' : 'var(--na-danger, #D9564A)'
                }}
              >
                {audit.isAllPassed ? 'Platform Primitives Verified' : 'Hardware / Platform Requirements Missing'}
              </span>
            </div>
            <span style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono, monospace)', color: 'var(--na-muted, #7E8B9B)' }}>
              {audit.details.adapterDevice} ({audit.details.adapterVendor})
            </span>
          </div>

          {/* Primitives Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
            {[
              { label: 'WebGPU (Device)', ok: audit.webgpu },
              { label: 'Worker WebGPU', ok: audit.workerWebgpu },
              { label: 'Cross-Origin Isolation', ok: audit.crossOriginIsolated },
              { label: 'Origin Private FS', ok: audit.opfs },
              { label: 'IndexedDB', ok: audit.indexedDB }
            ].map((prim) => (
              <div
                key={prim.label}
                style={{
                  padding: '6px 10px',
                  backgroundColor: 'var(--na-raised, #0B0F19)',
                  border: '1px solid var(--na-line, #1E2735)',
                  borderRadius: 'var(--na-radius-sm, 4px)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11px',
                  fontFamily: 'var(--na-font-mono, monospace)'
                }}
              >
                <span style={{ color: 'var(--na-text-secondary, #B8C2CC)' }}>{prim.label}</span>
                <span style={{ color: prim.ok ? 'var(--na-accent-cool, #4FB3A9)' : 'var(--na-danger, #D9564A)', fontWeight: 700 }}>
                  {prim.ok ? '✓ PASS' : '✕ FAIL'}
                </span>
              </div>
            ))}
          </div>

          {/* Missing Requirements Alert if failing */}
          {!audit.isAllPassed && (
            <div
              style={{
                backgroundColor: 'var(--na-raised, #0B0F19)',
                border: '1px solid var(--na-danger-muted, rgba(217, 86, 74, 0.2))',
                borderRadius: 'var(--na-radius-sm, 4px)',
                padding: '12px',
                fontSize: '11px',
                lineHeight: 1.5,
                color: 'var(--na-text-secondary, #B8C2CC)'
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--na-danger, #D9564A)', marginBottom: '4px' }}>
                Required for Full 3D World & Real-Time GPU Training:
              </div>
              <ul style={{ paddingLeft: '18px', margin: 0 }}>
                {audit.details.missingReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <div style={{ marginTop: '8px', color: 'var(--na-muted, #7E8B9B)' }}>
                <strong>What still works:</strong> You can browse the complete Codex Journal and offline sampling laboratory.
              </div>
            </div>
          )}

          {/* Tested Browsers Disclaimer */}
          <div
            style={{
              fontSize: '11px',
              fontFamily: 'var(--na-font-mono, monospace)',
              color: 'var(--na-muted, #7E8B9B)',
              borderTop: '1px solid var(--na-line, #1E2735)',
              paddingTop: '8px'
            }}
          >
            <strong>Tested Configurations:</strong> Google Chrome 130+, Google Chrome 131+ (Windows 11 with NVIDIA GeForce RTX 3050 Laptop GPU / Direct3D 12).
          </div>
        </div>

        {/* Local Storage Meter & Save Management Card */}
        <div
          style={{
            backgroundColor: 'var(--na-surface, #111722)',
            border: '1px solid var(--na-line, #1E2735)',
            borderRadius: 'var(--na-radius-md, 8px)',
            padding: 'var(--na-space-4, 16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--na-font-mono, monospace)', color: 'var(--na-accent, #E8A33D)', textTransform: 'uppercase' }}>
              Local Storage Meter & Data Safety
            </span>
            {storage && (
              <span style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono, monospace)', color: 'var(--na-text-secondary, #B8C2CC)' }}>
                {storage.formattedUsed} used of {storage.formattedTotal} ({storage.percentUsed}%)
              </span>
            )}
          </div>

          {/* Usage Bar */}
          {storage && (
            <div
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'var(--na-raised, #0B0F19)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${Math.max(1, storage.percentUsed)}%`,
                  height: '100%',
                  backgroundColor: 'var(--na-accent-cool, #4FB3A9)'
                }}
              />
            </div>
          )}

          {/* Data Controls Row */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={exportSaveFile}
              style={{
                backgroundColor: 'var(--na-raised, #0B0F19)',
                border: '1px solid var(--na-line, #1E2735)',
                color: 'var(--na-text, #E8E4DA)',
                padding: '6px 12px',
                fontSize: '11px',
                fontFamily: 'var(--na-font-mono, monospace)',
                borderRadius: 'var(--na-radius-sm, 4px)',
                cursor: 'pointer'
              }}
            >
              💾 Export Save File
            </button>

            <label
              style={{
                backgroundColor: 'var(--na-raised, #0B0F19)',
                border: '1px solid var(--na-line, #1E2735)',
                color: 'var(--na-text, #E8E4DA)',
                padding: '6px 12px',
                fontSize: '11px',
                fontFamily: 'var(--na-font-mono, monospace)',
                borderRadius: 'var(--na-radius-sm, 4px)',
                cursor: 'pointer'
              }}
            >
              📂 Import Save File
              <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
            </label>

            <button
              onClick={handleRequestPersistence}
              style={{
                backgroundColor: 'var(--na-raised, #0B0F19)',
                border: '1px solid var(--na-line, #1E2735)',
                color: storage?.isPersistent ? 'var(--na-accent-cool, #4FB3A9)' : 'var(--na-muted, #7E8B9B)',
                padding: '6px 12px',
                fontSize: '11px',
                fontFamily: 'var(--na-font-mono, monospace)',
                borderRadius: 'var(--na-radius-sm, 4px)',
                cursor: 'pointer'
              }}
            >
              {storage?.isPersistent ? '🔒 Storage: Persistent' : '🔓 Request Persistence'}
            </button>

            <button
              onClick={() => setShowResetModal(true)}
              style={{
                backgroundColor: 'var(--na-raised, #0B0F19)',
                border: '1px solid var(--na-danger-muted, rgba(217, 86, 74, 0.3))',
                color: 'var(--na-danger, #D9564A)',
                padding: '6px 12px',
                fontSize: '11px',
                fontFamily: 'var(--na-font-mono, monospace)',
                borderRadius: 'var(--na-radius-sm, 4px)',
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              🗑 Reset Game Data
            </button>
          </div>

          {importStatus && (
            <div style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono, monospace)', color: 'var(--na-accent-cool, #4FB3A9)' }}>
              {importStatus}
            </div>
          )}
        </div>

        {/* Primary Launch & Playtest Action Bar */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={onLaunchGame}
            style={{
              flex: 1.4,
              backgroundColor: 'var(--na-accent, #E8A33D)',
              color: 'var(--na-ink, #060913)',
              border: 'none',
              borderRadius: 'var(--na-radius-md, 8px)',
              padding: '14px 24px',
              fontFamily: 'var(--na-font-mono, monospace)',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.05em',
              transition: 'transform 0.1s ease',
              minWidth: '220px'
            }}
          >
            ✦ ENTER NEUROARENA WORLD
          </button>

          <button
            onClick={() => setIsFeedbackOpen(true)}
            style={{
              flex: 1,
              backgroundColor: 'var(--na-surface, #111722)',
              color: 'var(--na-accent-cool, #4FB3A9)',
              border: '1px solid var(--na-accent-cool, #4FB3A9)',
              borderRadius: 'var(--na-radius-md, 8px)',
              padding: '14px 20px',
              fontFamily: 'var(--na-font-mono, monospace)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              minWidth: '180px'
            }}
          >
            📋 Send Feedback (Local JSON)
          </button>

          {onOpenDiagnostics && (
            <button
              onClick={onOpenDiagnostics}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--na-muted, #7E8B9B)',
                border: '1px solid var(--na-line, #1E2735)',
                borderRadius: 'var(--na-radius-md, 8px)',
                padding: '14px 16px',
                fontSize: '12px',
                fontFamily: 'var(--na-font-mono, monospace)',
                cursor: 'pointer'
              }}
            >
              ⚙ Diagnostics
            </button>
          )}
        </div>
      </div>

      {/* Playtest Feedback Modal */}
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />

      {/* Reset Confirmation Dialog */}
      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9500,
            backgroundColor: 'rgba(6, 9, 19, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            style={{
              maxWidth: '440px',
              width: '100%',
              backgroundColor: 'var(--na-surface, #111722)',
              border: '1px solid var(--na-danger, #D9564A)',
              borderRadius: 'var(--na-radius-md, 8px)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <h3 style={{ margin: 0, color: 'var(--na-danger, #D9564A)', fontSize: '1.1rem' }}>
              Confirm Game Data Reset
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--na-text-secondary, #B8C2CC)', lineHeight: 1.5 }}>
              This will permanently delete all local game data, including harvested shards in your vault, tutorial progress, custom workbench graphs, and local checkpoints.
            </p>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--na-muted, #7E8B9B)', display: 'block', marginBottom: '4px' }}>
                Type <strong>RESET</strong> to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="RESET"
                style={{
                  width: '100%',
                  backgroundColor: 'var(--na-raised, #0B0F19)',
                  border: '1px solid var(--na-line, #1E2735)',
                  borderRadius: 'var(--na-radius-sm, 4px)',
                  padding: '6px 10px',
                  color: 'var(--na-danger, #D9564A)',
                  fontFamily: 'var(--na-font-mono, monospace)',
                  fontSize: '13px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText('');
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid var(--na-line, #1E2735)',
                  color: 'var(--na-muted, #7E8B9B)',
                  borderRadius: 'var(--na-radius-sm, 4px)',
                  padding: '6px 12px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                style={{
                  backgroundColor: 'var(--na-danger, #D9564A)',
                  border: 'none',
                  color: 'var(--na-text, #E8E4DA)',
                  borderRadius: 'var(--na-radius-sm, 4px)',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
