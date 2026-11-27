/**
 * Global React Error Boundary & Anomaly Recovery Screen.
 * Catches unhandled UI / rendering exceptions, captures diagnostic error logs,
 * offers recovery actions (Restart, Export Emergency Save, Hardware Report),
 * and prevents raw stack traces from exposing confusing internals to players.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  onExportEmergencySave?: () => void;
  onOpenDiagnostics?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string;
  sanitizedMessage: string;
  showTechnicalDetails: boolean;
  copiedDetails: boolean;
}

export class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: '',
      sanitizedMessage: '',
      showTechnicalDetails: false,
      copiedDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = `ERR-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString(36).toUpperCase()}`;
    
    // Sanitize technical messages for players
    let sanitizedMessage = 'An unexpected neural matrix anomaly interrupted the simulation.';
    const msg = error?.message || '';

    if (msg.includes('WebGPU') || msg.includes('GPUAdapter') || msg.includes('GPUDevice')) {
      sanitizedMessage = 'The WebGPU graphics accelerator encountered a device disruption.';
    } else if (msg.includes('SharedArrayBuffer') || msg.includes('crossOriginIsolated')) {
      sanitizedMessage = 'Cross-Origin memory isolation is restricted or disabled.';
    } else if (msg.includes('QuotaExceededError') || msg.includes('quota')) {
      sanitizedMessage = 'Browser storage quota was exceeded while persisting model state.';
    } else if (msg.includes('NetworkError') || msg.includes('Failed to fetch')) {
      sanitizedMessage = 'A required asset or model checkpoint failed to stream.';
    }

    return {
      hasError: true,
      error,
      errorId,
      sanitizedMessage
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[NeuroArena] Global Error Boundary caught unhandled exception:', error, errorInfo);
    // Push error to session diagnostic history for playtest feedback export
    if (typeof window !== 'undefined') {
      const existing = (window as any).__na_error_log || [];
      existing.push({
        timestamp: new Date().toISOString(),
        errorId: this.state.errorId,
        message: error?.message,
        componentStack: errorInfo?.componentStack
      });
      (window as any).__na_error_log = existing;
    }
  }

  handleRestart = () => {
    window.location.reload();
  };

  handleCopyDetails = () => {
    const details = {
      errorId: this.state.errorId,
      sanitizedMessage: this.state.sanitizedMessage,
      rawMessage: this.state.error?.message,
      stack: this.state.error?.stack,
      userAgent: navigator.userAgent,
      time: new Date().toISOString()
    };
    navigator.clipboard?.writeText(JSON.stringify(details, null, 2)).then(() => {
      this.setState({ copiedDetails: true });
      setTimeout(() => this.setState({ copiedDetails: false }), 2000);
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'var(--na-ground, #060913)',
            color: 'var(--na-text, #E8E4DA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--na-space-5, 20px)',
            fontFamily: 'var(--na-font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)'
          }}
        >
          <div
            style={{
              maxWidth: '640px',
              width: '100%',
              backgroundColor: 'var(--na-surface, #111722)',
              border: '1px solid var(--na-danger, #D9564A)',
              borderRadius: 'var(--na-radius-md, 8px)',
              padding: 'var(--na-space-6, 24px)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--na-space-4, 16px)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--na-radius-sm, 4px)',
                  backgroundColor: 'var(--na-danger-muted, rgba(217, 86, 74, 0.15))',
                  color: 'var(--na-danger, #D9564A)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 700
                }}
              >
                ⚠
              </div>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--na-text, #E8E4DA)' }}>
                  Simulation Interrupted
                </h1>
                <div style={{ fontSize: '11px', fontFamily: 'var(--na-font-mono, monospace)', color: 'var(--na-muted, #7E8B9B)', marginTop: '2px' }}>
                  Incident Code: <span style={{ color: 'var(--na-accent-warm, #E8A33D)' }}>{this.state.errorId}</span>
                </div>
              </div>
            </div>

            {/* Sanitized Message */}
            <p style={{ fontSize: '0.92rem', color: 'var(--na-text-secondary, #B8C2CC)', lineHeight: 1.5, margin: 0 }}>
              {this.state.sanitizedMessage}
            </p>

            <div
              style={{
                fontSize: '11px',
                color: 'var(--na-muted, #7E8B9B)',
                backgroundColor: 'var(--na-raised, #0B0F19)',
                padding: '10px 14px',
                borderRadius: 'var(--na-radius-sm, 4px)',
                border: '1px solid var(--na-line, #1E2735)',
                lineHeight: 1.4
              }}
            >
              <strong>Data Safety Note:</strong> Your local vault shards and training checkpoints are persisted in browser storage and were not erased. You can restart or export an emergency save below.
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                onClick={this.handleRestart}
                style={{
                  flex: 1,
                  minWidth: '140px',
                  backgroundColor: 'var(--na-accent, #E8A33D)',
                  color: 'var(--na-ink, #060913)',
                  border: 'none',
                  borderRadius: 'var(--na-radius-sm, 4px)',
                  padding: '10px 16px',
                  fontWeight: 700,
                  fontSize: '13px',
                  fontFamily: 'var(--na-font-mono, monospace)',
                  cursor: 'pointer'
                }}
              >
                ⟳ Restart Simulation
              </button>

              {this.props.onExportEmergencySave && (
                <button
                  onClick={this.props.onExportEmergencySave}
                  style={{
                    backgroundColor: 'var(--na-raised, #0B0F19)',
                    color: 'var(--na-text, #E8E4DA)',
                    border: '1px solid var(--na-line, #1E2735)',
                    borderRadius: 'var(--na-radius-sm, 4px)',
                    padding: '10px 14px',
                    fontSize: '12px',
                    fontFamily: 'var(--na-font-mono, monospace)',
                    cursor: 'pointer'
                  }}
                >
                  💾 Export Emergency Save
                </button>
              )}

              {this.props.onOpenDiagnostics && (
                <button
                  onClick={this.props.onOpenDiagnostics}
                  style={{
                    backgroundColor: 'var(--na-raised, #0B0F19)',
                    color: 'var(--na-accent-cool, #4FB3A9)',
                    border: '1px solid var(--na-accent-cool, #4FB3A9)',
                    borderRadius: 'var(--na-radius-sm, 4px)',
                    padding: '10px 14px',
                    fontSize: '12px',
                    fontFamily: 'var(--na-font-mono, monospace)',
                    cursor: 'pointer'
                  }}
                >
                  ⚙ Hardware Report
                </button>
              )}
            </div>

            {/* Expandable Technical Details (Sanitized, no raw stack trace by default) */}
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--na-line, #1E2735)', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => this.setState({ showTechnicalDetails: !this.state.showTechnicalDetails })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--na-muted, #7E8B9B)',
                    fontSize: '11px',
                    fontFamily: 'var(--na-font-mono, monospace)',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {this.state.showTechnicalDetails ? '▾ Hide Technical Diagnostics' : '▸ Show Technical Diagnostics'}
                </button>
                {this.state.showTechnicalDetails && (
                  <button
                    onClick={this.handleCopyDetails}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--na-accent-cool, #4FB3A9)',
                      fontSize: '11px',
                      fontFamily: 'var(--na-font-mono, monospace)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {this.state.copiedDetails ? '✓ Copied JSON' : '📋 Copy for Bug Report'}
                  </button>
                )}
              </div>

              {this.state.showTechnicalDetails && (
                <pre
                  style={{
                    marginTop: '8px',
                    backgroundColor: 'var(--na-ground, #060913)',
                    border: '1px solid var(--na-line, #1E2735)',
                    borderRadius: 'var(--na-radius-sm, 4px)',
                    padding: '10px',
                    fontFamily: 'var(--na-font-mono, monospace)',
                    fontSize: '10px',
                    color: 'var(--na-text-secondary, #B8C2CC)',
                    overflowX: 'auto',
                    maxHeight: '160px',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.4
                  }}
                >
                  {`Error ID: ${this.state.errorId}\n` +
                    `Summary: ${this.state.error?.message || 'Unknown error'}\n` +
                    `Timestamp: ${new Date().toISOString()}`}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
