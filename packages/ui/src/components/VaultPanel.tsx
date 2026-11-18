import React, { useState, useMemo, useRef } from 'react';
import { VaultState } from '@na/game-core';
import { Badge } from './Badge.js';
import { Button } from './Button.js';
import { Panel } from './Panel.js';

export interface VaultPanelProps {
  isOpen: boolean;
  onClose: () => void;
  vaultState: VaultState;
  onToggleStatus: (shardId: string) => void;
  onRemoveEntry?: (shardId: string) => void;
  onKeepAll?: () => void;
  onDiscardAll?: () => void;
  onRevealTags?: () => void;
  onFillDebug?: (count: number) => void;
  onImportJson?: (jsonStr: string) => void;
  isDev?: boolean;
}

const REGION_COLORS: Record<string, string> = {
  meadow_of_verse: '#10b981',
  weathered_archive: '#f59e0b',
  echo_hollow: '#a855f7',
  billboard_flats: '#f43f5e',
  foreign_shore: '#06b6d4',
  unknown: '#64748b'
};

const REGION_NAMES: Record<string, string> = {
  meadow_of_verse: 'Meadow of Verse',
  weathered_archive: 'Weathered Archive',
  echo_hollow: 'Echo Hollow',
  billboard_flats: 'Billboard Flats',
  foreign_shore: 'Foreign Shore',
  unknown: 'Unknown Sector'
};

export const VaultPanel: React.FC<VaultPanelProps> = ({
  isOpen,
  onClose,
  vaultState,
  onToggleStatus,
  onRemoveEntry,
  onKeepAll,
  onDiscardAll,
  onRevealTags,
  onFillDebug,
  onImportJson,
  isDev = Boolean(typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV)
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'keep' | 'discard'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { entries, stats } = vaultState;

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (regionFilter !== 'all' && e.regionId !== regionFilter) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesId = e.shardId.toLowerCase().includes(query);
        const matchesText = e.text.toLowerCase().includes(query);
        const matchesTag = e.isRevealed && e.tag ? e.tag.toLowerCase().includes(query) : false;
        if (!matchesId && !matchesText && !matchesTag) return false;
      }
      return true;
    });
  }, [entries, statusFilter, regionFilter, searchTerm]);

  // Export JSON handler
  const handleExportJson = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      fingerprint: stats.fingerprint,
      stats,
      entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuroarena-vault-${stats.fingerprint ? stats.fingerprint.slice(0, 8) : 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImportJson) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        try {
          onImportJson(text);
        } catch (err) {
          console.error('Failed to import vault JSON:', err);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div
      className="na-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.78)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 'var(--na-space-4)'
      }}
    >
      <div className="na-modal na-modal--xl na-vault-modal" style={{ maxWidth: '1100px', maxHeight: '90vh' }}>
        <Panel variant="raised">
          {/* Header */}
          <div className="na-panel__header" style={{ borderBottom: '1px solid var(--na-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
              <h2 id="vault-panel-title" className="na-panel__title" style={{ fontSize: 'var(--na-text-lg)', margin: 0 }}>
                Data Shard Vault
              </h2>
              <Badge variant="neutral">
                {stats.count} Shards Collected
              </Badge>
              <Badge variant={stats.keptCount > 0 ? 'accent' : 'neutral'}>
                {stats.keptCount} Active for Training
              </Badge>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
              <Button size="sm" variant="ghost" onClick={handleExportJson} title="Export vault as JSON file">
                ⤓ Export JSON
              </Button>
              {onImportJson && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} title="Import vault from JSON file">
                    ⤒ Import JSON
                  </Button>
                </>
              )}
              {isDev && onFillDebug && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onFillDebug(25)}
                  title="Debug: Fill with 25 random shards"
                >
                  ⚡ Fill Random 25
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close Vault (Tab)">
                Close [Tab]
              </Button>
            </div>
          </div>

          {/* Top Running Stats Section */}
          <div style={{ padding: 'var(--na-space-4)', backgroundColor: 'var(--na-ink)', borderBottom: '1px solid var(--na-line)' }}>
            {/* Vault Storage Capacity Bar */}
            <div
              style={{
                marginBottom: 'var(--na-space-3)',
                padding: 'var(--na-space-3)',
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid var(--na-line)',
                borderRadius: 'var(--na-radius-base)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: 'var(--na-text-xs)', fontWeight: 600, color: 'var(--na-muted)', letterSpacing: '0.5px' }}>
                    VAULT CAPACITY
                  </span>
                  <Badge variant={stats.tier === 3 ? 'accent' : 'neutral'}>
                    Tier {stats.tier || 1}: {stats.tierTitle || 'Novice Ledger'}
                  </Badge>
                </div>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)', color: 'var(--na-text)' }}>
                  <span style={{ fontWeight: 600, color: (stats.count / (stats.maxCapacity || 150)) > 0.9 ? '#ef4444' : 'var(--na-accent)' }}>
                    {stats.count}
                  </span>
                  {' '}/ {stats.maxCapacity || 150} Pages ({Math.min(100, Math.round((stats.count / (stats.maxCapacity || 150)) * 100))}%)
                </div>
              </div>
              <div
                style={{
                  height: '8px',
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (stats.count / (stats.maxCapacity || 150)) * 100)}%`,
                    backgroundColor:
                      (stats.count / (stats.maxCapacity || 150)) > 0.9
                        ? '#ef4444'
                        : (stats.count / (stats.maxCapacity || 150)) > 0.75
                        ? '#f59e0b'
                        : '#00f3ff',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              {stats.nextTierUnlock && (
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', marginTop: '6px' }}>
                  🔒 {stats.nextTierUnlock}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--na-space-3)', marginBottom: 'var(--na-space-3)' }}>
              <div className="na-stat-card" style={{ padding: 'var(--na-space-2) var(--na-space-3)', background: 'var(--na-surface)', borderRadius: 'var(--na-radius-base)' }}>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>ACTIVE TOKENS</div>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-lg)', color: 'var(--na-accent)', fontWeight: 600 }}>
                  ~{stats.tokens.toLocaleString()}
                </div>
              </div>
              <div className="na-stat-card" style={{ padding: 'var(--na-space-2) var(--na-space-3)', background: 'var(--na-surface)', borderRadius: 'var(--na-radius-base)' }}>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>UNIQUE 3-GRAM RATIO</div>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-lg)', color: stats.uniqueRatio < 0.6 ? 'var(--na-critical)' : 'var(--na-text)' }}>
                  {(stats.uniqueRatio * 100).toFixed(1)}%
                </div>
              </div>
              <div className="na-stat-card" style={{ padding: 'var(--na-space-2) var(--na-space-3)', background: 'var(--na-surface)', borderRadius: 'var(--na-radius-base)' }}>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>KEPT / DISCARDED</div>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-lg)', color: 'var(--na-text)' }}>
                  <span style={{ color: 'var(--na-accent)' }}>{stats.keptCount}</span> / <span style={{ color: 'var(--na-muted)' }}>{stats.discardedCount}</span>
                </div>
              </div>
              <div className="na-stat-card" style={{ padding: 'var(--na-space-2) var(--na-space-3)', background: 'var(--na-surface)', borderRadius: 'var(--na-radius-base)' }}>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>ACTIVE REGIONS</div>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-lg)', color: 'var(--na-text)' }}>
                  {Object.keys(stats.sourceMix).length} / 5
                </div>
              </div>
              <div className="na-stat-card" style={{ padding: 'var(--na-space-2) var(--na-space-3)', background: 'var(--na-surface)', borderRadius: 'var(--na-radius-base)' }}>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>DATASET FINGERPRINT</div>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stats.fingerprint ? stats.fingerprint.slice(0, 12) : '000000000000'}
                </div>
              </div>
            </div>

            {/* Source Mix Bar */}
            <div style={{ marginTop: 'var(--na-space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '4px' }}>
                <span>Source Composition Mix</span>
                <span>{stats.keptCount} active shards</span>
              </div>
              <div
                style={{
                  height: '10px',
                  width: '100%',
                  display: 'flex',
                  borderRadius: 'var(--na-radius-sm)',
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--na-line)'
                }}
              >
                {Object.entries(stats.sourceMix).map(([src, fraction]) => (
                  <div
                    key={src}
                    style={{
                      width: `${fraction * 100}%`,
                      backgroundColor: REGION_COLORS[src] || '#64748b',
                      height: '100%'
                    }}
                    title={`${REGION_NAMES[src] || src}: ${(fraction * 100).toFixed(1)}%`}
                  />
                ))}
              </div>
              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--na-space-3)', marginTop: '6px' }}>
                {Object.entries(stats.sourceMix).map(([src, fraction]) => (
                  <div key={src} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--na-muted)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: REGION_COLORS[src] || '#64748b' }} />
                    <span>{REGION_NAMES[src] || src}: {(fraction * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filters & Actions Bar */}
          <div style={{ padding: 'var(--na-space-3) var(--na-space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--na-space-3)', borderBottom: '1px solid var(--na-line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)', flex: 1 }}>
              <input
                type="text"
                placeholder="Search text or shard ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  background: 'var(--na-ink)',
                  border: '1px solid var(--na-line)',
                  borderRadius: 'var(--na-radius-base)',
                  padding: '6px 12px',
                  color: 'var(--na-text)',
                  fontFamily: 'var(--na-font-ui)',
                  fontSize: 'var(--na-text-sm)',
                  width: '260px'
                }}
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  background: 'var(--na-ink)',
                  border: '1px solid var(--na-line)',
                  borderRadius: 'var(--na-radius-base)',
                  padding: '6px 10px',
                  color: 'var(--na-text)',
                  fontFamily: 'var(--na-font-ui)',
                  fontSize: 'var(--na-text-sm)'
                }}
              >
                <option value="all">Status: All</option>
                <option value="keep">Keep Only</option>
                <option value="discard">Discarded Only</option>
              </select>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                style={{
                  background: 'var(--na-ink)',
                  border: '1px solid var(--na-line)',
                  borderRadius: 'var(--na-radius-base)',
                  padding: '6px 10px',
                  color: 'var(--na-text)',
                  fontFamily: 'var(--na-font-ui)',
                  fontSize: 'var(--na-text-sm)'
                }}
              >
                <option value="all">Region: All</option>
                <option value="meadow_of_verse">Meadow of Verse</option>
                <option value="weathered_archive">Weathered Archive</option>
                <option value="echo_hollow">Echo Hollow</option>
                <option value="billboard_flats">Billboard Flats</option>
                <option value="foreign_shore">Foreign Shore</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 'var(--na-space-2)' }}>
              {onKeepAll && <Button size="sm" variant="ghost" onClick={onKeepAll}>Keep All</Button>}
              {onDiscardAll && <Button size="sm" variant="ghost" onClick={onDiscardAll}>Discard All</Button>}
              {isDev && onRevealTags && (
                <Button size="sm" variant="secondary" onClick={onRevealTags} title="Dev Only: Reveal hidden quality tags for debugging / review">
                  🔍 Reveal Ground Truth (Dev)
                </Button>
              )}
            </div>
          </div>

          {/* Main Shard List */}
          <div style={{ height: '480px', overflowY: 'auto', padding: 'var(--na-space-4)' }}>
            {filteredEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--na-space-8)', color: 'var(--na-muted)' }}>
                {entries.length === 0
                  ? 'Your Vault is empty. Explore the terrain and hold [E] near glowing markers to harvest shards.'
                  : 'No shards match the selected search and filter criteria.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                {filteredEntries.map((shard) => {
                  const isKept = shard.status === 'keep';
                  const regColor = REGION_COLORS[shard.regionId] || '#64748b';

                  return (
                    <div
                      key={shard.shardId}
                      style={{
                        background: 'var(--na-surface)',
                        border: `1px solid ${isKept ? 'var(--na-line)' : 'rgba(239, 68, 68, 0.25)'}`,
                        borderRadius: 'var(--na-radius-base)',
                        padding: 'var(--na-space-3) var(--na-space-4)',
                        opacity: isKept ? 1.0 : 0.65,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--na-space-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
                          <span style={{ fontFamily: 'var(--na-font-mono)', fontWeight: 600, fontSize: 'var(--na-text-sm)', color: 'var(--na-text)' }}>
                            {shard.shardId}
                          </span>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: `${regColor}20`,
                              color: regColor,
                              border: `1px solid ${regColor}50`,
                              fontWeight: 500
                            }}
                          >
                            {REGION_NAMES[shard.regionId] || shard.regionId}
                          </span>
                          <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                            {shard.text.length} chars
                          </span>
                          {shard.isRevealed && shard.tag && (
                            <span
                              style={{
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                fontFamily: 'var(--na-font-mono)',
                                fontWeight: 700
                              }}
                            >
                              TAG: {shard.tag.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
                          <Button
                            size="sm"
                            variant={isKept ? 'primary' : 'secondary'}
                            onClick={() => onToggleStatus(shard.shardId)}
                          >
                            {isKept ? 'Keep for Training' : 'Discarded'}
                          </Button>
                          {onRemoveEntry && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onRemoveEntry(shard.shardId)}
                              aria-label={`Remove ${shard.shardId}`}
                            >
                              ✕
                            </Button>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 'var(--na-text-sm)',
                          color: 'var(--na-text)',
                          lineHeight: '1.5',
                          fontFamily: 'var(--na-font-mono)',
                          background: 'var(--na-ink)',
                          padding: 'var(--na-space-3)',
                          borderRadius: 'var(--na-radius-sm)',
                          maxHeight: '96px',
                          overflowY: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {shard.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
};
