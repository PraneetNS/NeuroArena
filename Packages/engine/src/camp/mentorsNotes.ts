/**
 * THE MENTOR'S NOTES: Diegetic Telemetry Component.
 * 
 * A wooden notice board set behind the workbench:
 * - Findings from diagnose() appear as pinned parchment notes on the board.
 * - Severity colouring: Red pin/badge for Critical, Amber for Warning, Cyan for Info.
 * - 2-sentence diagnostic explanation and suggested-fix tags.
 * - High-DPI canvas texture mapped to a 3D board geometry.
 */

import * as THREE from 'three/webgpu';
import { Finding } from '@na/ml-core';

export class MentorsNotes {
  public group: THREE.Group;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private boardMesh: THREE.Mesh;
  private findings: Finding[] = [];
  private needsRedraw = true;

  constructor() {
    this.group = new THREE.Group();

    // 1. High-DPI Canvas (1024 x 768)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 768;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.generateMipmaps = true;

    // 2. Wooden Board Frame & Twin Support Posts
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.8,
      metalness: 0.1
    });

    const postGeo = new THREE.BoxGeometry(0.08, 2.2, 0.08);
    const leftPost = new THREE.Mesh(postGeo, woodMat);
    leftPost.position.set(-0.85, 1.1, -0.05);
    this.group.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, woodMat);
    rightPost.position.set(0.85, 1.1, -0.05);
    this.group.add(rightPost);

    // Board Frame
    const frameGeo = new THREE.BoxGeometry(1.82, 1.34, 0.05);
    const frameMesh = new THREE.Mesh(frameGeo, woodMat);
    frameMesh.position.set(0, 1.45, 0);
    this.group.add(frameMesh);

    // Cork/Parchment Board Face
    const boardGeo = new THREE.PlaneGeometry(1.72, 1.24);
    const boardMat = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.9,
      metalness: 0.02
    });
    this.boardMesh = new THREE.Mesh(boardGeo, boardMat);
    this.boardMesh.position.set(0, 1.45, 0.03);
    this.group.add(this.boardMesh);

    this.drawInitialBoard();
  }

  public updateFindings(findings: Finding[]): void {
    this.findings = findings || [];
    this.needsRedraw = true;
  }

  public render(): void {
    if (!this.needsRedraw) return;
    this.needsRedraw = false;
    this.drawBoard();
    this.texture.needsUpdate = true;
  }

  private drawInitialBoard(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Warm cork background
    ctx.fillStyle = '#1e1b18';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 26px "Fraunces", serif';
    ctx.fillText("MENTOR'S DIAGNOSTIC BOARD", 50, 60);

    ctx.fillStyle = '#78716c';
    ctx.font = '16px monospace';
    ctx.fillText('All training diagnostics nominal. No failure patterns detected.', 50, 130);
    this.texture.needsUpdate = true;
  }

  private drawBoard(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Dark aged corkboard background
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, w, h);

    // Title Header
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 26px serif';
    ctx.textAlign = 'left';
    ctx.fillText("THE MENTOR'S NOTES // FAILURE TAXONOMY", 50, 56);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 72);
    ctx.lineTo(w - 50, 72);
    ctx.stroke();

    if (this.findings.length === 0) {
      // Nominal state card
      ctx.fillStyle = '#292524';
      ctx.fillRect(50, 110, w - 100, 120);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('● ALL SUBSYSTEMS HEALTHY', 80, 155);

      ctx.fillStyle = '#a8a29e';
      ctx.font = '16px monospace';
      ctx.fillText('No divergence, gradient vanishing, or attention collapse observed.', 80, 190);
      return;
    }

    // Render up to 3 pinned findings as pinned notes
    const cards = this.findings.slice(0, 3);
    const cardW = (w - 140) / Math.max(1, cards.length);

    cards.forEach((finding, idx) => {
      const cardX = 50 + idx * (cardW + 20);
      const cardY = 110;
      const cardH = h - 160;

      // Note background
      ctx.fillStyle = '#292524';
      ctx.fillRect(cardX, cardY, cardW, cardH);

      // Severity pin & border
      let pinColor = '#38bdf8';
      let badgeText = 'INFO';
      if (finding.severity === 'critical') {
        pinColor = '#ef4444';
        badgeText = 'CRITICAL';
      } else if (finding.severity === 'warn') {
        pinColor = '#f59e0b';
        badgeText = 'WARNING';
      }

      ctx.strokeStyle = pinColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(cardX, cardY, cardW, cardH);

      // Pushpin at top center
      ctx.fillStyle = pinColor;
      ctx.beginPath();
      ctx.arc(cardX + cardW / 2, cardY + 12, 6, 0, Math.PI * 2);
      ctx.fill();

      // Severity Badge
      ctx.fillStyle = pinColor;
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`[${badgeText}]`, cardX + 16, cardY + 36);

      // Title
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(finding.title || 'Diagnostic Finding', cardX + 16, cardY + 64);

      // 2-sentence explanation (wrapped)
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '13px sans-serif';
      const text = finding.plainExplanation || (finding as any).explanation || 'Anomaly detected during backpropagation step.';
      const words = text.split(' ');
      let line = '';
      let textY = cardY + 95;
      const maxW = cardW - 32;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const m = ctx.measureText(testLine);
        if (m.width > maxW && n > 0) {
          ctx.fillText(line, cardX + 16, textY);
          line = words[n] + ' ';
          textY += 20;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, cardX + 16, textY);

      // Suggested Fix Tag Box
      const firstFix = finding.suggestedFixes?.[0] || (finding as any).suggestedFix;
      if (firstFix) {
        const fixY = cardY + cardH - 80;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(cardX + 16, fixY, cardW - 32, 58);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.strokeRect(cardX + 16, fixY, cardW - 32, 58);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('RECOMMENDED ACTION:', cardX + 24, fixY + 20);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px sans-serif';
        const fixText = firstFix.label || (firstFix as any).actionDescription || 'Tune hyperparameter in Workbench';
        ctx.fillText(fixText.slice(0, 38) + (fixText.length > 38 ? '...' : ''), cardX + 24, fixY + 42);
      }
    });
  }

  public dispose(): void {
    this.texture.dispose();
    this.boardMesh.geometry.dispose();
    (this.boardMesh.material as THREE.Material).dispose();
  }
}
