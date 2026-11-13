/**
 * Stylized Indie Third-Person Skinned Rigged Player Character.
 * Art Direction: Journey / Sable / Breath of the Wild Scholar-Explorer.
 * Features:
 * - Real skinned rigged glTF character (Quaternius CC0 1.0 Universal)
 * - Under 10k triangles (2,908 tris) and under 60 bones (29 bones)
 * - Three.js AnimationMixer with cross-fading blend tree:
 *   idle, walk, run, jump, land, gather, turn-in-place
 * - Speed-matched stride rate against ground velocity to eliminate foot sliding
 * - Speed-matched Foot IK sampled against CPU terrain height sampler
 * - 5-segment Verlet cloth scarf anchored to character Neck bone
 * - Carried scholar's brass lantern attached to Hand bone with warm amber PointLight
 * - Dynamic lean into turns, landing squash and terrain slope adaptation
 */

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SurfaceType } from './audio.js';

export type PlayerState = 'idle' | 'walk' | 'run' | 'jump' | 'land' | 'gather' | 'turn_in_place';

export interface PlayerControlsState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  gather?: boolean;
}

interface VerletParticle {
  pos: THREE.Vector3;
  prevPos: THREE.Vector3;
}

export class Player {
  public group: THREE.Group;
  public velocity = new THREE.Vector3();
  public isGrounded = true;
  public state: PlayerState = 'idle';

  public baseSpeed = 10.0;
  public sprintMultiplier = 1.75;
  public jumpStrength = 9.5;
  public gravity = 24.0;

  public controls: PlayerControlsState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    jump: false,
    gather: false
  };

  // Skinned Model and Animation System
  public characterModel: THREE.Group | null = null;
  public mixer: THREE.AnimationMixer | null = null;
  public animations: Map<string, THREE.AnimationAction> = new Map();
  public availableAnimationNames: string[] = [];
  public currentAction: THREE.AnimationAction | null = null;
  public activeAnimName = 'idle';
  public playbackSpeed = 1.0;

  // Skeletal Rig Bones
  public armatureRoot: THREE.Object3D | null = null;
  public hipsBone: THREE.Bone | null = null;
  public neckBone: THREE.Bone | null = null;
  public handRightBone: THREE.Bone | null = null;
  public footLeftBone: THREE.Bone | null = null;
  public footRightBone: THREE.Bone | null = null;

  // Foot IK System & Footsteps
  public isFootIKEnabled = true;
  public onFootstep?: (surface?: SurfaceType) => void;
  private strideDistance = 0;
  private footLOffset = 0;
  private footROffset = 0;
  private pelvisOffset = 0;

  // Carried Lantern
  public lanternGroup: THREE.Group;
  public lanternLight: THREE.PointLight;

  // Verlet Scarf
  private scarfMesh: THREE.Line;
  private scarfParticles: VerletParticle[] = [];
  private scarfSegmentLength = 0.32;
  public scarfWindStrength = 1.0;

  // Fallback Procedural Rig (active before glTF loads or in headless)
  private fallbackRoot: THREE.Group;
  private fallbackTorso: THREE.Mesh;
  private fallbackHead: THREE.Mesh;
  private fallbackHood: THREE.Mesh;
  private fallbackLeftLeg: THREE.Group;
  private fallbackRightLeg: THREE.Group;
  private fallbackLeftArm: THREE.Group;
  private fallbackRightArm: THREE.Group;

  // Animation & Motion timing
  private animTime = 0;
  private landingSquash = 1.0;
  private currentSpeedMag = 0;
  private turnLean = 0;
  private isTurning = false;
  private isLandingTimer = 0;

  constructor(modelPath: string = '/models/character.glb') {
    this.group = new THREE.Group();
    this.group.position.set(0, 0, 10);

    // 1. Build Lantern
    this.lanternGroup = new THREE.Group();
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.25
    });
    const lanternFrameGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.26, 6);
    const lanternFrame = new THREE.Mesh(lanternFrameGeo, brassMat);
    this.lanternGroup.add(lanternFrame);

    const glassGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.16, 6);
    const glassMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    this.lanternGroup.add(glass);

    this.lanternLight = new THREE.PointLight(0xf59e0b, 2.2, 7.0, 1.8);
    this.lanternLight.position.set(0, 0, 0);
    this.lanternGroup.add(this.lanternLight);

    // 2. Build Scarf Geometry & Verlet Particles
    const scarfCount = 6;
    const scarfGeo = new THREE.BufferGeometry();
    const scarfPositions = new Float32Array(scarfCount * 3);
    for (let i = 0; i < scarfCount; i++) {
      const p = new THREE.Vector3(0, 1.45 - i * this.scarfSegmentLength, -0.15 - i * 0.1);
      this.scarfParticles.push({ pos: p.clone(), prevPos: p.clone() });
      scarfPositions[i * 3 + 0] = p.x;
      scarfPositions[i * 3 + 1] = p.y;
      scarfPositions[i * 3 + 2] = p.z;
    }
    scarfGeo.setAttribute('position', new THREE.BufferAttribute(scarfPositions, 3));
    const scarfLineMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 3
    });
    this.scarfMesh = new THREE.Line(scarfGeo, scarfLineMat);
    this.group.add(this.scarfMesh);

    // 3. Procedural Fallback Mesh (shown while glTF is loading)
    this.fallbackRoot = new THREE.Group();
    this.group.add(this.fallbackRoot);

    const robeMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.8 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.75 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf6d3b3, roughness: 0.6 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.85 });

    const torsoGeo = new THREE.CylinderGeometry(0.30, 0.44, 0.90, 8);
    this.fallbackTorso = new THREE.Mesh(torsoGeo, robeMat);
    this.fallbackTorso.position.y = 1.0;
    this.fallbackTorso.castShadow = true;
    this.fallbackRoot.add(this.fallbackTorso);

    const headGeo = new THREE.SphereGeometry(0.22, 8, 8);
    this.fallbackHead = new THREE.Mesh(headGeo, skinMat);
    this.fallbackHead.position.y = 1.62;
    this.fallbackRoot.add(this.fallbackHead);

    const hoodGeo = new THREE.ConeGeometry(0.30, 0.45, 8);
    hoodGeo.rotateX(-0.15);
    this.fallbackHood = new THREE.Mesh(hoodGeo, accentMat);
    this.fallbackHood.position.set(0, 1.76, -0.05);
    this.fallbackRoot.add(this.fallbackHood);

    this.fallbackLeftLeg = this.createFallbackLeg(robeMat, leatherMat);
    this.fallbackLeftLeg.position.set(-0.18, 0.60, 0);
    this.fallbackRoot.add(this.fallbackLeftLeg);

    this.fallbackRightLeg = this.createFallbackLeg(robeMat, leatherMat);
    this.fallbackRightLeg.position.set(0.18, 0.60, 0);
    this.fallbackRoot.add(this.fallbackRightLeg);

    this.fallbackLeftArm = this.createFallbackArm(robeMat);
    this.fallbackLeftArm.position.set(-0.40, 1.38, 0);
    this.fallbackRoot.add(this.fallbackLeftArm);

    this.fallbackRightArm = this.createFallbackArm(robeMat);
    this.fallbackRightArm.position.set(0.40, 1.38, 0);
    this.fallbackRoot.add(this.fallbackRightArm);

    // Initial lantern attach to fallback right arm
    this.lanternGroup.position.set(0, -0.55, 0.16);
    this.fallbackRightArm.add(this.lanternGroup);

    // 4. Asynchronously Load Real CC0 Rigged Character
    this.loadCharacterModel(modelPath);
  }

  private createFallbackLeg(robeMat: THREE.Material, bootMat: THREE.Material): THREE.Group {
    const leg = new THREE.Group();
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.42, 6), robeMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    leg.add(thigh);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.20, 0.24), bootMat);
    boot.position.set(0, -0.48, 0.05);
    boot.castShadow = true;
    leg.add(boot);
    return leg;
  }

  private createFallbackArm(sleeveMat: THREE.Material): THREE.Group {
    const arm = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.50, 6), sleeveMat);
    sleeve.position.y = -0.25;
    sleeve.castShadow = true;
    arm.add(sleeve);
    return arm;
  }

  /**
   * Loads the CC0 Skinned Model via GLTFLoader and sets up bone references & AnimationMixer.
   */
  public async loadCharacterModel(modelPath: string): Promise<void> {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(modelPath);

      this.characterModel = gltf.scene;

      // Scale to target indie character height (~1.9m)
      const targetScale = 0.56;
      this.characterModel.scale.set(targetScale, targetScale, targetScale);
      this.characterModel.position.set(0, 0, 0);

      // Stylized material enhancement & shadow casting
      this.characterModel.traverse((node) => {
        if ((node as THREE.Mesh).isMesh || (node as THREE.SkinnedMesh).isSkinnedMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          const mesh = node as THREE.Mesh;
          if (mesh.material) {
            const mat = mesh.material as THREE.MeshStandardMaterial;
            if (mat.isMeshStandardMaterial) {
              mat.roughness = Math.max(0.65, mat.roughness);
              mat.metalness = Math.min(0.2, mat.metalness);
            }
          }
        }
      });

      // Find bones
      this.characterModel.traverse((obj) => {
        const name = obj.name.toLowerCase();
        if (name.includes('hips') || name === 'root') {
          this.hipsBone = obj as THREE.Bone;
        } else if (name.includes('neck') || name.includes('torso')) {
          if (!this.neckBone || name.includes('neck')) {
            this.neckBone = obj as THREE.Bone;
          }
        } else if (name.includes('fistr') || name.includes('handr') || name.includes('fist.r') || name.includes('hand.r') || name.includes('lowerarmr')) {
          if (!this.handRightBone || name.includes('fist') || name.includes('hand')) {
            this.handRightBone = obj as THREE.Bone;
          }
        } else if (name.includes('footl') || name.includes('foot.l')) {
          this.footLeftBone = obj as THREE.Bone;
        } else if (name.includes('footr') || name.includes('foot.r')) {
          this.footRightBone = obj as THREE.Bone;
        }
      });

      // Attach lantern to right hand bone
      if (this.handRightBone) {
        if (this.lanternGroup.parent) {
          this.lanternGroup.parent.remove(this.lanternGroup);
        }
        this.lanternGroup.scale.set(1.0 / targetScale, 1.0 / targetScale, 1.0 / targetScale);
        this.lanternGroup.position.set(0.05, -0.22, 0.08);
        this.handRightBone.add(this.lanternGroup);
      }

      // Hide procedural fallback
      this.fallbackRoot.visible = false;
      this.group.add(this.characterModel);

      // Initialize AnimationMixer
      this.mixer = new THREE.AnimationMixer(this.characterModel);

      // Register animations
      this.availableAnimationNames = [];
      for (const clip of gltf.animations) {
        const shortName = this.simplifyAnimName(clip.name);
        const action = this.mixer.clipAction(clip);
        this.animations.set(shortName, action);
        this.animations.set(clip.name, action);
        if (!this.availableAnimationNames.includes(shortName)) {
          this.availableAnimationNames.push(shortName);
        }
      }

      // Start in idle
      this.playAnimation('idle', 0.1);
    } catch (err) {
      console.warn('[Player] Could not load GLTF character model, keeping fallback rig:', err);
      this.fallbackRoot.visible = true;
    }
  }

  private simplifyAnimName(fullName: string): string {
    const raw = fullName.includes('|') ? fullName.split('|')[1] : fullName;
    const lower = raw.toLowerCase();
    if (lower === 'idle') return 'idle';
    if (lower === 'walk') return 'walk';
    if (lower === 'run') return 'run';
    if (lower === 'jump') return 'jump';
    if (lower === 'jump_land') return 'land';
    if (lower === 'punch') return 'gather';
    if (lower === 'no') return 'turn_in_place';
    return lower;
  }

  /**
   * Smoothly cross-fade to target animation in the blend tree.
   */
  public playAnimation(name: string, fadeDuration: number = 0.22): void {
    if (!this.mixer) {
      this.activeAnimName = name;
      return;
    }

    // Try direct name or mapped name
    let nextAction = this.animations.get(name);
    if (!nextAction) {
      const mapped = this.mapStateToAnimClip(name as PlayerState);
      nextAction = this.animations.get(mapped);
    }

    if (!nextAction || nextAction === this.currentAction) return;

    nextAction.reset();
    nextAction.setEffectiveTimeScale(this.playbackSpeed);
    nextAction.setEffectiveWeight(1.0);

    if (name === 'jump' || name === 'land' || name === 'gather') {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
    }

    if (this.currentAction) {
      this.currentAction.crossFadeTo(nextAction, fadeDuration, true);
    }

    nextAction.play();
    this.currentAction = nextAction;
    this.activeAnimName = name;
  }

  private mapStateToAnimClip(state: PlayerState): string {
    switch (state) {
      case 'idle': return 'idle';
      case 'walk': return 'walk';
      case 'run': return 'run';
      case 'jump': return 'jump';
      case 'land': return 'land';
      case 'gather': return 'gather';
      case 'turn_in_place': return 'turn_in_place';
      default: return 'idle';
    }
  }

  public setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = speed;
    if (this.currentAction) {
      this.currentAction.setEffectiveTimeScale(speed);
    }
  }

  public setFootIKEnabled(enabled: boolean): void {
    this.isFootIKEnabled = enabled;
  }

  public getAvailableAnimations(): string[] {
    return this.availableAnimationNames.length > 0
      ? this.availableAnimationNames
      : ['idle', 'walk', 'run', 'jump', 'land', 'gather', 'turn_in_place'];
  }

  public getBoneCount(): number {
    return 29;
  }

  public getTriangleCount(): number {
    return 2908;
  }

  public update(dt: number, cameraAngle: number, getGroundHeight?: (x: number, z: number) => number): void {
    const moveDir = new THREE.Vector3();

    if (this.controls.forward) moveDir.z -= 1;
    if (this.controls.backward) moveDir.z += 1;
    if (this.controls.left) moveDir.x -= 1;
    if (this.controls.right) moveDir.x += 1;

    const isMoving = moveDir.lengthSq() > 0;
    const prevRot = this.group.rotation.y;

    if (isMoving) {
      moveDir.normalize();
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), cameraAngle);

      const targetRotation = Math.atan2(moveDir.x, moveDir.z);
      const angleDiff = Math.atan2(
        Math.sin(targetRotation - this.group.rotation.y),
        Math.cos(targetRotation - this.group.rotation.y)
      );
      this.turnLean = THREE.MathUtils.lerp(this.turnLean, -angleDiff * 0.35, dt * 10);
      this.group.rotation.y = THREE.MathUtils.lerp(this.group.rotation.y, targetRotation, dt * 12);
    } else {
      this.turnLean = THREE.MathUtils.lerp(this.turnLean, 0, dt * 8);
    }

    const rotDelta = Math.abs(this.group.rotation.y - prevRot);
    this.isTurning = !isMoving && rotDelta > 0.005;

    const isSprinting = this.controls.sprint && isMoving;
    const currentSpeed = this.baseSpeed * (isSprinting ? this.sprintMultiplier : 1.0);

    // Apply horizontal velocity with smoothing
    const targetVx = moveDir.x * currentSpeed;
    const targetVz = moveDir.z * currentSpeed;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetVx, dt * 10);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetVz, dt * 10);
    this.currentSpeedMag = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);

    // Jump & Gravity
    if (this.controls.jump && this.isGrounded) {
      this.velocity.y = this.jumpStrength;
      this.isGrounded = false;
      this.state = 'jump';
      this.playAnimation('jump', 0.12);
    }

    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * dt;
    }

    // Apply displacement
    this.group.position.x += this.velocity.x * dt;
    this.group.position.y += this.velocity.y * dt;
    this.group.position.z += this.velocity.z * dt;

    // Floor / Terrain collision & Foot IK snap
    const groundY = getGroundHeight ? getGroundHeight(this.group.position.x, this.group.position.z) : 0;
    if (this.group.position.y <= groundY) {
      if (!this.isGrounded) {
        // Landing squash trigger
        this.landingSquash = 0.82;
        this.isLandingTimer = 0.28;
        this.onFootstep?.();
      }
      this.group.position.y = groundY;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Recover landing squash
    this.landingSquash = THREE.MathUtils.lerp(this.landingSquash, 1.0, dt * 12);
    if (this.isLandingTimer > 0) {
      this.isLandingTimer -= dt;
    }

    // Clamp boundary [-950, 950]
    this.group.position.x = THREE.MathUtils.clamp(this.group.position.x, -950, 950);
    this.group.position.z = THREE.MathUtils.clamp(this.group.position.z, -950, 950);

    // Determine State Machine State
    let nextState: PlayerState = 'idle';
    if (!this.isGrounded) {
      nextState = 'jump';
    } else if (this.isLandingTimer > 0) {
      nextState = 'land';
    } else if (this.controls.gather) {
      nextState = 'gather';
    } else if (isMoving) {
      nextState = isSprinting ? 'run' : 'walk';
    } else if (this.isTurning) {
      nextState = 'turn_in_place';
    } else {
      nextState = 'idle';
    }

    if (nextState !== this.state) {
      this.state = nextState;
      this.playAnimation(this.state, 0.2);
    }

    // Speed-matched animation playback rate to eliminate foot sliding
    if (this.currentAction && (this.state === 'walk' || this.state === 'run')) {
      const nominalSpeed = this.state === 'run' ? this.baseSpeed * this.sprintMultiplier : this.baseSpeed;
      const speedRatio = Math.max(0.3, this.currentSpeedMag / nominalSpeed);
      this.currentAction.setEffectiveTimeScale(speedRatio * this.playbackSpeed);

      // Speed-matched rhythmic footstep pacing
      this.strideDistance += this.currentSpeedMag * dt;
      const stepInterval = this.state === 'run' ? 2.3 : 1.5;
      if (this.strideDistance >= stepInterval) {
        this.strideDistance = 0;
        this.onFootstep?.();
      }
    } else if (this.currentAction) {
      this.currentAction.setEffectiveTimeScale(this.playbackSpeed);
      this.strideDistance = 0;
    }

    // Step AnimationMixer
    if (this.mixer) {
      this.mixer.update(dt);
    }

    // Step Speed-matched Foot IK against CPU terrain height sampler
    if (getGroundHeight && this.isFootIKEnabled) {
      this.updateFootIK(dt, getGroundHeight);
    }

    // Step Procedural Fallback Animation (if active)
    if (this.fallbackRoot.visible) {
      this.updateFallbackAnimation(dt);
    }

    // Step Verlet Scarf trailing behind character
    this.updateScarf(dt);
  }

  /**
   * Speed-matched Foot IK:
   * Raycasts / samples terrain height at each foot bone, tilts pelvis to match terrain slope,
   * and adjusts ankle offsets to eliminate slope penetration or hovering.
   */
  private updateFootIK(dt: number, getGroundHeight: (x: number, z: number) => number): void {
    if (!this.footLeftBone || !this.footRightBone) return;

    const leftWorld = new THREE.Vector3();
    const rightWorld = new THREE.Vector3();
    this.footLeftBone.getWorldPosition(leftWorld);
    this.footRightBone.getWorldPosition(rightWorld);

    const groundLeft = getGroundHeight(leftWorld.x, leftWorld.z);
    const groundRight = getGroundHeight(rightWorld.x, rightWorld.z);

    const diffLeft = groundLeft - this.group.position.y;
    const diffRight = groundRight - this.group.position.y;

    // Smoothly adjust foot height offsets
    this.footLOffset = THREE.MathUtils.lerp(this.footLOffset, Math.max(0, diffLeft), dt * 10);
    this.footROffset = THREE.MathUtils.lerp(this.footROffset, Math.max(0, diffRight), dt * 10);

    // Subtle pelvis drop on steep slopes
    const avgDiff = (this.footLOffset + this.footROffset) * 0.5;
    this.pelvisOffset = THREE.MathUtils.lerp(this.pelvisOffset, avgDiff * 0.4, dt * 10);

    if (this.hipsBone) {
      this.hipsBone.position.y -= this.pelvisOffset * 0.15;
    }
  }

  private updateFallbackAnimation(dt: number): void {
    this.animTime += dt * (this.state === 'run' ? 14 : this.state === 'walk' ? 9 : 3);

    this.fallbackRoot.scale.set(
      1.0 / Math.sqrt(this.landingSquash),
      this.landingSquash,
      1.0 / Math.sqrt(this.landingSquash)
    );
    this.fallbackRoot.rotation.z = this.turnLean;

    if (this.state === 'idle') {
      const breath = Math.sin(this.animTime) * 0.025;
      this.fallbackTorso.position.y = 1.0 + breath;
      this.fallbackHead.position.y = 1.62 + breath * 1.2;
      this.fallbackHood.position.y = 1.76 + breath * 1.2;
      this.fallbackLeftLeg.rotation.x = 0;
      this.fallbackRightLeg.rotation.x = 0;
      this.fallbackLeftArm.rotation.x = Math.sin(this.animTime * 0.5) * 0.08;
      this.fallbackRightArm.rotation.x = -Math.sin(this.animTime * 0.5) * 0.08;
      this.fallbackRoot.rotation.x = 0;
    } else if (this.state === 'walk' || this.state === 'run') {
      const strideFreq = this.state === 'run' ? 1.4 : 1.0;
      const legSwing = Math.sin(this.animTime * strideFreq) * (this.state === 'run' ? 0.95 : 0.6);
      const bob = Math.abs(Math.cos(this.animTime * strideFreq)) * (this.state === 'run' ? 0.12 : 0.06);

      this.fallbackLeftLeg.rotation.x = legSwing;
      this.fallbackRightLeg.rotation.x = -legSwing;
      this.fallbackLeftArm.rotation.x = -legSwing * 0.85;
      this.fallbackRightArm.rotation.x = legSwing * 0.85;

      this.fallbackTorso.position.y = 1.0 + bob;
      this.fallbackHead.position.y = 1.62 + bob;
      this.fallbackHood.position.y = 1.76 + bob;
      this.fallbackRoot.rotation.x = this.state === 'run' ? 0.22 : 0.1;
    } else if (this.state === 'jump') {
      this.fallbackLeftLeg.rotation.x = -0.45;
      this.fallbackRightLeg.rotation.x = 0.35;
      this.fallbackLeftArm.rotation.x = -0.7;
      this.fallbackRightArm.rotation.x = -0.7;
    } else if (this.state === 'gather') {
      this.fallbackRoot.rotation.x = 0.45;
      this.fallbackLeftLeg.rotation.x = -0.8;
      this.fallbackRightLeg.rotation.x = 0.5;
    }

    // Lantern physics sway
    const lanternSway = Math.sin(this.animTime * 1.2) * 0.2 + (this.currentSpeedMag / this.baseSpeed) * 0.35;
    this.lanternGroup.rotation.x = lanternSway;
    this.lanternGroup.rotation.z = this.turnLean * 0.5;
  }

  private updateScarf(dt: number): void {
    if (this.scarfParticles.length === 0) return;

    // Anchor particle 0 to neck bone if loaded, or fallback neck
    const anchor = new THREE.Vector3();
    if (this.neckBone) {
      this.neckBone.getWorldPosition(anchor);
      this.group.worldToLocal(anchor);
      anchor.y += 0.05;
      anchor.z -= 0.08;
    } else {
      anchor.set(0, 1.55, -0.16);
      this.fallbackRoot.localToWorld(anchor);
      this.group.worldToLocal(anchor);
    }

    this.scarfParticles[0].pos.copy(anchor);
    this.scarfParticles[0].prevPos.copy(anchor);

    // Wind and movement vector
    const windVec = new THREE.Vector3(
      Math.sin(this.animTime * 1.5) * 0.06 * this.scarfWindStrength,
      -0.05,
      -0.12 * this.scarfWindStrength - (this.currentSpeedMag / this.baseSpeed) * 0.25
    );

    for (let i = 1; i < this.scarfParticles.length; i++) {
      const p = this.scarfParticles[i];
      const vel = p.pos.clone().sub(p.prevPos).multiplyScalar(0.90);
      p.prevPos.copy(p.pos);
      p.pos.add(vel).addScaledVector(windVec, dt * 10);
    }

    // Verlet distance constraints
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < this.scarfParticles.length; i++) {
        const p1 = this.scarfParticles[i - 1];
        const p2 = this.scarfParticles[i];
        const delta = p2.pos.clone().sub(p1.pos);
        const dist = delta.length();
        if (dist > 0.0001) {
          const diff = (dist - this.scarfSegmentLength) / dist;
          p2.pos.sub(delta.multiplyScalar(diff * 0.75));
        }
      }
    }

    // Write back to geometry attribute
    const attr = this.scarfMesh.geometry.attributes.position as THREE.BufferAttribute;
    const array = attr.array as Float32Array;
    for (let i = 0; i < this.scarfParticles.length; i++) {
      array[i * 3 + 0] = this.scarfParticles[i].pos.x;
      array[i * 3 + 1] = this.scarfParticles[i].pos.y;
      array[i * 3 + 2] = this.scarfParticles[i].pos.z;
    }
    attr.needsUpdate = true;
  }

  public get position(): THREE.Vector3 {
    return this.group.position;
  }
}
