/**
 * THE SLATE: Diegetic Telemetry Component.
 * 
 * A chalkboard on a wooden easel beside the campfire:
 * - Live train (amber) and validation (teal) loss curves.
 * - Bigram (3.286) and Trigram (2.834) dashed chalk guidelines.
 * - Current step / max steps, training tokens/s, and ETA.
 * - Uses high-DPI HTML CanvasTexture mapped onto a framed wooden slate easel.
 */

import * as THREE from 'three/webgpu';
import { CampStepStats } from './campScene.js';

export class CampSlate {
  public group: THREE.Group;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private boardMesh: THREE.Mesh;
  private history: CampStepStats[] = [];
  private needsRedraw = true;

  constructor() {
    this.group = new THREE.Group();

    // 1. Canvas Texture Setup (1024 x 640 high resolution canvas)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 640;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.generateMipmaps = true;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;

    // 2. Easel Wooden Stand
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.75,
      metalness: 0.1
    });

    // 3 Legs of Easel
    const legGeo = new THREE.BoxGeometry(0.04, 1.8, 0.04);
    const leftLeg = new THREE.Mesh(legGeo, woodMat);
    leftLeg.position.set(-0.55, 0.9, -0.1);
    leftLeg.rotation.z = -0.12;
    this.group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, woodMat);
    rightLeg.position.set(0.55, 0.9, -0.1);
    rightLeg.rotation.z = 0.12;
    this.group.add(rightLeg);

    const backLeg = new THREE.Mesh(legGeo, woodMat);
    backLeg.position.set(0, 0.85, -0.45);
    backLeg.rotation.x = -0.28;
    this.group.add(backLeg);

    // Cross shelf
    const shelfGeo = new THREE.BoxGeometry(1.4, 0.04, 0.08);
    const shelf = new THREE.Mesh(shelfGeo, woodMat);
    shelf.position.set(0, 0.72, 0.02);
    this.group.add(shelf);

    // 3. Chalkboard Frame & Slate Surface
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 1.25, 0.0);
    boardGroup.rotation.x = -0.12; // Slight easel tilt

    // Wooden Frame
    const frameGeo = new THREE.BoxGeometry(1.36, 0.88, 0.035);
    const frameMesh = new THREE.Mesh(frameGeo, woodMat);
    boardGroup.add(frameMesh);

    // Chalkboard Face
    const slateGeo = new THREE.PlaneGeometry(1.28, 0.80);
    const slateMat = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.9,
      metalness: 0.05
    });
    this.boardMesh = new THREE.Mesh(slateGeo, slateMat);
    this.boardMesh.position.z = 0.02;
    boardGroup.add(this.boardMesh);

    this.group.add(boardGroup);

    this.drawInitialChalkboard();
  }

  public updateStats(stats: CampStepStats): void {
    this.history.push(stats);
    if (this.history.length > 250) {
      this.history.shift();
    }
    this.needsRedraw = true;
  }

  public render(): void {
    if (!this.needsRedraw) return;
    this.needsRedraw = false;
    this.drawChalkboard();
    this.texture.needsUpdate = true;
  }

  private drawInitialChalkboard(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Dark charcoal slate background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 26px monospace';
    ctx.fillText('NEUROARENA // LIVE LOSS SLATE', 40, 50);

    ctx.fillStyle = '#64748b';
    ctx.font = '18px monospace';
    ctx.fillText('Awaiting training telemetry stream...', 40, 120);
    this.texture.needsUpdate = true;
  }

  private drawChalkboard(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Slate Background with subtle chalk texture
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, w, h);

    // 2. Header Status Line
    const latest = this.history[this.history.length - 1];
    const step = latest ? latest.step : 0;
    const maxSteps = latest ? latest.maxSteps : 500;
    const trainLoss = latest ? latest.trainLoss : 0;
    const valLoss = latest ? latest.valLoss : 0;
    const tps = latest ? Math.round(latest.tokensPerSec || 0) : 0;
    const eta = latest ? Math.round(latest.etaSeconds || 0) : 0;

    // Title and step
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`TRAINING SLATE // STEP ${step} / ${maxSteps}`, 40, 48);

    // Metrics Pill
    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`Train: ${trainLoss ? trainLoss.toFixed(3) : '--'}`, 580, 48);

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Val: ${valLoss ? valLoss.toFixed(3) : '--'}`, 760, 48);

    // Speed & ETA subhead
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText(`SPEED: ${tps.toLocaleString()} tok/s   |   ETA: ${eta}s`, 40, 82);

    // Step Progress Bar
    const barW = w - 80;
    const totalSteps = maxSteps ?? 250;
    const barProgress = totalSteps > 0 ? Math.min(1.0, step / totalSteps) : 0;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(40, 96, barW, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(40, 96, barW * barProgress, 8);

    // 3. Loss Plot Area
    const plotX = 70;
    const plotY = 140;
    const plotW = w - 120;
    const plotH = h - 190;

    // Chalk Grid Box
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    // Determine scale: 1.5 to 5.5
    const minLoss = 1.8;
    const maxLoss = 5.2;

    const getY = (val: number) => {
      const norm = (val - minLoss) / (maxLoss - minLoss);
      return plotY + plotH * (1 - Math.max(0, Math.min(1, norm)));
    };

    // Y Axis gridlines
    ctx.fillStyle = '#64748b';
    ctx.font = '13px monospace';
    ctx.textAlign = 'right';
    for (let l = 2.0; l <= 5.0; l += 1.0) {
      const gy = getY(l);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.beginPath();
      ctx.moveTo(plotX, gy);
      ctx.lineTo(plotX + plotW, gy);
      ctx.stroke();
      ctx.fillText(l.toFixed(1), plotX - 8, gy + 4);
    }

    // 4. Target Baseline Guidelines
    // Trigram (2.834)
    const triY = getY(2.834);
    ctx.strokeStyle = '#38bdf8';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(plotX, triY);
    ctx.lineTo(plotX + plotW, triY);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'right';
    ctx.fillText('TRIGRAM (2.834) - TIER 3 GATE', plotX + plotW - 10, triY - 6);

    // Bigram (3.286)
    const biY = getY(3.286);
    ctx.strokeStyle = '#f59e0b';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(plotX, biY);
    ctx.lineTo(plotX + plotW, biY);
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('BIGRAM (3.286) - TIER 2 GATE', plotX + plotW - 10, biY - 6);
    ctx.setLineDash([]);

    // 5. Draw Loss Curves
    if (this.history.length >= 2) {
      const getX = (idx: number) => {
        return plotX + (idx / (this.history.length - 1)) * plotW;
      };

      // Train Loss Curve (Warm Amber Chalk)
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 3;
      ctx.beginPath();
      this.history.forEach((pt, i) => {
        const x = getX(i);
        const y = getY(pt.trainLoss);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Val Loss Curve (Signal Teal Chalk)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      let hasVal = false;
      this.history.forEach((pt, i) => {
        if (pt.valLoss && pt.valLoss > 0) {
          const x = getX(i);
          const y = getY(pt.valLoss);
          if (!hasVal) {
            ctx.moveTo(x, y);
            hasVal = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      if (hasVal) ctx.stroke();
    }
  }

  public dispose(): void {
    this.texture.dispose();
    this.boardMesh.geometry.dispose();
    (this.boardMesh.material as THREE.Material).dispose();
  }
}
