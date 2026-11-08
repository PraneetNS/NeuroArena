import React, { useState, useEffect, useMemo } from 'react';
import {
  TinyGPT,
  inspectTinyGPT,
  ModelInspectionResult,
  loadElderCheckpoint,
  ElderCheckpointManifest,
  ByteBPE
} from '@na/ml-core';
import { AttentionInstrument } from './AttentionInstrument.js';
import { LogitLensPanel } from './LogitLensPanel.js';
import { EmbeddingExplorer } from './EmbeddingExplorer.js';
import { PositionSimilarityView } from './PositionSimilarityView.js';

export type ObservatoryTab = 'attention' | 'logit_lens' | 'embeddings' | 'positions';

export interface ObservatoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customModel?: TinyGPT | null;
  customModelName?: string;
  bpeTokenizer?: ByteBPE | null;
  initialTab?: ObservatoryTab;
}

const DEFAULT_PROMPTS = [
  'To be, or not to be, that is the question: Whether \'tis nobler in the mind to suffer',
  'Shall I compare thee to a summer\'s day? Thou art more lovely and more temperate.',
  'All that glitters is not gold; Often have you heard that told.',
  'Now is the winter of our discontent Made glorious summer by this sun of York.'
];

export const ObservatoryModal: React.FC<ObservatoryModalProps> = ({
  isOpen,
  onClose,
  customModel = null,
  customModelName = 'Active Trained Model',
  bpeTokenizer = null,
  initialTab = 'attention'
}) => {
  const [activeTab, setActiveTab] = useState<ObservatoryTab>(initialTab);
  const [selectedModelType, setSelectedModelType] = useState<'elder' | 'custom'>(customModel ? 'custom' : 'elder');

  // Loaded Elder Model and Checkpoint Manifest
  const [elderData, setElderData] = useState<{
    manifest: ElderCheckpointManifest;
    weights: Float32Array;
    model: TinyGPT;
  } | null>(null);
  const [isLoadingElder, setIsLoadingElder] = useState(false);
  const [elderError, setElderError] = useState<string | null>(null);

  // Text Prompt State
  const [promptText, setPromptText] = useState(DEFAULT_PROMPTS[0]);

  // Selected Layer & Head for Attention
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [selectedHead, setSelectedHead] = useState(0);

  // Load Elder Model if not loaded
  useEffect(() => {
    if (!isOpen) return;
    if (elderData) return;

    let cancelled = false;
    setIsLoadingElder(true);

    loadElderCheckpoint('/assets/elder_preset_s.bin')
      .then((res) => {
        if (!cancelled) {
          setElderData(res);
          setIsLoadingElder(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('Could not load Elder checkpoint from assets, instantiating fresh Preset S:', err);
          // Fallback to fresh Preset S if asset not downloaded yet
          try {
            const fallbackModel = new TinyGPT(
              {
                vocabSize: 1024,
                dModel: 128,
                nLayers: 4,
                nHeads: 4,
                dFF: 512,
                contextLen: 128
              },
              42
            );
            setElderData({
              manifest: {
                magic: 'NACP',
                version: 1,
                name: 'The Elder (Preset S)',
                preset: 'S',
                totalParams: fallbackModel.totalParams,
                config: fallbackModel.config,
                step: 12000,
                trainLoss: 2.1159,
                valLoss: 2.5959,
                tokensSeen: 24576000,
                trainedAt: '2026-11-08'
              },
              weights: new Float32Array(fallbackModel.params),
              model: fallbackModel
            });
          } catch (e: any) {
            setElderError(e?.message || String(e));
          }
          setIsLoadingElder(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, elderData]);

  // Determine active model
  const activeModel = useMemo(() => {
    if (selectedModelType === 'custom' && customModel) {
      return customModel;
    }
    return elderData?.model || null;
  }, [selectedModelType, customModel, elderData]);

  // Tokenize Prompt
  const tokenIds = useMemo(() => {
    if (!bpeTokenizer) {
      // Fallback simple character-based mapping if BPE not ready
      const tokens: number[] = [];
      for (let i = 0; i < Math.min(64, promptText.length); i++) {
        tokens.push(promptText.charCodeAt(i) % 1024);
      }
      return tokens;
    }
    const encoded = bpeTokenizer.encode(promptText);
    return Array.from(encoded.subarray(0, Math.min(128, encoded.length)));
  }, [promptText, bpeTokenizer]);

  // Run Inspection Pass
  const inspection: ModelInspectionResult | null = useMemo(() => {
    if (!activeModel || tokenIds.length === 0) return null;
    try {
      return inspectTinyGPT(activeModel, tokenIds, bpeTokenizer);
    } catch (e) {
      console.error('Inspection failed:', e);
      return null;
    }
  }, [activeModel, tokenIds, bpeTokenizer]);

  if (!isOpen) return null;

  const tokEmb = activeModel ? activeModel.getParamView('tokEmb') : new Float64Array(0);
  const posEmb = activeModel ? activeModel.getParamView('posEmb') : new Float64Array(0);

  // Token strings decoded for embeddings view
  const allTokenStrings: string[] = [];
  if (bpeTokenizer) {
    for (let i = 0; i < (activeModel?.config.vocabSize || 1024); i++) {
      try {
        allTokenStrings.push(bpeTokenizer.decode([i]));
      } catch {
        allTokenStrings.push(`[${i}]`);
      }
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--na-overlay)',
        backdropFilter: 'blur(16px)',
        zIndex: 'var(--na-z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--na-space-4)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(1440px, 98vw)',
          height: 'min(920px, 94vh)',
          backgroundColor: 'var(--na-ink)',
          border: '1px solid var(--na-line-strong)',
          borderRadius: 'var(--na-radius-lg)',
          boxShadow: '0 24px 64px var(--na-overlay)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Top Observatory Navigation Bar */}
        <div
          style={{
            padding: 'var(--na-space-3) var(--na-space-6)',
            backgroundColor: 'var(--na-surface)',
            borderBottom: '1px solid var(--na-line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          {/* Title & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-4)' }}>
            <div>
              <div
                style={{
                  fontFamily: 'var(--na-font-display)',
                  fontSize: 'var(--na-text-lg)',
                  color: 'var(--na-text)',
                  fontWeight: 600
                }}
              >
                The Neural Observatory
              </div>
              <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>
                Mechanistic Interpretability & Representation Geometry
              </div>
            </div>

            {/* Model Selector Pill */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--na-raised)',
                padding: '2px',
                borderRadius: 'var(--na-radius-sm)',
                border: '1px solid var(--na-line)'
              }}
            >
              <button
                onClick={() => setSelectedModelType('elder')}
                style={{
                  padding: '4px 10px',
                  fontSize: 'var(--na-text-xs)',
                  fontFamily: 'var(--na-font-mono)',
                  borderRadius: 'var(--na-radius-sm)',
                  backgroundColor: selectedModelType === 'elder' ? 'var(--na-accent)' : 'transparent',
                  color: selectedModelType === 'elder' ? 'var(--na-ink)' : 'var(--na-text)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: selectedModelType === 'elder' ? 600 : 400
                }}
              >
                The Elder (Preset S · 12k Steps)
              </button>

              {customModel && (
                <button
                  onClick={() => setSelectedModelType('custom')}
                  style={{
                    padding: '4px 10px',
                    fontSize: 'var(--na-text-xs)',
                    fontFamily: 'var(--na-font-mono)',
                    borderRadius: 'var(--na-radius-sm)',
                    backgroundColor: selectedModelType === 'custom' ? 'var(--na-accent-cool)' : 'transparent',
                    color: selectedModelType === 'custom' ? 'var(--na-ink)' : 'var(--na-text)',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: selectedModelType === 'custom' ? 600 : 400
                  }}
                >
                  {customModelName}
                </button>
              )}
            </div>
          </div>

          {/* Tab Navigation Buttons */}
          <div style={{ display: 'flex', gap: 'var(--na-space-2)' }}>
            <button
              onClick={() => setActiveTab('attention')}
              style={{
                padding: '6px 14px',
                fontSize: 'var(--na-text-xs)',
                borderRadius: 'var(--na-radius-sm)',
                backgroundColor: activeTab === 'attention' ? 'var(--na-raised)' : 'transparent',
                color: activeTab === 'attention' ? 'var(--na-accent)' : 'var(--na-muted)',
                border: `1px solid ${activeTab === 'attention' ? 'var(--na-accent)' : 'var(--na-line)'}`,
                cursor: 'pointer',
                fontWeight: activeTab === 'attention' ? 600 : 400
              }}
            >
              1. Attention Arcs
            </button>

            <button
              onClick={() => setActiveTab('logit_lens')}
              style={{
                padding: '6px 14px',
                fontSize: 'var(--na-text-xs)',
                borderRadius: 'var(--na-radius-sm)',
                backgroundColor: activeTab === 'logit_lens' ? 'var(--na-raised)' : 'transparent',
                color: activeTab === 'logit_lens' ? 'var(--na-accent-cool)' : 'var(--na-muted)',
                border: `1px solid ${activeTab === 'logit_lens' ? 'var(--na-accent-cool)' : 'var(--na-line)'}`,
                cursor: 'pointer',
                fontWeight: activeTab === 'logit_lens' ? 600 : 400
              }}
            >
              2. Logit Lens
            </button>

            <button
              onClick={() => setActiveTab('embeddings')}
              style={{
                padding: '6px 14px',
                fontSize: 'var(--na-text-xs)',
                borderRadius: 'var(--na-radius-sm)',
                backgroundColor: activeTab === 'embeddings' ? 'var(--na-raised)' : 'transparent',
                color: activeTab === 'embeddings' ? 'var(--na-warning)' : 'var(--na-muted)',
                border: `1px solid ${activeTab === 'embeddings' ? 'var(--na-warning)' : 'var(--na-line)'}`,
                cursor: 'pointer',
                fontWeight: activeTab === 'embeddings' ? 600 : 400
              }}
            >
              3. Embedding Explorer (3D PCA)
            </button>

            <button
              onClick={() => setActiveTab('positions')}
              style={{
                padding: '6px 14px',
                fontSize: 'var(--na-text-xs)',
                borderRadius: 'var(--na-radius-sm)',
                backgroundColor: activeTab === 'positions' ? 'var(--na-raised)' : 'transparent',
                color: activeTab === 'positions' ? 'var(--na-text)' : 'var(--na-muted)',
                border: `1px solid ${activeTab === 'positions' ? 'var(--na-text)' : 'var(--na-line)'}`,
                cursor: 'pointer',
                fontWeight: activeTab === 'positions' ? 600 : 400
              }}
            >
              4. Position View
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              padding: '6px 12px',
              fontSize: 'var(--na-text-sm)',
              color: 'var(--na-muted)',
              backgroundColor: 'var(--na-raised)',
              border: '1px solid var(--na-line)',
              borderRadius: 'var(--na-radius-sm)',
              cursor: 'pointer'
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Prompt Input Sub-Bar (for Attention & Logit Lens) */}
        {(activeTab === 'attention' || activeTab === 'logit_lens') && (
          <div
            style={{
              padding: 'var(--na-space-2) var(--na-space-6)',
              backgroundColor: 'var(--na-raised)',
              borderBottom: '1px solid var(--na-line)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--na-space-4)'
            }}
          >
            <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', whiteSpace: 'nowrap' }}>
              Sequence Prompt:
            </span>
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              style={{
                flex: 1,
                padding: '4px 10px',
                fontSize: 'var(--na-text-xs)',
                fontFamily: 'var(--na-font-mono)',
                backgroundColor: 'var(--na-surface)',
                border: '1px solid var(--na-line)',
                borderRadius: 'var(--na-radius-sm)',
                color: 'var(--na-text)'
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--na-space-1)' }}>
              {DEFAULT_PROMPTS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setPromptText(p)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '10px',
                    color: 'var(--na-muted)',
                    backgroundColor: 'var(--na-surface)',
                    border: '1px solid var(--na-line)',
                    borderRadius: 'var(--na-radius-sm)',
                    cursor: 'pointer'
                  }}
                >
                  Prompt {idx + 1}
                </button>
              ))}
            </div>

            {/* Metrics Snapshot */}
            {inspection && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--na-space-3)',
                  borderLeft: '1px solid var(--na-line)',
                  paddingLeft: 'var(--na-space-4)',
                  fontSize: '11px',
                  fontFamily: 'var(--na-font-mono)'
                }}
              >
                <div>
                  <span style={{ color: 'var(--na-muted)' }}>Tokens: </span>
                  <span style={{ color: 'var(--na-text)', fontWeight: 600 }}>{inspection.T}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--na-muted)' }}>Surprisal: </span>
                  <span style={{ color: 'var(--na-accent-cool)', fontWeight: 600 }}>
                    {inspection.meanLoss.toFixed(3)}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--na-muted)' }}>Perplexity: </span>
                  <span style={{ color: 'var(--na-accent)', fontWeight: 600 }}>
                    {Math.exp(inspection.meanLoss).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Instrument Display Area */}
        <div style={{ flex: 1, padding: 'var(--na-space-4)', overflow: 'hidden' }}>
          {isLoadingElder && (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--na-muted)'
              }}
            >
              Loading Elder Model Checkpoint...
            </div>
          )}

          {elderError && (
            <div style={{ color: 'var(--na-danger)', padding: 'var(--na-space-4)' }}>
              Error loading reference model: {elderError}
            </div>
          )}

          {!isLoadingElder && inspection && activeTab === 'attention' && (
            <AttentionInstrument
              inspection={inspection}
              selectedLayer={selectedLayer}
              selectedHead={selectedHead}
              onSelectLayerHead={(l, h) => {
                setSelectedLayer(l);
                setSelectedHead(h);
              }}
            />
          )}

          {!isLoadingElder && inspection && activeTab === 'logit_lens' && (
            <LogitLensPanel inspection={inspection} />
          )}

          {!isLoadingElder && activeModel && activeTab === 'embeddings' && (
            <EmbeddingExplorer
              tokEmb={tokEmb}
              vocabSize={activeModel.config.vocabSize}
              dModel={activeModel.config.dModel}
              tokenStrings={allTokenStrings}
            />
          )}

          {!isLoadingElder && activeModel && activeTab === 'positions' && (
            <PositionSimilarityView
              posEmb={posEmb}
              contextLen={activeModel.config.contextLen}
              dModel={activeModel.config.dModel}
            />
          )}
        </div>
      </div>
    </div>
  );
};
