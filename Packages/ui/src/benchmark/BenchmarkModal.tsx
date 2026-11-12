/**
 * In-Game Benchmark Modal & Feature Cost Dashboard.
 * 
 * Provides:
 * - Scripted camera path through the five photo spots (20s each at fixed times of day)
 * - 60s player walking path
 * - Current tier or all three tiers in sequence
 * - Comprehensive telemetry (Adapter, powerPreference, UA, webdriver, headless check, DPR, VSync lock)
 * - Invalidation notification for headless/software/hidden runs
 * - 5 Photo Spots metrics table (Draw calls, Triangles, Avg FPS, 1% Low, p50, p95)
 * - Feature Cost Table (Delta ms and share of frame per feature)
 * - B1 triangle and draw call evolution comparison
 * - "Copy JSON" and "Download JSON" buttons
 */

import React, { useState } from 'react';
import {
  BenchmarkHarness,
  BenchmarkSuiteResult,
  BenchmarkRunReport,
  QualityTier
} from '@na/engine';
import { Button } from '../components/Button.js';
import { Badge } from '../components/Badge.js';

export interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  harness: BenchmarkHarness | null;
  currentTier: QualityTier;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  isOpen,
  onClose,
  harness,
  currentTier
}) => {
  const [selectedMode, setSelectedMode] = useState<'current' | 'all'>('current');
  const [quickMode, setQuickMode] = useState<boolean>(false);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to benchmark');
  const [suiteResult, setSuiteResult] = useState<BenchmarkSuiteResult | null>(null);
  const [activeTabTier, setActiveTabTier] = useState<QualityTier>(currentTier);
  const [copyFeedback, setCopyFeedback] = useState<string>('');

  if (!isOpen) return null;

  const handleStartBenchmark = async () => {
    if (!harness || isRunning) return;

    setIsRunning(true);
    setProgress(0);
    setStatusMessage('Initializing benchmark harness...');
    setCopyFeedback('');

    const targetTier = selectedMode === 'all' ? 'all' : currentTier;
    // Standard durations: 20s per spot + 60s walk = 160s per tier
    // Quick test mode for rapid validation: 3s per spot + 5s walk
    const spotDuration = quickMode ? 3 : 20;
    const walkDuration = quickMode ? 5 : 60;

    try {
      const result = await harness.runBenchmark(
        targetTier,
        spotDuration,
        walkDuration,
        (p, status) => {
          setProgress(p);
          setStatusMessage(status);
        }
      );
      setSuiteResult(result);
      if (result.reports[currentTier]) {
        setActiveTabTier(currentTier);
      } else if (result.activeTiersTested.length > 0) {
        setActiveTabTier(result.activeTiersTested[0]);
      }
      setStatusMessage('Benchmark completed successfully');
    } catch (err) {
      console.error('Benchmark execution error:', err);
      setStatusMessage(`Benchmark failed: ${String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleAbort = () => {
    if (harness) {
      harness.abort();
      setIsRunning(false);
      setStatusMessage('Benchmark aborted by user');
    }
  };

  const activeReport: BenchmarkRunReport | null = suiteResult
    ? suiteResult.reports[activeTabTier]
    : null;

  const handleCopyJson = () => {
    if (!suiteResult) return;
    const jsonStr = JSON.stringify(suiteResult, null, 2);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(jsonStr).then(() => {
        setCopyFeedback('JSON copied to clipboard!');
        setTimeout(() => setCopyFeedback(''), 3000);
      });
    }
  };

  const handleDownloadJson = () => {
    if (!suiteResult) return;
    const jsonStr = JSON.stringify(suiteResult, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuroarena-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCopyFeedback('Downloaded JSON report');
    setTimeout(() => setCopyFeedback(''), 3000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 12, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 250,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: 'var(--na-font-sans, system-ui, sans-serif)',
        color: 'var(--na-text, #E8E4DA)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '92vh',
          backgroundColor: '#0E1217',
          border: '1px solid var(--na-line, #2A333F)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid #232B36',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #151A22 0%, #0E1217 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: isRunning ? '#E8A33D' : '#4FB3A9',
                boxShadow: `0 0 10px ${isRunning ? '#E8A33D' : '#4FB3A9'}`
              }}
            />
            <div>
              <div
                style={{
                  fontSize: '1rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: '#F8FAFC'
                }}
              >
                OPEN-WORLD BENCHMARK & FEATURE COST PROFILER
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#94A3B8',
                  fontFamily: 'var(--na-font-mono, monospace)'
                }}
              >
                Route: /#/bench-world • Standard 160s Path (5 Photo Spots + Walking Tour)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {copyFeedback && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#4FB3A9',
                  fontFamily: 'var(--na-font-mono, monospace)'
                }}
              >
                {copyFeedback}
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid #334155',
                borderRadius: '4px',
                color: '#94A3B8',
                padding: '0.35rem 0.65rem',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}
        >
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              backgroundColor: '#131821',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid #232B36'
            }}
          >
            {/* Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>
                MODE:
              </span>
              <button
                disabled={isRunning}
                onClick={() => setSelectedMode('current')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: selectedMode === 'current' ? '#E8A33D' : '#2A333F',
                  backgroundColor:
                    selectedMode === 'current' ? 'rgba(232, 163, 61, 0.15)' : 'transparent',
                  color: selectedMode === 'current' ? '#E8A33D' : '#94A3B8',
                  cursor: isRunning ? 'not-allowed' : 'pointer'
                }}
              >
                Current Tier ({currentTier.toUpperCase()})
              </button>
              <button
                disabled={isRunning}
                onClick={() => setSelectedMode('all')}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: selectedMode === 'all' ? '#E8A33D' : '#2A333F',
                  backgroundColor:
                    selectedMode === 'all' ? 'rgba(232, 163, 61, 0.15)' : 'transparent',
                  color: selectedMode === 'all' ? '#E8A33D' : '#94A3B8',
                  cursor: isRunning ? 'not-allowed' : 'pointer'
                }}
              >
                All 3 Tiers (High → Med → Low)
              </button>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  marginLeft: '0.5rem',
                  fontSize: '0.72rem',
                  color: '#64748B',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  checked={quickMode}
                  disabled={isRunning}
                  onChange={(e) => setQuickMode(e.target.checked)}
                />
                Fast Verification (3s/spot, 5s walk)
              </label>
            </div>

            {/* Run / Abort Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {!isRunning ? (
                <Button variant="primary" size="sm" onClick={handleStartBenchmark}>
                  ▶ Start Benchmark
                </Button>
              ) : (
                <Button variant="danger" size="sm" onClick={handleAbort}>
                  ⏹ Abort Run
                </Button>
              )}

              {suiteResult && (
                <>
                  <Button variant="secondary" size="sm" onClick={handleCopyJson}>
                    📋 Copy JSON
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleDownloadJson}>
                    💾 Download JSON
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Live Progress Bar */}
          {isRunning && (
            <div
              style={{
                backgroundColor: '#131821',
                padding: '0.85rem 1rem',
                borderRadius: '6px',
                border: '1px solid #232B36',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--na-font-mono, monospace)'
                }}
              >
                <span style={{ color: '#E8A33D', fontWeight: 600 }}>{statusMessage}</span>
                <span style={{ color: '#F8FAFC' }}>{Math.round(progress * 100)}%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: '#1E293B',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    height: '100%',
                    backgroundColor: '#E8A33D',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>
          )}

          {/* Results View */}
          {activeReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Tier Selection Tabs if Multiple Tiers Tested */}
              {suiteResult && suiteResult.activeTiersTested.length > 1 && (
                <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid #232B36', paddingBottom: '0.5rem' }}>
                  {suiteResult.activeTiersTested.map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setActiveTabTier(tier)}
                      style={{
                        padding: '0.4rem 0.9rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '4px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: activeTabTier === tier ? '#E8A33D' : '#1E293B',
                        color: activeTabTier === tier ? '#0E1217' : '#94A3B8'
                      }}
                    >
                      {tier.toUpperCase()} TIER
                    </button>
                  ))}
                </div>
              )}

              {/* Invalidation Banner */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: activeReport.isValid ? 'rgba(79, 179, 169, 0.4)' : 'rgba(239, 68, 68, 0.4)',
                  backgroundColor: activeReport.isValid ? 'rgba(79, 179, 169, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: activeReport.isValid ? '#4FB3A9' : '#EF4444',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <span>{activeReport.isValid ? '● VALID RUN' : '▲ INVALID RUN FOR PERFORMANCE CLAIMS'}</span>
                    <Badge variant={activeReport.isValid ? 'success' : 'danger'}>
                      {activeReport.isValid ? 'CERTIFIED' : 'INVALIDATED'}
                    </Badge>
                  </div>
                  {!activeReport.isValid && (
                    <div style={{ fontSize: '0.72rem', color: '#FCA5A5', marginTop: '0.35rem', lineHeight: 1.4 }}>
                      {activeReport.invalidationReasons.map((r, idx) => (
                        <div key={idx}>• {r}</div>
                      ))}
                      <div style={{ marginTop: '0.2rem', color: '#CBD5E1', fontStyle: 'italic' }}>
                        Performance numbers are uncertified for headless / software / background runs. Deliver report with draw calls & geometry budgets.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', fontFamily: 'var(--na-font-mono, monospace)', fontSize: '0.7rem', color: '#94A3B8' }}>
                  <div>VSYNC LOCKED: <strong style={{ color: activeReport.vsyncLocked ? '#4FB3A9' : '#F59E0B' }}>{activeReport.vsyncLocked ? 'YES' : 'NO'}</strong></div>
                  <div>DPR: {activeReport.devicePixelRatio}x ({activeReport.canvasWidth}x{activeReport.canvasHeight})</div>
                </div>
              </div>

              {/* Telemetry Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '0.75rem'
                }}
              >
                <div style={{ backgroundColor: '#131821', padding: '0.75rem', borderRadius: '6px', border: '1px solid #232B36' }}>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase' }}>Average FPS</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: activeReport.isValid ? '#4FB3A9' : '#64748B' }}>
                    {activeReport.isValid ? `${activeReport.avgFps} FPS` : 'N/A (Headless)'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748B' }}>1% Low: {activeReport.isValid ? `${activeReport.onePercentLowFps} FPS` : '--'}</div>
                </div>

                <div style={{ backgroundColor: '#131821', padding: '0.75rem', borderRadius: '6px', border: '1px solid #232B36' }}>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase' }}>Frame Time Percentiles</div>
                  <div style={{ fontSize: '0.85rem', fontFamily: 'var(--na-font-mono, monospace)', color: '#F8FAFC', marginTop: '0.2rem' }}>
                    p50: <strong>{activeReport.isValid ? `${activeReport.p50Ms}ms` : '--'}</strong>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--na-font-mono, monospace)', color: '#94A3B8' }}>
                    p95: {activeReport.isValid ? `${activeReport.p95Ms}ms` : '--'} • p99: {activeReport.isValid ? `${activeReport.p99Ms}ms` : '--'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#131821', padding: '0.75rem', borderRadius: '6px', border: '1px solid #232B36' }}>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase' }}>Peak Draw Calls</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#E8A33D' }}>
                    {activeReport.drawCallsPeak}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
                    Budget: {activeReport.tier === 'low' ? '120' : activeReport.tier === 'medium' ? '250' : '500'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#131821', padding: '0.75rem', borderRadius: '6px', border: '1px solid #232B36' }}>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase' }}>Peak Triangles</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#E8A33D' }}>
                    {Math.round(activeReport.trianglesPeak / 1000)}k
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
                    Budget: {activeReport.tier === 'low' ? '150k' : activeReport.tier === 'medium' ? '400k' : '900k'}
                  </div>
                </div>

                <div style={{ backgroundColor: '#131821', padding: '0.75rem', borderRadius: '6px', border: '1px solid #232B36' }}>
                  <div style={{ fontSize: '0.65rem', color: '#94A3B8', textTransform: 'uppercase' }}>GPU Memory (Estimate)</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38BDF8' }}>
                    {activeReport.gpuMemoryMB} MB
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748B' }}>Explicitly marked "estimate"</div>
                </div>
              </div>

              {/* Hardware Device Telemetry */}
              <div
                style={{
                  backgroundColor: '#131821',
                  padding: '0.85rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid #232B36',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--na-font-mono, monospace)',
                  color: '#94A3B8',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '0.5rem'
                }}
              >
                <div>GPU DEVICE: <span style={{ color: '#F8FAFC' }}>{activeReport.adapterInfo.vendor} {activeReport.adapterInfo.device} ({activeReport.adapterInfo.backend})</span></div>
                <div>POWER PREFERENCE: <span style={{ color: '#E8A33D' }}>{activeReport.powerPreference}</span></div>
                <div>USER AGENT: <span style={{ color: '#CBD5E1' }}>{activeReport.userAgent.slice(0, 48)}...</span></div>
                <div>HEADLESS UA: <span style={{ color: activeReport.isHeadless ? '#EF4444' : '#4FB3A9' }}>{String(activeReport.isHeadless)}</span> | WEBDRIVER: <span style={{ color: activeReport.webdriver ? '#EF4444' : '#4FB3A9' }}>{String(activeReport.webdriver)}</span></div>
              </div>

              {/* Five Photo Spots Metrics Table */}
              <div
                style={{
                  backgroundColor: '#131821',
                  borderRadius: '6px',
                  border: '1px solid #232B36',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    padding: '0.65rem 1rem',
                    backgroundColor: '#18202C',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: '#E8A33D',
                    textTransform: 'uppercase'
                  }}
                >
                  Five Photo Spots Telemetry
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #232B36', color: '#64748B' }}>
                      <th style={{ padding: '0.5rem 1rem' }}>PHOTO SPOT</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>TIME</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>DRAW CALLS</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>TRIANGLES</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>AVG FPS</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>1% LOW</th>
                      <th style={{ padding: '0.5rem 1rem' }}>p95 (MS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReport.photoSpotMetrics.map((spot) => (
                      <tr key={spot.spotId} style={{ borderBottom: '1px solid #1A222F', color: '#CBD5E1' }}>
                        <td style={{ padding: '0.5rem 1rem', fontWeight: 600, color: '#F8FAFC' }}>{spot.spotName}</td>
                        <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace' }}>{spot.timeHours.toFixed(2)}h</td>
                        <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace', color: '#E8A33D' }}>{spot.drawCalls}</td>
                        <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace' }}>{Math.round(spot.triangles / 1000)}k</td>
                        <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace', color: activeReport.isValid ? '#4FB3A9' : '#64748B' }}>
                          {activeReport.isValid ? `${spot.avgFps} FPS` : 'N/A (Headless)'}
                        </td>
                        <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace' }}>
                          {activeReport.isValid ? `${spot.onePercentLowFps} FPS` : '--'}
                        </td>
                        <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace' }}>
                          {activeReport.isValid ? `${spot.p95Ms}ms` : '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Feature Cost Table */}
              <div
                style={{
                  backgroundColor: '#131821',
                  borderRadius: '6px',
                  border: '1px solid #232B36',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    padding: '0.65rem 1rem',
                    backgroundColor: '#18202C',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: '#4FB3A9',
                    textTransform: 'uppercase'
                  }}
                >
                  Feature Cost Differential Table (A/B Profiling)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #232B36', color: '#64748B' }}>
                      <th style={{ padding: '0.5rem 1rem' }}>FEATURE</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>BASELINE (MS)</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>TOGGLED (MS)</th>
                      <th style={{ padding: '0.5rem 0.5rem' }}>DIFF (MS)</th>
                      <th style={{ padding: '0.5rem 1rem' }}>SHARE OF FRAME (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeReport.featureCostMetrics.map((feat) => (
                      <tr key={feat.feature} style={{ borderBottom: '1px solid #1A222F', color: '#CBD5E1' }}>
                        <td style={{ padding: '0.5rem 1rem', fontWeight: 600, color: '#F8FAFC' }}>{feat.feature}</td>
                        <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace' }}>{feat.baselineMs.toFixed(2)}</td>
                        <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace' }}>{feat.toggledMs.toFixed(2)}</td>
                        <td style={{ padding: '0.5rem 0.5rem', fontFamily: 'monospace', color: feat.deltaMs > 1.0 ? '#F59E0B' : '#CBD5E1', fontWeight: 600 }}>
                          +{feat.deltaMs.toFixed(2)} ms
                        </td>
                        <td style={{ padding: '0.5rem 1rem', fontFamily: 'monospace', color: feat.shareOfFramePercent > 8.0 ? '#E8A33D' : '#4FB3A9' }}>
                          {feat.shareOfFramePercent.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* B1 Evolution Comparison Card */}
              <div
                style={{
                  backgroundColor: '#131821',
                  padding: '1rem',
                  borderRadius: '6px',
                  border: '1px solid #232B36',
                  fontSize: '0.75rem',
                  lineHeight: 1.5
                }}
              >
                <div style={{ fontWeight: 700, color: '#E8A33D', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                  B1 Baseline Evolution & Growth Analysis
                </div>
                <div style={{ color: '#94A3B8' }}>
                  NeuroArena B1 Baseline: <strong style={{ color: '#F8FAFC' }}>75,000 triangles</strong> across <strong style={{ color: '#F8FAFC' }}>56 draw calls</strong>.
                </div>
                <div style={{ color: '#94A3B8', marginTop: '0.2rem' }}>
                  Current Measured Peak ({activeReport.tier.toUpperCase()} Tier): <strong style={{ color: '#4FB3A9' }}>{activeReport.b1Comparison.measuredPeakTriangles.toLocaleString()} triangles ({activeReport.b1Comparison.triangleGrowthRatio}x growth)</strong> across <strong style={{ color: '#4FB3A9' }}>{activeReport.b1Comparison.measuredPeakDrawCalls} draw calls ({activeReport.b1Comparison.drawCallGrowthRatio}x growth)</strong>.
                </div>
                <div style={{ color: '#CBD5E1', marginTop: '0.35rem' }}>
                  Features adding the greatest frame cost: <strong style={{ color: '#F59E0B' }}>{activeReport.b1Comparison.highestCostFeatures.join(', ')}</strong>.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
