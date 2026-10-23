import subprocess
import sys
import os

commits = [
    # Phase 1: Tooling, Monorepo Config & Root Docs
    {
        "files": [".gitignore"],
        "msg": "chore(git): ignore temporary scratch verification scripts"
    },
    {
        "files": ["tsconfig.base.json"],
        "msg": "chore(tooling): update root typescript base configuration with project paths"
    },
    {
        "files": ["pnpm-lock.yaml"],
        "msg": "chore(workspace): synchronize monorepo pnpm lockfile"
    },
    {
        "files": ["README.md"],
        "msg": "docs: update project documentation with WebGPU architecture and benchmarks"
    },
    {
        "files": ["apps/bench/vite.config.ts"],
        "msg": "chore(bench): configure Vite bundler for WebGPU benchmark suite"
    },

    # Phase 2: WebGPU WGSL Compute Shaders
    {
        "files": ["Packages/ml-core/src/gpu/shaders/wgsl.d.ts"],
        "msg": "types(ml-core/gpu): add ambient declaration types for raw WGSL imports"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/matmul.wgsl"],
        "msg": "feat(ml-core/gpu): add 16x16 tiled matrix multiplication compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/batched_matmul.wgsl"],
        "msg": "feat(ml-core/gpu): add batched matrix multiplication WGSL compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/layernorm.wgsl"],
        "msg": "feat(ml-core/gpu): add forward layer normalization compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/layernorm_backward_dx.wgsl"],
        "msg": "feat(ml-core/gpu): add layer norm backward input gradient dx shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/layernorm_backward_params.wgsl"],
        "msg": "feat(ml-core/gpu): add layer norm parameter gradient dw and db shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/bias_backward.wgsl"],
        "msg": "feat(ml-core/gpu): add parallel bias backward gradient reduction shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/gelu.wgsl"],
        "msg": "feat(ml-core/gpu): add forward GELU activation WGSL compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/gelu_backward.wgsl"],
        "msg": "feat(ml-core/gpu): add backward GELU activation gradient compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/residual.wgsl"],
        "msg": "feat(ml-core/gpu): add elementwise residual addition compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/embedding.wgsl"],
        "msg": "feat(ml-core/gpu): add forward token and positional embedding lookup shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/embedding_backward.wgsl"],
        "msg": "feat(ml-core/gpu): add backward token embedding gradient accumulation shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/position_embedding_backward.wgsl"],
        "msg": "feat(ml-core/gpu): add position embedding backward gradient compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/causal_attention.wgsl"],
        "msg": "feat(ml-core/gpu): add causal self-attention forward compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/attention_value.wgsl"],
        "msg": "feat(ml-core/gpu): add attention context-value multiplication compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/causal_attention_backward_q.wgsl"],
        "msg": "feat(ml-core/gpu): add causal attention query gradient backward shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/causal_attention_backward_kv.wgsl"],
        "msg": "feat(ml-core/gpu): add causal attention key-value gradient backward shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/cross_entropy.wgsl"],
        "msg": "feat(ml-core/gpu): add fused cross-entropy loss with logits backward shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/adamw.wgsl"],
        "msg": "feat(ml-core/gpu): add AdamW fused optimizer step compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/grad_norm.wgsl"],
        "msg": "feat(ml-core/gpu): add gradient L2 norm sum-of-squares compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/reduce_norm.wgsl"],
        "msg": "feat(ml-core/gpu): add workgroup tree reduction shader for gradient clipping"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/reduce_sum.wgsl"],
        "msg": "feat(ml-core/gpu): add general reduction shader for buffer scalar aggregation"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/zero_buffer.wgsl"],
        "msg": "feat(ml-core/gpu): add fast memory clearing zero buffer compute shader"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/diagnostics.wgsl"],
        "msg": "feat(ml-core/gpu): add on-device GPU weight and gradient diagnostic probes"
    },
    {
        "files": ["Packages/ml-core/src/gpu/shaders/index.ts"],
        "msg": "feat(ml-core/gpu): export WGSL shader registry and module bindings"
    },

    # Phase 3: WebGPU ML Core Engine
    {
        "files": ["Packages/ml-core/src/gpu/types.ts"],
        "msg": "feat(ml-core/gpu): define GPU trainer, buffer layout, and execution types"
    },
    {
        "files": ["Packages/ml-core/src/gpu/context.ts"],
        "msg": "feat(ml-core/gpu): implement WebGPU device initialization and limits probe"
    },
    {
        "files": ["Packages/ml-core/src/gpu/storage.ts"],
        "msg": "feat(ml-core/gpu): implement GPU memory buffer manager and tensor staging allocations"
    },
    {
        "files": ["Packages/ml-core/src/gpu/pipelines.ts"],
        "msg": "feat(ml-core/gpu): build compute pipeline cache and bind group layout manager"
    },
    {
        "files": ["Packages/ml-core/src/gpu/model.ts"],
        "msg": "feat(ml-core/gpu): construct GPU forward pass and backward computation graph"
    },
    {
        "files": ["Packages/ml-core/src/gpu/sampler.ts"],
        "msg": "feat(ml-core/gpu): implement GPU temperature-scaled autoregressive text sampler"
    },
    {
        "files": ["Packages/ml-core/src/gpu/parity.ts"],
        "msg": "feat(ml-core/gpu): implement CPU vs GPU numerical gradient and loss parity suite"
    },
    {
        "files": ["Packages/ml-core/src/gpu/trainer.ts"],
        "msg": "feat(ml-core/gpu): implement main thread GPUTrainer with telemetry stream"
    },
    {
        "files": ["Packages/ml-core/src/gpu/trainer.worker.ts"],
        "msg": "feat(ml-core/gpu): implement background WebWorker GPU training supervisor"
    },
    {
        "files": ["Packages/ml-core/src/gpu/client.ts"],
        "msg": "feat(ml-core/gpu): implement promise-based GPUTrainerClient worker proxy"
    },
    {
        "files": ["Packages/ml-core/src/gpu/index.ts"],
        "msg": "feat(ml-core/gpu): export WebGPU neural training client and utilities"
    },

    # Phase 4: ML Diagnostics, Reference Runs & Validation Splits
    {
        "files": ["Packages/ml-core/data/runs/healthy.json"],
        "msg": "feat(ml-core/diagnostics): add healthy reference training telemetry run"
    },
    {
        "files": ["Packages/ml-core/data/runs/overfit.json"],
        "msg": "feat(ml-core/diagnostics): add overfitting benchmark run with validation divergence"
    },
    {
        "files": ["Packages/ml-core/data/runs/diverge.json"],
        "msg": "feat(ml-core/diagnostics): add NaN/Inf divergence telemetry run with gradient explosion"
    },
    {
        "files": ["Packages/ml-core/data/runs/duplicated.json"],
        "msg": "feat(ml-core/diagnostics): add memorization run on synthetic duplicate data"
    },
    {
        "files": ["Packages/ml-core/data/runs/leaky.json"],
        "msg": "feat(ml-core/diagnostics): add contaminated train-validation leakage reference run"
    },
    {
        "files": ["Packages/ml-core/src/diagnostics.ts"],
        "msg": "feat(ml-core/diagnostics): implement 13 telemetry anomaly detectors and autopsy report"
    },
    {
        "files": ["Packages/ml-core/src/diagnoseDemo.ts"],
        "msg": "feat(ml-core/diagnostics): add CLI diagnostics evaluation harness across reference runs"
    },
    {
        "files": ["Packages/ml-core/src/data/validation.ts"],
        "msg": "feat(ml-core/data): establish canonical Shakespeare validation split provenance"
    },
    {
        "files": ["Packages/ml-core/src/validation.ts"],
        "msg": "refactor(ml-core): expose unified validation corpus constants and char offsets"
    },
    {
        "files": ["Packages/ml-core/src/tokenizers/char.ts"],
        "msg": "feat(ml-core/tokenizers): add character tokenizer with deterministic vocab table"
    },
    {
        "files": ["Packages/ml-core/src/model.ts"],
        "msg": "refactor(ml-core/model): optimize transformer forward/backward pass memory layout"
    },
    {
        "files": ["Packages/ml-core/src/demo.ts"],
        "msg": "feat(ml-core): enhance CLI training demo with live telemetry and perplexity tracking"
    },
    {
        "files": ["Packages/ml-core/src/index.ts"],
        "msg": "feat(ml-core): re-export validation provenance, diagnostics engine, and GPU client"
    },
    {
        "files": ["Packages/ml-core/package.json"],
        "msg": "chore(ml-core): add diagnostics and validation build scripts"
    },

    # Phase 5: Game Core Data Shards, Lens, & Cleaner Architecture
    {
        "files": ["Packages/game-core/data/LICENSE.txt"],
        "msg": "legal(game-core): document Project Gutenberg public domain text license"
    },
    {
        "files": ["Packages/game-core/data/input.txt"],
        "msg": "assets(game-core): add raw Shakespeare corpus source for shard extraction"
    },
    {
        "files": ["Packages/game-core/data/pride_and_prejudice.txt"],
        "msg": "assets(game-core): add Jane Austen source text for cross-domain shards"
    },
    {
        "files": ["Packages/game-core/package.json"],
        "msg": "chore(game-core): initialize package configuration and dependencies"
    },
    {
        "files": ["Packages/game-core/tsconfig.json"],
        "msg": "chore(game-core): configure TypeScript project references for game-core"
    },
    {
        "files": ["Packages/game-core/src/types.ts"],
        "msg": "feat(game-core): define shard, biome region, lens signal, and vault types"
    },
    {
        "files": ["Packages/game-core/src/data/shakespeare.ts"],
        "msg": "feat(game-core/data): embed raw Shakespeare text partition for offline play"
    },
    {
        "files": ["Packages/game-core/src/data/shakespeareCorpus.ts"],
        "msg": "feat(game-core/data): implement Shakespeare text slice and chunk indexing"
    },
    {
        "files": ["Packages/game-core/src/data/prideAndPrejudice.ts"],
        "msg": "feat(game-core/data): embed Pride and Prejudice text slices for out-of-domain shards"
    },
    {
        "files": ["Packages/game-core/src/data/prideAndPrejudiceCorpus.ts"],
        "msg": "feat(game-core/data): implement Pride and Prejudice shard extraction helpers"
    },
    {
        "files": ["Packages/game-core/src/data/boilerplate.ts"],
        "msg": "feat(game-core/data): embed synthetic boilerplate and noisy web text patterns"
    },
    {
        "files": ["Packages/game-core/src/data/corpus.ts"],
        "msg": "feat(game-core/data): build multi-source shard sampling and metadata catalog"
    },
    {
        "files": ["Packages/game-core/src/dictionary.ts"],
        "msg": "feat(game-core): implement English word frequency lookup and bloom filter"
    },
    {
        "files": ["Packages/game-core/src/bigram.ts"],
        "msg": "feat(game-core): implement character bigram frequency estimator for text quality"
    },
    {
        "files": ["Packages/game-core/src/regions.ts"],
        "msg": "feat(game-core): implement 5-biome shard region layout and contamination zones"
    },
    {
        "files": ["Packages/game-core/src/poisson.ts"],
        "msg": "feat(game-core): implement 2D Poisson disc sampling for shard world placement"
    },
    {
        "files": ["Packages/game-core/src/spatial.ts"],
        "msg": "feat(game-core): implement spatial hash grid for fast shard proximity queries"
    },
    {
        "files": ["Packages/game-core/src/generator.ts"],
        "msg": "feat(game-core): implement procedural shard generation with synthetic noise injection"
    },
    {
        "files": ["Packages/game-core/src/lens.ts"],
        "msg": "feat(game-core): implement analytical Lens signals without leaking ground-truth labels"
    },
    {
        "files": ["Packages/game-core/src/lensReport.ts"],
        "msg": "feat(game-core): implement Lens diagnostic signal summary and distribution report"
    },
    {
        "files": ["Packages/game-core/src/cleaner.ts"],
        "msg": "feat(game-core): implement configurable dataset cleaner with duplicate and quality filters"
    },
    {
        "files": ["Packages/game-core/src/vault.ts"],
        "msg": "feat(game-core): implement player ShardVault with keep/trash states and persistence"
    },
    {
        "files": ["Packages/game-core/src/walkthrough.ts"],
        "msg": "feat(game-core): add deterministic headless 25-shard game walkthrough script"
    },
    {
        "files": ["Packages/game-core/src/inspect.ts"],
        "msg": "feat(game-core): add shard corpus inspection CLI tool"
    },
    {
        "files": ["Packages/game-core/src/index.ts"],
        "msg": "feat(game-core): export world shard generator, lens, cleaner, and vault modules"
    },

    # Phase 6: UI Design System, RealRuntime & Workbench
    {
        "files": ["Packages/ui/package.json"],
        "msg": "chore(ui): update package dependencies with game-core and ml-core links"
    },
    {
        "files": ["Packages/ui/src/env.d.ts"],
        "msg": "types(ui): add Vite environment client declarations"
    },
    {
        "files": ["Packages/ui/src/workbench/types.ts"],
        "msg": "feat(ui/workbench): define 6-node DAG pipeline states and inspection types"
    },
    {
        "files": ["Packages/ui/src/workbench/runtime.ts"],
        "msg": "refactor(ui/workbench): abstract WorkbenchRuntime interface for pluggable engines"
    },
    {
        "files": ["Packages/ui/src/workbench/RealRuntime.ts"],
        "msg": "feat(ui/workbench): implement production RealRuntime with WebGPU and worker pipeline"
    },
    {
        "files": ["Packages/ui/src/components/VaultPanel.tsx"],
        "msg": "feat(ui): implement interactive Vault shard curator panel with lens inspection"
    },
    {
        "files": ["Packages/ui/src/workbench/components/GraphNode.tsx"],
        "msg": "feat(ui/workbench): render interactive node canvas cards with port connections"
    },
    {
        "files": ["Packages/ui/src/workbench/components/BottomDock.tsx"],
        "msg": "feat(ui/workbench): implement telemetry bottom dock with loss graphs and step metrics"
    },
    {
        "files": ["Packages/ui/src/workbench/components/InspectorPanel.tsx"],
        "msg": "feat(ui/workbench): implement interactive node inspectors for all 6 DAG nodes"
    },
    {
        "files": ["Packages/ui/src/workbench/components/AutopsyModal.tsx"],
        "msg": "feat(ui/workbench): implement post-mortem run autopsy modal with fix recommendations"
    },
    {
        "files": ["Packages/ui/src/workbench/components/RunManagerModal.tsx"],
        "msg": "feat(ui/workbench): implement run history and saved model checkpoints modal"
    },
    {
        "files": ["Packages/ui/src/workbench/Workbench.tsx"],
        "msg": "feat(ui/workbench): assemble main 6-node ML training workbench canvas"
    },
    {
        "files": ["Packages/ui/src/index.ts"],
        "msg": "feat(ui): export RealRuntime, Workbench, and VaultPanel components"
    },

    # Phase 7: Application Integration & Verification
    {
        "files": ["apps/bench/public/shakespeare.txt"],
        "msg": "assets(bench): add Shakespeare benchmark training corpus asset"
    },
    {
        "files": ["apps/bench/src/main.ts"],
        "msg": "feat(bench): implement automated WebGPU benchmark matrix with adapter telemetry"
    },
    {
        "files": ["apps/game/package.json"],
        "msg": "chore(game): link game-core and ui packages in game application"
    },
    {
        "files": ["apps/game/src/shardHUD.tsx"],
        "msg": "feat(game): implement heads-up display overlay for shard collection and lens telemetry"
    },
    {
        "files": ["apps/game/src/shardWorld.ts"],
        "msg": "feat(game): integrate procedural shard world placement and player collection physics"
    },
    {
        "files": ["apps/game/src/main.ts"],
        "msg": "feat(game): bind interactive shard inspection and workbench modal to game loop"
    },
    {
        "files": ["scripts/make_85_commits.py"],
        "msg": "chore(tooling): add release commit orchestration pipeline script"
    },
]

def main():
    print(f"Total planned commits: {len(commits)}")
    
    # Verify all files exist
    all_files = set()
    for c in commits:
        for f in c["files"]:
            if not os.path.exists(f):
                print(f"ERROR: File not found: {f}")
                sys.exit(1)
            all_files.add(f)
    print(f"Verified {len(all_files)} files exist on disk.")

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
        print(f"\nWARNING: Remaining uncommitted changes:\n{status_output}")
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
