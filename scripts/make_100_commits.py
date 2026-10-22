import subprocess
import sys
import os

commits = [
    # Phase 1: Workspace & Tooling Configuration
    {
        "files": ["pnpm-workspace.yaml"],
        "msg": "chore(workspace): configure pnpm monorepo workspace structure"
    },
    {
        "files": ["tsconfig.base.json"],
        "msg": "chore(tooling): add base TypeScript configuration for monorepo packages"
    },
    {
        "files": ["eslint.config.js"],
        "msg": "chore(tooling): add root ESLint flat configuration for TypeScript and React"
    },
    {
        "files": [".prettierrc"],
        "msg": "chore(tooling): add prettier formatting configuration"
    },
    {
        "files": [".prettierignore"],
        "msg": "chore(tooling): configure prettier ignore rules"
    },
    {
        "files": [".npmrc"],
        "msg": "chore(npm): set npm and pnpm engine dependency rules"
    },
    {
        "files": ["package.json"],
        "msg": "chore(root): update root package.json with workspace scripts and dev dependencies"
    },

    # Phase 2: Licensing & Procedural Asset Generation
    {
        "files": ["LICENSES.md"],
        "msg": "docs(licenses): record CC0 asset and texture attribution licenses"
    },
    {
        "files": ["scripts/generate_terrain_textures.js"],
        "msg": "build(assets): create procedural KTX2 terrain texture generation pipeline"
    },
    {
        "files": ["apps/game/public/basis/README.md"],
        "msg": "assets(game): add Basis Universal transcoder documentation"
    },
    {
        "files": ["apps/game/public/basis/basis_transcoder.js"],
        "msg": "assets(game): add Basis Universal web transcoder wrapper script"
    },
    {
        "files": ["apps/game/public/basis/basis_transcoder.wasm"],
        "msg": "assets(game): add Basis Universal WebAssembly transcoder binary"
    },
    {
        "files": ["apps/game/public/textures/terrain/grass_diffuse.ktx2"],
        "msg": "assets(textures): add grass diffuse KTX2 texture map"
    },
    {
        "files": ["apps/game/public/textures/terrain/grass_normal.ktx2"],
        "msg": "assets(textures): add grass normal KTX2 texture map"
    },
    {
        "files": ["apps/game/public/textures/terrain/dirt_diffuse.ktx2"],
        "msg": "assets(textures): add dirt diffuse KTX2 texture map"
    },
    {
        "files": ["apps/game/public/textures/terrain/dirt_normal.ktx2"],
        "msg": "assets(textures): add dirt normal KTX2 texture map"
    },
    {
        "files": ["apps/game/public/textures/terrain/rock_diffuse.ktx2"],
        "msg": "assets(textures): add rock diffuse KTX2 texture map"
    },
    {
        "files": ["apps/game/public/textures/terrain/rock_normal.ktx2"],
        "msg": "assets(textures): add rock normal KTX2 texture map"
    },
    {
        "files": ["apps/game/public/textures/terrain/sand_diffuse.ktx2"],
        "msg": "assets(textures): add sand diffuse KTX2 texture map"
    },
    {
        "files": ["apps/game/public/textures/terrain/sand_normal.ktx2"],
        "msg": "assets(textures): add sand normal KTX2 texture map"
    },

    # Phase 3: Design System Tokens, Theming & Base UI
    {
        "files": ["Packages/ui/package.json"],
        "msg": "chore(ui): initialize packages/ui package.json manifest"
    },
    {
        "files": ["Packages/ui/tsconfig.json"],
        "msg": "chore(ui): add TypeScript project configuration for UI package"
    },
    {
        "files": ["Packages/ui/src/tokens/index.ts"],
        "msg": "feat(ui/tokens): define scholarly explorer typography and color tokens"
    },
    {
        "files": ["Packages/ui/src/styles/theme.css"],
        "msg": "feat(ui/styles): implement CSS variable theme definitions for dark and light modes"
    },
    {
        "files": ["Packages/ui/src/styles/components.css"],
        "msg": "feat(ui/styles): implement restrained component stylesheets with glassmorphic accents"
    },
    {
        "files": ["Packages/ui/src/icons/index.tsx"],
        "msg": "feat(ui/icons): add custom SVG icon library for scholarly instruments"
    },
    {
        "files": ["Packages/ui/src/components/Panel.tsx"],
        "msg": "feat(ui/components): implement foundational Panel component"
    },
    {
        "files": ["Packages/ui/src/components/Button.tsx"],
        "msg": "feat(ui/components): implement Button component with variant hierarchy"
    },
    {
        "files": ["Packages/ui/src/components/Badge.tsx"],
        "msg": "feat(ui/components): implement Badge and status indicator components"
    },
    {
        "files": ["Packages/ui/src/components/KeyHint.tsx"],
        "msg": "feat(ui/components): implement KeyHint keyboard shortcut component"
    },
    {
        "files": ["Packages/ui/src/components/Modal.tsx"],
        "msg": "feat(ui/components): implement accessible Modal dialog component"
    },
    {
        "files": ["Packages/ui/src/components/NumberField.tsx"],
        "msg": "feat(ui/components): implement NumberField stepper and precision input component"
    },
    {
        "files": ["Packages/ui/src/components/ProgressRing.tsx"],
        "msg": "feat(ui/components): implement ProgressRing circular indicator component"
    },
    {
        "files": ["Packages/ui/src/components/Select.tsx"],
        "msg": "feat(ui/components): implement Select dropdown menu component"
    },
    {
        "files": ["Packages/ui/src/components/Slider.tsx"],
        "msg": "feat(ui/components): implement Slider input component with tick marks"
    },
    {
        "files": ["Packages/ui/src/components/Tabs.tsx"],
        "msg": "feat(ui/components): implement Tabs navigation component"
    },
    {
        "files": ["Packages/ui/src/components/Toast.tsx"],
        "msg": "feat(ui/components): implement Toast notification system"
    },
    {
        "files": ["Packages/ui/src/components/Toggle.tsx"],
        "msg": "feat(ui/components): implement Toggle switch component"
    },
    {
        "files": ["Packages/ui/src/components/Tooltip.tsx"],
        "msg": "feat(ui/components): implement Tooltip popover component"
    },
    {
        "files": ["Packages/ui/src/components/ToolWheel.tsx"],
        "msg": "feat(ui/components): implement radial ToolWheel selector component"
    },

    # Phase 4: UI Gallery & Specialized Interface Panels
    {
        "files": ["Packages/ui/src/gallery/UILabGallery.tsx"],
        "msg": "feat(ui/gallery): build UI Lab component gallery page for token verification"
    },
    {
        "files": ["Packages/ui/src/components/hud.ts"],
        "msg": "feat(ui/components): implement head-up display HUD overlay component"
    },
    {
        "files": ["Packages/ui/src/components/chatTerminal.ts"],
        "msg": "feat(ui/components): implement interactive ChatTerminal terminal emulator"
    },
    {
        "files": ["Packages/ui/src/components/dataCurator.ts"],
        "msg": "feat(ui/components): implement DataCurator dataset inspection panel"
    },
    {
        "files": ["Packages/ui/src/components/trainingDashboard.ts"],
        "msg": "feat(ui/components): implement real-time TrainingDashboard metrics interface"
    },
    {
        "files": ["Packages/ui/src/styles/workbench.css"],
        "msg": "feat(ui/styles): add layout and node-canvas styling for Workbench"
    },
    {
        "files": ["Packages/ui/src/index.ts"],
        "msg": "feat(ui): expose public exports from packages/ui index module"
    },

    # Phase 5: Workbench Node-Graph Editor
    {
        "files": ["Packages/ui/src/workbench/types.ts"],
        "msg": "feat(workbench/types): define node-graph schema, port types, and dataflow interfaces"
    },
    {
        "files": ["Packages/ui/src/workbench/runtime.ts"],
        "msg": "feat(workbench/runtime): implement execution runtime and port validation for node graph"
    },
    {
        "files": ["Packages/ui/src/workbench/components/CanvasGrid.tsx"],
        "msg": "feat(workbench/canvas): implement infinite pan/zoom canvas grid with SVG bezier connections"
    },
    {
        "files": ["Packages/ui/src/workbench/components/GraphNode.tsx"],
        "msg": "feat(workbench/nodes): implement typed GraphNode component with compact and expanded views"
    },
    {
        "files": ["Packages/ui/src/workbench/components/InspectorPanel.tsx"],
        "msg": "feat(workbench/inspector): implement dynamic node InspectorPanel with configuration fields"
    },
    {
        "files": ["Packages/ui/src/workbench/components/BottomDock.tsx"],
        "msg": "feat(workbench/dock): implement BottomDock metrics telemetry and timeline drawer"
    },
    {
        "files": ["Packages/ui/src/workbench/components/CommandPalette.tsx"],
        "msg": "feat(workbench/palette): implement CommandPalette for quick node instantiation"
    },
    {
        "files": ["Packages/ui/src/workbench/components/CodexStubModal.tsx"],
        "msg": "feat(workbench/codex): implement CodexStubModal documentation reference viewer"
    },
    {
        "files": ["Packages/ui/src/workbench/Workbench.tsx"],
        "msg": "feat(workbench): assemble full-screen Workbench node-graph editor"
    },

    # Phase 6: Engine Core - Architecture & Terrain Generation
    {
        "files": ["Packages/engine/package.json"],
        "msg": "chore(engine): initialize packages/engine package.json manifest"
    },
    {
        "files": ["Packages/engine/tsconfig.json"],
        "msg": "chore(engine): add TypeScript project configuration for engine package"
    },
    {
        "files": ["Packages/engine/src/terrain/noise.ts"],
        "msg": "feat(engine/noise): implement fBm, domain warping, and ridged multifractal noise generators"
    },
    {
        "files": ["Packages/engine/src/terrain/textureLoader.ts"],
        "msg": "feat(engine/terrain): implement KTX2 compressed texture loader with fallback support"
    },
    {
        "files": ["Packages/engine/src/terrain/terrainChunk.ts"],
        "msg": "feat(engine/terrain): implement TerrainChunk geometry generator with LOD skirt seams"
    },
    {
        "files": ["Packages/engine/src/terrain/terrainMaterial.ts"],
        "msg": "feat(engine/terrain): implement TSL triplanar surface splatting shader material"
    },
    {
        "files": ["Packages/engine/src/terrain/terrainWorker.ts"],
        "msg": "feat(engine/worker): implement web worker for off-main-thread terrain height generation"
    },
    {
        "files": ["Packages/engine/src/terrain/terrainManager.ts"],
        "msg": "feat(engine/terrain): implement TerrainManager for streaming chunks and CPU height sampling"
    },
    {
        "files": ["Packages/engine/src/camera/freeFlyCamera.ts"],
        "msg": "feat(engine/camera): implement FreeFlyCamera with smooth damping and collision bounds"
    },
    {
        "files": ["Packages/engine/src/player.ts"],
        "msg": "feat(engine/player): implement character controller with terrain ground clamping"
    },
    {
        "files": ["Packages/engine/src/audio.ts"],
        "msg": "feat(engine/audio): implement procedural spatial audio synthesizer and sound effects"
    },
    {
        "files": ["Packages/engine/src/world.ts"],
        "msg": "feat(engine/world): assemble World lifecycle manager for rendering and entity updates"
    },
    {
        "files": ["Packages/engine/src/index.ts"],
        "msg": "feat(engine): expose public engine systems and interfaces in index module"
    },

    # Phase 7: Engine World Entities & Environmental Shaders
    {
        "files": ["Packages/engine/src/entities/companion.ts"],
        "msg": "feat(engine/entities): implement Companion drone agent entity with hover physics"
    },
    {
        "files": ["Packages/engine/src/entities/shard.ts"],
        "msg": "feat(engine/entities): implement interactive Shard energy pickup entities"
    },
    {
        "files": ["Packages/engine/src/entities/terminal.ts"],
        "msg": "feat(engine/entities): implement Terminal console world entity with proximity trigger"
    },
    {
        "files": ["Packages/engine/src/environment/timeOfDay.ts"],
        "msg": "feat(engine/environment): implement TimeOfDay cycle with sun trajectory and golden hour derives"
    },
    {
        "files": ["Packages/engine/src/environment/skySystem.ts"],
        "msg": "feat(engine/sky): implement TSL atmospheric scattering sky dome with sun, moon, and stars"
    },
    {
        "files": ["Packages/engine/src/environment/fogSystem.ts"],
        "msg": "feat(engine/fog): implement exponential height fog and aerial perspective color shifting"
    },
    {
        "files": ["Packages/engine/src/environment/waterSystem.ts"],
        "msg": "feat(engine/water): implement screen-space reflection water system with Gerstner waves"
    },
    {
        "files": ["Packages/engine/src/environment/grassSystem.ts"],
        "msg": "feat(engine/grass): implement GPU-instanced grass blade system with wind turbulence"
    },
    {
        "files": ["Packages/engine/src/environment/foliageSystem.ts"],
        "msg": "feat(engine/foliage): implement procedural foliage distributor and instanced tree meshes"
    },
    {
        "files": ["Packages/engine/src/environment/postProcessingSystem.ts"],
        "msg": "feat(engine/postprocessing): implement post-processing pipeline with tone mapping and bloom"
    },
    {
        "files": ["Packages/engine/src/environment/environmentManager.ts"],
        "msg": "feat(engine/environment): orchestrate unified atmospheric and environmental quality manager"
    },

    # Phase 8: ML Core - RNG, Tokenizers, and Training Data
    {
        "files": ["Packages/ml-core/package.json"],
        "msg": "chore(ml-core): initialize packages/ml-core package.json manifest"
    },
    {
        "files": ["Packages/ml-core/tsconfig.json"],
        "msg": "chore(ml-core): add TypeScript project configuration for ml-core package"
    },
    {
        "files": ["Packages/ml-core/src/rng.ts"],
        "msg": "feat(ml-core/rng): implement deterministic Xoshiro128** PRNG with Box-Muller normal"
    },
    {
        "files": ["Packages/ml-core/src/types.ts"],
        "msg": "feat(ml-core/types): define transformer configurations, preset specifications, and batch types"
    },
    {
        "files": ["Packages/ml-core/data/LICENSE.txt"],
        "msg": "docs(ml-core/data): bundle Project Gutenberg public-domain license attribution"
    },
    {
        "files": ["Packages/ml-core/data/input.txt"],
        "msg": "data(ml-core): bundle Complete Works of Shakespeare training corpus"
    },
    {
        "files": ["Packages/ml-core/src/tokenizers/char.ts"],
        "msg": "feat(ml-core/tokenizers): implement CharTokenizer with frequency ordering and JSON serialization"
    },
    {
        "files": ["Packages/ml-core/src/tokenizers/bpe.ts"],
        "msg": "feat(ml-core/tokenizers): implement ByteBPE trainer and tokenizer with word boundary isolation"
    },
    {
        "files": ["Packages/ml-core/src/dataset.ts"],
        "msg": "feat(ml-core/dataset): implement DataLoader with 90/10 train-val split and batch sampling"
    },
    {
        "files": ["Packages/ml-core/src/tokenizeDemo.ts"],
        "msg": "feat(ml-core/demo): implement tokenizer benchmark and comparison demonstration script"
    },

    # Phase 9: ML Core - Pure Float64 Math Kernels & GPT Architecture
    {
        "files": ["Packages/ml-core/src/ops.ts"],
        "msg": "feat(ml-core/ops): implement pure Float64Array matrix kernels, LayerNorm, causal attention, and GELU"
    },
    {
        "files": ["Packages/ml-core/src/model.ts"],
        "msg": "feat(ml-core/model): implement pure Float64Array GPT transformer with hand-derived backward pass"
    },
    {
        "files": ["Packages/ml-core/src/forwardDemo.ts"],
        "msg": "feat(ml-core/demo): implement forwardDemo script verifying parameter counts and initial loss"
    },

    # Phase 10: ML Core - Optimizer, Sampler, Verification & Demo
    {
        "files": ["Packages/ml-core/src/optimizer.ts"],
        "msg": "feat(ml-core/optimizer): implement AdamW with decoupled weight decay and Cosine LR scheduler"
    },
    {
        "files": ["Packages/ml-core/src/sampler.ts"],
        "msg": "feat(ml-core/sampler): implement autoregressive async generator sampler with Top-K and Top-P"
    },
    {
        "files": ["Packages/ml-core/src/gradCheck.ts"],
        "msg": "feat(ml-core/gradCheck): implement central finite differences verification across every parameter group"
    },
    {
        "files": ["Packages/ml-core/src/demo.ts"],
        "msg": "feat(ml-core/demo): implement end-to-end training demo script with loss reporting and sampling"
    },
    {
        "files": ["Packages/ml-core/src/index.ts"],
        "msg": "feat(ml-core): expose comprehensive public API exports in index module"
    },
    {
        "files": ["apps/game/LICENSES.md"],
        "msg": "docs(game): document game asset license attribution and third-party notices"
    },

    # Phase 11: Apps - Benchmarking Suite
    {
        "files": ["apps/bench/package.json"],
        "msg": "chore(apps/bench): setup benchmarking suite package.json manifest"
    },
    {
        "files": ["apps/bench/tsconfig.json"],
        "msg": "chore(apps/bench): add TypeScript project configuration for bench suite"
    },
    {
        "files": ["apps/bench/vite.config.ts"],
        "msg": "chore(apps/bench): configure Vite bundler configuration for benchmark suite"
    },
    {
        "files": ["apps/bench/index.html"],
        "msg": "feat(apps/bench): provide HTML host template for benchmark harness"
    },
    {
        "files": ["apps/bench/src/main.ts"],
        "msg": "feat(apps/bench): implement automated ML Core performance benchmark suite"
    },

    # Phase 12: Apps - Game Host Application & WebGPU Systems
    {
        "files": ["apps/game/package.json"],
        "msg": "chore(apps/game): configure game host application package.json dependencies"
    },
    {
        "files": ["apps/game/tsconfig.json"],
        "msg": "chore(apps/game): add TypeScript project configuration for game application"
    },
    {
        "files": ["apps/game/vite.config.ts"],
        "msg": "chore(apps/game): configure Vite build pipeline with glsl and asset plugins"
    },
    {
        "files": ["apps/game/index.html"],
        "msg": "feat(apps/game): create main HTML host application shell with font loading"
    },
    {
        "files": ["apps/game/src/capabilityWorker.ts"],
        "msg": "feat(apps/game): implement worker for WebGPU device feature and adapter limit discovery"
    },
    {
        "files": ["apps/game/src/capability.ts"],
        "msg": "feat(apps/game): implement WebGPU capability probe with high-performance power preference"
    },
    {
        "files": ["apps/game/src/statsOverlay.ts"],
        "msg": "feat(apps/game): implement HUD stats overlay tracking GPU device, active chunks, and FPS"
    },
    {
        "files": ["apps/game/src/environmentDebugPanel.tsx"],
        "msg": "feat(apps/game): implement EnvironmentDebugPanel for real-time lighting and weather controls"
    },
    {
        "files": ["apps/game/src/main.ts"],
        "msg": "feat(apps/game): implement main game entrypoint with world lifecycle and view routing"
    },
    {
        "files": ["pnpm-lock.yaml"],
        "msg": "chore(lockfile): synchronize pnpm lockfile across all workspace dependencies"
    },
    {
        "files": ["scripts/make_100_commits.py"],
        "msg": "chore(tooling): add automated commit orchestration script"
    }
]

def main():
    print(f"Executing {len(commits)} commits sequentially...")
    total = len(commits)

    for idx, c in enumerate(commits, 1):
        # 1. Add files
        add_cmd = ["git", "add"] + c["files"]
        res = subprocess.run(add_cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Error adding {c['files']}: {res.stderr}")
            sys.exit(1)

        # 2. Commit
        commit_cmd = ["git", "commit", "-m", c["msg"]]
        res = subprocess.run(commit_cmd, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Error committing [{idx}/{total}] {c['msg']}: {res.stderr}")
            sys.exit(1)

        print(f"[{idx:03d}/{total}] {c['msg']}")

    # Check status
    res = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
    status_output = res.stdout.strip()
    if status_output:
        print(f"WARNING: Remaining uncommitted changes:\n{status_output}")
    else:
        print("\nAll changes successfully committed! Working tree clean.")

    # Push to origin main
    print("\nPushing to GitHub (git push origin main)...")
    push_res = subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True)
    print("STDOUT:\n" + push_res.stdout)
    print("STDERR:\n" + push_res.stderr)

    if push_res.returncode == 0:
        print("\nSUCCESS: All commits successfully pushed to GitHub!")
    else:
        print(f"\nPush exited with code {push_res.returncode}")
        sys.exit(push_res.returncode)

if __name__ == "__main__":
    main()
