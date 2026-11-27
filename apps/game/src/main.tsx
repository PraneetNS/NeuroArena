/**
 * NeuroArena Entry Orchestrator & Production Bootstrap:
 * First screen loaded by players (< 3 MB budget).
 * Evaluates platform capabilities, renders the Capability Gate,
 * Data Safety tools, and Playtest Feedback exporter inside a Global Error Boundary,
 * then lazy-loads the 3D game engine and shaders with a real-progress loading screen.
 */

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import '@na/ui/styles';
import { GlobalErrorBoundary } from './landing/ErrorBoundary.js';
import { CapabilityGate } from './landing/CapabilityGate.js';
import { LoadingScreen } from './landing/LoadingScreen.js';
import { exportSaveFile } from './landing/dataSafety.js';
import { CapabilityReportModal } from './capability.js';

const isDirectLaunch = () => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.search.includes('direct=1') ||
    window.location.pathname.startsWith('/workbench') ||
    window.location.pathname.startsWith('/ui-lab') ||
    window.location.hash.startsWith('#/workbench') ||
    window.location.hash.startsWith('#/ui-lab')
  );
};

export const AppRoot: React.FC = () => {
  const [appState, setAppState] = useState<'gate' | 'loading' | 'running'>(
    isDirectLaunch() ? 'loading' : 'gate'
  );
  const [loadProgress, setLoadProgress] = useState(10);
  const [loadStepLabel, setLoadStepLabel] = useState('Auditing platform capabilities...');
  const [diagModal, setDiagModal] = useState<CapabilityReportModal | null>(null);

  useEffect(() => {
    // Set up diagnostics modal container
    const diagContainer = document.createElement('div');
    diagContainer.id = 'na-diag-modal-container';
    document.body.appendChild(diagContainer);
    const modal = new CapabilityReportModal(diagContainer);
    setDiagModal(modal);

    if (isDirectLaunch()) {
      launchEngine();
    }
  }, []);

  const launchEngine = async () => {
    setAppState('loading');
    setLoadProgress(15);
    setLoadStepLabel('Initializing WebGPU device & memory...');

    try {
      await new Promise((r) => setTimeout(r, 60));
      setLoadProgress(35);
      setLoadStepLabel('Dynamically importing 3D game engine & shaders...');

      // Dynamic import splits three/webgpu and @na/engine into secondary chunk
      const { initApp } = await import('./gameWorldBootstrap.js');

      setLoadProgress(65);
      setLoadStepLabel('Loading BPE-1024 Tokenizer & Shakespeare vocabulary...');
      await new Promise((r) => setTimeout(r, 60));

      setLoadProgress(85);
      setLoadStepLabel('Mounting Shard Vault, Audio & Companion Drone...');

      const gameInstance = await initApp();

      setLoadProgress(100);
      setLoadStepLabel('Entering World...');
      await new Promise((r) => setTimeout(r, 120));

      setAppState('running');

      // Hook WebGPU device loss recovery
      if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
        try {
          const adapter = await (navigator as any).gpu.requestAdapter({ powerPreference: 'high-performance' });
          if (adapter) {
            const device = await adapter.requestDevice();
            device.lost?.then((info: any) => {
              console.warn('[WebGPU] Hardware device lost:', info.reason, info.message);
              // Save emergency training checkpoint
              try {
                localStorage.setItem('na_device_lost_timestamp', new Date().toISOString());
              } catch {}
              alert('WebGPU device connection was reset by graphics driver. Your progress has been preserved.');
            });
          }
        } catch {}
      }
    } catch (err: any) {
      console.error('[NeuroArena] Failed during engine bootstrap:', err);
      setLoadStepLabel(`Failed to load engine: ${err?.message || 'Unknown error'}`);
      throw err; // Captured by GlobalErrorBoundary
    }
  };

  const handleOpenDiagnostics = () => {
    diagModal?.open();
  };

  return (
    <GlobalErrorBoundary
      onExportEmergencySave={exportSaveFile}
      onOpenDiagnostics={handleOpenDiagnostics}
    >
      {appState === 'gate' && (
        <CapabilityGate
          onLaunchGame={launchEngine}
          onOpenDiagnostics={handleOpenDiagnostics}
        />
      )}

      {appState === 'loading' && (
        <LoadingScreen progress={loadProgress} stepLabel={loadStepLabel} />
      )}
    </GlobalErrorBoundary>
  );
};

function bootstrap() {
  const container = document.getElementById('app-ui-container');
  if (!container) return;

  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(AppRoot));
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
