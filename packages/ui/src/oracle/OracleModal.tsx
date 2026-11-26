import React, { useState, useRef, useEffect } from 'react';
import { KEYMAP } from '@na/game-core';
import {
  AUSTEN_HEATMAP_TOKENS,
  CANONICAL_AUSTEN_COMPARISONS,
  generateSyntheticCurve,
  HeatmapWordToken
} from './austenData.js';

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
      minP?: number;
      repetitionPenalty?: number;
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
  const [minP, setMinP] = useState(0.05);
  const [maxTokens, setMaxTokens] = useState(50);
  const [repetitionPenalty, setRepetitionPenalty] = useState(1.0);
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
  const [genTokensPerSec, setGenTokensPerSec] = useState<number | null>(null);

  // Tab & Fine-Tune panel state
  const [activeTab, setActiveTab] = useState<'communion' | 'finetune'>('communion');
  const [ftLr, setFtLr] = useState<number>(3e-4);
  const [ftSteps, setFtSteps] = useState<number>(3000);
  const [ftReplay, setFtReplay] = useState<number>(0.50);
  const [ftPromptIdx, setFtPromptIdx] = useState<number>(0);
  const [hoveredHeatmapToken, setHoveredHeatmapToken] = useState<HeatmapWordToken | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];
  const activeTokens = activeBranch.tokens;

  // Compute lineage breadcrumbs from root to active branch
  const activeLineage: OracleBranch[] = [];
  let curr: OracleBranch | undefined = activeBranch;
  while (curr) {
    activeLineage.unshift(curr);
    if (!curr.parentId) break;
    curr = branches.find((b) => b.id === curr!.parentId);
  }

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

  const handleDownloadMarkdown = () => {
    const fullText = activeBranch.prompt + activeBranch.tokens.map((t) => t.token).join('');
    const mdContent = `# Oracle Stone Communion Transcript\n\n` +
      `**Speaker Model**: ${speaker || 'Elder (Preset S)'}\n` +
      `**Active Branch**: ${activeBranch.label}\n` +
      `**Sampling Config**: Temperature=${temperature}, Top-K=${topK}, Top-P=${topP}, RepetitionPenalty=${repetitionPenalty}\n` +
      `**Metrics**: Tokens=${activeTokens.length}, Avg Entropy=${avgEntropy} bits, Avg Surprise=${avgSurprise}\n\n` +
      `---\n\n` +
      `### Prompt\n\n\`\`\`\n${activeBranch.prompt}\n\`\`\`\n\n` +
      `### Model Continuation\n\n\`\`\`\n${fullText}\n\`\`\`\n\n` +
      `---\n*Exported from NeuroArena Oracle Stone*\n`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oracle_communion_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PROMPT_PRESETS = [
    { label: 'Hamlet: Soliloquy', text: 'To be, or not to ' },
    { label: 'Falstaff: Honour', text: 'Honour is a ' },
    { label: 'Portia: Mercy', text: "The quality of mercy is not strain'd,\n" },
    { label: 'Jaques: The Stage', text: "All the world's a stage,\nAnd all the men and women merely players;\n" },
    { label: 'Prospero: Revels', text: "Our revels now are ended. These our actors,\nAs I foretold you, were all spirits and\n" },
    { label: 'Dialogue: Life', text: "PLAYER:\nWhat think you of this mortal life?\nHAMLET:\n" }
  ];

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
    const genStartTime = performance.now();
    let genCount = 0;

    try {
      if (onGenerateLive) {
        // Fast-path token buffer: batch incoming tokens on requestAnimationFrame
        // to decouple 250+ tok/s GPU streaming from React virtual DOM reconciliation
        let pendingTokens: OracleTokenStep[] = [];
        let rafId: number | null = null;

        const flushTokens = () => {
          if (pendingTokens.length === 0) return;
          const toAdd = [...pendingTokens];
          pendingTokens = [];
          setBranches((prev) =>
            prev.map((b) => {
              if (b.id !== currentBranchId) return b;
              return { ...b, tokens: [...b.tokens, ...toAdd] };
            })
          );
        };

        try {
          await onGenerateLive(
            effectivePrompt,
            { temperature, topK, topP, minP, repetitionPenalty, maxTokens, seed, speaker },
            (newToken) => {
              genCount++;
              pendingTokens.push(newToken);
              const elapsed = (performance.now() - genStartTime) / 1000;
              if (elapsed > 0.05) {
                setGenTokensPerSec(Math.round((genCount / elapsed) * 10) / 10);
              }
              if (!rafId) {
                rafId = requestAnimationFrame(() => {
                  rafId = null;
                  flushTokens();
                });
              }
            },
            controller.signal
          );
        } finally {
          if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          flushTokens();
        }
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
                <h2
                  style={{
                    fontFamily: 'var(--na-font-display)',
                    fontSize: 'var(--na-text-xl)',
                    color: 'var(--na-text)',
                    margin: 0
                  }}
                >
                  The Oracle Stone
                </h2>
                {/* Tab Switcher */}
                <div
                  style={{
                    display: 'flex',
                    backgroundColor: 'var(--na-surface)',
                    borderRadius: 'var(--na-radius-sm)',
                    padding: '2px',
                    border: '1px solid var(--na-line)'
                  }}
                >
                  <button
                    onClick={() => setActiveTab('communion')}
                    style={{
                      backgroundColor: activeTab === 'communion' ? 'var(--na-raised)' : 'transparent',
                      color: activeTab === 'communion' ? 'var(--na-accent)' : 'var(--na-muted)',
                      border: 'none',
                      borderRadius: 'var(--na-radius-sm)',
                      padding: '4px 10px',
                      fontSize: 'var(--na-text-xs)',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🔮 Communion (Inference)
                  </button>
                  <button
                    onClick={() => setActiveTab('finetune')}
                    style={{
                      backgroundColor: activeTab === 'finetune' ? 'var(--na-raised)' : 'transparent',
                      color: activeTab === 'finetune' ? 'var(--na-accent-cool)' : 'var(--na-muted)',
                      border: 'none',
                      borderRadius: 'var(--na-radius-sm)',
                      padding: '4px 10px',
                      fontSize: 'var(--na-text-xs)',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    📈 Domain Adaptation (Fine-Tune)
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginTop: '2px' }}>
                {activeTab === 'communion'
                  ? 'Live Autoregressive KV-Cache Inference & Sampling Laboratory'
                  : 'Jane Austen (Pride and Prejudice) Adaptation — Dual-Curve Dynamics & Loss Heatmap'}
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
                  onClick={() => onOpenCodex(activeTab === 'communion' ? 'sampling' : 'fine_tuning')}
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
              <span>Depth: <strong style={{ color: 'var(--na-accent-warm)' }}>{activeBranchId.split('_').length}</strong></span>
              <span>•</span>
              <span>Tokens: <strong style={{ color: 'var(--na-text)' }}>{activeTokens.length}</strong></span>
              <span>•</span>
              <span>Avg H: <strong style={{ color: 'var(--na-accent-cool)' }}>{avgEntropy}</strong></span>
              <span>•</span>
              <span>Avg S: <strong style={{ color: 'var(--na-accent)' }}>{avgSurprise}</strong></span>
              {genTokensPerSec !== null && (
                <>
                  <span>•</span>
                  <span>Speed: <strong style={{ color: 'var(--na-accent-cool)' }}>{genTokensPerSec} t/s</strong></span>
                </>
              )}
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

            {/* Export Markdown File Button */}
            <button
              onClick={handleDownloadMarkdown}
              style={{
                backgroundColor: 'var(--na-surface)',
                color: 'var(--na-text)',
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
              title="Download conversation transcript as markdown file"
            >
              <span>💾</span>
              <span>Export .md</span>
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
        {activeTab === 'communion' ? (
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
            {/* Branch Lineage Breadcrumb */}
            {activeLineage.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--na-space-1)',
                  fontSize: 'var(--na-text-xs)',
                  color: 'var(--na-text-secondary)',
                  backgroundColor: 'var(--na-raised)',
                  padding: 'var(--na-space-1) var(--na-space-3)',
                  borderRadius: 'var(--na-radius-sm)',
                  border: '1px solid var(--na-line)'
                }}
              >
                <span style={{ color: 'var(--na-muted)' }}>Lineage:</span>
                {activeLineage.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    {idx > 0 && <span style={{ color: 'var(--na-muted)' }}>&gt;</span>}
                    <span
                      onClick={() => setActiveBranchId(item.id)}
                      style={{
                        cursor: 'pointer',
                        color: item.id === activeBranchId ? 'var(--na-accent)' : 'var(--na-text-secondary)',
                        fontWeight: item.id === activeBranchId ? 600 : 400,
                        textDecoration: item.id === activeBranchId ? 'underline' : 'none'
                      }}
                      title={item.forkStep >= 0 ? `Forked at token #${item.forkStep + 1}` : 'Root'}
                    >
                      {item.label}{item.forkStep >= 0 ? ` (#${item.forkStep + 1})` : ''}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}

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
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {PROMPT_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      disabled={isGenerating}
                      onClick={() => setPrompt(preset.text)}
                      style={{
                        padding: '1px 6px',
                        fontSize: '10px',
                        fontFamily: 'var(--na-font-mono)',
                        backgroundColor: prompt === preset.text ? 'var(--na-accent-muted)' : 'var(--na-surface)',
                        color: prompt === preset.text ? 'var(--na-accent)' : 'var(--na-muted)',
                        border: '1px solid var(--na-line)',
                        borderRadius: 'var(--na-radius-sm)',
                        cursor: isGenerating ? 'not-allowed' : 'pointer'
                      }}
                      title={preset.text}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
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

              {/* Min-P (Relative Threshold) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--na-text-secondary)' }}>Min-P Threshold:</span>
                  <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', fontWeight: 600 }}>
                    {minP.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.01"
                  value={minP}
                  disabled={isGenerating}
                  onChange={(e) => setMinP(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--na-accent-cool)' }}
                />
              </div>

              {/* Repetition Penalty */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--na-text-secondary)' }}>Repetition Penalty:</span>
                  <span style={{ fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent)', fontWeight: 600 }}>
                    {repetitionPenalty.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="1.5"
                  step="0.05"
                  value={repetitionPenalty}
                  disabled={isGenerating}
                  onChange={(e) => setRepetitionPenalty(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--na-accent)' }}
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
      ) : (
        /* Domain Adaptation (Fine-Tune) Tab Body */
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left Column: Config Selector, Dual-Curve Chart & Prompt Comparison */}
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
            {/* Context & Hyperparameter Selector */}
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
                    color: 'var(--na-accent)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Domain Adaptation Controls (Pride & Prejudice)
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--na-font-mono)',
                    color:
                      ftLr === 1e-4 && ftReplay === 0.25
                        ? 'var(--na-accent)'
                        : ftLr === 3e-4 && ftReplay === 0.5
                        ? 'var(--na-accent-cool)'
                        : 'var(--na-muted)',
                    backgroundColor: 'var(--na-raised)',
                    padding: '2px 8px',
                    borderRadius: 'var(--na-radius-sm)',
                    border: '1px solid var(--na-line)'
                  }}
                >
                  {ftLr === 1e-4 && ftReplay === 0.25
                    ? '★ Selected Pareto Optimum'
                    : ftLr === 3e-4 && ftReplay === 0.5
                    ? '🛡 Conservative Pareto'
                    : ftReplay === 0
                    ? '⚠ Severe Forgetting Hazard'
                    : 'Custom Sweep Point'}
                </span>
              </div>

              {/* Target Dataset Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
                <span style={{ fontSize: '12px', color: 'var(--na-text-secondary)', minWidth: '100px' }}>
                  Target Domain:
                </span>
                <div style={{ display: 'flex', gap: 'var(--na-space-2)' }}>
                  <button
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontFamily: 'var(--na-font-mono)',
                      backgroundColor: 'var(--na-accent)',
                      color: 'var(--na-ink)',
                      border: '1px solid var(--na-accent)',
                      borderRadius: 'var(--na-radius-sm)',
                      cursor: 'default',
                      fontWeight: 700
                    }}
                  >
                    Jane Austen (Pride and Prejudice, 250k tok)
                  </button>
                </div>
              </div>

              {/* Learning Rate Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
                <span style={{ fontSize: '12px', color: 'var(--na-text-secondary)', minWidth: '100px' }}>
                  Learning Rate:
                </span>
                <div style={{ display: 'flex', gap: 'var(--na-space-2)' }}>
                  {[1e-4, 3e-4, 1e-3].map((lr) => (
                    <button
                      key={lr}
                      onClick={() => setFtLr(lr)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontFamily: 'var(--na-font-mono)',
                        backgroundColor: ftLr === lr ? 'var(--na-accent)' : 'var(--na-raised)',
                        color: ftLr === lr ? 'var(--na-ink)' : 'var(--na-text)',
                        border: `1px solid ${ftLr === lr ? 'var(--na-accent)' : 'var(--na-line)'}`,
                        borderRadius: 'var(--na-radius-sm)',
                        cursor: 'pointer',
                        fontWeight: ftLr === lr ? 700 : 400
                      }}
                    >
                      {lr === 1e-4 ? '1e-4 (Gentle)' : lr === 3e-4 ? '3e-4 (Standard)' : '1e-3 (Aggressive)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Steps Selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
                <span style={{ fontSize: '12px', color: 'var(--na-text-secondary)', minWidth: '100px' }}>
                  Training Steps:
                </span>
                <div style={{ display: 'flex', gap: 'var(--na-space-2)' }}>
                  {[100, 300, 1000, 3000].map((steps) => (
                    <button
                      key={steps}
                      onClick={() => setFtSteps(steps)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontFamily: 'var(--na-font-mono)',
                        backgroundColor: ftSteps === steps ? 'var(--na-accent-cool)' : 'var(--na-raised)',
                        color: ftSteps === steps ? 'var(--na-ink)' : 'var(--na-text)',
                        border: `1px solid ${ftSteps === steps ? 'var(--na-accent-cool)' : 'var(--na-line)'}`,
                        borderRadius: 'var(--na-radius-sm)',
                        cursor: 'pointer',
                        fontWeight: ftSteps === steps ? 700 : 400
                      }}
                    >
                      {steps} steps
                    </button>
                  ))}
                </div>
              </div>

              {/* Shakespeare Replay Buffer Selector & Range Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--na-text-secondary)' }}>
                    Replay Regularizer Fraction:
                  </span>
                  <span style={{ fontFamily: 'var(--na-font-mono)', fontSize: '12px', color: 'var(--na-accent-warm)', fontWeight: 600 }}>
                    {(ftReplay * 100).toFixed(0)}% Shakespeare Mix
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={ftReplay}
                  onChange={(e) => setFtReplay(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--na-accent-warm)' }}
                />
                <div style={{ display: 'flex', gap: 'var(--na-space-2)' }}>
                  {[
                    { val: 0.0, label: '0% (Severe Forgetting)' },
                    { val: 0.25, label: '25% (Balanced Pareto)' },
                    { val: 0.50, label: '50% (Conservative)' }
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => setFtReplay(item.val)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontFamily: 'var(--na-font-mono)',
                        backgroundColor: ftReplay === item.val ? 'var(--na-accent-warm)' : 'var(--na-raised)',
                        color: ftReplay === item.val ? 'var(--na-ink)' : 'var(--na-text)',
                        border: `1px solid ${ftReplay === item.val ? 'var(--na-accent-warm)' : 'var(--na-line)'}`,
                        borderRadius: 'var(--na-radius-sm)',
                        cursor: 'pointer',
                        fontWeight: ftReplay === item.val ? 700 : 400
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Dual-Curve Loss Chart */}
            {(() => {
              const { points, minStep, minAusten } = generateSyntheticCurve(ftLr, ftReplay);
              const padLeft = 45;
              const padRight = 20;
              const padTop = 15;
              const padBottom = 25;
              const totalW = 560;
              const totalH = 180;
              const plotW = totalW - padLeft - padRight;
              const plotH = totalH - padTop - padBottom;
              const yMin = 2.0;
              const yMax = 6.5;

              const getX = (step: number) => padLeft + (step / 3000) * plotW;
              const getY = (loss: number) => padTop + ((yMax - Math.min(yMax, Math.max(yMin, loss))) / (yMax - yMin)) * plotH;

              const dAusten = points
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.step).toFixed(1)} ${getY(p.austenHeldOut).toFixed(1)}`)
                .join(' ');

              const dShake = points
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(p.step).toFixed(1)} ${getY(p.shakeVal).toFixed(1)}`)
                .join(' ');

              const minX = getX(minStep);
              const minY = getY(minAusten);
              const curX = getX(ftSteps);

              return (
                <div
                  style={{
                    backgroundColor: 'var(--na-surface)',
                    border: '1px solid var(--na-line)',
                    borderRadius: 'var(--na-radius-md)',
                    padding: 'var(--na-space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--na-space-2)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-accent-cool)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Dual-Curve Loss Trajectory (Austen Held-Out vs Shakespeare VAL)
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)', fontSize: '11px', fontFamily: 'var(--na-font-mono)' }}>
                      <span style={{ color: 'var(--na-accent-cool)' }}>― Austen Held-Out</span>
                      <span style={{ color: 'var(--na-accent-warm)' }}>― Shakespeare General VAL</span>
                      <span style={{ color: 'var(--na-accent)' }}>⚑ Early-Stop Best</span>
                    </div>
                  </div>

                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <svg viewBox={`0 0 ${totalW} ${totalH}`} style={{ width: '100%', height: '180px', display: 'block' }}>
                      {/* Grid Lines */}
                      {[2.5, 3.5, 4.5, 5.5].map((yVal) => (
                        <g key={yVal}>
                          <line
                            x1={padLeft}
                            y1={getY(yVal)}
                            x2={totalW - padRight}
                            y2={getY(yVal)}
                            stroke="var(--na-line)"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          <text
                            x={padLeft - 6}
                            y={getY(yVal) + 3}
                            textAnchor="end"
                            fill="var(--na-muted)"
                            fontSize="9"
                            fontFamily="var(--na-font-mono)"
                          >
                            {yVal.toFixed(1)}
                          </text>
                        </g>
                      ))}

                      {/* X-axis tick marks */}
                      {[0, 1000, 2000, 3000].map((xVal) => (
                        <g key={xVal}>
                          <line
                            x1={getX(xVal)}
                            y1={padTop}
                            x2={getX(xVal)}
                            y2={totalH - padBottom}
                            stroke="var(--na-line)"
                            strokeDasharray="2 2"
                            strokeWidth="1"
                          />
                          <text
                            x={getX(xVal)}
                            y={totalH - padBottom + 14}
                            textAnchor="middle"
                            fill="var(--na-muted)"
                            fontSize="9"
                            fontFamily="var(--na-font-mono)"
                          >
                            {xVal}
                          </text>
                        </g>
                      ))}

                      {/* Shakespeare VAL Curve */}
                      <path d={dShake} fill="none" stroke="var(--na-accent-warm)" strokeWidth="2.2" strokeLinecap="round" />

                      {/* Austen Held-Out Curve */}
                      <path d={dAusten} fill="none" stroke="var(--na-accent-cool)" strokeWidth="2.2" strokeLinecap="round" />

                      {/* Selected Checkpoint Marker */}
                      <line
                        x1={curX}
                        y1={padTop}
                        x2={curX}
                        y2={totalH - padBottom}
                        stroke="var(--na-text-secondary)"
                        strokeDasharray="4 2"
                        strokeWidth="1.2"
                      />
                      <circle cx={curX} cy={getY(points.find((p) => p.step === ftSteps)?.austenHeldOut || 3.0)} r="4" fill="var(--na-accent-cool)" />

                      {/* Early Stop / Best Checkpoint Marker */}
                      <line
                        x1={minX}
                        y1={padTop}
                        x2={minX}
                        y2={totalH - padBottom}
                        stroke="var(--na-accent)"
                        strokeDasharray="2 2"
                        strokeWidth="1.5"
                      />
                      <circle cx={minX} cy={minY} r="5" fill="var(--na-accent)" stroke="var(--na-surface)" strokeWidth="1.5" />
                      <text
                        x={minX}
                        y={Math.max(padTop + 12, minY - 8)}
                        textAnchor="middle"
                        fill="var(--na-accent)"
                        fontSize="9"
                        fontWeight="700"
                        fontFamily="var(--na-font-mono)"
                      >
                        Restore Best ({minAusten.toFixed(2)} nats @ {minStep})
                      </text>
                    </svg>
                  </div>

                  {/* Dynamic Threshold Explanations (Shown ONLY when data matches) */}
                  {(() => {
                    const baseAusten = 4.690;
                    const baseShake = 3.164;
                    const curPoint = points.find((p) => p.step === ftSteps) || points[points.length - 1];
                    const austenDrop = baseAusten - curPoint.austenHeldOut;
                    const shakeRise = curPoint.shakeVal - baseShake;
                    const isImproved = austenDrop >= 0.1;
                    const isNegligible = Math.abs(austenDrop) < 0.03;
                    const isOverfitting = minStep < ftSteps && (curPoint.austenHeldOut - minAusten >= 0.03);
                    const isForgetting = shakeRise > 0.1;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'var(--na-space-2)', borderTop: '1px solid var(--na-line)', paddingTop: 'var(--na-space-2)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--na-muted)', fontFamily: 'var(--na-font-mono)', textTransform: 'uppercase' }}>
                          Threshold Diagnostics (Step {ftSteps}):
                        </div>

                        {isImproved && (
                          <div style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)', backgroundColor: 'var(--na-raised)', padding: '4px 8px', borderRadius: 'var(--na-radius-sm)', borderLeft: '3px solid var(--na-accent-cool)' }}>
                            <strong>✦ Improved:</strong> Austen held-out loss reduced from {baseAusten.toFixed(3)} to {curPoint.austenHeldOut.toFixed(3)} nats (gain of {austenDrop.toFixed(3)} nats, beating the ≥0.1 threshold).
                          </div>
                        )}

                        {isNegligible && (
                          <div style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-muted)', backgroundColor: 'var(--na-raised)', padding: '4px 8px', borderRadius: 'var(--na-radius-sm)', borderLeft: '3px solid var(--na-muted)' }}>
                            <strong>✦ Negligible:</strong> Austen held-out loss change is {Math.abs(austenDrop).toFixed(3)} nats (below the 0.03 threshold; adaptation has not taken effect).
                          </div>
                        )}

                        {isOverfitting && (
                          <div style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-warning)', backgroundColor: 'var(--na-raised)', padding: '4px 8px', borderRadius: 'var(--na-radius-sm)', borderLeft: '3px solid var(--na-warning)' }}>
                            <strong>⚠ Overfitting:</strong> Austen held-out loss rose from minimum of {minAusten.toFixed(3)} at step {minStep} to {curPoint.austenHeldOut.toFixed(3)} at step {ftSteps}. Restore-best recommended.
                          </div>
                        )}

                        {isForgetting && (
                          <div style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-danger)', backgroundColor: 'var(--na-raised)', padding: '4px 8px', borderRadius: 'var(--na-radius-sm)', borderLeft: '3px solid var(--na-danger)' }}>
                            <strong>⚠ Forgetting:</strong> Shakespeare VAL loss increased from {baseShake.toFixed(3)} to {curPoint.shakeVal.toFixed(3)} nats (drift of +{shakeRise.toFixed(3)} nats, exceeding the &gt;0.1 threshold; replay regularizer required).
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Prompt Comparison View */}
            {(() => {
              const comp = CANONICAL_AUSTEN_COMPARISONS[ftPromptIdx] || CANONICAL_AUSTEN_COMPARISONS[0];
              return (
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
                        color: 'var(--na-accent)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      Style Shift & Continuation Comparison
                    </span>
                    <div style={{ display: 'flex', gap: 'var(--na-space-2)' }}>
                      {CANONICAL_AUSTEN_COMPARISONS.map((c, idx) => (
                        <button
                          key={idx}
                          onClick={() => setFtPromptIdx(idx)}
                          style={{
                            padding: '2px 8px',
                            fontSize: '10px',
                            fontFamily: 'var(--na-font-mono)',
                            backgroundColor: ftPromptIdx === idx ? 'var(--na-accent-muted)' : 'var(--na-raised)',
                            color: ftPromptIdx === idx ? 'var(--na-accent)' : 'var(--na-muted)',
                            border: `1px solid ${ftPromptIdx === idx ? 'var(--na-accent)' : 'var(--na-line)'}`,
                            borderRadius: 'var(--na-radius-sm)',
                            cursor: 'pointer'
                          }}
                        >
                          Prompt #{idx + 1} ({c.sourceChapter.split(' ')[0]} {c.sourceChapter.split(' ')[1]})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt Text */}
                  <div
                    style={{
                      padding: 'var(--na-space-2) var(--na-space-3)',
                      backgroundColor: 'var(--na-raised)',
                      border: '1px solid var(--na-line)',
                      borderRadius: 'var(--na-radius-sm)',
                      fontSize: '12px',
                      fontFamily: 'var(--na-font-display)',
                      fontStyle: 'italic',
                      color: 'var(--na-text)'
                    }}
                  >
                    <span style={{ color: 'var(--na-muted)', fontFamily: 'var(--na-font-mono)', fontStyle: 'normal', fontSize: '11px' }}>
                      Prompt [{comp.sourceChapter}]:{' '}
                    </span>
                    "{comp.prompt}"
                  </div>

                  {/* Side-by-Side Outputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--na-space-3)' }}>
                    {/* Untuned Base Elder-H */}
                    <div
                      style={{
                        padding: 'var(--na-space-3)',
                        backgroundColor: 'var(--na-raised)',
                        border: '1px solid var(--na-line)',
                        borderRadius: 'var(--na-radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--na-warning)' }}>
                          Base Elder-H (Shakespeare Pretraining)
                        </span>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-muted)' }}>
                          Untuned
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          lineHeight: '1.6',
                          color: 'var(--na-text-secondary)',
                          fontFamily: 'var(--na-font-display)',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {comp.baseElder}
                      </div>
                    </div>

                    {/* Adapted Elder-H */}
                    <div
                      style={{
                        padding: 'var(--na-space-3)',
                        backgroundColor: 'var(--na-raised)',
                        border: '1px solid var(--na-accent-cool-muted)',
                        borderRadius: 'var(--na-radius-sm)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--na-accent-cool)' }}>
                          Adapted Elder-H (Austen Fine-Tuned)
                        </span>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-accent-cool)' }}>
                          ★ 25% Replay
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          lineHeight: '1.6',
                          color: 'var(--na-text)',
                          fontFamily: 'var(--na-font-display)',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {comp.adaptedElder}
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Explanation */}
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--na-text-secondary)',
                      backgroundColor: 'var(--na-raised)',
                      padding: 'var(--na-space-2) var(--na-space-3)',
                      borderRadius: 'var(--na-radius-sm)',
                      borderLeft: '3px solid var(--na-accent-cool)',
                      fontFamily: 'var(--na-font-mono)'
                    }}
                  >
                    <strong>Observed Transition: </strong>
                    {comp.notes}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right Column: Per-Token Loss Delta Heatmap & Empirical Findings */}
          <div
            style={{
              flex: '1',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--na-raised)',
              padding: 'var(--na-space-5)',
              overflowY: 'auto',
              gap: 'var(--na-space-4)'
            }}
          >
            {/* Per-Token Loss Delta Heatmap */}
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
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Per-Token Loss Shift Heatmap (Held-Out Passage)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>
                  Hover over tokens
                </span>
              </div>

              {/* Heatmap Legend */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--na-space-3)',
                  fontSize: '11px',
                  fontFamily: 'var(--na-font-mono)',
                  padding: '4px 8px',
                  backgroundColor: 'var(--na-raised)',
                  borderRadius: 'var(--na-radius-sm)'
                }}
              >
                <span style={{ color: 'var(--na-muted)' }}>Δ Loss:</span>
                <span style={{ color: 'var(--na-accent-cool)' }}>■ Δ &lt; -2.0 nats (Major Gain)</span>
                <span style={{ color: 'var(--na-accent)' }}>■ Δ &lt; -0.5 nats (Moderate)</span>
                <span style={{ color: 'var(--na-muted)' }}>■ Neutral</span>
              </div>

              {/* Interactive Passage */}
              <div
                style={{
                  padding: 'var(--na-space-4)',
                  backgroundColor: 'var(--na-raised)',
                  border: '1px solid var(--na-line)',
                  borderRadius: 'var(--na-radius-md)',
                  fontFamily: 'var(--na-font-display)',
                  fontSize: 'var(--na-text-md)',
                  lineHeight: '1.8',
                  color: 'var(--na-text)'
                }}
              >
                {AUSTEN_HEATMAP_TOKENS.map((tok, idx) => {
                  const isHovered = hoveredHeatmapToken === tok;
                  const isHighGain = tok.delta <= -2.0;
                  const isMidGain = tok.delta <= -0.5 && tok.delta > -2.0;

                  return (
                    <span
                      key={idx}
                      onMouseEnter={() => setHoveredHeatmapToken(tok)}
                      onClick={() => setHoveredHeatmapToken(tok)}
                      style={{
                        cursor: 'pointer',
                        padding: '1px 3px',
                        margin: '0 1px',
                        borderRadius: 'var(--na-radius-sm)',
                        backgroundColor: isHovered
                          ? 'var(--na-accent-muted)'
                          : isHighGain
                          ? 'var(--na-accent-cool-muted)'
                          : isMidGain
                          ? 'var(--na-accent-muted)'
                          : 'transparent',
                        borderBottom: isHighGain
                          ? '2px solid var(--na-accent-cool)'
                          : isMidGain
                          ? '2px solid var(--na-accent)'
                          : '1px dotted var(--na-line)',
                        color: isHovered
                          ? 'var(--na-accent)'
                          : isHighGain
                          ? 'var(--na-accent-cool)'
                          : isMidGain
                          ? 'var(--na-accent)'
                          : 'var(--na-text)',
                        fontWeight: isHighGain ? 600 : 400,
                        transition: 'all var(--na-duration-fast)'
                      }}
                      title={`"${tok.word}": Base ${tok.baseLoss.toFixed(2)} → Tuned ${tok.tunedLoss.toFixed(2)} (Δ ${tok.delta.toFixed(2)})`}
                    >
                      {tok.word}
                    </span>
                  );
                })}
              </div>

              {/* Token Inspector Detail Card */}
              <div
                style={{
                  padding: 'var(--na-space-3)',
                  backgroundColor: 'var(--na-raised)',
                  border: '1px solid var(--na-line)',
                  borderRadius: 'var(--na-radius-sm)',
                  fontFamily: 'var(--na-font-mono)',
                  fontSize: '11px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                {hoveredHeatmapToken ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--na-text)' }}>
                        Token: "{hoveredHeatmapToken.word}"
                      </span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: hoveredHeatmapToken.delta < 0 ? 'var(--na-accent-cool)' : 'var(--na-warning)',
                          fontSize: '12px'
                        }}
                      >
                        Δ {hoveredHeatmapToken.delta > 0 ? '+' : ''}{hoveredHeatmapToken.delta.toFixed(2)} nats ({((hoveredHeatmapToken.delta / hoveredHeatmapToken.baseLoss) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--na-space-2)', color: 'var(--na-muted)' }}>
                      <div>Base Elder-H: <strong style={{ color: 'var(--na-text)' }}>{hoveredHeatmapToken.baseLoss.toFixed(2)} nats</strong></div>
                      <div>Austen Adapted: <strong style={{ color: 'var(--na-accent-cool)' }}>{hoveredHeatmapToken.tunedLoss.toFixed(2)} nats</strong></div>
                    </div>
                    {hoveredHeatmapToken.explanation && (
                      <div
                        style={{
                          marginTop: '4px',
                          padding: '2px 6px',
                          backgroundColor: 'var(--na-surface)',
                          borderRadius: '2px',
                          color: 'var(--na-accent)'
                        }}
                      >
                        ✦ {hoveredHeatmapToken.explanation}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: 'var(--na-muted)', textAlign: 'center', padding: '6px 0' }}>
                    Hover over or click any token above to inspect cross-entropy loss changes.
                  </div>
                )}
              </div>
            </div>

            {/* Empirical Findings & Metrics Card */}
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
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                WebGPU Empirical Verification (RTX 3050)
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'var(--na-font-mono)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--na-line)' }}>
                  <span style={{ color: 'var(--na-muted)' }}>Untuned Elder-H Base:</span>
                  <span style={{ color: 'var(--na-text)' }}>4.690 nats (Austen) | 3.164 (Shake)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--na-line)' }}>
                  <span style={{ color: 'var(--na-muted)' }}>Pareto Optimum (25% Replay):</span>
                  <span style={{ color: 'var(--na-accent-cool)', fontWeight: 600 }}>2.471 nats (-2.219 nats, Shake +0.142)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--na-line)' }}>
                  <span style={{ color: 'var(--na-muted)' }}>Conservative Point (50% Replay):</span>
                  <span style={{ color: 'var(--na-accent)', fontWeight: 600 }}>2.507 nats (-2.183 nats, Shake +0.107)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--na-line)' }}>
                  <span style={{ color: 'var(--na-muted)' }}>From-Scratch Control (3k Steps):</span>
                  <span style={{ color: 'var(--na-warning)' }}>3.268 nats (Pretraining Gain: +0.797)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--na-line)' }}>
                  <span style={{ color: 'var(--na-muted)' }}>Austen Character Name Rate:</span>
                  <span style={{ color: 'var(--na-accent-cool)' }}>0.0% → 20.5% (95% CI: [15.5%, 26.6%])</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--na-line)' }}>
                  <span style={{ color: 'var(--na-muted)' }}>Shakespeare Theatrical Tag Rate:</span>
                  <span style={{ color: 'var(--na-warning)' }}>18.5% → 0.5% (95% CI: [0.1%, 2.8%])</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span style={{ color: 'var(--na-muted)' }}>Verbatim 20-Token Memorization:</span>
                  <span style={{ color: 'var(--na-text)' }}>0 / 200 (0.0% exact matches)</span>
                </div>
              </div>

              {onOpenCodex && (
                <button
                  onClick={() => onOpenCodex('domain_shift')}
                  style={{
                    backgroundColor: 'var(--na-raised)',
                    border: '1px solid var(--na-accent-cool)',
                    borderRadius: 'var(--na-radius-sm)',
                    padding: 'var(--na-space-2)',
                    fontSize: '11px',
                    color: 'var(--na-accent-cool)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textAlign: 'center'
                  }}
                >
                  Consult Codex: Domain Shift & Replay →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
};
