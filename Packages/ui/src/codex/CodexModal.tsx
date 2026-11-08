import React, { useState } from 'react';
import { CODEX_ENTRIES, CodexConceptId, CodexEntryDef } from '@na/game-core';
import { BASELINES } from '@na/ml-core';

export interface CodexModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEntryId?: CodexConceptId;
  completedStepIds?: string[];
}

export const CodexModal: React.FC<CodexModalProps> = ({
  isOpen,
  onClose,
  initialEntryId = 'token',
  completedStepIds: _completedStepIds = []
}) => {
  const [selectedId, setSelectedId] = useState<CodexConceptId>(initialEntryId);

  // Widget States
  const [sampleText, setSampleText] = useState('This world is made of words.');
  const [simulatedLr, setSimulatedLr] = useState(0.003);
  const [assignedProb, setAssignedProb] = useState(0.65);
  const [vocabSize, setVocabSize] = useState(1024);
  const [splitRatio, setSplitRatio] = useState(0.9);

  // New Live Model Widgets State
  const [selectedAttnRow, setSelectedAttnRow] = useState<number>(3);
  const [lensDepth, setLensDepth] = useState<number>(4);

  if (!isOpen) return null;

  const entries = Object.values(CODEX_ENTRIES);
  const currentEntry: CodexEntryDef = CODEX_ENTRIES[selectedId] || CODEX_ENTRIES.token;

  // Simple token splitter demo: simulates BPE subwords
  const getSimulatedTokens = (text: string) => {
    const words = text.split(/(\s+|[.,!?;:])/).filter(Boolean);
    let idCounter = 120;
    return words.map((w) => {
      const id = (idCounter += 17) % 1024;
      return { text: w, id };
    });
  };

  // Learning rate ball curve calculation
  const getBallState = (lr: number) => {
    if (lr > 0.08) {
      return { x: 92, y: 12, label: 'Divergence! Gradient explosion (Loss -> Inf)', color: 'var(--na-danger)' };
    }
    if (lr < 0.0008) {
      return { x: 22, y: 78, label: 'Sluggish / Stalled (undershooting minimum)', color: 'var(--na-muted)' };
    }
    return { x: 50, y: 88, label: 'Optimal Descent (converges to minimum)', color: 'var(--na-success)' };
  };

  const ball = getBallState(simulatedLr);
  const calculatedLoss = -Math.log(Math.max(0.001, assignedProb)).toFixed(3);

  // Sample sequence for live attention matrix
  const attnTokens = ['The', 'quiet', 'ridge', 'glows'];
  // Real causal attention matrix for prompt
  const sampleAttnMatrix = [
    [1.00, 0.00, 0.00, 0.00],
    [0.72, 0.28, 0.00, 0.00],
    [0.18, 0.65, 0.17, 0.00],
    [0.12, 0.08, 0.74, 0.06]
  ];

  // Logit lens stage progression for token "glows"
  const lensStages = [
    { depth: 0, stage: 'Embedding', topToken: 'and', prob: 0.08, note: 'Unigram frequency prior' },
    { depth: 1, stage: 'Layer 0 Attn', topToken: 'with', prob: 0.14, note: 'Broad syntax candidate' },
    { depth: 2, stage: 'Layer 1 MLP', topToken: 'shines', prob: 0.32, note: 'Semantic illumination concept' },
    { depth: 3, stage: 'Layer 2 Attn', topToken: 'glows', prob: 0.61, note: 'Contextual binding to ridge' },
    { depth: 4, stage: 'Layer 3 MLP', topToken: 'glows', prob: 0.89, note: 'High confidence crystallisation' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--na-overlay)',
        backdropFilter: 'blur(12px)',
        zIndex: 'var(--na-z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--na-space-6)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(1080px, 94vw)',
          height: 'min(720px, 90vh)',
          backgroundColor: 'var(--na-ink)',
          border: '1px solid var(--na-line-strong)',
          borderRadius: 'var(--na-radius-lg)',
          boxShadow: '0 24px 64px var(--na-overlay)',
          display: 'flex',
          overflow: 'hidden'
        }}
      >
        {/* Left Concept Sidebar */}
        <div
          style={{
            width: '280px',
            backgroundColor: 'var(--na-surface)',
            borderRight: '1px solid var(--na-line)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            style={{
              padding: 'var(--na-space-4) var(--na-space-5)',
              borderBottom: '1px solid var(--na-line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--na-font-display)',
                  fontSize: 'var(--na-text-md)',
                  color: 'var(--na-text)',
                  fontWeight: 600
                }}
              >
                The Codex
              </div>
              <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Foundations & Mechanisms</div>
            </div>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'var(--na-font-mono)',
                color: 'var(--na-accent-cool)',
                backgroundColor: 'var(--na-accent-cool-muted)',
                padding: '2px 8px',
                borderRadius: 'var(--na-radius-full)'
              }}
            >
              {entries.length} Entries
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--na-space-3)' }}>
            {entries.map((entry) => {
              const isSelected = selectedId === entry.id;
              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    marginBottom: '4px',
                    backgroundColor: isSelected ? 'var(--na-raised)' : 'transparent',
                    border: `1px solid ${isSelected ? 'var(--na-accent-cool)' : 'transparent'}`,
                    borderRadius: 'var(--na-radius-sm)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                    transition: 'background-color var(--na-duration-fast)'
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--na-text-sm)',
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? 'var(--na-accent-cool)' : 'var(--na-text)'
                    }}
                  >
                    {entry.title}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--na-muted)', textTransform: 'uppercase' }}>
                    {entry.category}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Detail & Interactive Widget Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header */}
          <div
            style={{
              padding: 'var(--na-space-5) var(--na-space-6)',
              borderBottom: '1px solid var(--na-line)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              backgroundColor: 'var(--na-surface)'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--na-accent-cool)', textTransform: 'uppercase', fontWeight: 600 }}>
                {currentEntry.category}
              </div>
              <h2
                style={{
                  fontFamily: 'var(--na-font-display)',
                  fontSize: 'var(--na-text-2xl)',
                  color: 'var(--na-text)',
                  margin: '4px 0 0'
                }}
              >
                {currentEntry.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--na-muted)',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Content Body */}
          <div style={{ padding: 'var(--na-space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--na-space-5)' }}>
            {/* Paragraphs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
              {currentEntry.paragraphs.map((p, idx) => (
                <p key={idx} style={{ fontSize: 'var(--na-text-base)', lineHeight: 1.6, color: 'var(--na-text-secondary)', margin: 0 }}>
                  {p}
                </p>
              ))}
            </div>

            {/* Formula Block */}
            <div
              style={{
                backgroundColor: 'var(--na-surface)',
                border: '1px solid var(--na-line)',
                borderRadius: 'var(--na-radius-sm)',
                padding: 'var(--na-space-3) var(--na-space-4)',
                fontFamily: 'var(--na-font-mono)',
                fontSize: 'var(--na-text-xs)',
                color: 'var(--na-accent)'
              }}
            >
              <span style={{ color: 'var(--na-muted)', marginRight: '8px' }}>FORMULA:</span>
              {currentEntry.formulaPlain}
            </div>

            {/* Interactive Live Mini-Widgets */}
            <div
              style={{
                backgroundColor: 'var(--na-surface)',
                border: '1px solid var(--na-line)',
                borderRadius: 'var(--na-radius-md)',
                padding: 'var(--na-space-5)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--na-space-4)'
              }}
            >
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Interactive Model Simulation
              </div>

              {/* Widget: Attention Matrix */}
              {currentEntry.id === 'attention' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                  <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)' }}>
                    Causal attention weights across token sequence. Click a query token to isolate its routing distribution:
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--na-space-4)', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 48px)', gap: '4px' }}>
                      {sampleAttnMatrix.map((row, r) =>
                        row.map((weight, c) => {
                          const isMasked = c > r;
                          const isSelectedRow = r === selectedAttnRow;
                          return (
                            <div
                              key={`${r}-${c}`}
                              onClick={() => setSelectedAttnRow(r)}
                              style={{
                                width: '48px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: isMasked
                                  ? 'var(--na-ink)'
                                  : isSelectedRow
                                  ? 'color-mix(in srgb, var(--na-accent) 60%, var(--na-surface))'
                                  : 'color-mix(in srgb, var(--na-accent-cool) 30%, var(--na-surface))',
                                border: `1px solid ${isSelectedRow ? 'var(--na-accent)' : 'var(--na-line)'}`,
                                borderRadius: 'var(--na-radius-sm)',
                                fontSize: '10px',
                                fontFamily: 'var(--na-font-mono)',
                                color: isMasked ? 'var(--na-faint)' : 'var(--na-text)',
                                cursor: isMasked ? 'default' : 'pointer'
                              }}
                            >
                              {isMasked ? '—' : weight.toFixed(2)}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div style={{ flex: 1, backgroundColor: 'var(--na-raised)', padding: '12px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                      <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                        Query: <span style={{ color: 'var(--na-accent)', fontWeight: 600 }}>"{attnTokens[selectedAttnRow]}"</span> (Pos {selectedAttnRow})
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {attnTokens.slice(0, selectedAttnRow + 1).map((tok, c) => (
                          <div key={c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--na-font-mono)' }}>
                            <span style={{ color: 'var(--na-text)' }}>→ "{tok}"</span>
                            <span style={{ color: 'var(--na-accent-cool)', fontWeight: 600 }}>
                              {(sampleAttnMatrix[selectedAttnRow][c] * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Widget: Embedding Space */}
              {currentEntry.id === 'embedding' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                  <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)' }}>
                    2D PCA Projection of token vectors demonstrating semantic semantic clustering:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--na-space-3)' }}>
                    <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--na-accent)' }}>Royalty / Persons</div>
                      <div style={{ fontSize: '13px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-text)', marginTop: '4px' }}>
                        KING · QUEEN · LORD · PRINCE
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginTop: '4px' }}>Mean Cosine: 0.842</div>
                    </div>

                    <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--na-accent-cool)' }}>Verbs of Speech</div>
                      <div style={{ fontSize: '13px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-text)', marginTop: '4px' }}>
                        say · speak · tell · declare
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginTop: '4px' }}>Mean Cosine: 0.791</div>
                    </div>

                    <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--na-warning)' }}>Connective Syntax</div>
                      <div style={{ fontSize: '13px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-text)', marginTop: '4px' }}>
                        and · but · or · nor · yet
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--na-muted)', marginTop: '4px' }}>Mean Cosine: 0.819</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Widget: Residual Stream Norm Growth */}
              {currentEntry.id === 'residual_stream' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                  <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)' }}>
                    Empirical L2 norm progression through Transformer depth (additive accumulation):
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { stage: 'Embedding', norm: 1.41, color: 'var(--na-faint)' },
                      { stage: 'Layer 0 Mid (Attn)', norm: 1.84, color: 'var(--na-accent-cool)' },
                      { stage: 'Layer 0 Out (MLP)', norm: 2.31, color: 'var(--na-accent-cool)' },
                      { stage: 'Layer 1 Mid (Attn)', norm: 2.89, color: 'var(--na-accent)' },
                      { stage: 'Layer 1 Out (MLP)', norm: 3.52, color: 'var(--na-accent)' },
                      { stage: 'Layer 2 Out (MLP)', norm: 4.88, color: 'var(--na-warning)' },
                      { stage: 'Layer 3 Out (MLP)', norm: 6.24, color: 'var(--na-warning)' }
                    ].map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontFamily: 'var(--na-font-mono)' }}>
                        <span style={{ width: '130px', color: 'var(--na-muted)' }}>{s.stage}</span>
                        <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--na-raised)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${(s.norm / 7.0) * 100}%`, height: '100%', backgroundColor: s.color }} />
                        </div>
                        <span style={{ width: '40px', color: 'var(--na-text)', textAlign: 'right' }}>{s.norm.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Widget: Logit Lens Depth Scrubber */}
              {currentEntry.id === 'logit_lens' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)' }}>
                      Scrub depth to inspect intermediate unembedded prediction for "The quiet ridge glows":
                    </span>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 600 }}>
                      {lensStages[lensDepth].stage}
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="4"
                    value={lensDepth}
                    onChange={(e) => setLensDepth(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--na-accent)' }}
                  />

                  <div style={{ backgroundColor: 'var(--na-raised)', padding: '12px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>Decoded Virtual Prediction:</div>
                      <div style={{ fontSize: 'var(--na-text-lg)', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)', fontWeight: 600, marginTop: '2px' }}>
                        "{lensStages[lensDepth].topToken}"
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--na-text-secondary)', marginTop: '2px' }}>
                        {lensStages[lensDepth].note}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: 'var(--na-muted)' }}>Probability:</div>
                      <div style={{ fontSize: 'var(--na-text-xl)', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 700 }}>
                        {(lensStages[lensDepth].prob * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Widget 1: Token Splitter */}
              {currentEntry.id === 'token' && (
                <div>
                  <div style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--na-muted)' }}>
                    Type text to observe subword tokenization:
                  </div>
                  <input
                    type="text"
                    value={sampleText}
                    onChange={(e) => setSampleText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--na-raised)',
                      border: '1px solid var(--na-line)',
                      borderRadius: 'var(--na-radius-sm)',
                      color: 'var(--na-text)',
                      fontFamily: 'var(--na-font-mono)',
                      fontSize: '13px',
                      marginBottom: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {getSimulatedTokens(sampleText).map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          padding: '6px 10px',
                          backgroundColor: 'var(--na-raised)',
                          border: '1px solid var(--na-accent-cool)',
                          borderRadius: 'var(--na-radius-sm)',
                          fontSize: '12px'
                        }}
                      >
                        <span style={{ color: 'var(--na-text)', fontWeight: 600 }}>{t.text}</span>
                        <span style={{ fontSize: '10px', color: 'var(--na-accent-cool)', fontFamily: 'var(--na-font-mono)', marginTop: '2px' }}>
                          id: {t.id}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Widget 2: LR Ball on Parabolic Curve */}
              {currentEntry.id === 'learning_rate' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--na-muted)' }}>Simulate Learning Rate:</span>
                    <span style={{ fontSize: '14px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)', fontWeight: 700 }}>
                      {simulatedLr.toFixed(4)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0001"
                    max="0.1"
                    step="0.0005"
                    value={simulatedLr}
                    onChange={(e) => setSimulatedLr(parseFloat(e.target.value))}
                    style={{ width: '100%', marginBottom: '14px' }}
                  />
                  <div style={{ height: '100px', backgroundColor: 'var(--na-ink)', borderRadius: 'var(--na-radius-sm)', position: 'relative', overflow: 'hidden' }}>
                    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                      <path d="M 10,20 Q 50,95 90,20" fill="none" stroke="var(--na-line)" strokeWidth="3" />
                      <circle cx={ball.x} cy={ball.y} r="5" fill={ball.color} />
                    </svg>
                  </div>
                  <div style={{ fontSize: '12px', color: ball.color, marginTop: '8px', fontWeight: 500 }}>
                    {ball.label}
                  </div>
                </div>
              )}

              {/* Widget 3: Cross-Entropy Loss Calculator */}
              {currentEntry.id === 'loss' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--na-muted)' }}>Assigned Probability to Target:</span>
                    <span style={{ fontSize: '14px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 700 }}>
                      {(assignedProb * 100).toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.01"
                    max="0.99"
                    step="0.01"
                    value={assignedProb}
                    onChange={(e) => setAssignedProb(parseFloat(e.target.value))}
                    style={{ width: '100%', marginBottom: '14px' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '12px 18px', backgroundColor: 'var(--na-raised)', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Loss:</span>
                      <div style={{ fontSize: '20px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)', fontWeight: 700 }}>
                        {calculatedLoss}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--na-muted)', lineHeight: 1.4 }}>
                      As confidence approaches 100%, surprisal vanishes to 0. As probability drops toward 0, loss spikes toward infinity.
                    </div>
                  </div>
                </div>
              )}

              {/* Widget 4: Baseline Comparison Bars */}
              {currentEntry.id === 'baseline' && (
                <div>
                  <div style={{ fontSize: '13px', color: 'var(--na-muted)', marginBottom: '12px' }}>
                    Benchmark validation loss thresholds on ByteBPE-1024 Shakespeare:
                  </div>
                  {[
                    { label: 'Uniform Random Guessing', loss: BASELINES.uniform, color: 'var(--na-faint)' },
                    { label: 'Unigram Frequency (Tutorial Gate - Cleared)', loss: BASELINES.unigram, color: 'var(--na-success)' },
                    { label: 'Bigram Frequency (Region 1 Gate)', loss: BASELINES.bigram, color: 'var(--na-accent)' },
                    { label: 'Trigram Frequency (Region 2 Gate)', loss: BASELINES.trigram, color: 'var(--na-accent-cool)' },
                    { label: 'Elder Neural Model (Preset S · 12k)', loss: 2.595, color: 'var(--na-accent-cool-hover)' }
                  ].map((b, i) => (
                    <div key={i} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--na-text)', marginBottom: '4px' }}>
                        <span>{b.label}</span>
                        <span style={{ fontFamily: 'var(--na-font-mono)', fontWeight: 600 }}>{b.loss.toFixed(3)}</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: 'var(--na-raised)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${(b.loss / 7.0) * 100}%`, height: '100%', backgroundColor: b.color, borderRadius: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Widget 4b: Overfitting Empirical Dual Curves */}
              {currentEntry.id === 'overfitting' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--na-muted)' }}>
                      Measured 3,000-Step Scout Overfitting Run (Shakespeare 60k tokens):
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontFamily: 'var(--na-font-mono)' }}>
                      <span style={{ color: 'var(--na-accent)' }}>● Train Loss (plunging)</span>
                      <span style={{ color: 'var(--na-danger)' }}>● Val Loss (surging)</span>
                    </div>
                  </div>

                  <div style={{ height: '160px', width: '100%', backgroundColor: 'var(--na-ink)', borderRadius: '8px', padding: '12px', boxSizing: 'border-box' }}>
                    <svg viewBox="0 0 400 140" style={{ width: '100%', height: '100%' }}>
                      <line x1="40" y1="20" x2="380" y2="20" stroke="var(--na-line)" strokeDasharray="4 4" />
                      <line x1="40" y1="60" x2="380" y2="60" stroke="var(--na-line)" strokeDasharray="4 4" />
                      <line x1="40" y1="100" x2="380" y2="100" stroke="var(--na-line)" strokeDasharray="4 4" />
                      
                      <line x1="40" y1="68" x2="380" y2="68" stroke="var(--na-muted)" strokeDasharray="2 2" />
                      <text x="382" y="71" fill="var(--na-muted)" fontSize="8" fontFamily="var(--na-font-mono)">Unigram 4.472</text>

                      <text x="32" y="24" fill="var(--na-muted)" fontSize="9" textAnchor="end" fontFamily="var(--na-font-mono)">6.5</text>
                      <text x="32" y="64" fill="var(--na-muted)" fontSize="9" textAnchor="end" fontFamily="var(--na-font-mono)">4.5</text>
                      <text x="32" y="104" fill="var(--na-muted)" fontSize="9" textAnchor="end" fontFamily="var(--na-font-mono)">2.5</text>
                      <text x="32" y="125" fill="var(--na-muted)" fontSize="9" textAnchor="end" fontFamily="var(--na-font-mono)">0.8</text>

                      <path
                        d="M 40,20 L 51,73 L 74,81 L 108,88 L 153,94 L 210,108 L 266,116 L 323,121 L 380,125"
                        fill="none"
                        stroke="var(--na-accent)"
                        strokeWidth="2.5"
                      />

                      <path
                        d="M 40,19 L 51,64 L 74,68 L 108,69 L 153,66 L 210,55 L 266,41 L 323,30 L 380,27"
                        fill="none"
                        stroke="var(--na-danger)"
                        strokeWidth="2.5"
                      />

                      <circle cx="108" cy="69" r="4" fill="var(--na-success)" />
                      <text x="108" y="60" fill="var(--na-success)" fontSize="9" textAnchor="middle" fontFamily="var(--na-font-mono)">Optimal: 600 (Val 3.89)</text>

                      <line x1="380" y1="27" x2="380" y2="125" stroke="var(--na-danger)" strokeWidth="1.5" strokeDasharray="3 3" />
                      <text x="375" y="80" fill="var(--na-danger)" fontSize="9" textAnchor="end" fontFamily="var(--na-font-mono)">Gap: +5.36</text>
                    </svg>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                    <div style={{ backgroundColor: 'var(--na-raised)', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--na-muted)' }}>Optimal Early Stop:</span>
                      <div style={{ color: 'var(--na-success)', fontWeight: 600, fontFamily: 'var(--na-font-mono)' }}>Step 600 (Val 3.8918)</div>
                    </div>
                    <div style={{ backgroundColor: 'var(--na-raised)', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--na-accent)', fontWeight: 600, fontFamily: 'var(--na-font-mono)' }}>Final Train Loss:</span>
                      <div style={{ color: 'var(--na-accent)', fontWeight: 600, fontFamily: 'var(--na-font-mono)' }}>0.8327 (Memorized)</div>
                    </div>
                    <div style={{ backgroundColor: 'var(--na-raised)', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: 'var(--na-muted)' }}>Final Val Surrender:</span>
                      <div style={{ color: 'var(--na-danger)', fontWeight: 600, fontFamily: 'var(--na-font-mono)' }}>6.1898 (+5.357 Gap)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Widget 5: Vocabulary Slider */}
              {currentEntry.id === 'vocabulary' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--na-muted)' }}>Vocabulary Size (Tokens):</span>
                    <span style={{ fontSize: '14px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 700 }}>{vocabSize}</span>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="4096"
                    step="256"
                    value={vocabSize}
                    onChange={(e) => setVocabSize(parseInt(e.target.value, 10))}
                    style={{ width: '100%', marginBottom: '12px' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '10px', backgroundColor: 'var(--na-raised)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Embedding Memory:</div>
                      <div style={{ fontSize: '15px', color: 'var(--na-accent-cool)', fontWeight: 600, marginTop: '2px' }}>
                        {((vocabSize * 128 * 4) / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: 'var(--na-raised)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Uniform Baseline Loss:</div>
                      <div style={{ fontSize: '15px', color: 'var(--na-accent)', fontWeight: 600, marginTop: '2px' }}>
                        {Math.log(vocabSize).toFixed(3)} nats
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Widget 6: Dataset & Split Slider */}
              {(currentEntry.id === 'dataset' || currentEntry.id === 'validation_split') && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--na-muted)' }}>Train / Validation Split:</span>
                    <span style={{ fontSize: '14px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 700 }}>
                      {Math.round(splitRatio * 100)}% Train / {Math.round((1 - splitRatio) * 100)}% Val
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="0.95"
                    step="0.05"
                    value={splitRatio}
                    onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                    style={{ width: '100%', marginBottom: '12px' }}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ padding: '10px', backgroundColor: 'var(--na-raised)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Train Tokens (~60k corpus):</div>
                      <div style={{ fontSize: '15px', color: 'var(--na-success)', fontWeight: 600, marginTop: '2px' }}>
                        {Math.round(60000 * splitRatio).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: 'var(--na-raised)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Validation Tokens:</div>
                      <div style={{ fontSize: '15px', color: 'var(--na-accent-cool)', fontWeight: 600, marginTop: '2px' }}>
                        {Math.round(60000 * (1 - splitRatio)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
