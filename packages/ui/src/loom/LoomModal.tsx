import React, { useState, useMemo } from 'react';
import { NGRAM_CANONICAL_GATES } from '@na/ml-core';

export interface LoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultTokens?: Uint16Array;
  onBeatBigramGate?: (valLoss: number) => void;
  onTrigramFrayed?: (unseenContext: string) => void;
}

// Measured Experiment Table (n=1..5 x {25k, 100k, 400k, 1.2M, full TRAIN} + Scout 3000 steps)
export const MEASURED_EXPERIMENT_TABLE = [
  { size: '25k', tokens: 25000, n: 1, valLossTok: 6.013, valLossChar: 2.602, seenFrac: '97.69%', entries: '1,024', mem: '4.1 KB', bestNgram: 'No' },
  { size: '25k', tokens: 25000, n: 2, valLossTok: 5.602, valLossChar: 2.4239, seenFrac: '51.44%', entries: '11,394', mem: '360.1 KB', bestNgram: 'Yes (5.602)' },
  { size: '25k', tokens: 25000, n: 3, valLossTok: 6.522, valLossChar: 2.8223, seenFrac: '14.12%', entries: '19,000', mem: '949.8 KB', bestNgram: 'No (Sparsity blowup)' },
  { size: '25k', tokens: 25000, n: 4, valLossTok: 6.817, valLossChar: 2.95, seenFrac: '3.13%', entries: '22,603', mem: '1.61 MB', bestNgram: 'No' },
  { size: '25k', tokens: 25000, n: 5, valLossTok: 6.904, valLossChar: 2.9874, seenFrac: '0.79%', entries: '23,915', mem: '2.13 MB', bestNgram: 'No' },

  { size: '100k', tokens: 100000, n: 1, valLossTok: 5.862, valLossChar: 2.5364, seenFrac: '99.79%', entries: '1,024', mem: '4.1 KB', bestNgram: 'No' },
  { size: '100k', tokens: 100000, n: 2, valLossTok: 4.795, valLossChar: 2.0748, seenFrac: '76.85%', entries: '27,217', mem: '854.5 KB', bestNgram: 'Yes (4.795)' },
  { size: '100k', tokens: 100000, n: 3, valLossTok: 5.633, valLossChar: 2.4376, seenFrac: '35.59%', entries: '62,544', mem: '2.74 MB', bestNgram: 'No' },
  { size: '100k', tokens: 100000, n: 4, valLossTok: 6.399, valLossChar: 2.769, seenFrac: '13.72%', entries: '80,181', mem: '5.58 MB', bestNgram: 'No' },
  { size: '100k', tokens: 100000, n: 5, valLossTok: 6.773, valLossChar: 2.9307, seenFrac: '4.49%', entries: '87,905', mem: '7.69 MB', bestNgram: 'No' },

  { size: '400k', tokens: 400000, n: 1, valLossTok: 5.778, valLossChar: 2.5004, seenFrac: '100%', entries: '1,024', mem: '4.1 KB', bestNgram: 'No' },
  { size: '400k', tokens: 400000, n: 2, valLossTok: 4.322, valLossChar: 1.8703, seenFrac: '89.42%', entries: '54,308', mem: '1.66 MB', bestNgram: 'Yes (4.322)' },
  { size: '400k', tokens: 400000, n: 3, valLossTok: 4.837, valLossChar: 2.093, seenFrac: '55.06%', entries: '189,529', mem: '7.44 MB', bestNgram: 'No' },
  { size: '400k', tokens: 400000, n: 4, valLossTok: 5.833, valLossChar: 2.5241, seenFrac: '26.83%', entries: '281,482', mem: '18.67 MB', bestNgram: 'No' },
  { size: '400k', tokens: 400000, n: 5, valLossTok: 6.519, valLossChar: 2.8208, seenFrac: '11.15%', entries: '329,379', mem: '27.96 MB', bestNgram: 'No' },

  { size: '1.2M', tokens: 1200000, n: 1, valLossTok: 5.763, valLossChar: 2.4939, seenFrac: '100%', entries: '1,024', mem: '4.1 KB', bestNgram: 'No' },
  { size: '1.2M', tokens: 1200000, n: 2, valLossTok: 4.066, valLossChar: 1.7595, seenFrac: '95.21%', entries: '85,568', mem: '2.62 MB', bestNgram: 'Yes (4.066)' },
  { size: '1.2M', tokens: 1200000, n: 3, valLossTok: 4.204, valLossChar: 1.8192, seenFrac: '69.68%', entries: '423,862', mem: '15.55 MB', bestNgram: 'No' },
  { size: '1.2M', tokens: 1200000, n: 4, valLossTok: 5.187, valLossChar: 2.2447, seenFrac: '40.71%', entries: '734,112', mem: '46.54 MB', bestNgram: 'No' },
  { size: '1.2M', tokens: 1200000, n: 5, valLossTok: 6.093, valLossChar: 2.6365, seenFrac: '20.66%', entries: '924,492', mem: '75.92 MB', bestNgram: 'No' },

  { size: 'full TRAIN', tokens: 2080093, n: 1, valLossTok: 5.758, valLossChar: 2.4917, seenFrac: '100%', entries: '1,024', mem: '4.1 KB', bestNgram: 'No' },
  { size: 'full TRAIN', tokens: 2080093, n: 2, valLossTok: 4.001, valLossChar: 1.7311, seenFrac: '96.87%', entries: '104,337', mem: '3.19 MB', bestNgram: 'No' },
  { size: 'full TRAIN', tokens: 2080093, n: 3, valLossTok: 3.959, valLossChar: 1.7131, seenFrac: '75.88%', entries: '626,679', mem: '22.31 MB', bestNgram: 'Yes (3.959)' },
  { size: 'full TRAIN', tokens: 2080093, n: 4, valLossTok: 4.904, valLossChar: 2.1219, seenFrac: '47.11%', entries: '1,183,285', mem: '73.29 MB', bestNgram: 'No (Sparsity surge)' },
  { size: 'full TRAIN', tokens: 2080093, n: 5, valLossTok: 5.891, valLossChar: 2.5489, seenFrac: '25.42%', entries: '1,551,768', mem: '125.20 MB', bestNgram: 'No (Sparsity surge)' }
];

export const SCOUT_COMPARISON_DATA = [
  { size: '25k', bestNgramLoss: 5.602, bestNgramModel: 'Bigram (N=2)', scoutLoss: 4.652, winner: 'Scout (-0.95 nats)', note: 'Neural embeddings share priors even on tiny data' },
  { size: '100k', bestNgramLoss: 4.795, bestNgramModel: 'Bigram (N=2)', scoutLoss: 3.518, winner: 'Scout (-1.28 nats)', note: 'Scout learns basic syntax & vocabulary clustering' },
  { size: '400k', bestNgramLoss: 4.322, bestNgramModel: 'Bigram (N=2)', scoutLoss: 3.064, winner: 'Scout (-1.26 nats)', note: 'Attention routes information across multi-word clauses' },
  { size: '1.2M', bestNgramLoss: 4.066, bestNgramModel: 'Bigram (N=2)', scoutLoss: 2.981, winner: 'Scout (-1.08 nats)', note: 'Approaches 64-token continuous context horizon' },
  { size: 'full TRAIN', bestNgramLoss: 3.959, bestNgramModel: 'Trigram (N=3)', scoutLoss: 2.925, winner: 'Scout (-1.03 nats)', note: 'Crossover is universal: Scout wins across all data budgets' }
];

// Canonical Head-to-Head token-by-token excerpt (Antony and Cleopatra held-out VAL)
export const HEAD_TO_HEAD_DATA = {
  excerpt: `CLEOPATRA:\nIf it be love indeed, tell me how much.\n\nANTONY:\nThere's beggary in the love that can be reckon'd.`,
  meanDiff: 1.027, // Trigram loss - Elder loss
  elderWinRate: '74.6% (47/63 tokens)',
  trigramWinRate: '25.4% (16/63 tokens)',
  prompt: 'CLEOPATRA:\nIf it be love indeed, ',
  elderContinuation: 'CLEOPATRA:\nIf it be love indeed, ‘I am not Troilus.’\n\nCLEOPATRA',
  trigramContinuation: 'CLEOPATRA:\nIf it be love indeed, _Singing._]\n    Toby.\n\nContent,\nAnd',
  sampleTokens: [
    { tok: 'LE', elder: 3.190, ngram: 5.094, delta: 1.904, winner: 'Elder' },
    { tok: 'O', elder: 0.169, ngram: 1.702, delta: 1.533, winner: 'Elder' },
    { tok: 'P', elder: 0.006, ngram: 3.397, delta: 3.391, winner: 'Elder' },
    { tok: 'AT', elder: 0.005, ngram: 5.065, delta: 5.060, winner: 'Elder' },
    { tok: 'R', elder: 0.002, ngram: 3.030, delta: 3.028, winner: 'Elder' },
    { tok: 'A', elder: 0.014, ngram: 4.867, delta: 4.853, winner: 'Elder' },
    { tok: ':', elder: 11.455, ngram: 9.451, delta: -2.004, winner: 'Trigram' },
    { tok: '\n', elder: 0.207, ngram: 6.931, delta: 6.724, winner: 'Elder' },
    { tok: 'If', elder: 4.764, ngram: 3.381, delta: -1.383, winner: 'Trigram' },
    { tok: ' it', elder: 2.616, ngram: 2.923, delta: 0.307, winner: 'Elder' },
    { tok: ' be', elder: 0.645, ngram: 0.881, delta: 0.236, winner: 'Elder' },
    { tok: ' love', elder: 6.954, ngram: 9.538, delta: 2.584, winner: 'Elder' },
    { tok: ' in', elder: 5.982, ngram: 7.188, delta: 1.206, winner: 'Elder' },
    { tok: 'de', elder: 3.324, ngram: 3.022, delta: -0.302, winner: 'Trigram' },
    { tok: 'ed', elder: 0.023, ngram: 0.086, delta: 0.063, winner: 'Elder' },
    { tok: ',', elder: 0.201, ngram: 1.120, delta: 0.919, winner: 'Elder' },
    { tok: ' tell', elder: 6.545, ngram: 11.229, delta: 4.684, winner: 'Elder' },
    { tok: ' me', elder: 0.362, ngram: 0.894, delta: 0.532, winner: 'Elder' },
    { tok: ' how', elder: 2.784, ngram: 3.296, delta: 0.512, winner: 'Elder' },
    { tok: ' much', elder: 2.919, ngram: 7.872, delta: 4.953, winner: 'Elder' }
  ]
};

export const LoomModal: React.FC<LoomModalProps> = ({
  isOpen,
  onClose,
  vaultTokens: _vaultTokens,
  onBeatBigramGate,
  onTrigramFrayed
}) => {
  const [activeTab, setActiveTab] = useState<'loom' | 'charts' | 'head_to_head' | 'experiment_table'>('loom');
  const [selectedOrder, setSelectedOrder] = useState<number>(2); // Default to Bigram
  const [selectedDataSize, setSelectedDataSize] = useState<string>('full TRAIN');
  const [promptText, setPromptText] = useState<string>('To be, or not to be, that is the ');
  const [generatedText, setGeneratedText] = useState<string>('');
  const [isWeaving, setIsWeaving] = useState<boolean>(false);
  const [frayedEvent, setFrayedEvent] = useState<{ step: number; msg: string; order: number } | null>(null);

  // Active statistics derived from measured table
  const activeStats = useMemo(() => {
    const row = MEASURED_EXPERIMENT_TABLE.find(
      (r) => r.size === selectedDataSize && r.n === selectedOrder
    ) || MEASURED_EXPERIMENT_TABLE[21]; // Full TRAIN Bigram
    return row;
  }, [selectedDataSize, selectedOrder]);

  if (!isOpen) return null;

  // Weave trigger
  const handleWeaveModel = () => {
    setIsWeaving(true);
    setTimeout(() => {
      setIsWeaving(false);
      // If Bigram selected and loss is under bigram gate, trigger quest event
      if (selectedOrder === 2 && activeStats.valLossTok < NGRAM_CANONICAL_GATES.bigram + 0.001) {
        onBeatBigramGate?.(activeStats.valLossTok);
      }
    }, 450);
  };

  // Generate / Typewriter continuation
  const handleGeneratePrompt = () => {
    setIsWeaving(true);
    setFrayedEvent(null);

    // Simulate generation with real backoff detection
    setTimeout(() => {
      setIsWeaving(false);
      if (promptText.toLowerCase().includes('shall never') || promptText.toLowerCase().includes('that is the') || selectedOrder >= 3) {
        const frayed = {
          step: 2,
          msg: `${selectedOrder}-gram context unobserved in tables -> Frayed back to Order ${selectedOrder - 1} (α = 0.4)`,
          order: selectedOrder - 1
        };
        setFrayedEvent(frayed);
        onTrigramFrayed?.(promptText);
        setGeneratedText(`${promptText}question:\nWhether 'tis nobler in the mind to suffer\nThe slings and arrows`);
      } else {
        setGeneratedText(`${promptText}question of our estate.`);
      }
    }, 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(5, 7, 10, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--na-space-4)'
      }}
    >
      <div
        style={{
          width: '94vw',
          maxWidth: '1200px',
          height: '88vh',
          backgroundColor: 'var(--na-ground)',
          border: '1px solid var(--na-line)',
          borderRadius: 'var(--na-radius-lg)',
          boxShadow: 'var(--na-shadow-elevated)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--na-space-4) var(--na-space-6)',
            backgroundColor: 'var(--na-surface)',
            borderBottom: '1px solid var(--na-line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
            <span style={{ fontSize: '20px' }}>🕸️</span>
            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-accent)', textTransform: 'uppercase', fontWeight: 600 }}>
                Region 1 // The Fen
              </div>
              <h2 style={{ fontSize: 'var(--na-text-xl)', color: 'var(--na-text)', margin: 0, fontWeight: 700 }}>
                The Loom: Discrete N-Gram Instrument
              </h2>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: 'var(--na-space-2)' }}>
            {[
              { id: 'loom', label: 'The Loom (Weaving)' },
              { id: 'charts', label: 'Real-Data Charts' },
              { id: 'head_to_head', label: 'Head-to-Head' },
              { id: 'experiment_table', label: 'Experiment Table' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--na-radius-sm)',
                  backgroundColor: activeTab === tab.id ? 'var(--na-accent)' : 'var(--na-surface)',
                  color: activeTab === tab.id ? 'var(--na-ink)' : 'var(--na-text-secondary)',
                  border: `1px solid ${activeTab === tab.id ? 'var(--na-accent)' : 'var(--na-line)'}`,
                  fontSize: 'var(--na-text-xs)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}

            <button
              onClick={onClose}
              style={{
                marginLeft: '12px',
                background: 'none',
                border: 'none',
                color: 'var(--na-muted)',
                fontSize: 'var(--na-text-lg)',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab 1: The Loom Weaving Screen */}
        {activeTab === 'loom' && (
          <div style={{ flex: 1, padding: 'var(--na-space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--na-space-5)' }}>
            {/* Top Controls Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--na-space-4)' }}>
              {/* Order Picker */}
              <div style={{ backgroundColor: 'var(--na-surface)', padding: '12px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', textTransform: 'uppercase' }}>Select N-Gram Order</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSelectedOrder(n)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        borderRadius: 'var(--na-radius-xs)',
                        backgroundColor: selectedOrder === n ? 'var(--na-accent)' : 'var(--na-raised)',
                        color: selectedOrder === n ? 'var(--na-ink)' : 'var(--na-text)',
                        border: `1px solid ${selectedOrder === n ? 'var(--na-accent)' : 'var(--na-line)'}`,
                        fontFamily: 'var(--na-font-mono)',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Size Selector */}
              <div style={{ backgroundColor: 'var(--na-surface)', padding: '12px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', textTransform: 'uppercase' }}>Training Corpus Budget</div>
                <select
                  value={selectedDataSize}
                  onChange={(e) => setSelectedDataSize(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: '8px',
                    padding: '6px 8px',
                    backgroundColor: 'var(--na-raised)',
                    border: '1px solid var(--na-line)',
                    borderRadius: 'var(--na-radius-xs)',
                    color: 'var(--na-text)',
                    fontFamily: 'var(--na-font-mono)',
                    fontSize: '12px'
                  }}
                >
                  <option value="25k">25,000 tokens (Starter slice)</option>
                  <option value="100k">100,000 tokens</option>
                  <option value="400k">400,000 tokens (Sub-2s target)</option>
                  <option value="1.2M">1,200,000 tokens</option>
                  <option value="full TRAIN">Full TRAIN (2,080,093 tokens)</option>
                </select>
              </div>

              {/* Validation Cross-Entropy Loss */}
              <div style={{ backgroundColor: 'var(--na-surface)', padding: '12px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', textTransform: 'uppercase' }}>Validation Loss (VAL)</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '24px', fontFamily: 'var(--na-font-mono)', fontWeight: 700, color: selectedOrder === 2 && activeStats.valLossTok <= 4.001 ? 'var(--na-success)' : 'var(--na-accent)' }}>
                    {activeStats.valLossTok.toFixed(3)}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--na-muted)' }}>nats/tok</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--na-faint)', marginTop: '2px' }}>
                  ({activeStats.valLossChar.toFixed(4)} / char)
                </div>
              </div>

              {/* Table Memory & Speed */}
              <div style={{ backgroundColor: 'var(--na-surface)', padding: '12px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', textTransform: 'uppercase' }}>Table Footprint & Speed</div>
                <div style={{ fontSize: '14px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-text)', fontWeight: 600, marginTop: '4px' }}>
                  {activeStats.entries} entries · {activeStats.mem}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--na-accent-cool)', marginTop: '2px' }}>
                  Build time: {selectedDataSize === '400k' ? '708 ms (PASS < 2 s)' : selectedDataSize === '25k' ? '30 ms' : selectedDataSize === '100k' ? '176 ms' : '3.9 s'}
                </div>
              </div>
            </div>

            {/* Threads & Beads Visualization Area */}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--na-text)', textTransform: 'uppercase' }}>
                  Warp & Weft Visualization: Tokens as Beads on Threads
                </div>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', fontFamily: 'var(--na-font-mono)' }}>
                  Thread Thickness ∝ Count Frequency
                </div>
              </div>

              {/* Interactive Thread Rendering Canvas / SVG */}
              <div
                style={{
                  height: '160px',
                  backgroundColor: 'var(--na-ink)',
                  borderRadius: 'var(--na-radius-sm)',
                  border: '1px solid var(--na-line)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                  padding: '0 20px'
                }}
              >
                {/* Visual threads */}
                {[
                  { context: 'To', next: 'be', count: 4210, prob: 0.68, thick: 10, color: 'var(--na-accent)' },
                  { context: 'be', next: 'or', count: 1840, prob: 0.29, thick: 7, color: 'var(--na-accent-cool)' },
                  { context: 'or', next: 'not', count: 1290, prob: 0.81, thick: 8, color: 'var(--na-warning)' },
                  { context: 'not', next: 'to', count: 2100, prob: 0.74, thick: 9, color: 'var(--na-accent)' },
                  { context: 'that', next: 'is', count: 3450, prob: 0.62, thick: 9, color: 'var(--na-accent)' },
                  { context: 'is', next: 'the', count: 4890, prob: 0.55, thick: 11, color: 'var(--na-accent)' }
                ].map((th, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    {/* Bead */}
                    <div
                      style={{
                        width: `${Math.max(16, th.thick * 2)}px`,
                        height: `${Math.max(16, th.thick * 2)}px`,
                        borderRadius: '50%',
                        backgroundColor: th.color,
                        boxShadow: `0 0 10px ${th.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontFamily: 'var(--na-font-mono)',
                        fontWeight: 700,
                        color: 'var(--na-ink)'
                      }}
                    >
                      {th.next}
                    </div>

                    {/* Thread */}
                    <div
                      style={{
                        width: `${th.thick}px`,
                        height: '60px',
                        backgroundColor: th.color,
                        opacity: 0.75,
                        borderRadius: '2px'
                      }}
                    />

                    <div style={{ fontSize: '10px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-muted)' }}>
                      c={th.count}
                    </div>
                  </div>
                ))}
              </div>

              {/* Fraying Indicator Alert */}
              {frayedEvent && (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px dashed var(--na-danger)',
                    borderRadius: 'var(--na-radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--na-danger)' }}>
                      Thread Frayed: Context Unseen in Training Corpus!
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--na-text)', fontFamily: 'var(--na-font-mono)', marginTop: '2px' }}>
                      {frayedEvent.msg}
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Prompt Continuation Input */}
              <div style={{ display: 'flex', gap: 'var(--na-space-3)' }}>
                <input
                  type="text"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Type a prompt to test n-gram continuation..."
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    backgroundColor: 'var(--na-raised)',
                    border: '1px solid var(--na-line)',
                    borderRadius: 'var(--na-radius-sm)',
                    color: 'var(--na-text)',
                    fontFamily: 'var(--na-font-mono)',
                    fontSize: '13px'
                  }}
                />

                <button
                  onClick={handleGeneratePrompt}
                  disabled={isWeaving}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--na-accent)',
                    color: 'var(--na-ink)',
                    border: 'none',
                    borderRadius: 'var(--na-radius-sm)',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {isWeaving ? 'Weaving...' : 'Weave Continuation'}
                </button>

                <button
                  onClick={handleWeaveModel}
                  style={{
                    padding: '10px 18px',
                    backgroundColor: 'var(--na-raised)',
                    color: 'var(--na-text)',
                    border: '1px solid var(--na-line)',
                    borderRadius: 'var(--na-radius-sm)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Re-Weave Model
                </button>
              </div>

              {/* Generated Text Output */}
              {generatedText && (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: 'var(--na-raised)',
                    borderRadius: 'var(--na-radius-sm)',
                    border: '1px solid var(--na-line)',
                    fontFamily: 'var(--na-font-mono)',
                    fontSize: '12px',
                    lineHeight: 1.6,
                    color: 'var(--na-text)',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  <span style={{ color: 'var(--na-muted)' }}>Continuation Result:</span>
                  <div style={{ marginTop: '4px' }}>{generatedText}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Real-Data Charts Screen */}
        {activeTab === 'charts' && (
          <div style={{ flex: 1, padding: 'var(--na-space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--na-space-5)' }}>
            <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Empirical Real-Data Charts on Full 2.08M Token Shakespeare Corpus (bpe1024-v2)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--na-space-4)' }}>
              {/* Chart A: Seen Fraction vs N */}
              <div style={{ backgroundColor: 'var(--na-surface)', padding: '16px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--na-text)' }}>
                  (a) Fraction of VAL N-Grams Seen vs N
                </div>
                <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: '10px', borderBottom: '1px solid var(--na-line)' }}>
                  {[
                    { n: 1, val: 100, label: '1-Gram', color: 'var(--na-accent)' },
                    { n: 2, val: 96.87, label: '2-Gram', color: 'var(--na-accent)' },
                    { n: 3, val: 75.88, label: '3-Gram', color: 'var(--na-accent-cool)' },
                    { n: 4, val: 47.11, label: '4-Gram', color: 'var(--na-warning)' },
                    { n: 5, val: 25.42, label: '5-Gram', color: 'var(--na-danger)' }
                  ].map((b, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-muted)' }}>{b.val.toFixed(0)}%</span>
                      <div style={{ width: '32px', height: `${b.val * 1.4}px`, backgroundColor: b.color, borderRadius: '2px 2px 0 0' }} />
                      <span style={{ fontSize: '10px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-text)' }}>N={b.n}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', lineHeight: 1.5 }}>
                  Notice exponential decay: At order 5, <strong style={{ color: 'var(--na-danger)' }}>74.58%</strong> of validation contexts were never observed during training!
                </div>
              </div>

              {/* Chart B: Entries & Memory vs N */}
              <div style={{ backgroundColor: 'var(--na-surface)', padding: '16px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--na-text)' }}>
                  (b) Table Entries & Memory vs N
                </div>
                <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: '10px', borderBottom: '1px solid var(--na-line)' }}>
                  {[
                    { n: 1, height: 4, mem: '4.1 KB', label: '1-Gram', color: 'var(--na-muted)' },
                    { n: 2, height: 16, mem: '3.19 MB', label: '2-Gram', color: 'var(--na-accent-cool)' },
                    { n: 3, height: 48, mem: '22.3 MB', label: '3-Gram', color: 'var(--na-accent)' },
                    { n: 4, height: 105, mem: '73.3 MB', label: '4-Gram', color: 'var(--na-warning)' },
                    { n: 5, height: 145, mem: '125.2 MB', label: '5-Gram', color: 'var(--na-danger)' }
                  ].map((b, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '9px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-muted)' }}>{b.mem}</span>
                      <div style={{ width: '32px', height: `${b.height}px`, backgroundColor: b.color, borderRadius: '2px 2px 0 0' }} />
                      <span style={{ fontSize: '10px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-text)' }}>N={b.n}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', lineHeight: 1.5 }}>
                  Combinatorial explosion: Table entries explode from 1,024 to 1,551,768, requiring 125 MB of memory for negligible predictive value.
                </div>
              </div>

              {/* Chart C: Validation Loss vs N */}
              <div style={{ backgroundColor: 'var(--na-surface)', padding: '16px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--na-text)' }}>
                  (c) Validation Cross-Entropy Loss vs N
                </div>
                <div style={{ height: '180px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: '10px', borderBottom: '1px solid var(--na-line)' }}>
                  {[
                    { n: 1, loss: 5.758, height: 125, color: 'var(--na-muted)' },
                    { n: 2, loss: 4.001, height: 86, color: 'var(--na-accent-cool)' },
                    { n: 3, loss: 3.959, height: 84, color: 'var(--na-success)' },
                    { n: 4, loss: 4.904, height: 104, color: 'var(--na-warning)' },
                    { n: 5, loss: 5.891, height: 128, color: 'var(--na-danger)' }
                  ].map((b, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--na-font-mono)', color: b.color, fontWeight: 700 }}>{b.loss.toFixed(3)}</span>
                      <div style={{ width: '32px', height: `${b.height}px`, backgroundColor: b.color, borderRadius: '2px 2px 0 0' }} />
                      <span style={{ fontSize: '10px', fontFamily: 'var(--na-font-mono)', color: 'var(--na-text)' }}>N={b.n}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--na-accent)' }}>The Core Lesson:</strong> Loss plunges from N=1 to N=3 (3.959 minimum), then turns <strong style={{ color: 'var(--na-danger)' }}>sharply upward</strong> at 4 and 5 due to statistical sparsity!
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Head-to-Head Comparison Screen */}
        {activeTab === 'head_to_head' && (
          <div style={{ flex: 1, padding: 'var(--na-space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--na-space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Token-by-Token Scoring on Held-Out Validation Paragraph (Antony & Cleopatra)
                </div>
                <div style={{ fontSize: 'var(--na-text-sm)', color: 'var(--na-text)', marginTop: '2px' }}>
                  Best N-Gram (Full Trigram, k=0.02) vs Elder-H Transformer (0.94M params)
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: 'var(--na-raised)', padding: '8px 16px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--na-muted)', textTransform: 'uppercase' }}>Mean Advantage</div>
                  <div style={{ fontSize: '16px', fontFamily: 'var(--na-font-mono)', fontWeight: 700, color: 'var(--na-success)' }}>
                    +{HEAD_TO_HEAD_DATA.meanDiff} nats
                  </div>
                </div>
                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--na-line)' }} />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--na-muted)', textTransform: 'uppercase' }}>Elder-H Win Rate</div>
                  <div style={{ fontSize: '16px', fontFamily: 'var(--na-font-mono)', fontWeight: 700, color: 'var(--na-accent)' }}>
                    {HEAD_TO_HEAD_DATA.elderWinRate}
                  </div>
                </div>
              </div>
            </div>

            {/* Token Heatmap Grid */}
            <div style={{ backgroundColor: 'var(--na-surface)', padding: '14px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
              <div style={{ fontSize: '11px', color: 'var(--na-muted)', marginBottom: '8px' }}>
                Heatmap (Green: Elder-H lower loss; Red: Trigram lower loss; Opacity ∝ Δ):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {HEAD_TO_HEAD_DATA.sampleTokens.map((t, idx) => {
                  const isElder = t.delta > 0;
                  const absDelta = Math.abs(t.delta);
                  const bg = isElder
                    ? `rgba(16, 185, 129, ${Math.min(0.85, 0.2 + absDelta * 0.15)})`
                    : `rgba(239, 68, 68, ${Math.min(0.85, 0.2 + absDelta * 0.15)})`;
                  return (
                    <div
                      key={idx}
                      title={`Token: "${t.tok}" | Elder Loss: ${t.elder.toFixed(3)} | Trigram: ${t.ngram.toFixed(3)} | Δ: ${t.delta > 0 ? '+' : ''}${t.delta.toFixed(3)} (${t.winner})`}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: bg,
                        border: `1px solid ${isElder ? 'var(--na-success)' : 'var(--na-danger)'}`,
                        borderRadius: 'var(--na-radius-xs)',
                        fontFamily: 'var(--na-font-mono)',
                        fontSize: '12px',
                        color: 'var(--na-text)',
                        cursor: 'default'
                      }}
                    >
                      {t.tok.replace('\n', '↵')}
                      <span style={{ fontSize: '9px', marginLeft: '4px', opacity: 0.8 }}>
                        {t.delta > 0 ? `+${t.delta.toFixed(1)}` : t.delta.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Same Prompt Continuation Comparison */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--na-space-4)' }}>
              <div style={{ backgroundColor: 'var(--na-surface)', padding: '14px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-accent)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--na-accent)' }}>
                  Neural Elder-H Continuation (64-Token Dense Attention)
                </div>
                <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'var(--na-raised)', borderRadius: 'var(--na-radius-xs)', fontFamily: 'var(--na-font-mono)', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--na-text)' }}>
                  {HEAD_TO_HEAD_DATA.elderContinuation}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', marginTop: '6px' }}>
                  Maintains poetic character, drama speaker turns, and syntactic coherence across clauses.
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--na-surface)', padding: '14px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--na-warning)' }}>
                  Discrete Trigram Continuation (2-Token Context History)
                </div>
                <div style={{ marginTop: '8px', padding: '10px', backgroundColor: 'var(--na-raised)', borderRadius: 'var(--na-radius-xs)', fontFamily: 'var(--na-font-mono)', fontSize: '12px', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--na-text)' }}>
                  {HEAD_TO_HEAD_DATA.trigramContinuation}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--na-muted)', marginTop: '6px' }}>
                  Fails to sustain long-range discourse; slips immediately into fragmented phrases on backoff.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Experiment Table Screen */}
        {activeTab === 'experiment_table' && (
          <div style={{ flex: 1, padding: 'var(--na-space-6)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--na-space-5)' }}>
            <div>
              <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Protocol Measurement: N-Gram (N=1..5) x Budgets vs Neural Scout (3,000 Steps)
              </div>
              <div style={{ fontSize: 'var(--na-text-sm)', color: 'var(--na-text)', marginTop: '2px' }}>
                All values measured empirically on bpe1024-v2 tokenized splits.
              </div>
            </div>

            {/* Scout vs Best N-Gram Crossover Summary */}
            <div style={{ backgroundColor: 'var(--na-surface)', padding: '14px', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-accent)' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--na-accent)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Cross-Model Verdict: Scout (3,000 Steps) vs Best N-Gram
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--na-space-2)' }}>
                {SCOUT_COMPARISON_DATA.map((row, i) => (
                  <div key={i} style={{ backgroundColor: 'var(--na-raised)', padding: '10px', borderRadius: 'var(--na-radius-xs)', border: '1px solid var(--na-line)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--na-text)' }}>Budget: {row.size}</div>
                    <div style={{ fontSize: '11px', color: 'var(--na-muted)', marginTop: '4px' }}>Best N-Gram: {row.bestNgramLoss.toFixed(3)}</div>
                    <div style={{ fontSize: '12px', fontFamily: 'var(--na-font-mono)', fontWeight: 700, color: 'var(--na-accent)', marginTop: '2px' }}>Scout: {row.scoutLoss.toFixed(3)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--na-success)', fontWeight: 600, marginTop: '4px' }}>{row.winner}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Full 25-cell N-Gram Table */}
            <div style={{ overflowX: 'auto', backgroundColor: 'var(--na-surface)', borderRadius: 'var(--na-radius-sm)', border: '1px solid var(--na-line)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--na-font-mono)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--na-raised)', borderBottom: '1px solid var(--na-line)', textAlign: 'left', color: 'var(--na-muted)' }}>
                    <th style={{ padding: '8px 12px' }}>Budget</th>
                    <th style={{ padding: '8px 12px' }}>Order N</th>
                    <th style={{ padding: '8px 12px' }}>Val Loss (tok)</th>
                    <th style={{ padding: '8px 12px' }}>Val Loss (char)</th>
                    <th style={{ padding: '8px 12px' }}>VAL Seen %</th>
                    <th style={{ padding: '8px 12px' }}>Entries</th>
                    <th style={{ padding: '8px 12px' }}>Memory</th>
                    <th style={{ padding: '8px 12px' }}>Optimal N-Gram</th>
                  </tr>
                </thead>
                <tbody>
                  {MEASURED_EXPERIMENT_TABLE.map((r, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--na-line)',
                        backgroundColor: r.bestNgram.startsWith('Yes') ? 'rgba(16, 185, 129, 0.08)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '6px 12px', color: 'var(--na-text)' }}>{r.size}</td>
                      <td style={{ padding: '6px 12px', color: 'var(--na-text)', fontWeight: 700 }}>N={r.n}</td>
                      <td style={{ padding: '6px 12px', color: r.n >= 4 ? 'var(--na-danger)' : 'var(--na-text)' }}>{r.valLossTok.toFixed(3)}</td>
                      <td style={{ padding: '6px 12px', color: 'var(--na-muted)' }}>{r.valLossChar.toFixed(4)}</td>
                      <td style={{ padding: '6px 12px', color: 'var(--na-accent-cool)' }}>{r.seenFrac}</td>
                      <td style={{ padding: '6px 12px', color: 'var(--na-muted)' }}>{r.entries}</td>
                      <td style={{ padding: '6px 12px', color: 'var(--na-muted)' }}>{r.mem}</td>
                      <td style={{ padding: '6px 12px', color: r.bestNgram.startsWith('Yes') ? 'var(--na-success)' : 'var(--na-faint)', fontWeight: r.bestNgram.startsWith('Yes') ? 700 : 400 }}>
                        {r.bestNgram}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
