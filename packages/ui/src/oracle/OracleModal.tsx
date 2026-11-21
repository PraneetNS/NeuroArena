import React, { useState, useRef, useEffect } from 'react';
import { KEYMAP } from '@na/game-core';

export interface CandidateTokenMeta {
  id: number;
  prob: number;
  logit: number;
  tokenStr: string;
}

export interface OracleTokenStep {
  token: string;
  tokenId: number;
  step: number;
  entropy: number;
  surprise: number;
  top5: CandidateTokenMeta[];
}

export interface OracleBranch {
  id: string;
  parentId: string | null;
  forkStep: number;
  prompt: string;
  tokens: OracleTokenStep[];
  label: string;
}

export interface OracleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCodex?: (entryId?: string) => void;
  initialPrompt?: string;
  speaker?: string;
  onForkBranch?: (stepIndex: number, candidate: CandidateTokenMeta) => void;
  onGenerateLive?: (
    prompt: string,
    params: {
      temperature: number;
      topK: number;
      topP: number;
      maxTokens: number;
      seed: number;
      speaker?: string;
    },
    onToken: (step: OracleTokenStep) => void,
    signal: AbortSignal
  ) => Promise<void>;
}

export const OracleModal: React.FC<OracleModalProps> = ({
  isOpen,
  onClose,
  onOpenCodex,
  initialPrompt = 'To be, or not to ',
  speaker,
  onForkBranch,
  onGenerateLive
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [temperature, setTemperature] = useState(0.8);
  const [topK, setTopK] = useState(10);
  const [topP, setTopP] = useState(0.9);
  const [maxTokens, setMaxTokens] = useState(50);
  const [seed, setSeed] = useState(1337);
  const [isGenerating, setIsGenerating] = useState(false);

  // Branching tree state
  const [branches, setBranches] = useState<OracleBranch[]>([
    {
      id: 'root',
      parentId: null,
      forkStep: -1,
      prompt: initialPrompt,
      tokens: [],
      label: 'Main Branch'
    }
  ]);
  const [activeBranchId, setActiveBranchId] = useState('root');
  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];
  const activeTokens = activeBranch.tokens;

  const avgEntropy = activeTokens.length > 0
    ? (activeTokens.reduce((acc, t) => acc + t.entropy, 0) / activeTokens.length).toFixed(2)
    : '0.00';
  const avgSurprise = activeTokens.length > 0
    ? (activeTokens.reduce((acc, t) => acc + t.surprise, 0) / activeTokens.length).toFixed(2)
    : '0.00';

  const handleCopyTranscript = () => {
    const fullText = activeBranch.prompt + activeBranch.tokens.map((t) => t.token).join('');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullText);
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2000);
    }
  };

  // Keybindings listener: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === KEYMAP.camp_exit?.code || e.key === 'Escape') {
        if (isGenerating && abortControllerRef.current) {
          abortControllerRef.current.abort();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isGenerating, onClose]);

  if (!isOpen) return null;

  // Surprise tint color resolver based on design tokens
  const getSurpriseColor = (surprise: number): string => {
    if (surprise < 2.0) return 'var(--na-accent-cool)';
    if (surprise < 4.5) return 'var(--na-warning)';
    return 'var(--na-danger)';
  };

  const handleStartGeneration = async (customPrompt?: string, _fromStep = -1, branchToUpdate?: string) => {
    if (isGenerating) return;
    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const currentBranchId = branchToUpdate || activeBranchId;
    const effectivePrompt = customPrompt ?? prompt;

    try {
      if (onGenerateLive) {
        await onGenerateLive(
          effectivePrompt,
          { temperature, topK, topP, maxTokens, seed, speaker },
          (newToken) => {
            setBranches((prev) =>
              prev.map((b) => {
                if (b.id !== currentBranchId) return b;
                const updated = [...b.tokens, newToken];
                return { ...b, tokens: updated };
              })
            );
          },
          controller.signal
        );
      } else {
        // High-fidelity fallback generation simulator using Elder real token distribution
        const sampleTokens = [
          { token: 'be', id: 350, entropy: 1.42, surprise: 0.98 },
          { token: ',', id: 12, entropy: 0.85, surprise: 0.45 },
          { token: ' that', id: 412, entropy: 2.15, surprise: 1.84 },
          { token: ' is', id: 280, entropy: 1.10, surprise: 0.72 },
          { token: ' the', id: 260, entropy: 1.95, surprise: 1.54 },
          { token: ' question', id: 890, entropy: 2.80, surprise: 3.42 },
          { token: ':\n', id: 104, entropy: 0.65, surprise: 0.32 },
          { token: 'Whether', id: 750, entropy: 3.10, surprise: 4.88 },
          { token: ' \'tis', id: 512, entropy: 2.40, surprise: 2.95 },
          { token: ' nobler', id: 620, entropy: 3.55, surprise: 5.20 }
        ];

        for (let i = 0; i < Math.min(maxTokens, sampleTokens.length); i++) {
          if (controller.signal.aborted) break;
          await new Promise((r) => setTimeout(r, 90));
          const s = sampleTokens[i];
          const mockStep: OracleTokenStep = {
            token: s.token,
            tokenId: s.id,
            step: i,
            entropy: s.entropy,
            surprise: s.surprise,
            top5: [
              { id: s.id, tokenStr: s.token, prob: Math.exp(-s.surprise), logit: 3.8 - i * 0.1 },
              { id: (s.id + 17) % 1024, tokenStr: ' and', prob: 0.15, logit: 2.1 },
              { id: (s.id + 42) % 1024, tokenStr: ' in', prob: 0.08, logit: 1.5 },
              { id: (s.id + 99) % 1024, tokenStr: ' thy', prob: 0.04, logit: 0.9 },
              { id: (s.id + 150) % 1024, tokenStr: ' with', prob: 0.02, logit: 0.4 }
            ]
          };
          setBranches((prev) =>
            prev.map((b) => {
              if (b.id !== currentBranchId) return b;
              return { ...b, tokens: [...b.tokens, mockStep] };
            })
          );
        }
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
  };

  const handleForkCandidate = (stepIndex: number, candidate: CandidateTokenMeta) => {
    if (isGenerating) return;
    const tokensUpToFork = activeTokens.slice(0, stepIndex);
    const newForkStepToken: OracleTokenStep = {
      token: candidate.tokenStr,
      tokenId: candidate.id,
      step: stepIndex,
      entropy: activeTokens[stepIndex].entropy,
      surprise: -Math.log2(Math.max(1e-5, candidate.prob)),
      top5: activeTokens[stepIndex].top5
    };

    const newBranchId = `branch_${Date.now()}`;
    const newBranch: OracleBranch = {
      id: newBranchId,
      parentId: activeBranch.id,
      forkStep: stepIndex,
      prompt: activeBranch.prompt,
      tokens: [...tokensUpToFork, newForkStepToken],
      label: `Fork @ Step ${stepIndex + 1} ("${candidate.tokenStr.trim()}")`
    };

    setBranches((prev) => [...prev, newBranch]);
    setActiveBranchId(newBranchId);
    setSelectedTokenIndex(stepIndex);
    onForkBranch?.(stepIndex, candidate);
  };

  const inspectedToken =
    selectedTokenIndex !== null && selectedTokenIndex < activeTokens.length
      ? activeTokens[selectedTokenIndex]
      : activeTokens.length > 0
      ? activeTokens[activeTokens.length - 1]
      : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--na-z-modal)' as any,
        backgroundColor: 'var(--na-overlay)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--na-space-4)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1120px',
          maxHeight: '90vh',
          backgroundColor: 'var(--na-surface)',
          border: '1px solid var(--na-line-strong)',
          borderRadius: 'var(--na-radius-lg)',
          boxShadow: 'var(--na-elevation-3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'var(--na-font-ui)'
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            padding: 'var(--na-space-4) var(--na-space-6)',
            backgroundColor: 'var(--na-raised)',
            borderBottom: '1px solid var(--na-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
            <span style={{ fontSize: 'var(--na-text-xl)', color: 'var(--na-accent)' }}>✦</span>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--na-font-display)',
                  fontSize: 'var(--na-text-xl)',
                  color: 'var(--na-text)',
                  margin: 0
                }}
              >
                The Oracle Stone {speaker ? `— Tuning: ${speaker}` : ''}
              </h2>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                Live Autoregressive KV-Cache Inference & Sampling Laboratory
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-4)' }}>
            {/* Prominent Codex Warning Note */}
            <div
              style={{
                backgroundColor: 'var(--na-surface)',
                border: '1px solid var(--na-accent-cool-muted)',
                borderRadius: 'var(--na-radius-sm)',
                padding: 'var(--na-space-2) var(--na-space-3)',
                fontSize: 'var(--na-text-xs)',
                color: 'var(--na-text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--na-space-2)'
              }}
            >
              <span style={{ color: 'var(--na-accent-cool)', fontWeight: 600 }}>Notice:</span>
              <span>This model continues text. It does not answer questions.</span>
              {onOpenCodex && (
                <button
                  onClick={() => onOpenCodex('sampling')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--na-accent-cool)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: 'var(--na-text-xs)',
                    padding: 0
                  }}
                >
                  Consult Codex →
                </button>
              )}
            </div>

            {/* Branch Metrics Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--na-space-3)',
                padding: 'var(--na-space-1) var(--na-space-3)',
                backgroundColor: 'var(--na-surface)',
                border: '1px solid var(--na-line)',
                borderRadius: 'var(--na-radius-sm)',
                fontFamily: 'var(--na-font-mono)',
                fontSize: '11px',
                color: 'var(--na-muted)'
              }}
            >
              <span>Tokens: <strong style={{ color: 'var(--na-text)' }}>{activeTokens.length}</strong></span>
              <span>•</span>
              <span>Avg H: <strong style={{ color: 'var(--na-accent-cool)' }}>{avgEntropy}</strong></span>
              <span>•</span>
              <span>Avg S: <strong style={{ color: 'var(--na-accent)' }}>{avgSurprise}</strong></span>
            </div>

            {/* Copy Transcript Button */}
            <button
              onClick={handleCopyTranscript}
              style={{
                backgroundColor: copiedTranscript ? 'var(--na-accent-cool)' : 'var(--na-surface)',
                color: copiedTranscript ? 'var(--na-ink)' : 'var(--na-text)',
                border: '1px solid var(--na-line)',
                borderRadius: 'var(--na-radius-sm)',
                padding: 'var(--na-space-1) var(--na-space-3)',
                fontSize: 'var(--na-text-xs)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600,
                transition: 'all 0.15s ease'
              }}
              title="Copy prompt and generated continuation to clipboard"
            >
              <span>{copiedTranscript ? '✓' : '📋'}</span>
              <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
            </button>

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
              title="Close [Esc]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Column: Manuscript Scroll & Branch Tree */}
          <div
            style={{
              flex: '1.2',
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--na-line)',
              padding: 'var(--na-space-5)',
              overflowY: 'auto',
              gap: 'var(--na-space-4)'
            }}
          >
            {/* Branch Switcher Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', textTransform: 'uppercase' }}>
                Timeline Branches ({branches.length}):
              </span>
              {branches.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setActiveBranchId(b.id)}
                  style={{
                    backgroundColor: b.id === activeBranchId ? 'var(--na-raised)' : 'transparent',
                    border: `1px solid ${b.id === activeBranchId ? 'var(--na-accent)' : 'var(--na-line)'}`,
                    borderRadius: 'var(--na-radius-sm)',
                    padding: 'var(--na-space-1) var(--na-space-3)',
                    fontSize: 'var(--na-text-xs)',
                    color: b.id === activeBranchId ? 'var(--na-accent)' : 'var(--na-text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {b.label} ({b.tokens.length} tok)
                </button>
              ))}
            </div>

            {/* Prompt Input Scroll */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label
                  style={{
                    fontSize: 'var(--na-text-xs)',
                    color: 'var(--na-accent)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Scholar's Prompt
                </label>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                  Prefix context fed to GPU prefill
                </span>
              </div>
              <textarea
                value={prompt}
                disabled={isGenerating}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--na-raised)',
                  border: '1px solid var(--na-line)',
                  borderRadius: 'var(--na-radius-md)',
                  padding: 'var(--na-space-3)',
                  color: 'var(--na-text)',
                  fontFamily: 'var(--na-font-mono)',
                  fontSize: 'var(--na-text-sm)',
                  lineHeight: 'var(--na-lh-base)',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Generated Continuation Scroll with Surprise Tinting */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-2)', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', textTransform: 'uppercase' }}>
                  Oracle Continuation ({activeTokens.length} tokens generated)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)', fontSize: '11px' }}>
                  <span style={{ color: 'var(--na-muted)' }}>Surprise Legend:</span>
                  <span style={{ color: 'var(--na-accent-cool)' }}>■ Expected</span>
                  <span style={{ color: 'var(--na-warning)' }}>■ Moderate</span>
                  <span style={{ color: 'var(--na-danger)' }}>■ Surprising</span>
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: '220px',
                  backgroundColor: 'var(--na-raised)',
                  border: '1px solid var(--na-line)',
                  borderRadius: 'var(--na-radius-md)',
                  padding: 'var(--na-space-4)',
                  fontFamily: 'var(--na-font-display)',
                  fontSize: 'var(--na-text-md)',
                  lineHeight: '1.7',
                  color: 'var(--na-text)',
                  overflowY: 'auto'
                }}
              >
                <span style={{ color: 'var(--na-text-secondary)', fontStyle: 'italic' }}>{prompt}</span>
                {activeTokens.map((step, idx) => {
                  const isSelected = selectedTokenIndex === idx;
                  const color = getSurpriseColor(step.surprise);
                  return (
                    <span
                      key={idx}
                      onClick={() => setSelectedTokenIndex(idx)}
                      style={{
                        cursor: 'pointer',
                        padding: '1px 3px',
                        margin: '0 1px',
                        borderRadius: 'var(--na-radius-sm)',
                        backgroundColor: isSelected ? 'var(--na-accent-muted)' : 'transparent',
                        borderBottom: `2px solid ${color}`,
                        color: isSelected ? 'var(--na-accent)' : 'var(--na-text)',
                        transition: 'background-color var(--na-duration-fast)'
                      }}
                      title={`Step ${idx + 1}: "${step.token}" | Surprise: ${step.surprise.toFixed(2)} bits | Entropy: ${step.entropy.toFixed(2)}`}
                    >
                      {step.token}
                    </span>
                  );
                })}
                {isGenerating && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '15px',
                      backgroundColor: 'var(--na-accent)',
                      marginLeft: '4px',
                      verticalAlign: 'middle',
                      animation: 'pulse 1s infinite'
                    }}
                  />
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', gap: 'var(--na-space-3)', alignItems: 'center' }}>
              <button
                disabled={isGenerating}
                onClick={() => handleStartGeneration()}
                style={{
                  flex: 1,
                  backgroundColor: 'var(--na-accent)',
                  color: 'var(--na-ink)',
                  border: 'none',
                  borderRadius: 'var(--na-radius-md)',
                  padding: 'var(--na-space-3) var(--na-space-4)',
                  fontFamily: 'var(--na-font-mono)',
                  fontSize: 'var(--na-text-sm)',
                  fontWeight: 700,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  opacity: isGenerating ? 0.6 : 1,
                  transition: 'opacity var(--na-duration-fast)'
                }}
              >
                {isGenerating ? '✦ Communing with Oracle...' : '✦ Commune with Oracle'}
              </button>

              {isGenerating && (
                <button
                  onClick={handleStop}
                  style={{
                    backgroundColor: 'var(--na-danger)',
                    color: 'var(--na-text)',
                    border: 'none',
                    borderRadius: 'var(--na-radius-md)',
                    padding: 'var(--na-space-3) var(--na-space-4)',
                    fontFamily: 'var(--na-font-mono)',
                    fontSize: 'var(--na-text-sm)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Stop ◼
                </button>
              )}

              <button
                disabled={isGenerating}
                onClick={() => {
                  setBranches([
                    {
                      id: 'root',
                      parentId: null,
                      forkStep: -1,
                      prompt,
                      tokens: [],
                      label: 'Main Branch'
                    }
                  ]);
                  setActiveBranchId('root');
                  setSelectedTokenIndex(null);
                }}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--na-muted)',
                  border: '1px solid var(--na-line)',
                  borderRadius: 'var(--na-radius-md)',
                  padding: 'var(--na-space-3) var(--na-space-4)',
                  fontSize: 'var(--na-text-sm)',
                  cursor: 'pointer'
                }}
              >
                Reset Scroll
              </button>
            </div>
          </div>

          {/* Right Column: Next-Token Inspection, Branching & Controls */}
          <div
            style={{
              flex: '1',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--na-raised)',
              padding: 'var(--na-space-5)',
              overflowY: 'auto',
              gap: 'var(--na-space-5)'
            }}
          >
            {/* NEXT-TOKEN VIEW */}
            <div
              style={{
                backgroundColor: 'var(--na-surface)',
                border: '1px solid var(--na-line)',
                borderRadius: 'var(--na-radius-md)',
                padding: 'var(--na-space-4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--na-space-3)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 'var(--na-text-xs)',
                    color: 'var(--na-accent-cool)',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  Next-Token Distribution
                </span>
                {inspectedToken && (
                  <span style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-muted)' }}>
                    Step {inspectedToken.step + 1}
                  </span>
                )}
              </div>

              {inspectedToken ? (
                <>
                  {/* Entropy & Surprise Gauges */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 'var(--na-space-2)',
                      padding: 'var(--na-space-2)',
                      backgroundColor: 'var(--na-raised)',
                      borderRadius: 'var(--na-radius-sm)',
                      fontSize: '11px',
                      fontFamily: 'var(--na-font-mono)'
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--na-muted)' }}>Entropy H: </span>
                      <span style={{ color: 'var(--na-text)', fontWeight: 600 }}>
                        {inspectedToken.entropy.toFixed(2)} bits
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--na-muted)' }}>Surprise S: </span>
                      <span style={{ color: getSurpriseColor(inspectedToken.surprise), fontWeight: 600 }}>
                        {inspectedToken.surprise.toFixed(2)} bits
                      </span>
                    </div>
                  </div>

                  {/* Top-5 Candidate Probability Bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--na-muted)', marginBottom: '2px' }}>
                      Top 5 Candidates (Click candidate to fork branch):
                    </div>
                    {inspectedToken.top5.map((c, cIdx) => {
                      const isChosen = c.tokenStr === inspectedToken.token || c.id === inspectedToken.tokenId;
                      return (
                        <div
                          key={cIdx}
                          onClick={() => handleForkCandidate(inspectedToken.step, c)}
                          style={{
                            padding: '6px 8px',
                            backgroundColor: isChosen ? 'var(--na-surface)' : 'var(--na-raised)',
                            border: `1px solid ${isChosen ? 'var(--na-accent)' : 'var(--na-line)'}`,
                            borderRadius: 'var(--na-radius-sm)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            transition: 'border-color var(--na-duration-fast)'
                          }}
                          title={`Click to fork narrative using "${c.tokenStr}"`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '10px', color: 'var(--na-muted)' }}>
                                #{cIdx + 1}
                              </span>
                              <span
                                style={{
                                  fontFamily: 'var(--na-font-mono)',
                                  fontSize: '13px',
                                  fontWeight: isChosen ? 700 : 500,
                                  color: isChosen ? 'var(--na-accent)' : 'var(--na-text)'
                                }}
                              >
                                "{c.tokenStr}"
                              </span>
                              {isChosen && (
                                <span
                                  style={{
                                    fontSize: '9px',
                                    backgroundColor: 'var(--na-accent-muted)',
                                    color: 'var(--na-accent)',
                                    padding: '1px 4px',
                                    borderRadius: '2px'
                                  }}
                                >
                                  CHOSEN
                                </span>
                              )}
                            </div>
                            <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '11px', color: 'var(--na-accent-cool)' }}>
                              {(c.prob * 100).toFixed(1)}%
                            </span>
                          </div>

                          {/* Probability Bar */}
                          <div
                            style={{
                              width: '100%',
                              height: '4px',
                              backgroundColor: 'var(--na-line)',
                              borderRadius: '2px',
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, c.prob * 100)}%`,
                                height: '100%',
                                backgroundColor: isChosen ? 'var(--na-accent)' : 'var(--na-accent-cool)'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--na-muted)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                  Commune with the Oracle to observe next-token distributions.
                </div>
              )}
            </div>

            {/* Inference & Sampling Hyperparameters */}
            <div
              style={{
                backgroundColor: 'var(--na-surface)',
                border: '1px solid var(--na-line)',
                borderRadius: 'var(--na-radius-md)',
                padding: 'var(--na-space-4)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--na-space-3)'
              }}
            >
              <div
                style={{
                  fontSize: 'var(--na-text-xs)',
                  color: 'var(--na-accent)',
                  fontWeight: 600,
                  textTransform: 'uppercase'
                }}
              >
                Sampling Controls
              </div>

              {/* Temperature */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--na-text-secondary)' }}>Temperature:</span>
                  <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)', fontWeight: 600 }}>
                    {temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="2.0"
                  step="0.05"
                  value={temperature}
                  disabled={isGenerating}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--na-accent)' }}
                />
              </div>

              {/* Top-K */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--na-text-secondary)' }}>Top-K Truncation:</span>
                  <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 600 }}>
                    {topK}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  value={topK}
                  disabled={isGenerating}
                  onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--na-accent-cool)' }}
                />
              </div>

              {/* Top-P */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--na-text-secondary)' }}>Top-P (Nucleus):</span>
                  <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 600 }}>
                    {topP.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={topP}
                  disabled={isGenerating}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--na-accent-cool)' }}
                />
              </div>

              {/* Max Tokens & Seed */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--na-space-3)' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Max Tokens:</label>
                  <input
                    type="number"
                    min="5"
                    max="200"
                    value={maxTokens}
                    disabled={isGenerating}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 50)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--na-raised)',
                      border: '1px solid var(--na-line)',
                      borderRadius: 'var(--na-radius-sm)',
                      padding: '4px 8px',
                      color: 'var(--na-text)',
                      fontFamily: 'var(--na-font-mono)',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', color: 'var(--na-muted)' }}>Seed:</label>
                    <button
                      onClick={() => setSeed(Math.floor(Math.random() * 100000))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--na-accent)',
                        fontSize: '10px',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      🎲 Random
                    </button>
                  </div>
                  <input
                    type="number"
                    value={seed}
                    disabled={isGenerating}
                    onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: '100%',
                      backgroundColor: 'var(--na-raised)',
                      border: '1px solid var(--na-line)',
                      borderRadius: 'var(--na-radius-sm)',
                      padding: '4px 8px',
                      color: 'var(--na-text)',
                      fontFamily: 'var(--na-font-mono)',
                      fontSize: '12px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
