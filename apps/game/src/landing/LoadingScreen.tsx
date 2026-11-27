/**
 * Real-Progress Asset & Engine Loading Screen:
 * Displays real dynamic import & asset hydration progress (0% -> 100%)
 * while streaming shaders, terrain, tokenizer, and weights into GPU memory.
 */

import React from 'react';

export interface LoadingScreenProps {
  progress: number; // 0 to 100
  stepLabel: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, stepLabel }) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 8500,
        backgroundColor: 'var(--na-ground, #060913)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--na-text, #E8E4DA)',
        padding: 'var(--na-space-5, 20px)',
        fontFamily: 'var(--na-font-sans, sans-serif)',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--na-space-4, 16px)',
          textAlign: 'center'
        }}
      >
        {/* Animated Glyphs */}
        <div
          style={{
            fontSize: '32px',
            color: 'var(--na-accent, #E8A33D)',
            animation: 'pulse 1.5s infinite ease-in-out'
          }}
        >
          ✦
        </div>

        {/* Title */}
        <div>
          <div
            style={{
              fontFamily: 'var(--na-font-mono, monospace)',
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'var(--na-text, #E8E4DA)'
            }}
          >
            NEUROARENA
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--na-accent-cool, #4FB3A9)',
              marginTop: '4px',
              fontFamily: 'var(--na-font-mono, monospace)'
            }}
          >
            HYDRATING RUNTIME & SHADERS
          </div>
        </div>

        {/* Progress Bar Container */}
        <div
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'var(--na-raised, #0B0F19)',
            border: '1px solid var(--na-line, #1E2735)',
            borderRadius: '3px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            style={{
              width: `${clampedProgress}%`,
              height: '100%',
              backgroundColor: 'var(--na-accent, #E8A33D)',
              boxShadow: '0 0 12px var(--na-accent, #E8A33D)',
              transition: 'width 0.25s ease-out'
            }}
          />
        </div>

        {/* Status Text & Percentage */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            fontSize: '12px',
            fontFamily: 'var(--na-font-mono, monospace)'
          }}
        >
          <span style={{ color: 'var(--na-text-secondary, #B8C2CC)' }}>
            {stepLabel || 'Loading simulation primitives...'}
          </span>
          <span style={{ color: 'var(--na-accent, #E8A33D)', fontWeight: 700 }}>
            {Math.round(clampedProgress)}%
          </span>
        </div>

        {/* Educational Tip */}
        <div
          style={{
            fontSize: '11px',
            color: 'var(--na-muted, #7E8B9B)',
            marginTop: '16px',
            lineHeight: 1.5,
            maxWidth: '420px'
          }}
        >
          Compiling WebGPU matrix-vector multiplication compute shaders, streaming terrain LOD elevation textures, and preparing KV-cache ring buffers.
        </div>
      </div>
    </div>
  );
};
