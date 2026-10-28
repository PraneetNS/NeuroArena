/**
 * THE CAMP: HUD Overlay & Diegetic Interaction Panel.
 * 
 * Provides:
 * - Top header with run status and "Return to the world" (or Esc) button.
 * - Camera controls: Orbit Drift / Sit by the Fire / Free Look.
 * - Render budget controls: 30 FPS / 60 FPS / Adaptive.
 * - Procedural audio mute toggle.
 * - Small Debug HUD: active throttle, GPU yield %, Camp FPS, DPR, GPU device.
 * - Mentor's Notes inspection drawer with suggested-fix actions.
 * - Run Complete celebration modal with Evaluator / Autopsy / Return actions.
 */

import React, { useState, useEffect } from 'react';
import { CameraMode, FpsTargetSetting, CampThrottleState, CampSample as GeneratedSample } from '@na/engine';
import { Finding } from '@na/ml-core';

export interface CampOverlayProps {
  onReturnToWorld: () => void;
  onOpenEvaluator?: () => void;
  onOpenAutopsy?: () => void;
  onApplyFix?: (finding: Finding) => void;
  cameraMode: CameraMode;
  onChangeCameraMode: (mode: CameraMode) => void;
  fpsSetting: FpsTargetSetting;
  onChangeFpsSetting: (fps: FpsTargetSetting) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  throttleState: CampThrottleState;
  gpuName?: string;
  step?: number;
  maxSteps?: number;
  trainLoss?: number;
  valLoss?: number;
  findings?: Finding[];
  isCompleted?: boolean;
  finalSample?: GeneratedSample;
}

export const CampOverlay: React.FC<CampOverlayProps> = ({
  onReturnToWorld,
  onOpenEvaluator,
  onOpenAutopsy,
  onApplyFix,
  cameraMode,
  onChangeCameraMode,
  fpsSetting,
  onChangeFpsSetting,
  isMuted,
  onToggleMute,
  throttleState,
  gpuName = 'WebGPU Device',
  step = 0,
  maxSteps = 500,
  trainLoss,
  valLoss,
  findings = [],
  isCompleted = false,
  finalSample
}) => {
  const [isFindingsDrawerOpen, setIsFindingsDrawerOpen] = useState(false);

  // Esc key listener to return to the world
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onReturnToWorld();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReturnToWorld]);

  const hasCritical = findings.some((f) => f.severity === 'critical');

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.2rem',
        zIndex: 100,
        fontFamily: 'var(--na-font-sans, system-ui, sans-serif)'
      }}
    >
      {/* 1. TOP BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'auto'
        }}
      >
        {/* Left: Camp Title & Return Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={onReturnToWorld}
            className="na-button na-button--primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--na-border, #334155)',
              color: '#f8fafc',
              padding: '0.55rem 1.1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
            title="Leave camp and return to the 3D world (training continues in the background)"
          >
            <span>←</span> Return to the world <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>(Esc)</span>
          </button>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(12px)',
              padding: '0.4rem 0.9rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#f59e0b', fontSize: '1rem' }}>🔥</span>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc', letterSpacing: '0.04em' }}>
                THE CAMP
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>• Dusk Training Retreat</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
              Training continues actively while you rest by the fire
            </span>
          </div>
        </div>

        {/* Right: Live Telemetry Badge & Findings Alert */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          {findings.length > 0 && (
            <button
              onClick={() => setIsFindingsDrawerOpen(!isFindingsDrawerOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: hasCritical ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                border: `1px solid ${hasCritical ? '#ef4444' : '#f59e0b'}`,
                color: hasCritical ? '#ef4444' : '#f59e0b',
                padding: '0.45rem 0.8rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem'
              }}
            >
              <span>{hasCritical ? '⚠️' : 'ℹ️'}</span>
              <span>Mentor's Notes ({findings.length})</span>
            </button>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.9rem',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(12px)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontFamily: 'var(--na-font-mono, monospace)',
              fontSize: '0.8rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isCompleted ? '#10b981' : '#38bdf8',
                  boxShadow: `0 0 8px ${isCompleted ? '#10b981' : '#38bdf8'}`
                }}
              />
              <span style={{ color: '#e2e8f0' }}>
                {isCompleted ? 'COMPLETE' : `STEP ${step} / ${maxSteps}`}
              </span>
            </div>

            {trainLoss !== undefined && (
              <span style={{ color: '#f59e0b' }}>
                Loss: <strong>{trainLoss.toFixed(3)}</strong>
              </span>
            )}

            {valLoss !== undefined && valLoss > 0 && (
              <span style={{ color: '#38bdf8' }}>
                Val: <strong>{valLoss.toFixed(3)}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. FINDINGS / MENTOR'S NOTES DRAWER (Collapsible) */}
      {isFindingsDrawerOpen && findings.length > 0 && (
        <div
          style={{
            alignSelf: 'flex-end',
            width: '420px',
            maxHeight: '60vh',
            overflowY: 'auto',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1px solid #334155',
            borderRadius: '12px',
            padding: '1rem',
            marginTop: '0.8rem',
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>
              Pinned Mentor Notes ({findings.length})
            </span>
            <button
              onClick={() => setIsFindingsDrawerOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>

          {findings.map((f, i) => {
            const isCrit = f.severity === 'critical';
            return (
              <div
                key={f.id || i}
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.6)',
                  border: `1px solid ${isCrit ? '#ef4444' : '#f59e0b'}`,
                  borderRadius: '8px',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f1f5f9' }}>{f.title}</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: isCrit ? '#ef4444' : '#f59e0b',
                      textTransform: 'uppercase'
                    }}
                  >
                    {f.severity}
                  </span>
                </div>
                <span style={{ fontSize: '0.78rem', color: '#cbd5e1', lineHeight: '1.4' }}>{f.plainExplanation}</span>
                {f.suggestedFixes?.[0] && onApplyFix && (
                  <button
                    onClick={() => onApplyFix(f)}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: '0.3rem',
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid #38bdf8',
                      color: '#38bdf8',
                      borderRadius: '4px',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Fix: {f.suggestedFixes[0].label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. BOTTOM BAR (Controls & Diegetic Telemetry Status) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pointerEvents: 'auto'
        }}
      >
        {/* Left: Camera Modes & Audio */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            padding: '0.5rem 0.8rem',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>CAMERA:</span>
          <button
            onClick={() => onChangeCameraMode('drift')}
            style={{
              backgroundColor: cameraMode === 'drift' ? '#38bdf8' : 'transparent',
              color: cameraMode === 'drift' ? '#0f172a' : '#94a3b8',
              border: 'none',
              padding: '0.35rem 0.7rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Orbit Drift
          </button>
          <button
            onClick={() => onChangeCameraMode('sit')}
            style={{
              backgroundColor: cameraMode === 'sit' ? '#f59e0b' : 'transparent',
              color: cameraMode === 'sit' ? '#0f172a' : '#94a3b8',
              border: 'none',
              padding: '0.35rem 0.7rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Sit by Fire
          </button>
          <button
            onClick={() => onChangeCameraMode('free')}
            style={{
              backgroundColor: cameraMode === 'free' ? '#a855f7' : 'transparent',
              color: cameraMode === 'free' ? '#0f172a' : '#94a3b8',
              border: 'none',
              padding: '0.35rem 0.7rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Free Look
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#334155', margin: '0 0.3rem' }} />

          <button
            onClick={onToggleMute}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: isMuted ? '#64748b' : '#38bdf8',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
            title={isMuted ? 'Unmute procedural camp audio' : 'Mute procedural camp audio'}
          >
            {isMuted ? '🔇 Audio Off' : '🔊 Audio On'}
          </button>
        </div>

        {/* Right: Render Budget Selector & Active Throttle Debug HUD */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            padding: '0.5rem 0.9rem',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          {/* FPS Target Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>CAP:</span>
            {(['30', '60', 'adaptive'] as FpsTargetSetting[]).map((setting) => (
              <button
                key={setting}
                onClick={() => onChangeFpsSetting(setting)}
                style={{
                  backgroundColor: fpsSetting === setting ? '#10b981' : 'transparent',
                  color: fpsSetting === setting ? '#0f172a' : '#94a3b8',
                  border: 'none',
                  padding: '0.3rem 0.55rem',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                {setting === '30' ? '30 FPS' : setting === '60' ? '60 FPS' : 'Adaptive'}
              </button>
            ))}
          </div>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#334155' }} />

          {/* Active Throttle & Performance Debug HUD */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.8rem',
              fontFamily: 'var(--na-font-mono, monospace)',
              fontSize: '0.75rem'
            }}
          >
            <span style={{ color: throttleState.currentFps < 24 ? '#ef4444' : '#38bdf8' }}>
              <strong>{throttleState.currentFps.toFixed(1)}</strong> FPS
            </span>

            <span style={{ color: throttleState.activeThrottleFraction > 0 ? '#f59e0b' : '#94a3b8' }}>
              Throttle: <strong>{throttleState.throttleDelayMs}ms</strong> ({throttleState.gpuYieldPercent}%)
            </span>

            <span style={{ color: '#64748b' }}>DPR {throttleState.dpr.toFixed(2)}</span>

            <span style={{ color: '#475569', fontSize: '0.7rem' }}>[{gpuName}]</span>
          </div>
        </div>
      </div>

      {/* 4. RUN COMPLETE CELEBRATION MODAL */}
      {isCompleted && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(10, 15, 29, 0.78)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 200
          }}
        >
          <div
            style={{
              width: '540px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid #38bdf8',
              borderRadius: '16px',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '2.5rem' }}>✨ 🔥 ✨</div>
            <h2 style={{ fontSize: '1.6rem', color: '#f8fafc', margin: 0, fontWeight: 700 }}>
              Training Run Completed!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, lineHeight: '1.5' }}>
              The campfire flares with convergence. The weights have stabilized and the final checkpoint is scribed
              onto the generative scroll.
            </p>

            {finalSample && (
              <div
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '1rem',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, marginBottom: '0.3rem' }}>
                  FINAL GENERATIVE SAMPLE (STEP {finalSample.checkpointStep}):
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#f1f5f9', fontStyle: 'italic' }}>
                  "{finalSample.output.slice(0, 180)}..."
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.8rem', marginTop: '0.5rem' }}>
              {onOpenEvaluator && (
                <button
                  onClick={onOpenEvaluator}
                  className="na-button"
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.65rem 1.2rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Open Evaluator
                </button>
              )}

              {onOpenAutopsy && (
                <button
                  onClick={onOpenAutopsy}
                  className="na-button"
                  style={{
                    backgroundColor: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.65rem 1.2rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Open Autopsy
                </button>
              )}

              <button
                onClick={onReturnToWorld}
                className="na-button"
                style={{
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  padding: '0.65rem 1.2rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Return to World
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
