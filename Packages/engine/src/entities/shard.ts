/**
 * Collectible 3D Neural Data Shard as stylized art:
 * Floating text glyph clusters that visibly carry real words and letters from the page.
 * Pre-scan visual telemetry driven by computed Lens signals (hidden-tag invariant strictly preserved):
 * - Noisy pages: high-frequency jitter, opacity flicker, spark flutter.
 * - Duplicates: faint trailing echo meshes pulsing behind.
 * - Boilerplate pages: rigid rectangular signboard formation.
 * - Off-domain pages: alternate rune/symbol glyph cards and hue shift.
 */

import * as THREE from 'three/webgpu';

export interface ShardData {
  id: string;
  title: string;
  sector: string;
  text: string;
  category: 'dialogue' | 'lore' | 'logic';
  signals?: {
    nonAlphabeticRatio?: number;
    repetitionScore?: number;
    surpriseScore?: number;
    dictionaryHitRate?: number;
    uppercaseRatio?: number;
  };
}

/**
 * Creates a glowing canvas texture displaying actual text fragments from the shard.
 */
function createGlyphCardTexture(
  words: string,
  colorHex: string,
  fontType: 'fraunces' | 'mono' | 'rune' = 'mono'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Clear transparent
    ctx.clearRect(0, 0, 256, 64);

    // Rounded pill background card
    const r = 10;
    const x = 4;
    const y = 4;
    const w = 248;
    const h = 56;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colorHex;
    ctx.stroke();

    // Subtle inner accent dot
    ctx.beginPath();
    ctx.arc(18, 32, 4, 0, Math.PI * 2);
    ctx.fillStyle = colorHex;
    ctx.fill();

    // Text rendering with glow
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#f8fafc';

    let fontSpec = '600 20px "IBM Plex Mono", monospace';
    if (fontType === 'fraunces') {
      fontSpec = '600 21px Fraunces, serif';
    } else if (fontType === 'rune') {
      fontSpec = '500 22px "Segoe UI Symbol", sans-serif';
    }
    ctx.font = fontSpec;
    ctx.textBaseline = 'middle';

    // Ellipsize words if exceeding width
    let display = words;
    if (ctx.measureText(display).width > 200) {
      while (display.length > 3 && ctx.measureText(display + '…').width > 200) {
        display = display.slice(0, -1);
      }
      display += '…';
    }
    ctx.fillText(display, 30, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class NeuralShard {
  public data: ShardData;
  public group: THREE.Group;
  public isCollected = false;
  public initialPosition: THREE.Vector3;

  private outerMesh: THREE.Mesh;
  private innerMesh: THREE.Mesh;
  private glyphPlates: THREE.Mesh[] = [];
  private echoPlates: THREE.Mesh[] = [];
  private light: THREE.PointLight;
  private animOffset = Math.random() * Math.PI * 2;
  private unfoldProgress = 0;

  constructor(data: ShardData, position: THREE.Vector3) {
    this.data = data;
    this.initialPosition = position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // Color based on category using design-system tokens
    let colorVal = 0x4fb3a9; // Signal Teal for dialogue
    let colorHex = '#4FB3A9';
    let fontType: 'fraunces' | 'mono' | 'rune' = 'mono';

    if (data.category === 'lore') {
      colorVal = 0x8e9aaf; // Archival slate for lore
      colorHex = '#8E9AAF';
      fontType = 'fraunces';
    } else if (data.category === 'logic') {
      colorVal = 0xe8a33d; // Accent Amber for logic
      colorHex = '#E8A33D';
      fontType = 'mono';
    }

    // Check for off-domain signal (low dictionary hit rate)
    if (data.signals && data.signals.dictionaryHitRate !== undefined && data.signals.dictionaryHitRate < 0.65) {
      fontType = 'rune';
    }

    // 1. Outer stylized crystal envelope (frosted glass)
    const isBoilerplate = data.signals && (data.signals.dictionaryHitRate ?? 0) > 0.95 && (data.signals.surpriseScore ?? 1) < 0.25;
    const outerGeo = isBoilerplate
      ? new THREE.BoxGeometry(0.75, 1.1, 0.22)
      : new THREE.OctahedronGeometry(0.52, 0);

    const outerMat = new THREE.MeshStandardMaterial({
      color: colorVal,
      emissive: colorVal,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.75
    });
    this.outerMesh = new THREE.Mesh(outerGeo, outerMat);
    this.outerMesh.castShadow = false;
    this.outerMesh.receiveShadow = false;
    this.group.add(this.outerMesh);

    // 2. Inner bright glowing core glyph
    const innerGeo = new THREE.IcosahedronGeometry(0.24, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true
    });
    this.innerMesh = new THREE.Mesh(innerGeo, innerMat);
    this.group.add(this.innerMesh);

    // 3. Extract text fragments from shard.text
    const words = data.text.split(/\s+/).filter(Boolean);
    const fragments: string[] = [];
    const chunkSize = Math.max(1, Math.floor(words.length / 4));
    for (let i = 0; i < 4; i++) {
      const slice = words.slice(i * chunkSize, (i + 1) * chunkSize).join(' ');
      fragments.push(slice || data.title);
    }

    // 4. Floating Text Glyph Plates (Fragmented words orbiting the core)
    const plateGeo = new THREE.PlaneGeometry(0.68, 0.2);
    const plateCount = 4;

    for (let i = 0; i < plateCount; i++) {
      const textFrag = fragments[i % fragments.length];
      const texture = createGlyphCardTexture(textFrag, colorHex, fontType);

      const plateMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false
      });

      const plate = new THREE.Mesh(plateGeo, plateMat);
      const angle = (i / plateCount) * Math.PI * 2;
      plate.position.set(Math.cos(angle) * 0.78, (i - 1.5) * 0.22, Math.sin(angle) * 0.78);
      plate.rotation.y = -angle + Math.PI / 2;
      this.glyphPlates.push(plate);
      this.group.add(plate);

      // Trailing duplicate echo plate if repetition signal is high
      if (data.signals && (data.signals.repetitionScore ?? 0) > 0.35) {
        const echoMat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const echoPlate = new THREE.Mesh(plateGeo, echoMat);
        echoPlate.position.copy(plate.position);
        echoPlate.scale.set(0.9, 0.9, 0.9);
        this.echoPlates.push(echoPlate);
        this.group.add(echoPlate);
      }
    }

    // 5. Point light
    this.light = new THREE.PointLight(colorVal, 2.4, 7.5, 1.8);
    this.group.add(this.light);
  }

  public update(
    time: number,
    playerPos: THREE.Vector3,
    onCollect: (shard: NeuralShard) => void
  ): void {
    if (this.isCollected) return;

    // Visual Telemetry Signals
    const sig = this.data.signals;
    const isNoisy = sig && ((sig.nonAlphabeticRatio ?? 0) > 0.28 || (sig.surpriseScore ?? 0) > 0.85);
    const isDuplicate = sig && (sig.repetitionScore ?? 0) > 0.35;
    const isBoilerplate = sig && (sig.dictionaryHitRate ?? 0) > 0.95 && (sig.surpriseScore ?? 1) < 0.25;

    // 1. Bobbing & base rotation
    let jitterX = 0;
    let jitterY = 0;
    let jitterZ = 0;
    let lightFlicker = 1.0;

    if (isNoisy) {
      // Rapid high-frequency jitter and flicker
      const jTime = time * 32.0 + this.animOffset;
      jitterX = Math.sin(jTime) * 0.07;
      jitterY = Math.cos(jTime * 1.4) * 0.06;
      jitterZ = Math.sin(jTime * 0.8) * 0.07;
      lightFlicker = 0.7 + Math.sin(jTime * 2.0) * 0.35;
    }

    const yOffset = Math.sin(time * 2.2 + this.animOffset) * 0.22;
    this.group.position.set(
      this.initialPosition.x + jitterX,
      this.initialPosition.y + yOffset + jitterY,
      this.initialPosition.z + jitterZ
    );

    this.light.intensity = 2.4 * lightFlicker;

    this.outerMesh.rotation.y += 0.02;
    this.outerMesh.rotation.x += isBoilerplate ? 0.0 : 0.01;
    this.innerMesh.rotation.y -= 0.03;

    // Proximity check with player
    const dist = this.group.position.distanceTo(playerPos);

    // Unfold glyph plates when near
    const targetUnfold = dist < 5.0 ? 1.0 : 0.0;
    this.unfoldProgress = THREE.MathUtils.lerp(this.unfoldProgress, targetUnfold, 0.08);

    const orbitSpeed = isBoilerplate ? 0.15 : 0.75;

    for (let i = 0; i < this.glyphPlates.length; i++) {
      const plate = this.glyphPlates[i];
      let baseAngle = (i / this.glyphPlates.length) * Math.PI * 2 + time * orbitSpeed;
      let radius = 0.78 + this.unfoldProgress * 0.45;
      let height = (i - 1.5) * (0.22 + this.unfoldProgress * 0.16);

      // Boilerplate signboard column layout
      if (isBoilerplate) {
        baseAngle = Math.PI * 0.5;
        radius = 0.35;
        height = (i - 1.5) * 0.24;
      }

      plate.position.set(
        Math.cos(baseAngle) * radius,
        height,
        Math.sin(baseAngle) * radius
      );
      plate.rotation.y = isBoilerplate ? 0 : -baseAngle + Math.PI / 2;

      // Duplicate trailing echo update
      if (isDuplicate && i < this.echoPlates.length) {
        const echo = this.echoPlates[i];
        const echoAngle = baseAngle - 0.25;
        echo.position.set(
          Math.cos(echoAngle) * (radius * 1.15),
          height - 0.04,
          Math.sin(echoAngle) * (radius * 1.15)
        );
        echo.rotation.y = -echoAngle + Math.PI / 2;
      }
    }

    // Magnetic pull when close
    if (dist < 4.0 && dist > 0.8) {
      this.group.position.lerp(playerPos, 0.08);
    } else if (dist <= 0.8) {
      this.isCollected = true;
      this.group.visible = false;
      onCollect(this);
    }
  }

  public reset(): void {
    this.isCollected = false;
    this.group.visible = true;
    this.group.position.copy(this.initialPosition);
  }
}
