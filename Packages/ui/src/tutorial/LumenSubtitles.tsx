import React, { useState, useEffect } from 'react';
import { TutorialDirector, TutorialState } from '@na/game-core';

export interface LumenSubtitlesProps {
  director: TutorialDirector;
  onOpenCodex?: (entryId?: string) => void;
  onExportTelemetry?: () => void;
}

const MOOD_GLOW: Record<string, { border: string; glow: string; badge: string }> = {
  calm: {
    border: 'rgba(0, 243, 255, 0.4)',
    glow: '0 0 24px rgba(0, 243, 255, 0.18)',
    badge: '#00f3ff'
  },
  guiding: {
    border: 'rgba(245, 158, 11, 0.45)',
    glow: '0 0 24px rgba(245, 158, 11, 0.22)',
    badge: '#f59e0b'
  },
  alert: {
    border: 'rgba(239, 68, 68, 0.55)',
    glow: '0 0 32px rgba(239, 68, 68, 0.3)',
    badge: '#ef4444'
  },
  success: {
    border: 'rgba(16, 185, 129, 0.5)',
    glow: '0 0 28px rgba(16, 185, 129, 0.25)',
    badge: '#10b981'
  }
};

export const LumenSubtitles: React.FC<LumenSubtitlesProps> = ({
  director,
  onOpenCodex,
  onExportTelemetry
}) => {
  const [state, setState] = useState<TutorialState>(director.getState());
  const [showSettings, setShowSettings] = useState(false);
  const [subtitleSize, setSubtitleSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    return director.subscribe((s) => {
      setState(s);
    });
  }, [director]);

  const moodStyle = MOOD_GLOW[state.lumenMood] || MOOD_GLOW.calm;

  const fontSizes = {
    small: '14px',
    medium: '16.5px',
    large: '20px'
  };

  const lineHeights = {
    small: '1.4',
    medium: '1.45',
    large: '1.5'
  };

  const handleSkipSection = () => {
    director.skipSection(state.currentStep.section);
  };

  const handleClaimMentorCheckpoint = () => {
    director.handleEvent({ type: 'mentor_checkpoint_claimed' });
  };

  const handleToggleReducedMotion = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    director.setAccessibilitySettings({ reducedMotion: next });
  };

  const handleSizeChange = (size: 'small' | 'medium' | 'large') => {
    setSubtitleSize(size);
    director.setAccessibilitySettings({ subtitleSize: size });
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 900,
        width: 'min(760px, 92vw)',
        pointerEvents: 'auto',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Mentor Checkpoint Safety Net Banner */}
      {state.progress.mentorCheckpointOffered && !state.progress.mentorCheckpointClaimed && (
        <div
          style={{
            marginBottom: '10px',
            padding: '10px 16px',
            background: 'rgba(245, 158, 11, 0.16)',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            borderRadius: '10px',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            animation: reducedMotion ? 'none' : 'fadeIn 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✦</span>
            <span style={{ fontSize: '13.5px', color: '#fef3c7' }}>
              Mathematical divergence detected twice. Lumen has prepared a stable model checkpoint.
            </span>
          </div>
          <button
            onClick={handleClaimMentorCheckpoint}
            style={{
              background: '#f59e0b',
              color: '#0f172a',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Claim Lumen’s Checkpoint
          </button>
        </div>
      )}

      {/* Main Subtitle Container */}
      <div
        style={{
          background: 'rgba(12, 17, 29, 0.88)',
          border: `1px solid ${moodStyle.border}`,
          borderRadius: '14px',
          boxShadow: moodStyle.glow,
          backdropFilter: 'blur(16px)',
          padding: '14px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          transition: reducedMotion ? 'none' : 'all 0.3s ease'
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            paddingBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Lumen Orb Indicator */}
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: moodStyle.badge,
                boxShadow: `0 0 10px ${moodStyle.badge}`,
                animation: reducedMotion ? 'none' : 'pulse 2s infinite ease-in-out'
              }}
            />
            <span
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontWeight: 700,
                color: moodStyle.badge
              }}
            >
              Lumen // Step {state.currentStepIndex + 1} of 13: {state.currentStep.title}
            </span>
            {state.isHintActive && (
              <span
                style={{
                  fontSize: '10.5px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#fbbf24',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(245, 158, 11, 0.3)'
                }}
              >
                Hint
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {onOpenCodex && (
              <button
                onClick={() => onOpenCodex()}
                title="Open Codex [J]"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e2e8f0',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  cursor: 'pointer'
                }}
              >
                Codex [J]
              </button>
            )}

            <button
              onClick={handleSkipSection}
              title="Skip this tutorial section"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '11px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              Skip Section »
            </button>

            <button
              onClick={() => setShowSettings(!showSettings)}
              title="Subtitle & Accessibility Settings"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '2px 6px'
              }}
            >
              ⚙
            </button>
          </div>
        </div>

        {/* Subtitle Dialogue Content (max 14 words per line) */}
        <div
          style={{
            color: '#f8fafc',
            fontSize: fontSizes[subtitleSize],
            lineHeight: lineHeights[subtitleSize],
            whiteSpace: 'pre-line',
            fontWeight: 450,
            letterSpacing: '0.01em',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.7)'
          }}
        >
          {state.activeSubtitles}
        </div>

        {/* Accessibility & Settings Drawer */}
        {showSettings && (
          <div
            style={{
              marginTop: '6px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '12px',
              color: '#94a3b8'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Text Size:</span>
              {(['small', 'medium', 'large'] as const).map((sz) => (
                <button
                  key={sz}
                  onClick={() => handleSizeChange(sz)}
                  style={{
                    background: subtitleSize === sz ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: subtitleSize === sz ? '1px solid #00f3ff' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: subtitleSize === sz ? '#00f3ff' : '#cbd5e1',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {sz.toUpperCase()}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={handleToggleReducedMotion}
                />
                Reduced Motion
              </label>

              {onExportTelemetry && (
                <button
                  onClick={onExportTelemetry}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#e2e8f0',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Export Telemetry JSON
                </button>
              )}

              <button
                onClick={() => director.replayTutorial()}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                Replay Tutorial
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
