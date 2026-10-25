import React, { useState } from 'react';
import { ShardInteractionState } from './shardWorld.js';
import { VaultState, VaultManager, WorldState, LensRule, DEFAULT_LENS_RULES } from '@na/game-core';
import { ProgressRing, VaultPanel, Badge, Button, ToolWheel, ToolWheelItem } from '@na/ui';

export interface ShardHUDProps {
  interaction: ShardInteractionState;
  vault: VaultManager;
  vaultState: VaultState;
  worldState: WorldState;
  isVaultOpen: boolean;
  onCloseVault: () => void;
  onOpenVault?: () => void;
  onOpenWorkbench?: () => void;
  activeSignalKey: 'surpriseScore' | 'repetitionScore' | 'nonAlphaRatio' | 'uppercaseRatio' | 'dictionaryHitRate';
  onChangeSignalKey: (key: 'surpriseScore' | 'repetitionScore' | 'nonAlphaRatio' | 'uppercaseRatio' | 'dictionaryHitRate') => void;
  onTriggerSweep?: () => void;
  onCancelSweep?: () => void;
  onSetLensRule?: (rule: LensRule) => void;
  onSaveLensRule?: (rule: LensRule) => void;
  onSelectTool?: (toolId: string) => void;
  onToggleScan?: () => void;
}

export const ShardHUD: React.FC<ShardHUDProps> = ({
  interaction,
  vault,
  vaultState,
  worldState,
  isVaultOpen,
  onCloseVault,
  onOpenVault,
  onOpenWorkbench,
  activeSignalKey,
  onChangeSignalKey,
  onTriggerSweep,
  onCancelSweep,
  onSetLensRule,
  onSaveLensRule,
  onSelectTool,
  onToggleScan
}) => {
  const {
    targetShard,
    holdProgress,
    isHolding,
    scanResult,
    isScanMode,
    isSweeping,
    sweepProgress,
    sweepDuration,
    sweepCooldown,
    sweepCandidatesCount,
    activeRule,
    allRules,
    lastSweepSummary,
    selectedToolId
  } = interaction;

  const [isToolWheelOpen, setIsToolWheelOpen] = useState(false);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [customRule, setCustomRule] = useState<LensRule>(activeRule || DEFAULT_LENS_RULES[0]);
  const [newRuleName, setNewRuleName] = useState('My Custom Rule');

  const tools: ToolWheelItem[] = [
    {
      id: 'sweep_net',
      label: 'Sweep Net',
      description: 'Radius 18m bulk shard harvest filtered by Lens Rules (8s CD)'
    },
    {
      id: 'single_harvest',
      label: 'Precision Harvester',
      description: 'Single shard harvest (Hold [E] 0.6s)'
    },
    {
      id: 'lens_scanner',
      label: 'Lens Scanner',
      description: 'Toggle real-time analytical signal heatmap visualization'
    },
    {
      id: 'vault',
      label: 'Data Shard Vault',
      description: 'Inspect harvested pages, storage capacity tiers & token streams'
    },
    {
      id: 'workbench',
      label: 'Neural Workbench',
      description: 'Open 6-node WebGPU Transformer training canvas'
    }
  ];

  const handleToolSelect = (item: ToolWheelItem) => {
    setIsToolWheelOpen(false);
    if (onSelectTool) onSelectTool(item.id);

    if (item.id === 'sweep_net') {
      if (onTriggerSweep) onTriggerSweep();
    } else if (item.id === 'lens_scanner') {
      if (onToggleScan) onToggleScan();
    } else if (item.id === 'vault') {
      if (onOpenVault) onOpenVault();
    } else if (item.id === 'workbench') {
      if (onOpenWorkbench) onOpenWorkbench();
    }
  };

  return (
    <div className="na-shard-hud" style={{ pointerEvents: 'none' }}>
      {/* 1. Hold-E Harvest Progress Indicator */}
      {targetShard && !isSweeping && (
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

      {/* 2. Sweep Net Channeling Progress Overlay */}
      {isSweeping && (
        <div
          style={{
            position: 'fixed',
            bottom: '22%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(6, 15, 30, 0.92)',
            backdropFilter: 'blur(14px)',
            border: '2px solid #00f3ff',
            borderRadius: '16px',
            padding: '18px 28px',
            boxShadow: '0 12px 40px rgba(0, 243, 255, 0.35)',
            zIndex: 100
          }}
        >
          <ProgressRing
            value={sweepProgress}
            size={76}
            strokeWidth={6}
            color="#00f3ff"
            showLabel
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '1px', color: '#00f3ff' }}>
              SWEEP NET ACTIVE — HARVESTING
            </div>
            <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>
              Scanning 18m Radius ({sweepCandidatesCount} target shards detected)
            </div>
            <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '2px' }}>
              Lens Filter: <strong>{activeRule?.name || 'Default'}</strong>
            </div>
            <div style={{ fontSize: '10px', color: '#f43f5e', marginTop: '6px', fontWeight: 600 }}>
              ⚠️ Keep still: Movement cancels channeling
            </div>
          </div>
        </div>
      )}

      {/* 3. Sweep Net Quick Controls & Lens Rule HUD Widget (Bottom-Right) */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
          zIndex: 85,
          pointerEvents: 'auto'
        }}
      >
        {/* Sweep Net Activation Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(10, 18, 32, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0, 243, 255, 0.3)',
            borderRadius: '28px',
            padding: '6px 14px',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.5)'
          }}
        >
          <button
            onClick={() => setIsToolWheelOpen(true)}
            style={{
              background: 'rgba(0, 243, 255, 0.15)',
              border: '1px solid rgba(0, 243, 255, 0.5)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              color: '#00f3ff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700
            }}
            title="Open Radial ToolWheel [Q]"
          >
            ⚙
          </button>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              SWEEP NET (18m)
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
              Rule: {activeRule?.name || 'Clean English'}
            </span>
          </div>

          <Button
            size="sm"
            variant={sweepCooldown > 0 ? 'secondary' : 'primary'}
            disabled={sweepCooldown > 0 || isSweeping}
            onClick={() => onTriggerSweep && onTriggerSweep()}
            style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600 }}
          >
            {sweepCooldown > 0 ? `${sweepCooldown.toFixed(1)}s` : 'SWEEP [F]'}
          </Button>

          <button
            onClick={() => setIsRuleModalOpen(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              cursor: 'pointer',
              fontSize: '11px',
              textDecoration: 'underline'
            }}
            title="Configure Lens Rules"
          >
            Rules
          </button>
        </div>
      </div>

      {/* 4. Collection Summary Toast Notification */}
      {lastSweepSummary && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            minWidth: '320px',
            background: 'rgba(10, 22, 40, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid #10b981',
            borderRadius: '12px',
            padding: '14px 18px',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.35)',
            zIndex: 110,
            pointerEvents: 'auto',
            animation: 'fadeIn 0.3s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', letterSpacing: '0.5px' }}>
              ✓ SWEEP NET COMPLETE
            </div>
            <Badge variant="accent">
              +{lastSweepSummary.collected} Harvested
            </Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Pages Harvested:</span>
              <span style={{ fontWeight: 600, color: '#00f3ff' }}>{lastSweepSummary.collected}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Filtered (Skipped by Rule):</span>
              <span style={{ fontWeight: 600, color: '#f59e0b' }}>{lastSweepSummary.skipped}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94a3b8' }}>Tokens Yield:</span>
              <span style={{ fontWeight: 600, color: '#10b981' }}>~{lastSweepSummary.tokens.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#94a3b8' }}>Dataset Fingerprint:</span>
              <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontSize: '11px' }}>
                {lastSweepSummary.fingerprint ? lastSweepSummary.fingerprint.slice(0, 12) : '000000000000'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. ToolWheel Modal Overlay */}
      {isToolWheelOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 20, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 105,
            pointerEvents: 'auto'
          }}
          onClick={() => setIsToolWheelOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ToolWheel
              items={tools}
              selectedId={selectedToolId}
              onSelect={handleToolSelect}
            />
          </div>
          <div style={{ marginTop: '16px', color: '#94a3b8', fontSize: '12px' }}>
            Click an instrument or press [Enter] to equip • [Esc] or click outside to close
          </div>
        </div>
      )}

      {/* 6. Lens Rules Configuration Modal */}
      {isRuleModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 20, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 105,
            pointerEvents: 'auto'
          }}
          onClick={() => setIsRuleModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '520px',
              maxWidth: '92vw',
              background: '#0d1526',
              border: '1px solid rgba(0, 243, 255, 0.4)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 16px 48px rgba(0, 0, 0, 0.8)',
              color: '#f8fafc'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#00f3ff' }}>
                Lens Rules Filter Configuration
              </h3>
              <button
                onClick={() => setIsRuleModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '18px', lineHeight: 1.5 }}>
              Sweep Net only harvests shards whose computed analytical Lens Signals satisfy these thresholds.
              Rules operate strictly on measured signals (never on hidden ground-truth tags).
            </p>

            {/* Presets List */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>
                RULE PRESETS
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(allRules || DEFAULT_LENS_RULES).map((r) => (
                  <Button
                    key={r.id || r.name}
                    size="sm"
                    variant={activeRule?.id === r.id ? 'primary' : 'secondary'}
                    onClick={() => {
                      if (onSetLensRule) onSetLensRule(r);
                      setCustomRule({ ...r });
                    }}
                  >
                    {r.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sliders for active rule */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(15, 23, 42, 0.6)', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Min Dictionary Hit Rate:</span>
                  <span style={{ fontFamily: 'monospace', color: '#22c55e', fontWeight: 600 }}>
                    ≥ {((customRule.minDictionaryHitRate ?? 0.9) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={customRule.minDictionaryHitRate ?? 0.9}
                  onChange={(e) => setCustomRule({ ...customRule, minDictionaryHitRate: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Max Non-Alphabetic Ratio:</span>
                  <span style={{ fontFamily: 'monospace', color: '#f59e0b', fontWeight: 600 }}>
                    ≤ {((customRule.maxNonAlphaRatio ?? 0.3) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.6"
                  step="0.05"
                  value={customRule.maxNonAlphaRatio ?? 0.3}
                  onChange={(e) => setCustomRule({ ...customRule, maxNonAlphaRatio: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Max Vault Repetition:</span>
                  <span style={{ fontFamily: 'monospace', color: '#a855f7', fontWeight: 600 }}>
                    ≤ {((customRule.maxRepetitionScore ?? 0.4) * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={customRule.maxRepetitionScore ?? 0.4}
                  onChange={(e) => setCustomRule({ ...customRule, maxRepetitionScore: parseFloat(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Save Custom Rule */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="text"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
                placeholder="Rule Name"
                style={{
                  flex: 1,
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const saved = { ...customRule, id: newRuleName.toLowerCase().replace(/\s+/g, '_'), name: newRuleName };
                  if (onSaveLensRule) onSaveLensRule(saved);
                  if (onSetLensRule) onSetLensRule(saved);
                  setIsRuleModalOpen(false);
                }}
              >
                Apply & Save Rule
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Scan Mode HUD Overlay */}
      {isScanMode && (
        <>
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
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#00f3ff' }}>
              LENS SCANNER ACTIVE
            </div>
            <div style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
            <div style={{ display: 'flex', gap: '6px' }}>
              {(
                [
                  ['surpriseScore', 'Surprise'],
                  ['repetitionScore', 'Repetition'],
                  ['dictionaryHitRate', 'Dict Hit'],
                  ['nonAlphaRatio', 'Non-Alpha'],
                  ['uppercaseRatio', 'Uppercase']
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => onChangeSignalKey(k)}
                  style={{
                    background: activeSignalKey === k ? '#00f3ff' : 'transparent',
                    color: activeSignalKey === k ? '#050c16' : '#94a3b8',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Shard Inspector Card */}
          {scanResult && (
            <div
              style={{
                position: 'fixed',
                top: '128px',
                right: '24px',
                width: '320px',
                background: 'rgba(10, 15, 25, 0.92)',
                backdropFilter: 'blur(14px)',
                border: '1px solid rgba(0, 243, 255, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
                zIndex: 90,
                pointerEvents: 'auto'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#00f3ff', fontWeight: 700, letterSpacing: '0.5px' }}>
                    TARGET ANALYSIS
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
                    {(scanResult.signals.nonAlphabeticRatio * 100).toFixed(1)}%
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

      {/* 8. Vault Modal Panel */}
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
