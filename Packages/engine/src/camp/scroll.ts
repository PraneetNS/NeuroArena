/**
 * THE SCROLL: Diegetic Telemetry Component.
 * 
 * An ancient unrolled parchment resting on the Camp workbench:
 * - Animated feather quill / ink pen that scribes text line by line.
 * - At every checkpoint, writes the fixed prompt and the model's generated sample.
 * - Previous samples stay above so the player can read the magical progression
 *   from initial character noise/gibberish to emergent English language!
 * - High-DPI canvas texture with aged parchment styling.
 */

import * as THREE from 'three/webgpu';
import { CampSample } from './campScene.js';

export class CampScroll {
  public group: THREE.Group;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private scrollMesh: THREE.Mesh;
  private quillGroup: THREE.Group;

  private samples: CampSample[] = [];
  private currentWritingText = '';
  private targetFullText = '';
  private charWriteTimer = 0;
  private isWriting = false;
  private penProgressX = 0;
  private penProgressY = 0;

  constructor() {
    this.group = new THREE.Group();

    // 1. Canvas Texture Setup (Aged parchment aspect ratio 768 x 1024)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 768;
    this.canvas.height = 1024;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.generateMipmaps = true;

    // 2. Unrolled Parchment Geometry
    // Subtle curl at top and bottom edges
    const scrollGeo = new THREE.PlaneGeometry(0.72, 0.96, 16, 16);
    // Add slight curl by bending z coordinates at ends
    const pos = scrollGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0.40) {
        const d = (y - 0.40) * 10;
        pos.setZ(i, Math.sin(d) * 0.02);
      } else if (y < -0.40) {
        const d = (-y - 0.40) * 10;
        pos.setZ(i, Math.sin(d) * 0.02);
      }
    }
    scrollGeo.computeVertexNormals();

    const scrollMat = new THREE.MeshStandardMaterial({
      map: this.texture,
      roughness: 0.85,
      metalness: 0.05
    });
    this.scrollMesh = new THREE.Mesh(scrollGeo, scrollMat);
    this.scrollMesh.rotation.x = -Math.PI / 2; // Lies flat on workbench table
    this.group.add(this.scrollMesh);

    // Roll cylinder weights at top and bottom
    const woodWeightMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 });
    const rollGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.76, 16);
    rollGeo.rotateZ(Math.PI / 2);

    const topRoll = new THREE.Mesh(rollGeo, woodWeightMat);
    topRoll.position.set(0, 0.018, -0.48);
    this.group.add(topRoll);

    const bottomRoll = new THREE.Mesh(rollGeo, woodWeightMat);
    bottomRoll.position.set(0, 0.018, 0.48);
    this.group.add(bottomRoll);

    // 3. Animated Feather Quill / Pen
    this.quillGroup = new THREE.Group();
    // Feather shaft (slender cone)
    const shaftGeo = new THREE.CylinderGeometry(0.003, 0.008, 0.28, 8);
    shaftGeo.translate(0, 0.14, 0);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.z = 0.35;
    shaft.rotation.x = -0.25;
    this.quillGroup.add(shaft);

    // Feather vane
    const vaneGeo = new THREE.PlaneGeometry(0.045, 0.16);
    vaneGeo.translate(0.025, 0.20, 0);
    const vaneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8, side: THREE.DoubleSide });
    const vane = new THREE.Mesh(vaneGeo, vaneMat);
    vane.rotation.z = 0.35;
    vane.rotation.x = -0.25;
    this.quillGroup.add(vane);

    this.quillGroup.position.set(0.12, 0.02, 0.15);
    this.group.add(this.quillGroup);

    this.drawInitialParchment();
  }

  public addSample(sample: CampSample): void {
    this.samples.push(sample);
    if (this.samples.length > 5) {
      this.samples.shift(); // Keep latest 5 checkpoints
    }

    // Start animated scribing of latest sample
    this.targetFullText = sample.output;
    this.currentWritingText = '';
    this.isWriting = true;
    this.charWriteTimer = 0;
  }

  public update(dt: number, timeSec: number): void {
    if (this.isWriting) {
      this.charWriteTimer += dt;
      // Write ~25 characters per second
      const targetChars = Math.floor(this.charWriteTimer * 28.0);
      if (targetChars <= this.targetFullText.length) {
        this.currentWritingText = this.targetFullText.slice(0, targetChars);
        this.drawParchment();
        this.texture.needsUpdate = true;

        // Animate pen tip hovering and scribing
        const penJitter = Math.sin(timeSec * 45.0) * 0.004;
        this.quillGroup.position.x = this.penProgressX + penJitter;
        this.quillGroup.position.z = this.penProgressY + (Math.cos(timeSec * 35.0) * 0.003);
        this.quillGroup.position.y = 0.015 + Math.abs(Math.sin(timeSec * 30.0)) * 0.008;
      } else {
        this.currentWritingText = this.targetFullText;
        this.isWriting = false;
        this.drawParchment();
        this.texture.needsUpdate = true;
        // Rest pen in ink stand position
        this.quillGroup.position.set(0.28, 0.02, 0.38);
      }
    } else {
      // Idle pen breathing
      this.quillGroup.position.y = 0.02 + Math.sin(timeSec * 1.5) * 0.003;
    }
  }

  private drawInitialParchment(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Aged warm sepia parchment tone
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(0, 0, w, h);

    // Weathered border
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 24px "Fraunces", serif';
    ctx.fillText('THE GENERATIVE CHRONICLE', 44, 65);

    ctx.fillStyle = '#92400e';
    ctx.font = 'italic 16px serif';
    ctx.fillText('Tracking language emergence from token entropy...', 44, 95);

    ctx.fillStyle = '#b45309';
    ctx.font = '16px monospace';
    ctx.fillText('Awaiting first model checkpoint sample...', 44, 180);

    this.texture.needsUpdate = true;
  }

  private drawParchment(): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Background
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(0, 0, w, h);

    // Delicate border
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, w - 48, h - 48);

    // Header
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 22px serif';
    ctx.textAlign = 'left';
    ctx.fillText('THE GENERATIVE CHRONICLE', 44, 58);

    ctx.fillStyle = '#92400e';
    ctx.font = 'italic 14px serif';
    ctx.fillText('Fixed Prompt: "Shall I compare thee to a summer day?"', 44, 84);

    ctx.strokeStyle = 'rgba(180, 83, 9, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(44, 96);
    ctx.lineTo(w - 44, 96);
    ctx.stroke();

    let curY = 130;

    // Render historical samples
    for (let idx = 0; idx < this.samples.length; idx++) {
      const s = this.samples[idx];
      const isLatest = idx === this.samples.length - 1;
      const textToRender = isLatest ? this.currentWritingText : s.output;

      // Checkpoint label badge
      const pplStr = s.perplexity !== undefined ? s.perplexity.toFixed(1) : '--';
      ctx.fillText(`[CHECKPOINT • STEP ${s.checkpointStep} | PPL: ${pplStr}]`, 44, curY);
      curY += 24;

      // Wrap and render text lines
      ctx.fillStyle = isLatest ? '#1e293b' : '#64748b';
      ctx.font = '16px monospace';
      const words = textToRender.split(' ');
      let line = '';
      const maxLineWidth = w - 90;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxLineWidth && n > 0) {
          ctx.fillText(line, 54, curY);
          line = words[n] + ' ';
          curY += 22;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, 54, curY);

      // Track last line pen position
      if (isLatest) {
        const lastLineWidth = ctx.measureText(line).width;
        // Map 2D canvas pixel coordinates to 3D scroll surface (-0.36 to +0.36 X, -0.48 to +0.48 Z)
        this.penProgressX = -0.32 + (lastLineWidth / w) * 0.64;
        this.penProgressY = -0.42 + (curY / h) * 0.84;
      }

      curY += 36;
      if (curY > h - 40) break;
    }
  }

  public dispose(): void {
    this.texture.dispose();
    this.scrollMesh.geometry.dispose();
    (this.scrollMesh.material as THREE.Material).dispose();
  }
}
