import React, { useState, useEffect } from 'react';
import {
  Panel,
  PanelHeader,
  PanelBody,
  PanelFooter
} from '../components/Panel.js';
import { Button } from '../components/Button.js';
import { Slider } from '../components/Slider.js';
import { Toggle } from '../components/Toggle.js';
import { NumberField } from '../components/NumberField.js';
import { Select } from '../components/Select.js';
import { Tabs } from '../components/Tabs.js';
import { Tooltip } from '../components/Tooltip.js';
import { Modal } from '../components/Modal.js';
import { ToastProvider, useToast } from '../components/Toast.js';
import { Badge } from '../components/Badge.js';
import { KeyHint } from '../components/KeyHint.js';
import { ProgressRing } from '../components/ProgressRing.js';
import { ToolWheel, ToolWheelItem } from '../components/ToolWheel.js';
import {
  DatasetIcon,
  TokenIcon,
  ModelIcon,
  TrainIcon,
  EvaluateIcon,
  CleanIcon,
  ScanIcon,
  JournalIcon,
  SettingsIcon,
  LossIcon,
  AttentionIcon,
  SunIcon,
  MoonIcon,
  MotionIcon
} from '../icons/index.js';

const toolsList: ToolWheelItem[] = [
  { id: 'dataset', label: 'Dataset', description: 'Sample & inspect corpora', icon: <DatasetIcon size={20} /> },
  { id: 'scan', label: 'Horizon Scan', description: 'Probe uncharted sectors', icon: <ScanIcon size={20} /> },
  { id: 'clean', label: 'Curator', description: 'Filter noise & duplicates', icon: <CleanIcon size={20} /> },
  { id: 'token', label: 'Tokenizer', description: 'Subword partition engine', icon: <TokenIcon size={20} /> },
  { id: 'model', label: 'Weights', description: 'Transformer state & DAG', icon: <ModelIcon size={20} /> },
  { id: 'train', label: 'Backprop', description: 'AdamW gradient step', icon: <TrainIcon size={20} /> },
  { id: 'evaluate', label: 'Benchmark', description: 'Perplexity & accuracy', icon: <EvaluateIcon size={20} /> },
  { id: 'journal', label: 'Logbook', description: 'Explorer observations', icon: <JournalIcon size={20} /> }
];

const GalleryContent: React.FC = () => {
  const { addToast } = useToast();

  // Theme & Motion states
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [reducedMotion, setReducedMotion] = useState(false);

  // Component test states
  const [sliderVal, setSliderVal] = useState(42);
  const [toggleState, setToggleState] = useState(true);
  const [numVal, setNumVal] = useState(128);
  const [selectVal, setSelectVal] = useState('adamw');
  const [activeTab, setActiveTab] = useState('components');
  const [modalOpen, setModalOpen] = useState(false);
  const [progressVal, setProgressVal] = useState(68);
  const [selectedTool, setSelectedTool] = useState('model');

  // Sync theme to root attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync reduced motion to root attribute
  useEffect(() => {
    if (reducedMotion) {
      document.documentElement.setAttribute('data-reduced-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduced-motion');
    }
  }, [reducedMotion]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--na-ink)',
        color: 'var(--na-text)',
        padding: 'var(--na-space-6) var(--na-space-8)',
        maxWidth: '1440px',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Header Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--na-line)',
          paddingBottom: 'var(--na-space-4)',
          marginBottom: 'var(--na-space-6)',
          flexWrap: 'wrap',
          gap: 'var(--na-space-4)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-2)' }}>
            <span
              style={{
                fontFamily: 'var(--na-font-mono)',
                fontSize: 'var(--na-text-xs)',
                color: 'var(--na-accent)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}
            >
              NeuroArena Instrumentarium
            </span>
            <Badge variant="accent">UI LAB v1.0</Badge>
          </div>
          <h1
            style={{
              fontFamily: 'var(--na-font-display)',
              fontSize: 'var(--na-text-3xl)',
              margin: 'var(--na-space-1) 0 0 0',
              fontWeight: 600,
              letterSpacing: '-0.02em'
            }}
          >
            Design System & Component Gallery
          </h1>
          <p
            style={{
              margin: 'var(--na-space-1) 0 0 0',
              color: 'var(--na-muted)',
              fontSize: 'var(--na-text-sm)',
              maxWidth: '650px'
            }}
          >
            A scholarly explorer's instrument. Calm, warm, precise. Restraint over decoration;
            every effect has a purpose. Operable entirely via keyboard.
          </p>
        </div>

        {/* Global Controls: Theme & Motion toggles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--na-space-3)' }}>
          <Button
            variant="secondary"
            size="md"
            icon={theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle light/dark theme"
          >
            {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </Button>

          <Button
            variant={reducedMotion ? 'primary' : 'secondary'}
            size="md"
            icon={<MotionIcon size={16} />}
            onClick={() => setReducedMotion(!reducedMotion)}
            aria-pressed={reducedMotion}
          >
            {reducedMotion ? 'Reduced Motion: ON' : 'Reduced Motion: OFF'}
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              window.location.href = '/';
            }}
          >
            Back to World
          </Button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <Tabs
        tabs={[
          { id: 'components', label: 'Interactive Components' },
          { id: 'tokens', label: 'Design Tokens & Typography' },
          { id: 'icons', label: 'Scholarly Iconography (24px)' },
          { id: 'toolwheel', label: 'ToolWheel (Radial Menu)' }
        ]}
        activeId={activeTab}
        onChange={setActiveTab}
        className="na-mb-6"
      />

      {/* Tab 1: Interactive Components */}
      {activeTab === 'components' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--na-space-6)' }}>
          {/* Section: Buttons */}
          <Panel variant="raised">
            <PanelHeader
              title="Button States & Variants"
              subtitle="Operable via Tab / Space / Enter"
            />
            <PanelBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '8px' }}>
                  VARIANTS (sm, md, lg)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--na-space-2)', alignItems: 'center' }}>
                  <Button variant="primary" size="sm">Primary SM</Button>
                  <Button variant="primary" size="md">Primary MD</Button>
                  <Button variant="primary" size="lg">Primary LG</Button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--na-space-2)', alignItems: 'center' }}>
                <Button variant="secondary" size="md">Secondary</Button>
                <Button variant="ghost" size="md">Ghost</Button>
                <Button variant="danger" size="md">Danger</Button>
              </div>

              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '8px' }}>
                  ICON BUTTONS & STATES
                </div>
                <div style={{ display: 'flex', gap: 'var(--na-space-2)', alignItems: 'center' }}>
                  <Button variant="secondary" size="md" icon={<SettingsIcon size={16} />}>
                    Settings
                  </Button>
                  <Tooltip content="Clean dataset sample">
                    <Button variant="secondary" size="md" iconOnly icon={<CleanIcon size={16} />} aria-label="Clean" />
                  </Tooltip>
                  <Button variant="secondary" size="md" loading>
                    Computing
                  </Button>
                  <Button variant="secondary" size="md" disabled>
                    Disabled
                  </Button>
                </div>
              </div>
            </PanelBody>
            <PanelFooter>
              <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginRight: 'auto' }}>
                All variants keyboard operable
              </span>
              <Button variant="ghost" size="sm">Reset States</Button>
            </PanelFooter>
          </Panel>

          {/* Section: Badges & Data-Quality */}
          <Panel variant="raised">
            <PanelHeader
              title="Badges & Data-Quality Sets"
              subtitle="Semantic and dataset curation tags"
            />
            <PanelBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '8px' }}>
                  SEMANTIC BADGES
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--na-space-2)' }}>
                  <Badge variant="neutral">Neutral</Badge>
                  <Badge variant="accent">Lantern Amber</Badge>
                  <Badge variant="accent-cool">Signal Teal</Badge>
                  <Badge variant="success" dot>Converged</Badge>
                  <Badge variant="warning" dot>Stalled</Badge>
                  <Badge variant="danger" dot>NaN Diverged</Badge>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '8px' }}>
                  DATA-QUALITY SET (REQUIRED)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--na-space-2)' }}>
                  <Badge variant="clean">clean</Badge>
                  <Badge variant="noisy">noisy</Badge>
                  <Badge variant="duplicate">duplicate</Badge>
                  <Badge variant="contaminated">contaminated</Badge>
                  <Badge variant="unknown">unknown</Badge>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '8px' }}>
                  KEYHINTS (TACTILE KEYS)
                </div>
                <div style={{ display: 'flex', gap: 'var(--na-space-2)', alignItems: 'center' }}>
                  <span>Inspect:</span>
                  <KeyHint>E</KeyHint>
                  <span>Radial Menu:</span>
                  <KeyHint>Tab</KeyHint>
                  <span>Execute:</span>
                  <KeyHint>Enter</KeyHint>
                  <span>Abort:</span>
                  <KeyHint>Esc</KeyHint>
                </div>
              </div>
            </PanelBody>
          </Panel>

          {/* Section: Precision Inputs */}
          <Panel variant="raised">
            <PanelHeader
              title="Precision Controls"
              subtitle="Slider, Toggle, NumberField, Select"
            />
            <PanelBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-4)' }}>
              <Slider
                label="Learning Rate (x 10⁻⁴)"
                value={sliderVal}
                min={1}
                max={100}
                unit=" lr"
                onChange={setSliderVal}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Toggle
                  checked={toggleState}
                  onChange={setToggleState}
                  label="Causal Attention Mask"
                />
                <Toggle
                  checked={false}
                  disabled
                  onChange={() => {}}
                  label="Locked (Disabled)"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--na-space-4)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                    Context Length (Tokens)
                  </div>
                  <NumberField
                    value={numVal}
                    min={16}
                    max={1024}
                    step={16}
                    onChange={setNumVal}
                    label="Context Length"
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginBottom: '6px' }}>
                    Optimizer
                  </div>
                  <Select
                    value={selectVal}
                    onChange={setSelectVal}
                    options={[
                      { value: 'adamw', label: 'AdamW (Decoupled)' },
                      { value: 'sgd', label: 'SGD + Momentum' },
                      { value: 'rmsprop', label: 'RMSProp' },
                      { value: 'lion', label: 'Lion (Evo-Sign)' }
                    ]}
                  />
                </div>
              </div>
            </PanelBody>
          </Panel>

          {/* Section: Gauges, Modal & Toasts */}
          <Panel variant="raised">
            <PanelHeader
              title="Instruments, Dialogs & Toasts"
              subtitle="Feedback and system communication"
            />
            <PanelBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                <div style={{ textAlign: 'center' }}>
                  <ProgressRing value={progressVal} size={64} strokeWidth={5} />
                  <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginTop: '4px' }}>
                    Epoch 4/5
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <ProgressRing value={100} size={64} strokeWidth={5} color="var(--na-success)" />
                  <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginTop: '4px' }}>
                    Data Cleaned
                  </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <ProgressRing value={25} size={64} strokeWidth={5} color="var(--na-accent-cool)" />
                  <div style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginTop: '4px' }}>
                    GPU Memory
                  </div>
                </div>
              </div>

              <div>
                <Slider
                  label="Gauge Value Tester"
                  value={progressVal}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={setProgressVal}
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--na-space-2)', flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  onClick={() => setModalOpen(true)}
                >
                  Open Explorer Modal
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => addToast('Batch 256 processed. Loss: 1.84', 'info')}
                >
                  Info Toast
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => addToast('Weights checkpoint saved to OPFS.', 'success')}
                >
                  Success Toast
                </Button>

                <Button
                  variant="danger"
                  onClick={() => addToast('Gradient exploded in head 3!', 'danger')}
                >
                  Danger Toast
                </Button>
              </div>
            </PanelBody>
          </Panel>
        </div>
      )}

      {/* Tab 2: Design Tokens & Typography */}
      {activeTab === 'tokens' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-6)' }}>
          <Panel variant="raised">
            <PanelHeader
              title="Typography Scale (Modular)"
              subtitle="Display: Fraunces, UI: IBM Plex Sans, Mono: IBM Plex Mono"
            />
            <PanelBody style={{ display: 'flex', flexDirection: 'column', gap: 'var(--na-space-4)' }}>
              <div>
                <div style={{ fontFamily: 'var(--na-font-display)', fontSize: 'var(--na-text-4xl)', lineHeight: 'var(--na-lh-4xl)' }}>
                  Display 4XL — The Weight of Attention
                </div>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                  Fraunces 700 / 3.0rem (48px)
                </div>
              </div>

              <div>
                <div style={{ fontFamily: 'var(--na-font-display)', fontSize: 'var(--na-text-2xl)', lineHeight: 'var(--na-lh-2xl)' }}>
                  Display 2XL — Mathematical Truth in High Dimensions
                </div>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                  Fraunces 600 / 1.875rem (30px)
                </div>
              </div>

              <div>
                <div style={{ fontFamily: 'var(--na-font-ui)', fontSize: 'var(--na-text-base)', lineHeight: 'var(--na-lh-base)', maxWidth: '750px' }}>
                  UI Base — Every transformer layer learns an inductive bias over its receptive field.
                  In NeuroArena, the explorer manipulates attention heads and token distributions directly through
                  tactile instruments.
                </div>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>
                  IBM Plex Sans 400 / 0.9375rem (15px)
                </div>
              </div>

              <div>
                <pre className="na-code-block">
                  <span className="na-code-comment">// Self-contained Tiny GPT Parameter Layout</span>{'\n'}
                  <span className="na-code-keyword">const</span> <span className="na-code-def">paramOffsets</span> = {'{\n'}
                  {'  '}<span className="na-code-key">wte</span>: <span className="na-code-num">0</span>,                           <span className="na-code-comment">// [vocabSize, dModel]</span>{'\n'}
                  {'  '}<span className="na-code-key">wpe</span>: <span className="na-code-num">131072</span>,                      <span className="na-code-comment">// [contextLen, dModel]</span>{'\n'}
                  {'  '}<span className="na-code-key">blocks</span>: <span className="na-code-num">147456</span>,                   <span className="na-code-comment">// N * (ln1 + attn + ln2 + mlp)</span>{'\n'}
                  {'  '}<span className="na-code-key">ln_f_g</span>: <span className="na-code-num">1048576</span>,                  <span className="na-code-comment">// [dModel]</span>{'\n'}
                  {'  '}<span className="na-code-key">ln_f_b</span>: <span className="na-code-num">1048704</span>                   <span className="na-code-comment">// [dModel]</span>{'\n'}
                  {'};'}
                </pre>
                <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)', marginTop: '4px' }}>
                  IBM Plex Mono 400 / 0.75rem (12px)
                </div>
              </div>
            </PanelBody>
          </Panel>

          {/* Palette Swatches */}
          <Panel variant="raised">
            <PanelHeader
              title="Color Palette Tokens"
              subtitle="Calm, warm, precise. Dark and light theme pairs."
            />
            <PanelBody>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--na-space-3)' }}>
                {[
                  { name: 'ink', var: 'var(--na-ink)', desc: 'Canvas foundation' },
                  { name: 'surface', var: 'var(--na-surface)', desc: 'Primary panel surface' },
                  { name: 'raised', var: 'var(--na-raised)', desc: 'Raised cards & toolbars' },
                  { name: 'line', var: 'var(--na-line)', desc: 'Delicate dividers' },
                  { name: 'line-strong', var: 'var(--na-line-strong)', desc: 'Active outlines' },
                  { name: 'text', var: 'var(--na-text)', desc: 'Primary scholarly text' },
                  { name: 'muted', var: 'var(--na-muted)', desc: 'Secondary annotations' },
                  { name: 'accent (amber)', var: 'var(--na-accent)', desc: 'Lantern amber focus' },
                  { name: 'accent-cool (teal)', var: 'var(--na-accent-cool)', desc: 'Signal teal metrics' },
                  { name: 'success', var: 'var(--na-success)', desc: 'Clean convergence' },
                  { name: 'warning', var: 'var(--na-warning)', desc: 'Drift / Caution' },
                  { name: 'danger', var: 'var(--na-danger)', desc: 'Loss explosion' }
                ].map((color) => (
                  <div
                    key={color.name}
                    style={{
                      border: '1px solid var(--na-line)',
                      borderRadius: 'var(--na-radius-base)',
                      overflow: 'hidden',
                      backgroundColor: 'var(--na-surface)'
                    }}
                  >
                    <div style={{ height: '48px', backgroundColor: color.var, borderBottom: '1px solid var(--na-line)' }} />
                    <div style={{ padding: 'var(--na-space-2)' }}>
                      <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)', fontWeight: 600 }}>
                        {color.name}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--na-muted)' }}>
                        {color.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </div>
      )}

      {/* Tab 3: Iconography */}
      {activeTab === 'icons' && (
        <Panel variant="raised">
          <PanelHeader
            title="Scholarly Explorer's Icon Set"
            subtitle="24px grid, 1.5px stroke, crisp vector geometry"
          />
          <PanelBody>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--na-space-4)' }}>
              {[
                { name: 'dataset', icon: <DatasetIcon size={24} /> },
                { name: 'token', icon: <TokenIcon size={24} /> },
                { name: 'model', icon: <ModelIcon size={24} /> },
                { name: 'train', icon: <TrainIcon size={24} /> },
                { name: 'evaluate', icon: <EvaluateIcon size={24} /> },
                { name: 'clean', icon: <CleanIcon size={24} /> },
                { name: 'scan', icon: <ScanIcon size={24} /> },
                { name: 'journal', icon: <JournalIcon size={24} /> },
                { name: 'settings', icon: <SettingsIcon size={24} /> },
                { name: 'loss', icon: <LossIcon size={24} /> },
                { name: 'attention', icon: <AttentionIcon size={24} /> }
              ].map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--na-space-4)',
                    backgroundColor: 'var(--na-surface)',
                    border: '1px solid var(--na-line)',
                    borderRadius: 'var(--na-radius-md)',
                    gap: 'var(--na-space-2)'
                  }}
                >
                  <div style={{ color: 'var(--na-accent)' }}>{item.icon}</div>
                  <div style={{ fontFamily: 'var(--na-font-mono)', fontSize: 'var(--na-text-xs)' }}>
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          </PanelBody>
        </Panel>
      )}

      {/* Tab 4: ToolWheel Radial Menu */}
      {activeTab === 'toolwheel' && (
        <Panel variant="raised">
          <PanelHeader
            title="ToolWheel — Radial Instrument Menu"
            subtitle="Navigate with Arrow Keys / WASD / Enter, or Analog Gamepad Stick"
          />
          <PanelBody style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--na-space-6)' }}>
            <div style={{ textAlign: 'center', maxWidth: '500px' }}>
              <p style={{ color: 'var(--na-muted)', fontSize: 'var(--na-text-sm)', margin: 0 }}>
                Click or focus the radial instrument below. Use <KeyHint>←</KeyHint> <KeyHint>→</KeyHint> or <KeyHint>A</KeyHint> <KeyHint>D</KeyHint> to rotate, and <KeyHint>Enter</KeyHint> to select.
                Gamepad left thumbstick is automatically polled.
              </p>
            </div>

            <ToolWheel
              items={toolsList}
              selectedId={selectedTool}
              onSelect={(item) => {
                setSelectedTool(item.id);
                addToast(`Equipped tool: ${item.label}`, 'info');
              }}
            />

            <div style={{ display: 'flex', gap: 'var(--na-space-3)', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--na-text-xs)', color: 'var(--na-muted)' }}>Equipped Tool:</span>
              <Badge variant="accent" dot>
                {toolsList.find((t) => t.id === selectedTool)?.label}
              </Badge>
            </div>
          </PanelBody>
        </Panel>
      )}

      {/* Interactive Modal Instance */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Scholarly Explorer's Log"
        subtitle="SECTOR 04 — UNCHARTED EMBEDDING SPACE"
        footer={
          <div style={{ display: 'flex', gap: 'var(--na-space-2)' }}>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Dismiss
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setModalOpen(false);
                addToast('Log entry recorded into explorer journal.', 'success');
              }}
            >
              Record Entry
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 'var(--na-text-sm)', lineHeight: 'var(--na-lh-base)', margin: 0 }}>
          The terrain features steep gradient valleys along the manifold boundary. By lowering
          the learning rate from 1e-3 to 3e-4, residual stream oscillations were dampened without
          inducing plateaus. All weights are synchronized with the GPU storage buffer.
        </p>
        <div style={{ marginTop: 'var(--na-space-4)', display: 'flex', gap: 'var(--na-space-2)' }}>
          <Badge variant="clean">Clean Gradient</Badge>
          <Badge variant="accent">Epoch 4</Badge>
        </div>
      </Modal>
    </div>
  );
};

export const UILabGallery: React.FC = () => {
  return (
    <ToastProvider>
      <GalleryContent />
    </ToastProvider>
  );
};
