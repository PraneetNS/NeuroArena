/**
 * Playtest Support & Diagnostic Feedback Exporter:
 * Generates an all-in-one local JSON diagnostic bundle containing hardware info,
 * WebGPU adapter profile, benchmark summary, tutorial step times, error logs,
 * and player impressions. Transmits zero network data.
 */

import React, { useState } from 'react';

export interface FeedbackBundle {
  exportedAt: string;
  app: string;
  playerNotes: string;
  category: string;
  rating: number;
  environment: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    windowInnerSize: string;
    devicePixelRatio: number;
    hardwareConcurrency: number;
    deviceMemory: number | string;
    crossOriginIsolated: boolean;
  };
  webgpu: {
    available: boolean;
    adapterVendor: string;
    adapterDevice: string;
    adapterArchitecture: string;
    adapterDescription: string;
    limits: Record<string, number>;
  };
  storage: {
    usedBytes: number;
    totalBytes: number;
  };
  tutorialProgress: any;
  benchmarkSummary: any;
  errorLog: any[];
}

export async function generateFeedbackPackage(
  playerNotes: string,
  category = 'General Gameplay',
  rating = 5
): Promise<FeedbackBundle> {
  let gpuInfo = {
    available: false,
    adapterVendor: 'N/A',
    adapterDevice: 'N/A',
    adapterArchitecture: 'N/A',
    adapterDescription: 'N/A',
    limits: {} as Record<string, number>
  };

  if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (adapter) {
        gpuInfo.available = true;
        let info = adapter.info || {};
        if (typeof adapter.requestAdapterInfo === 'function') {
          try {
            info = await adapter.requestAdapterInfo();
          } catch {}
        }
        gpuInfo.adapterVendor = info.vendor || 'Unknown Vendor';
        gpuInfo.adapterDevice = info.device || 'Direct3D12/Vulkan Device';
        gpuInfo.adapterArchitecture = info.architecture || 'Modern GPU Architecture';
        gpuInfo.adapterDescription = info.description || 'Hardware WebGPU Device';

        if (adapter.limits) {
          gpuInfo.limits = {
            maxBufferSize: adapter.limits.maxBufferSize,
            maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
            maxComputeWorkgroupStorageSize: adapter.limits.maxComputeWorkgroupStorageSize
          };
        }
      }
    } catch {}
  }

  let storageEstimate = { usedBytes: 0, totalBytes: 0 };
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const est = await navigator.storage.estimate();
      storageEstimate.usedBytes = est.usage || 0;
      storageEstimate.totalBytes = est.quota || 0;
    } catch {}
  }

  // Load tutorial progress from localStorage if available
  let tutorialProgress = null;
  try {
    const rawTut = localStorage.getItem('na_tutorial_state') || localStorage.getItem('na_tutorial_history');
    if (rawTut) tutorialProgress = JSON.parse(rawTut);
  } catch {}

  // Load benchmark summary if available
  let benchmarkSummary = null;
  try {
    const rawBench = localStorage.getItem('na_benchmark_last_run');
    if (rawBench) benchmarkSummary = JSON.parse(rawBench);
  } catch {}

  const errorLog = (window as any).__na_error_log || [];

  return {
    exportedAt: new Date().toISOString(),
    app: 'NeuroArena',
    playerNotes,
    category,
    rating,
    environment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform || 'N/A',
      language: navigator.language || 'en',
      screenResolution: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      windowInnerSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio || 1,
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      deviceMemory: (navigator as any).deviceMemory || 'Not exposed',
      crossOriginIsolated: window.crossOriginIsolated || false
    },
    webgpu: gpuInfo,
    storage: storageEstimate,
    tutorialProgress,
    benchmarkSummary,
    errorLog
  };
}

export function downloadFeedbackFile(bundle: FeedbackBundle): void {
  const jsonStr = JSON.stringify(bundle, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const a = document.createElement('a');
  a.href = url;
  a.download = `neuroarena_feedback_${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('Gameplay Experience');
  const [rating, setRating] = useState(5);
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    const bundle = await generateFeedbackPackage(notes, category, rating);
    downloadFeedbackFile(bundle);
    setIsExporting(false);
    setExported(true);
    setTimeout(() => {
      setExported(false);
      onClose();
    }, 1500);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        backgroundColor: 'rgba(6, 9, 19, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--na-space-4, 16px)',
        fontFamily: 'var(--na-font-sans, sans-serif)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--na-surface, #111722)',
          border: '1px solid var(--na-line, #1E2735)',
          borderRadius: 'var(--na-radius-md, 8px)',
          padding: 'var(--na-space-5, 20px)',
          color: 'var(--na-text, #E8E4DA)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--na-space-4, 16px)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--na-accent, #E8A33D)' }}>
              ✦ Send Playtest Feedback
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--na-muted, #7E8B9B)', marginTop: '2px' }}>
              Exports an all-in-one diagnostic file to your computer. Nothing is transmitted online.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--na-muted, #7E8B9B)',
              fontSize: '18px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Category & Rating */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--na-muted, #7E8B9B)', display: 'block', marginBottom: '4px' }}>
              Feedback Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--na-raised, #0B0F19)',
                border: '1px solid var(--na-line, #1E2735)',
                color: 'var(--na-text, #E8E4DA)',
                borderRadius: 'var(--na-radius-sm, 4px)',
                padding: '6px 10px',
                fontSize: '12px',
                fontFamily: 'var(--na-font-mono, monospace)'
              }}
            >
              <option>Gameplay Experience</option>
              <option>Performance & FPS</option>
              <option>WebGPU / Hardware Compatibility</option>
              <option>Machine Learning & Tutorial Concepts</option>
              <option>Bug Report</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--na-muted, #7E8B9B)', display: 'block', marginBottom: '4px' }}>
              Rating (1 to 5)
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => setRating(s)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: '12px',
                    fontFamily: 'var(--na-font-mono, monospace)',
                    backgroundColor: rating >= s ? 'var(--na-accent-muted, rgba(232, 163, 61, 0.2))' : 'var(--na-raised, #0B0F19)',
                    color: rating >= s ? 'var(--na-accent, #E8A33D)' : 'var(--na-muted, #7E8B9B)',
                    border: `1px solid ${rating >= s ? 'var(--na-accent, #E8A33D)' : 'var(--na-line, #1E2735)'}`,
                    borderRadius: 'var(--na-radius-sm, 4px)',
                    cursor: 'pointer'
                  }}
                >
                  {s}★
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes Textarea */}
        <div>
          <label style={{ fontSize: '11px', color: 'var(--na-muted, #7E8B9B)', display: 'block', marginBottom: '4px' }}>
            Your Impressions, Issues, or Suggestions:
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Describe your hardware performance, learning curve, tutorial clarity, or any issues encountered..."
            style={{
              width: '100%',
              backgroundColor: 'var(--na-raised, #0B0F19)',
              border: '1px solid var(--na-line, #1E2735)',
              borderRadius: 'var(--na-radius-sm, 4px)',
              padding: '8px 12px',
              color: 'var(--na-text, #E8E4DA)',
              fontSize: '12px',
              fontFamily: 'var(--na-font-sans, sans-serif)',
              lineHeight: 1.5,
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Package Contents Notice */}
        <div
          style={{
            fontSize: '11px',
            color: 'var(--na-muted, #7E8B9B)',
            backgroundColor: 'var(--na-raised, #0B0F19)',
            border: '1px solid var(--na-line, #1E2735)',
            borderRadius: 'var(--na-radius-sm, 4px)',
            padding: '8px 12px',
            lineHeight: 1.4
          }}
        >
          <strong>Package contents:</strong> WebGPU adapter vendor/device, limits, display resolution, benchmark metrics, tutorial step times, recent runtime error entries, and your written notes.
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--na-muted, #7E8B9B)',
              border: '1px solid var(--na-line, #1E2735)',
              borderRadius: 'var(--na-radius-sm, 4px)',
              padding: '8px 14px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            disabled={isExporting}
            onClick={handleExport}
            style={{
              backgroundColor: exported ? 'var(--na-accent-cool, #4FB3A9)' : 'var(--na-accent, #E8A33D)',
              color: 'var(--na-ink, #060913)',
              border: 'none',
              borderRadius: 'var(--na-radius-sm, 4px)',
              padding: '8px 18px',
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'var(--na-font-mono, monospace)',
              cursor: isExporting ? 'not-allowed' : 'pointer'
            }}
          >
            {exported ? '✓ Exported JSON' : isExporting ? 'Packaging...' : '💾 Export Feedback JSON'}
          </button>
        </div>
      </div>
    </div>
  );
};
