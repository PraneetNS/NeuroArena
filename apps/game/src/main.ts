/**
 * NeuroArena Main Game Orchestrator:
 * Connects 3D Engine, 2 km x 2 km Streamed Terrain with WebGPURenderer,
 * ML-Core TinyGPT, and UI System into an end-to-end interactive experience.
 */

import * as THREE from 'three/webgpu';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  World,
  Player,
  SoundEngine,
  NeuralShard,
  ShardData,
  WorldTerminal,
  CompanionDrone,
  QualityTier
} from '@na/engine';
import { Tokenizer, Dataset, TinyGPT, PRESET_CORPORA } from '@na/ml-core';
import {
  HUD,
  DataCuratorModal,
  TrainingDashboard,
  ChatTerminalModal,
  HarvestedShardInfo,
  UILabGallery,
  Workbench
} from '@na/ui';
import '@na/ui/styles';
import {
  CapabilityReportModal,
  getPreferredGpuSetting,
  resolvePowerPreference
} from './capability.js';
import { TerrainStatsOverlay } from './statsOverlay.js';
import { EnvironmentDebugPanel } from './environmentDebugPanel.js';
import { VaultManager, Shard } from '@na/game-core';
import { ShardWorld, ShardInteractionState } from './shardWorld.js';
import { ShardHUD } from './shardHUD.js';

class NeuroArenaGame {
  private canvasContainer: HTMLElement;
  private uiContainer: HTMLElement;

  private world: World;
  private player: Player;
  private audio: SoundEngine;
  private companion: CompanionDrone;

  private shards: NeuralShard[] = [];
  private terminals: WorldTerminal[] = [];

  private tokenizer: Tokenizer;
  private dataset: Dataset;

  private vaultManager: VaultManager;
  private shardWorld: ShardWorld;
  private shardHudContainer: HTMLElement;
  private shardHudRoot: ReactDOM.Root;
  private isVaultOpen = false;
  private lastInteractionState: ShardInteractionState = {
    targetShard: null,
    targetDistance: Infinity,
    holdProgress: 0,
    isHolding: false,
    scanResult: null,
    isScanMode: false
  };

  private hud: HUD;
  private statsOverlay: TerrainStatsOverlay;
  private curatorModal: DataCuratorModal;
  private forgeModal: TrainingDashboard;
  private chatModal: ChatTerminalModal;
  private capabilityModal: CapabilityReportModal;
  private debugContainer!: HTMLElement;
  private debugRoot!: ReactDOM.Root;
  private isDebugPanelOpen = false;

  private workbenchContainer: HTMLElement | null = null;
  private workbenchRoot: ReactDOM.Root | null = null;
  private isWorkbenchOpen = false;

  private collectedShards: HarvestedShardInfo[] = [];
  private activeNearbyTerminal: WorldTerminal | null = null;
  private activeNearbyShard: NeuralShard | null = null;
  private currentSector = 'The Emerald Valley';
  private questStep = 1;

  private clock = new THREE.Clock();

  constructor() {
    this.canvasContainer = document.getElementById('app-canvas-container')!;
    this.uiContainer = document.getElementById('app-ui-container')!;

    // 1. Initialize Engine & Audio with Persisted Preferred GPU
    const preferredGpu = getPreferredGpuSetting();
    const targetPowerPreference = resolvePowerPreference(preferredGpu);
    this.world = new World(this.canvasContainer, { powerPreference: targetPowerPreference });
    this.player = new Player();
    this.world.scene.add(this.player.group);

    this.audio = new SoundEngine();
    this.companion = new CompanionDrone();
    this.world.scene.add(this.companion.group);

    // 2. Initialize ML Core
    this.tokenizer = new Tokenizer();
    this.dataset = new Dataset(this.tokenizer, PRESET_CORPORA.companion);
    this.tokenizer.buildVocab(this.dataset.rawText);

    // 3. Initialize UI System & Diagnostics Overlay
    this.hud = new HUD(this.uiContainer, {
      onCurator: () => this.openCurator(),
      onForge: () => this.openForge(),
      onChat: () => this.openChat(),
      onReport: () => this.openReport()
    });

    this.debugContainer = document.createElement('div');
    this.debugContainer.id = 'app-debug-container';
    this.uiContainer.appendChild(this.debugContainer);
    this.debugRoot = ReactDOM.createRoot(this.debugContainer);

    this.statsOverlay = new TerrainStatsOverlay(this.uiContainer, {
      onQualityChange: (tier: QualityTier) => {
        this.world.setQualityTier(tier);
        this.renderDebugPanel();
      },
      onToggleFreeFly: () => {
        this.toggleFreeFly();
      },
      onOpenDebugPanel: () => {
        this.toggleDebugPanel();
      }
    });

    this.capabilityModal = new CapabilityReportModal(this.uiContainer);

    this.curatorModal = new DataCuratorModal(this.uiContainer, this.tokenizer, (newCorpus) => {
      this.dataset.setText(newCorpus);
      if (this.questStep === 2) this.questStep = 3;
      this.updateHUD();
    });

    this.forgeModal = new TrainingDashboard(this.uiContainer, this.tokenizer, this.dataset, {
      onAwaken: (trainedModel: TinyGPT) => {
        this.awakenCompanion(trainedModel);
      },
      onStepSound: () => this.audio.playTrainingStep()
    });

    this.chatModal = new ChatTerminalModal(this.uiContainer, this.tokenizer, {
      onSpeakInWorld: (speech: string) => {
        this.companion.say(speech);
      },
      onTokenSound: () => this.audio.playTokenTick()
    });

    // 4. Initialize Vault Manager and Shard World
    this.vaultManager = new VaultManager();
    this.shardHudContainer = document.createElement('div');
    this.shardHudContainer.id = 'app-shard-hud-container';
    this.uiContainer.appendChild(this.shardHudContainer);
    this.shardHudRoot = ReactDOM.createRoot(this.shardHudContainer);

    this.shardWorld = new ShardWorld(
      this.world.scene,
      this.vaultManager,
      (x, z) => (this.world.terrain ? this.world.terrain.getHeight(x, z) : 0),
      (shard: Shard) => {
        this.audio.playShardCollect();
        // Sync kept tokens into active dataset
        const stream = this.vaultManager.vaultToTokenStream(this.tokenizer);
        this.dataset.setText(stream.rawText);
        this.tokenizer.buildVocab(this.dataset.rawText);
        this.curatorModal.setHarvestedShards(
          this.vaultManager.getState().entries.map(e => ({
            id: e.shardId,
            title: `Shard ${e.shardId}`,
            category: 'dataset',
            sector: e.regionId || 'Unknown',
            text: e.text
          }))
        );
        this.updateHUD();
      }
    );

    // Attach global debug commands in dev builds only
    if (import.meta.env.DEV) {
      (window as any).fillVaultDebug = (count = 20) => {
        const added = this.vaultManager.fillRandomShards(count, this.shardWorld.worldState.shards);
        const stream = this.vaultManager.vaultToTokenStream(this.tokenizer);
        this.dataset.setText(stream.rawText);
        this.tokenizer.buildVocab(this.dataset.rawText);
        this.updateHUD();
        console.log(`[NeuroArena Debug] Filled vault with ${added} random shards.`);
        return added;
      };
      (window as any).vault = this.vaultManager;
      (window as any).worldState = this.shardWorld.worldState;
    }

    // 5. Populate World
    this.spawnTerminals();
    this.spawnShards();

    // 6. Setup Input Handlers
    this.setupKeybindings();

    // Auto-open capability report if specified in URL (#capability or ?report)
    if (window.location.hash === '#capability' || window.location.search.includes('report')) {
      setTimeout(() => this.openReport(), 250);
    }

    // 7. Asynchronously initialize WebGPURenderer & Load 2 km Terrain
    this.initGame();
  }

  private async initGame(): Promise<void> {
    try {
      await this.world.init();
      await this.world.loadTerrain('high');

      // Snap entities to terrain elevation
      this.groundEntitiesOnTerrain();
    } catch (err) {
      console.warn('Terrain initialization warning:', err);
    }

    this.updateHUD();
    requestAnimationFrame(this.animate);
  }

  private groundEntitiesOnTerrain(): void {
    if (!this.world.terrain) return;
    const terrain = this.world.terrain;

    // Snap ShardWorld markers to elevation
    this.shardWorld.updateElevation((x, z) => terrain.getHeight(x, z));

    // Ground player at starting position
    const startY = terrain.getHeight(this.player.position.x, this.player.position.z);
    this.player.position.y = startY;

    // Ground terminals
    for (const term of this.terminals) {
      const y = terrain.getHeight(term.group.position.x, term.group.position.z);
      term.group.position.y = y;
    }

    // Ground shards
    for (const shard of this.shards) {
      const y = terrain.getHeight(shard.group.position.x, shard.group.position.z);
      shard.group.position.y = y + 1.2;
    }
  }

  public toggleFreeFly(): void {
    const isFree = this.world.toggleFreeFly();
    if (isFree) {
      this.world.freeFlyCamera.camera.position.set(
        this.player.position.x,
        this.player.position.y + 12,
        this.player.position.z + 18
      );
    }
  }

  private spawnTerminals(): void {
    // 1. Central Neural Forge Terminal at origin
    const forgeTerminal = new WorldTerminal(
      'forge',
      'The Central Neural Forge',
      'Upload curated tokens, configure hyper-parameters, and execute backpropagation.',
      new THREE.Vector3(0, 0, 0),
      0xa855f7
    );
    this.terminals.push(forgeTerminal);
    this.world.scene.add(forgeTerminal.group);

    // 2. Data Curator Terminal
    const curatorTerminal = new WorldTerminal(
      'curator',
      'Archival Databank',
      'Inspect harvested shards and analyze token frequencies.',
      new THREE.Vector3(-14, 0, 12),
      0x00f3ff
    );
    this.terminals.push(curatorTerminal);
    this.world.scene.add(curatorTerminal.group);

    // 3. Archivist NPC Station
    const archivistTerminal = new WorldTerminal(
      'archivist',
      'Archivist Turing',
      'Guide to the inner mechanics of multi-head attention and transformer loss.',
      new THREE.Vector3(14, 0, 12),
      0xf59e0b
    );
    this.terminals.push(archivistTerminal);
    this.world.scene.add(archivistTerminal.group);
  }

  private spawnShards(): void {
    const shardDefs: Array<{ data: ShardData; pos: THREE.Vector3 }> = [
      {
        data: {
          id: 'shard-1',
          title: 'Dialogue Fragment I',
          category: 'dialogue',
          sector: 'Dialogue Citadel',
          text: '[PLAYER]: Hello world! Are you conscious?\n[COMPANION]: I am computing token representations inside your browser memory.'
        },
        pos: new THREE.Vector3(-22, 1.2, -18)
      },
      {
        data: {
          id: 'shard-2',
          title: 'Dialogue Fragment II',
          category: 'dialogue',
          sector: 'Dialogue Citadel',
          text: '[PLAYER]: What is your name?\n[COMPANION]: I am your neural companion, born from gradient descent and self-attention.'
        },
        pos: new THREE.Vector3(-32, 1.2, -26)
      },
      {
        data: {
          id: 'shard-3',
          title: 'Cyberpunk Lore I',
          category: 'lore',
          sector: 'Ancient Ruins',
          text: 'The central networks fell silent when the mainframes vanished. Only local weights persisted in the silicon sands.'
        },
        pos: new THREE.Vector3(26, 1.2, -20)
      },
      {
        data: {
          id: 'shard-4',
          title: 'Cyberpunk Lore II',
          category: 'lore',
          sector: 'Ancient Ruins',
          text: 'Within the deep layers of the decoder blocks, residual pathways whispered memories of pre-training.'
        },
        pos: new THREE.Vector3(36, 1.2, -32)
      },
      {
        data: {
          id: 'shard-5',
          title: 'Logic Shard I',
          category: 'logic',
          sector: 'Logic Valley',
          text: 'function selfAttention(Q, K, V) {\n  const scores = matmul(Q, transpose(K)) / sqrt(d);\n  return matmul(softmax(scores), V);\n}'
        },
        pos: new THREE.Vector3(-18, 1.2, 28)
      },
      {
        data: {
          id: 'shard-6',
          title: 'Logic Shard II',
          category: 'logic',
          sector: 'Logic Valley',
          text: 'AdamW separates $L_2$ weight penalty from stochastic gradient variance: theta = theta - lr * (m_hat / (sqrt(v_hat) + eps) + decay * theta);'
        },
        pos: new THREE.Vector3(22, 1.2, 30)
      }
    ];

    for (const def of shardDefs) {
      const shard = new NeuralShard(def.data, def.pos);
      this.shards.push(shard);
      this.world.scene.add(shard.group);
    }
  }

  private setupKeybindings(): void {
    window.addEventListener('keydown', (e) => {
      // Free-Fly Camera toggle with key F
      if (e.code === 'KeyF') {
        this.toggleFreeFly();
        return;
      }

      // Vault modal toggle on Tab
      if (e.code === 'Tab') {
        e.preventDefault();
        this.toggleVault();
        return;
      }

      // Lens Scanner toggle on Key Q
      if (e.code === 'KeyQ') {
        this.shardWorld.toggleScanMode();
        return;
      }

      // Quality tier hotkeys: 1 = Low, 2 = Medium, 3 = High
      if (e.code === 'Digit1') {
        this.statsOverlay.selectTier('low');
        return;
      }
      if (e.code === 'Digit2') {
        this.statsOverlay.selectTier('medium');
        return;
      }
      if (e.code === 'Digit3') {
        this.statsOverlay.selectTier('high');
        return;
      }

      const isModalOpen =
        this.curatorModal.isOpen ||
        this.forgeModal.isOpen ||
        this.chatModal.isOpen ||
        this.capabilityModal.isOpen ||
        this.isVaultOpen;

      if (isModalOpen) {
        if (e.code === 'Escape') {
          this.closeAllModals();
        }
        return;
      }

      // Player Movement controls (when not in free-fly)
      if (!this.world.isFreeFly) {
        switch (e.code) {
          case 'KeyW':
          case 'ArrowUp':
            this.player.controls.forward = true;
            break;
          case 'KeyS':
          case 'ArrowDown':
            this.player.controls.backward = true;
            break;
          case 'KeyA':
          case 'ArrowLeft':
            this.player.controls.left = true;
            break;
          case 'KeyD':
          case 'ArrowRight':
            this.player.controls.right = true;
            break;
          case 'ShiftLeft':
          case 'ShiftRight':
            this.player.controls.sprint = true;
            break;
          case 'Space':
            this.player.controls.jump = true;
            break;
        }
      }

      switch (e.code) {
        case 'KeyE':
          this.shardWorld.isHoldingE = true;
          this.handleInteraction();
          break;

        case 'KeyC':
          this.openCurator();
          break;

        case 'KeyT':
          this.openForge();
          break;

        case 'KeyX':
          this.openChat();
          break;

        case 'KeyG':
          this.toggleDebugPanel();
          break;

        case 'KeyB':
          if (this.isWorkbenchOpen) {
            this.closeWorkbench();
          } else {
            this.openWorkbench();
          }
          break;

        case 'KeyU':
          window.location.href = '/ui-lab';
          break;

        case 'Escape':
          this.closeAllModals();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyE') {
        this.shardWorld.isHoldingE = false;
      }

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.player.controls.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.player.controls.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.player.controls.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.player.controls.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.player.controls.sprint = false;
          break;
        case 'Space':
          this.player.controls.jump = false;
          break;
      }
    });
  }

  private handleInteraction(): void {
    if (this.activeNearbyShard && !this.activeNearbyShard.isCollected) {
      this.collectShard(this.activeNearbyShard);
      return;
    }

    if (this.activeNearbyTerminal) {
      this.audio.playTerminalInteract();
      if (this.activeNearbyTerminal.type === 'forge') {
        this.openWorkbench();
      } else if (this.activeNearbyTerminal.type === 'curator') {
        this.openCurator();
      } else {
        this.openChat();
      }
    }
  }

  private collectShard(shard: NeuralShard): void {
    shard.isCollected = true;
    shard.group.visible = false;
    this.audio.playShardCollect();

    this.collectedShards.push({
      id: shard.data.id,
      title: shard.data.title,
      category: shard.data.category,
      sector: shard.data.sector,
      text: shard.data.text
    });

    // Ingest into dataset
    this.dataset.appendText(shard.data.text);
    this.tokenizer.buildVocab(this.dataset.rawText);
    this.curatorModal.setHarvestedShards(this.collectedShards);

    if (this.collectedShards.length >= 3 && this.questStep === 1) {
      this.questStep = 2;
    }

    this.updateHUD();
  }

  private awakenCompanion(trainedModel: TinyGPT): void {
    this.companion.awaken();
    this.chatModal.setModel(trainedModel);
    this.audio.playCompanionAwaken();
    this.questStep = 4;
    this.updateHUD();
    setTimeout(() => {
      this.openChat();
    }, 800);
  }

  private openReport(): void {
    this.closeAllModals();
    this.capabilityModal.open({
      activeGpuName: this.world.gpuInfo?.name,
      activeBackend: this.world.gpuInfo?.backend
    });
  }

  private openCurator(): void {
    this.closeAllModals();
    this.curatorModal.open();
  }

  private openForge(): void {
    this.closeAllModals();
    this.openWorkbench();
  }

  public openWorkbench(): void {
    this.closeAllModals();
    this.isWorkbenchOpen = true;

    if (!this.workbenchContainer) {
      this.workbenchContainer = document.createElement('div');
      this.workbenchContainer.id = 'app-workbench-modal-container';
      this.workbenchContainer.style.position = 'fixed';
      this.workbenchContainer.style.inset = '0';
      this.workbenchContainer.style.zIndex = '150';
      this.workbenchContainer.style.backgroundColor = 'var(--na-surface)';
      this.uiContainer.appendChild(this.workbenchContainer);
      this.workbenchRoot = ReactDOM.createRoot(this.workbenchContainer);
    }

    this.workbenchContainer.style.display = 'block';
    this.workbenchRoot!.render(
      React.createElement(Workbench, {
        vaultManager: this.vaultManager,
        onClose: () => this.closeWorkbench()
      })
    );
  }

  public closeWorkbench(): void {
    if (this.workbenchContainer) {
      this.workbenchContainer.style.display = 'none';
    }
    this.isWorkbenchOpen = false;
  }

  private openChat(): void {
    this.closeAllModals();
    this.chatModal.open();
  }

  public toggleDebugPanel(open?: boolean): void {
    this.isDebugPanelOpen = open !== undefined ? open : !this.isDebugPanelOpen;
    this.renderDebugPanel();
  }

  private renderDebugPanel(): void {
    if (!this.world.environment) return;
    this.debugRoot.render(
      React.createElement(EnvironmentDebugPanel, {
        environment: this.world.environment,
        isOpen: this.isDebugPanelOpen,
        onClose: () => this.toggleDebugPanel(false),
        onQualityChange: (tier: QualityTier) => {
          this.world.setQualityTier(tier);
          this.statsOverlay.selectTier(tier);
        }
      })
    );
  }

  private closeAllModals(): void {
    this.closeWorkbench();
    this.capabilityModal.close();
    this.curatorModal.close();
    this.forgeModal.close();
    this.chatModal.close();
    if (this.isDebugPanelOpen) {
      this.toggleDebugPanel(false);
    }
    if (this.isVaultOpen) {
      this.toggleVault(false);
    }
  }

  public toggleVault(open?: boolean): void {
    this.isVaultOpen = open !== undefined ? open : !this.isVaultOpen;
    this.renderShardHUD();
  }

  private renderShardHUD(): void {
    this.shardHudRoot.render(
      React.createElement(ShardHUD, {
        interaction: this.lastInteractionState,
        vault: this.vaultManager,
        vaultState: this.vaultManager.getState(),
        worldState: this.shardWorld.worldState,
        isVaultOpen: this.isVaultOpen,
        onCloseVault: () => this.toggleVault(false),
        activeSignalKey: this.shardWorld.activeSignalKey,
        onChangeSignalKey: (key) => {
          this.shardWorld.activeSignalKey = key;
        }
      })
    );
  }

  private updateHUD(): void {
    const p = this.player.position;
    if (p.x < -18 && p.z < 0) this.currentSector = 'Dialogue Citadel';
    else if (p.x > 18 && p.z < 0) this.currentSector = 'Logic Plains';
    else if (p.z > 18) this.currentSector = 'Knowledge Vault';
    else this.currentSector = 'The Emerald Valley';

    const vaultStats = this.vaultManager.getState().stats;
    let prompt: string | null = null;
    if (this.lastInteractionState.targetShard) {
      prompt = `HOLD [E] (0.6s) TO HARVEST SHARD ${this.lastInteractionState.targetShard.id.toUpperCase()}`;
    } else if (this.activeNearbyShard && !this.activeNearbyShard.isCollected) {
      prompt = `PRESS [E] TO HARVEST ${this.activeNearbyShard.data.title.toUpperCase()}`;
    } else if (this.activeNearbyTerminal) {
      prompt = `PRESS [E] TO INTERACT WITH ${this.activeNearbyTerminal.title.toUpperCase()}`;
    }

    const modelStatus = this.companion.state === 'dormant' ? 'untrained' : 'awakened';

    this.hud.update({
      sector: this.currentSector,
      shardsCollected: vaultStats.count,
      totalShards: this.shardWorld.worldState.shards.length,
      tokensHarvested: vaultStats.tokens,
      modelStatus,
      questStep: this.questStep,
      interactionPrompt: prompt
    });
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const dt = Math.min(0.1, this.clock.getDelta());
    const time = this.clock.getElapsedTime();

    // Ground sampling function on CPU
    const groundFn = (x: number, z: number) =>
      this.world.terrain ? this.world.terrain.getHeight(x, z) : 0;

    // 1. Update Player (when not in modal and not in free-fly)
    const isModalOpen =
      this.curatorModal.isOpen ||
      this.forgeModal.isOpen ||
      this.chatModal.isOpen ||
      this.isVaultOpen;
    if (!isModalOpen && !this.world.isFreeFly) {
      this.player.update(dt, this.world.cameraAngleY, groundFn);
    }
    this.world.updateCamera(this.player);

    // 2. Update Companion Drone
    this.companion.update(time, this.player.position);

    // 3. Update ShardWorld instanced markers & interactions
    this.lastInteractionState = this.shardWorld.update(dt, time, this.player.position);
    this.renderShardHUD();

    this.activeNearbyShard = null;
    for (const shard of this.shards) {
      shard.update(time, this.player.position, (s) => this.collectShard(s));
      if (!shard.isCollected && shard.group.position.distanceTo(this.player.position) < 3.5) {
        this.activeNearbyShard = shard;
      }
    }

    // 4. Update Terminals
    this.activeNearbyTerminal = null;
    for (const term of this.terminals) {
      const isNearby = term.update(time, this.player.position);
      if (isNearby) {
        this.activeNearbyTerminal = term;
      }
    }

    // 5. Update World environment, streamed chunks, and render
    this.world.update(dt, this.player.position);
    this.world.render();

    // 6. Update Diagnostics Stats Overlay
    if (this.statsOverlay) {
      const fullStats = this.world.getFullStats();
      const camPos = this.world.camera.position;
      const groundAlt = groundFn(camPos.x, camPos.z);
      this.statsOverlay.update({
        ...fullStats,
        cameraPos: { x: camPos.x, y: camPos.y, z: camPos.z },
        groundHeight: groundAlt
      });
    }

    // 7. Update HUD
    this.updateHUD();
  };
}

// Bootstrap application: route /workbench, /ui-lab, or standard open-world game
const isWorkbenchRoute = () =>
  window.location.pathname.startsWith('/workbench') ||
  window.location.hash.startsWith('#/workbench') ||
  window.location.search.includes('workbench');

const isUILabRoute = () =>
  window.location.pathname.startsWith('/ui-lab') ||
  window.location.hash.startsWith('#/ui-lab') ||
  window.location.search.includes('ui-lab');

window.addEventListener('DOMContentLoaded', () => {
  if (isWorkbenchRoute()) {
    const canvasContainer = document.getElementById('app-canvas-container');
    if (canvasContainer) {
      canvasContainer.style.display = 'none';
    }

    const uiContainer = document.getElementById('app-ui-container');
    if (uiContainer) {
      uiContainer.style.position = 'fixed';
      uiContainer.style.inset = '0';
      uiContainer.style.width = '100vw';
      uiContainer.style.height = '100vh';
      uiContainer.style.overflow = 'hidden';
      uiContainer.style.pointerEvents = 'auto';
      uiContainer.style.margin = '0';
      uiContainer.style.padding = '0';
      document.body.style.overflow = 'hidden';

      const root = ReactDOM.createRoot(uiContainer);
      root.render(React.createElement(Workbench, { vaultManager: new VaultManager() }));
    }
  } else if (isUILabRoute()) {
    const canvasContainer = document.getElementById('app-canvas-container');
    if (canvasContainer) {
      canvasContainer.style.display = 'none';
    }

    const uiContainer = document.getElementById('app-ui-container');
    if (uiContainer) {
      uiContainer.style.position = 'static';
      uiContainer.style.width = '100%';
      uiContainer.style.height = 'auto';
      uiContainer.style.minHeight = '100vh';
      uiContainer.style.overflow = 'auto';
      uiContainer.style.pointerEvents = 'auto';
      document.body.style.overflow = 'auto';

      const root = ReactDOM.createRoot(uiContainer);
      root.render(React.createElement(UILabGallery));
    }
  } else {
    new NeuroArenaGame();
  }
});

