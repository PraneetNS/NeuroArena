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

  // Inference & Sampling Widgets State (Real Elder Model on "To be, or not to ")
  const [codexTemp, setCodexTemp] = useState<number>(0.8);
  const [codexTopK, setCodexTopK] = useState<number>(5);
  const [codexTopP, setCodexTopP] = useState<number>(0.85);
  const [sampledTokens, setSampledTokens] = useState<string[]>([' be', ' the', ' be']);
  const [lastSampled, setLastSampled] = useState<{ token: string; prob: number; count: number }>({
    token: ' be',
    prob: 0.38,
    count: 3
  });

  if (!isOpen) return null;

  const entries = Object.values(CODEX_ENTRIES);
  const currentEntry: CodexEntryDef = CODEX_ENTRIES[selectedId] || CODEX_ENTRIES.token;

  // Simple token splitter demo: simulates bpe1024-v2 leading-space subwords
  const getSimulatedTokens = (text: string) => {
    const regex = / ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
    const matches = text.match(regex) || [];
    let idCounter = 120;
    return matches.map((w) => {
      const id = (idCounter += 17) % 1024;
      const visual = w.startsWith(' ') ? '␣' + w.slice(1) : w;
      return { text: w, visual, id, hasSpace: w.startsWith(' ') };
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

  // Real Elder model measured distribution for prompt "To be, or not to " (bpe1024-v2 leading-space pieces)
  const ELDER_PROMPT_DIST = [
    { token: ' be', logit: 3.829 },
    { token: ' the', logit: 3.163 },
    { token: ' see', logit: 2.514 },
    { token: ' do', logit: 2.360 },
    { token: ' me', logit: 2.358 },
    { token: ' a', logit: 2.199 },
    { token: ' my', logit: 2.077 },
    { token: ' w', logit: 1.915 },
    { token: ' you', logit: 1.905 },
    { token: ' make', logit: 1.888 },
    { token: ' come', logit: 1.810 },
    { token: ' have', logit: 1.765 },
    { token: ' hear', logit: 1.720 },
    { token: ' stand', logit: 1.685 },
    { token: ' die', logit: 1.642 }
  ];

  const getScaledProbs = (temp: number) => {
    const t = Math.max(0.01, temp);
    const maxL = Math.max(...ELDER_PROMPT_DIST.map((c) => c.logit / t));
    const exps = ELDER_PROMPT_DIST.map((c) => Math.exp(c.logit / t - maxL));
    const sumExp = exps.reduce((a, b) => a + b, 0);
    const probs = exps.map((e) => e / sumExp);
    let entropy = 0;
    for (const p of probs) {
      if (p > 1e-6) entropy -= p * Math.log2(p);
    }
    return {
      items: ELDER_PROMPT_DIST.map((c, i) => ({ ...c, prob: probs[i] })),
      entropy
    };
  };

  const getFilteredNucleus = (k: number, p: number, temp = 0.8) => {
    const scaled = getScaledProbs(temp);
    const sorted = [...scaled.items].sort((a, b) => b.prob - a.prob);
    const kFiltered = sorted.slice(0, Math.min(k, sorted.length));
    let cumProb = 0;
    const nucleusTokens = new Set<string>();
    for (const item of kFiltered) {
      nucleusTokens.add(item.token);
      cumProb += item.prob;
      if (cumProb >= p) break;
    }
    return {
      items: sorted.map((item, idx) => ({
        ...item,
        inTopK: idx < k,
        inNucleus: nucleusTokens.has(item.token)
      })),
      nucleusMass: cumProb
    };
  };

  const handleSampleRoll = (temp = codexTemp) => {
    const scaled = getScaledProbs(temp);
    const r = Math.random();
    let acc = 0;
    let chosen = scaled.items[0];
    for (const item of scaled.items) {
      acc += item.prob;
      if (r <= acc) {
        chosen = item;
        break;
      }
    }
    setSampledTokens((prev) => [chosen.token, ...prev.slice(0, 7)]);
    setLastSampled({ token: chosen.token, prob: chosen.prob, count: lastSampled.count + 1 });
  };

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
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Foundations & Mechanisms</div>
            </div>
            <span
              style={{
                fontSize: 'var(--na-text-xs)',
                fontFamily: 'var(--na-font-mono)',
                color: 'var(--na-accent-cool)',
                backgroundColor: 'var(--na-accent-cool-muted)',
                padding: 'var(--na-space-1) var(--na-space-2)',
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
                    padding: 'var(--na-space-2) var(--na-space-3)',
                    marginBottom: 'var(--na-space-1)',
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
                  <div style={{ fontSize: 'var(--na-text-2xs)', color: 'var(--na-muted)', textTransform: 'uppercase' }}>
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
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-accent-cool)', textTransform: 'uppercase', fontWeight: 600 }}>
                {currentEntry.category}
              </div>
              <h2
                style={{
                  fontFamily: 'var(--na-font-display)',
                  fontSize: 'var(--na-text-2xl)',
                  color: 'var(--na-text)',
                  margin: 'var(--na-space-1) 0 0'
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
                fontSize: 'var(--na-text-lg)',
                cursor: 'pointer',
                padding: 'var(--na-space-1) var(--na-space-2)'
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
                        <span style={{ color: 'var(--na-text)', fontWeight: 600 }}>
                          {t.hasSpace && <span style={{ color: 'var(--na-accent)', marginRight: '2px' }}>␣</span>}
                          {t.hasSpace ? t.text.slice(1) : t.text}
                        </span>
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
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 14px',
                    backgroundColor: 'rgba(232, 163, 61, 0.08)',
                    border: '1px solid rgba(232, 163, 61, 0.25)',
                    borderRadius: 'var(--na-radius-sm)',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    color: '#E8E4DA'
                  }}>
                    <strong style={{ color: 'var(--na-accent)' }}>Architectural Note: Scale-Invariance &amp; Gradient Clipping in Adam</strong>
                    <p style={{ margin: '6px 0 0 0' }}>
                      A common misconception is that gradient norm clipping will tame an excessively large learning rate under adaptive optimizers like Adam. In reality, Adam updates each coordinate by η · m̂ / (√v̂ + ε). When gradient clipping scales all gradients down by a factor α = C / ||g|| &lt; 1, both the first moment estimate m̂ and the second moment root √v̂ scale proportionally by α after a few steps. The scale factor α cancels out in the numerator and denominator: (α g) / (α |g|) = sign(g). Thus, Adam’s effective per-coordinate update step remains approximately ±η regardless of gradient magnitude. While gradient clipping prevents numerical overflow in the float accumulators, it cannot stop an optimizer with excessive η from taking catastrophic strides across the loss landscape.
                    </p>
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
                      <text x="382" y="71" fill="var(--na-muted)" fontSize="8" fontFamily="var(--na-font-mono)">Unigram {BASELINES.unigram}</text>

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

              {/* Widget: Next-Token Distribution */}
              {currentEntry.id === 'next_token_distribution' && (() => {
                const scaled = getScaledProbs(1.0);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                    <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)' }}>
                      Real Elder model vocabulary distribution for prompt <strong style={{ color: 'var(--na-accent)' }}>"To be, or not to "</strong>:
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--na-raised)', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Distribution Entropy: </span>
                        <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '13px', color: 'var(--na-accent)', fontWeight: 700 }}>
                          {scaled.entropy.toFixed(3)} bits
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>
                        Top token: <strong style={{ color: 'var(--na-accent-cool)' }}>"{scaled.items[0].token}"</strong> ({(scaled.items[0].prob * 100).toFixed(1)}%)
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {scaled.items.slice(0, 8).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontFamily: 'var(--na-font-mono)' }}>
                          <span style={{ width: '60px', color: idx === 0 ? 'var(--na-accent)' : 'var(--na-text)', fontWeight: idx === 0 ? 700 : 400 }}>
                            "{item.token}"
                          </span>
                          <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--na-raised)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${item.prob * 100}%`, height: '100%', backgroundColor: idx === 0 ? 'var(--na-accent)' : 'var(--na-accent-cool)' }} />
                          </div>
                          <span style={{ width: '45px', textAlign: 'right', color: 'var(--na-muted)' }}>
                            {(item.prob * 100).toFixed(1)}%
                          </span>
                          <span style={{ width: '45px', textAlign: 'right', color: 'var(--na-faint)', fontSize: '10px' }}>
                            z={item.logit.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Widget: Temperature Modulation */}
              {currentEntry.id === 'temperature' && (() => {
                const scaled = getScaledProbs(codexTemp);
                const qualitative = codexTemp < 0.4 ? 'Collapsed to Deterministic Argmax' : codexTemp < 1.1 ? 'Balanced Shakespearean Coherence' : 'High Entropy / Flattened Chaos';
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)' }}>
                        Modulate Softmax Temperature T for "To be, or not to ":
                      </span>
                      <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '14px', color: 'var(--na-accent)', fontWeight: 700 }}>
                        T = {codexTemp.toFixed(2)}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0.1"
                      max="2.0"
                      step="0.05"
                      value={codexTemp}
                      onChange={(e) => setCodexTemp(parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--na-accent)' }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--na-raised)', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Regime: <strong style={{ color: 'var(--na-text)' }}>{qualitative}</strong></span>
                      <span style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)' }}>Entropy: {scaled.entropy.toFixed(2)} bits</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {scaled.items.slice(0, 6).map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'var(--na-font-mono)' }}>
                          <span style={{ width: '50px', color: 'var(--na-text)' }}>"{item.token}"</span>
                          <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--na-raised)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${item.prob * 100}%`, height: '100%', backgroundColor: idx === 0 ? 'var(--na-accent)' : 'var(--na-accent-cool)' }} />
                          </div>
                          <span style={{ width: '42px', textAlign: 'right', color: 'var(--na-muted)' }}>{(item.prob * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Widget: Top-K and Top-P Truncation */}
              {currentEntry.id === 'top_k_top_p' && (() => {
                const nucleus = getFilteredNucleus(codexTopK, codexTopP, 0.8);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                    <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)' }}>
                      Interactive Nucleus & Rank Filtering for "To be, or not to ":
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--na-space-3)' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--na-muted)' }}>Top-K:</span>
                          <span style={{ color: 'var(--na-accent)', fontFamily: 'var(--na-font-mono)', fontWeight: 700 }}>{codexTopK}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="12"
                          step="1"
                          value={codexTopK}
                          onChange={(e) => setCodexTopK(parseInt(e.target.value, 10))}
                          style={{ width: '100%', accentColor: 'var(--na-accent)' }}
                        />
                      </div>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--na-muted)' }}>Top-P (Nucleus):</span>
                          <span style={{ color: 'var(--na-accent-cool)', fontFamily: 'var(--na-font-mono)', fontWeight: 700 }}>{codexTopP.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={codexTopP}
                          onChange={(e) => setCodexTopP(parseFloat(e.target.value))}
                          style={{ width: '100%', accentColor: 'var(--na-accent-cool)' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--na-raised)', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)', fontSize: '11px' }}>
                      <span style={{ color: 'var(--na-muted)' }}>Filtered Nucleus Mass:</span>
                      <span style={{ color: 'var(--na-accent)', fontFamily: 'var(--na-font-mono)', fontWeight: 700 }}>{(nucleus.nucleusMass * 100).toFixed(1)}%</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {nucleus.items.slice(0, 10).map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: item.inNucleus ? 'var(--na-raised)' : 'var(--na-surface)',
                            border: `1px solid ${item.inNucleus ? 'var(--na-accent)' : 'var(--na-line)'}`,
                            borderRadius: 'var(--na-radius-sm)',
                            opacity: item.inNucleus ? 1 : 0.4,
                            textDecoration: item.inNucleus ? 'none' : 'line-through',
                            fontSize: '11px',
                            fontFamily: 'var(--na-font-mono)',
                            display: 'flex',
                            gap: '4px'
                          }}
                        >
                          <span style={{ color: item.inNucleus ? 'var(--na-text)' : 'var(--na-faint)' }}>"{item.token}"</span>
                          <span style={{ color: item.inNucleus ? 'var(--na-accent-cool)' : 'var(--na-faint)' }}>{(item.prob * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Widget: Min-P Truncation */}
              {currentEntry.id === 'min_p' && (() => {
                const [demoMinP, setDemoMinP] = useState<number>(0.15);
                const candidates = [
                  { token: ' be', prob: 0.38 },
                  { token: ' the', prob: 0.18 },
                  { token: ' die', prob: 0.08 },
                  { token: ' sleep', prob: 0.05 },
                  { token: ' live', prob: 0.03 },
                  { token: ' see', prob: 0.015 },
                  { token: ' know', prob: 0.012 },
                  { token: ' stand', prob: 0.008 }
                ];
                const pMax = candidates[0].prob;
                const threshold = pMax * demoMinP;
                const kept = candidates.filter(c => c.prob >= threshold);
                const keptMass = kept.reduce((a, b) => a + b.prob, 0);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                    <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)' }}>
                      Min-P Dynamic Cutoff: Threshold = max(p) &times; MinP = {(pMax * 100).toFixed(1)}% &times; {demoMinP.toFixed(2)} = <strong style={{ color: 'var(--na-accent)' }}>{(threshold * 100).toFixed(2)}%</strong>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--na-muted)' }}>Min-P Threshold:</span>
                        <span style={{ color: 'var(--na-accent)', fontFamily: 'var(--na-font-mono)', fontWeight: 700 }}>{demoMinP.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="0.50"
                        step="0.01"
                        value={demoMinP}
                        onChange={(e) => setDemoMinP(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--na-accent)' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'var(--na-raised)', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)', fontSize: '11px' }}>
                      <span style={{ color: 'var(--na-muted)' }}>Retained Candidates ({kept.length}/{candidates.length}):</span>
                      <span style={{ color: 'var(--na-accent-cool)', fontFamily: 'var(--na-font-mono)', fontWeight: 700 }}>{(keptMass * 100).toFixed(1)}% Mass</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {candidates.map((c, idx) => {
                        const isKept = c.prob >= threshold;
                        return (
                          <div
                            key={idx}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: isKept ? 'var(--na-raised)' : 'var(--na-surface)',
                              border: `1px solid ${isKept ? 'var(--na-accent)' : 'var(--na-line)'}`,
                              borderRadius: 'var(--na-radius-sm)',
                              opacity: isKept ? 1 : 0.35,
                              textDecoration: isKept ? 'none' : 'line-through',
                              fontSize: '11px',
                              fontFamily: 'var(--na-font-mono)',
                              display: 'flex',
                              gap: '4px'
                            }}
                          >
                            <span style={{ color: isKept ? 'var(--na-text)' : 'var(--na-faint)' }}>"{c.token}"</span>
                            <span style={{ color: isKept ? 'var(--na-accent-cool)' : 'var(--na-faint)' }}>{(c.prob * 100).toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Widget: Stochastic Sampling */}
              {currentEntry.id === 'sampling' && (() => {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-3)' }}>
                    <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-text-secondary)' }}>
                      Simulate drawing a random token from the Elder distribution for "To be, or not to ":
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--na-space-3)', alignItems: 'center' }}>
                      <button
                        onClick={() => handleSampleRoll()}
                        style={{
                          backgroundColor: 'var(--na-accent)',
                          color: 'var(--na-ink)',
                          border: 'none',
                          borderRadius: 'var(--na-radius-sm)',
                          padding: '8px 16px',
                          fontFamily: 'var(--na-font-mono)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        🎲 Roll Stochastic Sample
                      </button>
                      <div style={{ fontSize: '11px', color: 'var(--na-muted)' }}>
                        Drawn: <strong style={{ color: 'var(--na-accent)', fontSize: '14px', fontFamily: 'var(--na-font-mono)' }}>"{lastSampled.token}"</strong> ({(lastSampled.prob * 100).toFixed(1)}% chance)
                      </div>
                    </div>

                    <div style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--na-muted)', marginBottom: '4px' }}>Recent Draws History:</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {sampledTokens.map((t, idx) => (
                          <span
                            key={idx}
                            style={{
                              backgroundColor: idx === 0 ? 'var(--na-accent-muted)' : 'var(--na-surface)',
                              border: `1px solid ${idx === 0 ? 'var(--na-accent)' : 'var(--na-line)'}`,
                              color: idx === 0 ? 'var(--na-accent)' : 'var(--na-text)',
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontFamily: 'var(--na-font-mono)',
                              fontSize: '12px'
                            }}
                          >
                            "{t}"
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
