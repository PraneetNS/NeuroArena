import React from 'react';
import { ShardInteractionState } from './shardWorld.js';
import { VaultState, VaultManager, WorldState } from '@na/game-core';
import { ProgressRing, VaultPanel, Badge } from '@na/ui';

export interface ShardHUDProps {
  interaction: ShardInteractionState;
  vault: VaultManager;
  vaultState: VaultState;
  worldState: WorldState;
  isVaultOpen: boolean;
  onCloseVault: () => void;
  activeSignalKey: 'surpriseScore' | 'repetitionScore' | 'nonAlphaRatio' | 'uppercaseRatio' | 'dictionaryHitRate';
  onChangeSignalKey: (key: 'surpriseScore' | 'repetitionScore' | 'nonAlphaRatio' | 'uppercaseRatio' | 'dictionaryHitRate') => void;
}

export const ShardHUD: React.FC<ShardHUDProps> = ({
  interaction,
  vault,
  vaultState,
  worldState,
  isVaultOpen,
  onCloseVault,
  activeSignalKey,
  onChangeSignalKey
}) => {
  const { targetShard, holdProgress, isHolding, scanResult, isScanMode } = interaction;

  return (
    <div className="na-shard-hud" style={{ pointerEvents: 'none' }}>
      {/* 1. Hold-E Harvest Progress Indicator */}
      {targetShard && (
        <div
          style={{
            position: 'fixed',
            bottom: '18%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(10, 15, 25, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 243, 255, 0.35)',
            borderRadius: '12px',
            padding: '12px 20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            zIndex: 90
          }}
        >
          <ProgressRing
            value={holdProgress}
            size={56}
            strokeWidth={5}
            color="#00f3ff"
            showLabel={isHolding && holdProgress > 0}
          />
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '1px',
                color: '#00f3ff',
                textTransform: 'uppercase'
              }}
            >
              {isHolding ? 'HARVESTING DATA SHARD...' : 'HOLD [E] (0.6s) TO HARVEST'}
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              {targetShard.regionId.replace(/_/g, ' ').toUpperCase()} • {targetShard.id}
            </div>
          </div>
        </div>
      )}

      {/* 2. Scan Mode HUD Overlay */}
      {isScanMode && (
        <>
          {/* Top Scan Mode Bar */}
          <div
            style={{
              position: 'fixed',
              top: '72px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(5, 12, 22, 0.9)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              borderRadius: '24px',
              padding: '6px 18px',
              boxShadow: '0 4px 20px rgba(0, 243, 255, 0.15)',
              zIndex: 90,
              pointerEvents: 'auto'
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#06b6d4',
                boxShadow: '0 0 8px #06b6d4'
              }}
            />
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 700,
                color: '#06b6d4',
                letterSpacing: '1.5px'
              }}
            >
              LENS SCANNER ACTIVE
            </span>
            <span style={{ color: '#475569', fontSize: '11px' }}>|</span>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Signal Tint:</span>
            <select
              value={activeSignalKey}
              onChange={(e) =>
                onChangeSignalKey(
                  e.target.value as 'surpriseScore' | 'repetitionScore' | 'nonAlphaRatio' | 'uppercaseRatio' | 'dictionaryHitRate'
                )
              }
              style={{
                background: '#0f172a',
                color: '#e2e8f0',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              <option value="surpriseScore">Surprise Score (Bigram NLL)</option>
              <option value="repetitionScore">Repetition Score (Vault Overlap)</option>
              <option value="dictionaryHitRate">Dictionary Hit Rate (Shakespeare Vocab)</option>
              <option value="nonAlphaRatio">Non-Alphabetic Ratio</option>
              <option value="uppercaseRatio">Uppercase Ratio</option>
            </select>
            <span
              style={{
                fontSize: '10px',
                color: '#64748b',
                background: '#1e293b',
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              [Q] Toggle
            </span>
          </div>

          {/* Lens Signals Tooltip Card for Scan Target */}
          {scanResult && (
            <div
              style={{
                position: 'fixed',
                top: '120px',
                right: '32px',
                width: '320px',
                background: 'rgba(8, 14, 26, 0.92)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)',
                color: '#e2e8f0',
                fontFamily: 'system-ui, sans-serif',
                zIndex: 90
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  borderBottom: '1px solid #1e293b',
                  paddingBottom: '8px'
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      color: '#06b6d4',
                      fontWeight: 700
                    }}
                  >
                    SCANNER TELEMETRY
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                    {scanResult.shardId}
                  </div>
                </div>
                <Badge variant="neutral">
                  Dominant: {scanResult.dominantSignal}
                </Badge>
              </div>

              {/* 6 Lens Signals */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Surprise Score (Bigram NLL):</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#38bdf8' }}>
                    {scanResult.signals.surpriseScore.toFixed(3)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Repetition (Vault Overlap):</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#a855f7' }}>
                    {(scanResult.signals.repetitionScore * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Dictionary Hit Rate:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#22c55e' }}>
                    {(scanResult.signals.dictionaryHitRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Non-Alphabetic Ratio:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#f59e0b' }}>
                    {(scanResult.signals.nonAlphaRatio * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Uppercase Ratio:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ec4899' }}>
                    {(scanResult.signals.uppercaseRatio * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Avg Word Length:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#10b981' }}>
                    {scanResult.signals.avgWordLength.toFixed(1)} chars
                  </span>
                </div>
              </div>

              {/* Text Preview */}
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px',
                  background: 'rgba(15, 23, 42, 0.7)',
                  borderRadius: '6px',
                  border: '1px solid #1e293b',
                  fontSize: '11px',
                  color: '#94a3b8',
                  fontStyle: 'italic',
                  lineHeight: '1.4',
                  maxHeight: '64px',
                  overflow: 'hidden'
                }}
              >
                &ldquo;{scanResult.preview}&rdquo;
              </div>

              <div
                style={{
                  marginTop: '8px',
                  fontSize: '9px',
                  color: '#475569',
                  textAlign: 'right'
                }}
              >
                *Ground-truth tag hidden until evaluation
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. Vault Modal Panel (Tab) */}
      <VaultPanel
        isOpen={isVaultOpen}
        onClose={onCloseVault}
        vaultState={vaultState}
        onToggleStatus={(shardId) => vault.toggleStatus(shardId)}
        onRemoveEntry={(shardId) => vault.removeEntry(shardId)}
        onKeepAll={() => vault.keepAll()}
        onDiscardAll={() => vault.discardAll()}
        onRevealTags={() => vault.revealAllTags()}
        onFillDebug={(count) => vault.fillRandomShards(count, worldState.shards)}
        onImportJson={(json) => vault.importFromJson(json)}
      />
    </div>
  );
};
