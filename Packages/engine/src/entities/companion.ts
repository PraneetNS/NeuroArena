/**
 * Trained Neural Companion 3D Drone entity that follows the player in the open world,
 * emotes, and displays generated dialogue.
 */

import * as THREE from 'three';

export type CompanionState = 'dormant' | 'active' | 'thinking' | 'speaking';

export class CompanionDrone {
  public group: THREE.Group;
  public state: CompanionState = 'dormant';
  public currentSpeech = '';

  private bodyMesh: THREE.Mesh;
  private eyeMesh: THREE.Mesh;
  private haloMesh: THREE.Mesh;
  private light: THREE.PointLight;
  private speechCanvas: HTMLCanvasElement;
  private speechTexture: THREE.CanvasTexture;
  private speechSprite: THREE.Sprite;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false; // Hidden until trained & awakened

    // Drone main body (Sphere / Capsule)
    const bodyGeo = new THREE.SphereGeometry(0.4, 16, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      metalness: 0.8,
      roughness: 0.2
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.group.add(this.bodyMesh);

    // Glowing Visor / Eye
    const eyeGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
    eyeGeo.rotateX(Math.PI / 2);
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff
    });
    this.eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeMesh.position.set(0, 0, 0.35);
    this.group.add(this.eyeMesh);

    // Floating Energy Halo
    const haloGeo = new THREE.TorusGeometry(0.55, 0.02, 8, 32);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.8
    });
    this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.haloMesh.rotation.x = Math.PI / 2;
    this.group.add(this.haloMesh);

    // Ambient Drone Point Light
    this.light = new THREE.PointLight(0x00f3ff, 2, 6);
    this.group.add(this.light);

    // 3D Billboard Speech Sprite
    this.speechCanvas = document.createElement('canvas');
    this.speechCanvas.width = 512;
    this.speechCanvas.height = 128;
    this.speechTexture = new THREE.CanvasTexture(this.speechCanvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: this.speechTexture,
      transparent: true,
      opacity: 0.95
    });
    this.speechSprite = new THREE.Sprite(spriteMat);
    this.speechSprite.scale.set(3.2, 0.8, 1);
    this.speechSprite.position.set(0, 1.1, 0);
    this.speechSprite.visible = false;
    this.group.add(this.speechSprite);
  }

  public awaken(startPosition: THREE.Vector3): void {
    this.state = 'active';
    this.group.visible = true;
    this.group.position.copy(startPosition);
    this.say('Awakened! Neural weights loaded.');
  }

  public say(text: string): void {
    this.currentSpeech = text;
    this.state = 'speaking';
    this.updateSpeechCanvas(text);
    this.speechSprite.visible = true;

    // Auto-hide speech bubble after delay
    setTimeout(() => {
      if (this.currentSpeech === text) {
        this.speechSprite.visible = false;
        this.state = 'active';
      }
    }, 5000);
  }

  private updateSpeechCanvas(text: string): void {
    const ctx = this.speechCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 512, 128);

    // Rounded speech box
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 108, 16);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Wrap or truncate text
    const display = text.length > 38 ? text.slice(0, 35) + '...' : text;
    ctx.fillText(display, 256, 64);

    this.speechTexture.needsUpdate = true;
  }

  public update(time: number, playerPos: THREE.Vector3): void {
    if (this.state === 'dormant') return;

    // Follow player with offset (shoulder position)
    const target = playerPos
      .clone()
      .add(new THREE.Vector3(1.4, 1.8 + Math.sin(time * 3) * 0.15, -0.8));
    this.group.position.lerp(target, 0.05);

    // Look at player
    this.group.lookAt(playerPos.x, playerPos.y + 1.2, playerPos.z);

    // Halo pulse & rotation
    this.haloMesh.rotation.z += 0.03;
    if (this.state === 'thinking') {
      this.haloMesh.scale.setScalar(1.0 + Math.sin(time * 10) * 0.15);
      (this.eyeMesh.material as THREE.MeshBasicMaterial).color.setHex(0xf59e0b);
    } else if (this.state === 'speaking') {
      (this.eyeMesh.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
    } else {
      (this.eyeMesh.material as THREE.MeshBasicMaterial).color.setHex(0x00f3ff);
    }
  }
}
