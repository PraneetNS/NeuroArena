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
  completedStepIds = []
}) => {
  const [selectedId, setSelectedId] = useState<CodexConceptId>(initialEntryId);

  // Widget States
  const [sampleText, setSampleText] = useState('This world is made of words.');
  const [simulatedLr, setSimulatedLr] = useState(0.003);
  const [assignedProb, setAssignedProb] = useState(0.65);
  const [vocabSize, setVocabSize] = useState(1024);
  const [splitRatio, setSplitRatio] = useState(0.9);

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
      return { x: 92, y: 12, label: 'Divergence! Gradient explosion (Loss -> Inf)', color: '#ef4444' };
    }
    if (lr < 0.0008) {
      return { x: 22, y: 78, label: 'Sluggish / Stalled (undershooting minimum)', color: '#94a3b8' };
    }
    return { x: 50, y: 88, label: 'Optimal Descent (converges to minimum)', color: '#10b981' };
  };

  const ball = getBallState(simulatedLr);
  const calculatedLoss = -Math.log(Math.max(0.001, assignedProb)).toFixed(3);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 15, 0.82)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(980px, 94vw)',
          height: 'min(680px, 88vh)',
          backgroundColor: '#0c1220',
          border: '1px solid rgba(0, 243, 255, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 0 40px rgba(0, 243, 255, 0.12)',
          display: 'flex',
          overflow: 'hidden'
        }}
      >
        {/* Left Concept Sidebar */}
        <div
          style={{
            width: '260px',
            backgroundColor: '#080d18',
            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            style={{
              padding: '18px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#00f3ff', fontWeight: 700 }}>
                The Codex // Journal
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginTop: '2px' }}>
                Foundations
              </div>
            </div>
            <span style={{ fontSize: '12px', background: 'rgba(255, 255, 255, 0.06)', padding: '2px 8px', borderRadius: '4px', color: '#94a3b8' }}>
              [J]
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
            {entries.map((entry) => {
              const isSelected = entry.id === selectedId;
              const isUnlocked = completedStepIds.length === 0 || completedStepIds.includes(entry.unlockedAtStep);

              return (
                <button
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    marginBottom: '4px',
                    border: isSelected ? '1px solid rgba(0, 243, 255, 0.4)' : '1px solid transparent',
                    background: isSelected ? 'rgba(0, 243, 255, 0.1)' : 'transparent',
                    color: isSelected ? '#00f3ff' : isUnlocked ? '#e2e8f0' : '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13.5px',
                    fontWeight: isSelected ? 600 : 400
                  }}
                >
                  <span>{entry.title}</span>
                  {!isUnlocked && <span style={{ fontSize: '11px', opacity: 0.7 }}>🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Article & Interactive Widget Body */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#0c1220'
          }}
        >
          {/* Article Header */}
          <div
            style={{
              padding: '20px 28px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#f59e0b', fontWeight: 600 }}>
                {currentEntry.category}
              </div>
              <h2 style={{ fontSize: '24px', margin: '4px 0 0 0', color: '#ffffff', fontWeight: 600 }}>
                {currentEntry.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#94a3b8',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              ✕
            </button>
          </div>

          {/* Article Content & Widget */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            {/* Paragraph 1 */}
            <p style={{ fontSize: '15px', lineHeight: '1.65', color: '#cbd5e1', margin: '0 0 16px 0' }}>
              {currentEntry.paragraphs[0]}
            </p>

            {/* Plain Formula Card */}
            <div
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                borderLeft: '3px solid #00f3ff',
                padding: '12px 18px',
                margin: '18px 0',
                borderRadius: '0 8px 8px 0'
              }}
            >
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Mathematical Formulation
              </div>
              <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
                {currentEntry.formulaPlain}
              </div>
            </div>

            {/* Paragraph 2 */}
            <p style={{ fontSize: '15px', lineHeight: '1.65', color: '#cbd5e1', margin: '0 0 24px 0' }}>
              {currentEntry.paragraphs[1]}
            </p>

            {/* ONE Tiny Interactive Widget */}
            <div
              style={{
                backgroundColor: '#070b14',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '20px',
                marginTop: '16px'
              }}
            >
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00f3ff', fontWeight: 700, marginBottom: '14px' }}>
                Interactive Demonstration // Hands-On Concept
              </div>

              {/* Widget 1: Token Splitter */}
              {currentEntry.id === 'token' && (
                <div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
                    Type text below to observe BPE tokenization into discrete numerical IDs:
                  </div>
                  <input
                    type="text"
                    value={sampleText}
                    onChange={(e) => setSampleText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#111827',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '14px',
                      marginBottom: '14px',
                      outline: 'none'
                    }}
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {getSimulatedTokens(sampleText).map((t, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: 'rgba(0, 243, 255, 0.12)',
                          border: '1px solid rgba(0, 243, 255, 0.35)',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 500 }}>
                          {t.text.trim() || '␣'}
                        </span>
                        <span style={{ color: '#00f3ff', fontSize: '11px', fontFamily: 'monospace' }}>
                          #{t.id}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Widget 2: Learning Rate Curve & Ball */}
              {currentEntry.id === 'learning_rate' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Learning Rate (Step Stride):</span>
                    <span style={{ fontSize: '14px', fontFamily: 'monospace', color: ball.color, fontWeight: 700 }}>
                      {simulatedLr.toFixed(4)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0001"
                    max="0.2"
                    step="0.0005"
                    value={simulatedLr}
                    onChange={(e) => setSimulatedLr(parseFloat(e.target.value))}
                    style={{ width: '100%', marginBottom: '14px' }}
                  />

                  {/* SVG 1D Loss Landscape */}
                  <div style={{ height: '110px', backgroundColor: '#0f172a', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                    <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                      <path d="M 5,10 Q 50,110 95,10" fill="none" stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2.5" />
                      <circle cx={ball.x} cy={ball.y} r="5" fill={ball.color} />
                    </svg>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '12.5px', color: ball.color, fontWeight: 600 }}>
                    {ball.label}
                  </div>
                </div>
              )}

              {/* Widget 3: Cross-Entropy Loss Calculator */}
              {currentEntry.id === 'loss' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Target Token Assigned Probability:</span>
                    <span style={{ fontSize: '14px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
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
                  <div style={{ padding: '12px', backgroundColor: '#0f172a', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: '#cbd5e1' }}>Resulting Cross-Entropy Loss:</span>
                    <span style={{ fontSize: '20px', fontFamily: 'monospace', color: assignedProb > 0.4 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                      {calculatedLoss} nats
                    </span>
                  </div>
                </div>
              )}

              {/* Widget 4: Baseline Comparison Bars */}
              {currentEntry.id === 'baseline' && (
                <div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
                    Benchmark validation loss thresholds on ByteBPE-1024 Shakespeare:
                  </div>
                  {[
                    { label: 'Uniform Random Guessing', loss: BASELINES.uniform, color: '#64748b' },
                    { label: 'Unigram Frequency (Tutorial Gate - Cleared)', loss: BASELINES.unigram, color: '#6BBF7A' },
                    { label: 'Bigram Frequency (Region 1 Gate)', loss: BASELINES.bigram, color: '#E8A33D' },
                    { label: 'Trigram Frequency (Region 2 Gate)', loss: BASELINES.trigram, color: '#4FB3A9' },
                    { label: 'Scout Neural Network (Trained)', loss: 2.62, color: '#38bdf8' }
                  ].map((b, i) => (
                    <div key={i} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#e2e8f0', marginBottom: '4px' }}>
                        <span>{b.label}</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{b.loss.toFixed(3)}</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
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
                    <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                      Measured 3,000-Step Scout Overfitting Run (Shakespeare 60k tokens):
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '11px', fontFamily: 'monospace' }}>
                      <span style={{ color: '#E8A33D' }}>● Train Loss (plunging)</span>
                      <span style={{ color: '#ec4899' }}>● Val Loss (surging)</span>
                    </div>
                  </div>

                  <div style={{ height: '160px', width: '100%', backgroundColor: '#090d16', borderRadius: '8px', padding: '12px', boxSizing: 'border-box' }}>
                    <svg viewBox="0 0 400 140" style={{ width: '100%', height: '100%' }}>
                      <line x1="40" y1="20" x2="380" y2="20" stroke="#1e293b" strokeDasharray="4 4" />
                      <line x1="40" y1="60" x2="380" y2="60" stroke="#1e293b" strokeDasharray="4 4" />
                      <line x1="40" y1="100" x2="380" y2="100" stroke="#1e293b" strokeDasharray="4 4" />
                      
                      <line x1="40" y1="68" x2="380" y2="68" stroke="#64748b" strokeDasharray="2 2" />
                      <text x="382" y="71" fill="#64748b" fontSize="8" fontFamily="monospace">Unigram 4.472</text>

                      <text x="32" y="24" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">6.5</text>
                      <text x="32" y="64" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">4.5</text>
                      <text x="32" y="104" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">2.5</text>
                      <text x="32" y="125" fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">0.8</text>

                      {/* Measured Empirical Train Path (Amber) */}
                      <path
                        d="M 40,20 L 51,73 L 74,81 L 108,88 L 153,94 L 210,108 L 266,116 L 323,121 L 380,125"
                        fill="none"
                        stroke="#E8A33D"
                        strokeWidth="2.5"
                      />

                      {/* Measured Empirical Val Path (Magenta) */}
                      <path
                        d="M 40,19 L 51,64 L 74,68 L 108,69 L 153,66 L 210,55 L 266,41 L 323,30 L 380,27"
                        fill="none"
                        stroke="#ec4899"
                        strokeWidth="2.5"
                      />

                      <circle cx="108" cy="69" r="4" fill="#10b981" />
                      <text x="108" y="60" fill="#10b981" fontSize="9" textAnchor="middle" fontFamily="monospace">Optimal: 600 (Val 3.89)</text>

                      <line x1="380" y1="27" x2="380" y2="125" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                      <text x="375" y="80" fill="#ef4444" fontSize="9" textAnchor="end" fontFamily="monospace">Gap: +5.36</text>
                    </svg>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                    <div style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: '#94a3b8' }}>Optimal Early Stop:</span>
                      <div style={{ color: '#10b981', fontWeight: 600, fontFamily: 'monospace' }}>Step 600 (Val 3.8918)</div>
                    </div>
                    <div style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: '#E8A33D', fontWeight: 600, fontFamily: 'monospace' }}>Final Train Loss:</span>
                      <div style={{ color: '#E8A33D', fontWeight: 600, fontFamily: 'monospace' }}>0.8327 (Memorized)</div>
                    </div>
                    <div style={{ backgroundColor: '#0f172a', padding: '8px', borderRadius: '6px' }}>
                      <span style={{ color: '#94a3b8' }}>Final Val Surrender:</span>
                      <div style={{ color: '#ec4899', fontWeight: 600, fontFamily: 'monospace' }}>6.1898 (+5.357 Gap)</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Widget 5: Vocabulary Slider */}
              {currentEntry.id === 'vocabulary' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Vocabulary Size (Tokens):</span>
                    <span style={{ fontSize: '14px', fontFamily: 'monospace', color: '#00f3ff', fontWeight: 700 }}>{vocabSize}</span>
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
                    <div style={{ padding: '10px', backgroundColor: '#0f172a', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Embedding Memory:</div>
                      <div style={{ fontSize: '15px', color: '#38bdf8', fontWeight: 600, marginTop: '2px' }}>
                        {((vocabSize * 128 * 4) / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: '#0f172a', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Uniform Baseline Loss:</div>
                      <div style={{ fontSize: '15px', color: '#f59e0b', fontWeight: 600, marginTop: '2px' }}>
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
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>Train / Validation Split:</span>
                    <span style={{ fontSize: '14px', fontFamily: 'monospace', color: '#00f3ff', fontWeight: 700 }}>
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
                    <div style={{ padding: '10px', backgroundColor: '#0f172a', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Train Tokens (~60k corpus):</div>
                      <div style={{ fontSize: '15px', color: '#10b981', fontWeight: 600, marginTop: '2px' }}>
                        {Math.round(60000 * splitRatio).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ padding: '10px', backgroundColor: '#0f172a', borderRadius: '6px' }}>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Validation Tokens:</div>
                      <div style={{ fontSize: '15px', color: '#3b82f6', fontWeight: 600, marginTop: '2px' }}>
                        {Math.round(60000 * (1 - splitRatio)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Widget 7: Overfitting Curve */}
              {currentEntry.id === 'overfitting' && (
                <div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px' }}>
                    Divergence between Training and Validation loss under memorization:
                  </div>
                  <div style={{ height: '90px', backgroundColor: '#0f172a', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 200 60" style={{ width: '100%', height: '100%' }}>
                      {/* Train Curve */}
                      <path d="M 10,10 Q 80,45 190,52" fill="none" stroke="#10b981" strokeWidth="2.5" />
                      {/* Val Curve */}
                      <path d="M 10,15 Q 80,42 190,20" fill="none" stroke="#ef4444" strokeWidth="2.5" />
                      <text x="140" y="55" fill="#10b981" fontSize="9">Train Loss</text>
                      <text x="140" y="16" fill="#ef4444" fontSize="9">Val Loss</text>
                    </svg>
                  </div>
                  <div style={{ fontSize: '12px', color: '#f87171', marginTop: '6px' }}>
                    Notice the widening gap: model continues memorizing training data while failing holdout text.
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
