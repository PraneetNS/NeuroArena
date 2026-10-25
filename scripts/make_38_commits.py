import subprocess
import sys
import os

commits = [
    # 1. Root and TypeScript configuration
    {
        "files": ["tsconfig.base.json"],
        "msg": "chore(tooling): update typescript base configuration aliases for packages"
    },

    # 2-7. Game Core Shard & Vault Subsystems
    {
        "files": ["packages/game-core/package.json"],
        "msg": "chore(game-core): update package dependencies and build exports"
    },
    {
        "files": ["packages/game-core/src/types.ts"],
        "msg": "feat(game-core/types): add shard telemetry, signal metrics, and sweep types"
    },
    {
        "files": ["packages/game-core/src/lens.ts"],
        "msg": "feat(game-core/lens): optimize optical lens signals and histogram binning"
    },
    {
        "files": ["packages/game-core/src/generator.ts"],
        "msg": "feat(game-core/generator): enhance procedural shard text and metadata generation"
    },
    {
        "files": ["packages/game-core/src/vault.ts"],
        "msg": "feat(game-core/vault): implement persistent kept shard filtering and storage"
    },
    {
        "files": ["packages/game-core/src/sweepCalc.ts"],
        "msg": "feat(game-core/sweep): add parameter sweep calculation utilities"
    },

    # 8-16. ML-Core Corpus, Packaging & Tokenizer Assets
    {
        "files": ["packages/ml-core/scripts/buildCorpus.ts"],
        "msg": "feat(ml-core/corpus): add corpus builder script for tokenization and packaging"
    },
    {
        "files": ["packages/ml-core/data/input.txt"],
        "msg": "data(ml-core): expand raw Shakespeare text training corpus"
    },
    {
        "files": ["apps/bench/public/shakespeare.txt"],
        "msg": "data(bench): sync full Shakespeare corpus text to benchmark public assets"
    },
    {
        "files": ["packages/ml-core/data/input.txt.gz"],
        "msg": "data(ml-core): add compressed raw input corpus gzip archive"
    },
    {
        "files": ["packages/ml-core/data/train_text.txt.gz"],
        "msg": "data(ml-core): add compressed train text partition gzip archive"
    },
    {
        "files": ["packages/ml-core/data/val_text.txt.gz"],
        "msg": "data(ml-core): add compressed validation text partition gzip archive"
    },
    {
        "files": ["packages/ml-core/data/bpe_1024.json"],
        "msg": "data(ml-core/bpe): add pre-trained ByteBPE-1024 vocabulary and merges table"
    },
    {
        "files": ["packages/ml-core/data/bpe_1024.json.gz"],
        "msg": "data(ml-core/bpe): add compressed ByteBPE-1024 vocabulary gzip archive"
    },
    {
        "files": ["packages/ml-core/data/corpus_manifest.json"],
        "msg": "data(ml-core/corpus): add corpus partition metadata and checksum manifest"
    },

    # 17-22. ML-Core Algorithms, GPU Engine & Diagnostics
    {
        "files": ["packages/ml-core/src/baselines.ts"],
        "msg": "feat(ml-core/baselines): implement analytical unigram, bigram, and trigram loss baselines"
    },
    {
        "files": ["packages/ml-core/src/data/validation.ts"],
        "msg": "fix(ml-core/data): resolve Node ESM filesystem loading and upward path traversal"
    },
    {
        "files": ["packages/ml-core/src/gpu/model.ts"],
        "msg": "feat(ml-core/gpu): add gradient clipping and diagnostics reduction pass to GpuModel"
    },
    {
        "files": ["packages/ml-core/src/gpu/trainer.ts"],
        "msg": "perf(ml-core/gpu): optimize asynchronous training loop and staging buffer transfers"
    },
    {
        "files": ["packages/ml-core/src/scalingRun.ts"],
        "msg": "feat(ml-core/scaling): implement multi-preset scaling matrix runner"
    },
    {
        "files": ["packages/ml-core/src/diagnostics.ts"],
        "msg": "feat(ml-core/diagnostics): add data-size monotone interpolation and knee detectors"
    },

    # 23-27. Empirical Run Results & Scaling Logs
    {
        "files": ["packages/ml-core/data/runs/scaling_experiment.json"],
        "msg": "data(ml-core/runs): record empirical 2,000-step multi-preset scaling results"
    },
    {
        "files": ["packages/ml-core/data/runs/long_run_curves.json"],
        "msg": "data(ml-core/runs): record 12,000-step long-run curves and crossing steps"
    },
    {
        "files": ["packages/ml-core/data/runs/memorization_probe_results.json"],
        "msg": "data(ml-core/runs): record memorizing vs healthy model probe verification"
    },
    {
        "files": ["packages/ml-core/data/runs/data_size_8k_experiment.json"],
        "msg": "data(ml-core/runs): record 8,000-step data-size matrix scaling benchmarks"
    },
    {
        "files": ["packages/ml-core/data/runs/data_size_fit.json"],
        "msg": "data(ml-core/runs): store monotone validation loss interpolation curves"
    },

    # 28-33. UI Workbench Components & Runtime
    {
        "files": ["packages/ui/src/workbench/types.ts"],
        "msg": "feat(ui/types): expand ModelNodeData with absolute tokens and scaling advice"
    },
    {
        "files": ["packages/ui/src/workbench/RealRuntime.ts"],
        "msg": "feat(ui/runtime): integrate absolute token starvation detection and baseline positioning"
    },
    {
        "files": ["packages/ui/src/workbench/components/GraphNode.tsx"],
        "msg": "feat(ui/components): render absolute token count and baseline position in GraphNode"
    },
    {
        "files": ["packages/ui/src/workbench/components/InspectorPanel.tsx"],
        "msg": "feat(ui/components): add interactive data scaling meter and advice in InspectorPanel"
    },
    {
        "files": ["packages/ui/src/workbench/Workbench.tsx"],
        "msg": "feat(ui/workbench): wire live model node data to telemetry and inspector updates"
    },
    {
        "files": ["packages/ui/src/components/VaultPanel.tsx"],
        "msg": "feat(ui/vault): implement Shard Vault filter chips and signal inspector"
    },

    # 34-36. 3D Game World & HUD Integration
    {
        "files": ["apps/game/src/shardWorld.ts"],
        "msg": "feat(game/world): add procedural shard spawning coordinates and cluster scattering"
    },
    {
        "files": ["apps/game/src/shardHUD.tsx"],
        "msg": "feat(game/hud): implement real-time 3D shard telemetry HUD overlay"
    },
    {
        "files": ["apps/game/src/main.ts"],
        "msg": "feat(game): connect shard collection events to game engine loop"
    },

    # 37-38. Docs and Pipeline Orchestration
    {
        "files": ["README.md"],
        "msg": "docs: document WebGPU training curves, BPE-1024 migration, and scaling findings"
    },
    {
        "files": ["scripts/make_38_commits.py"],
        "msg": "chore(tooling): add commit orchestration pipeline for v4.1 release"
    }
]

def run(cmd):
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if p.returncode != 0:
        print(f"Error running: {cmd}")
        print("Stdout:", p.stdout)
        print("Stderr:", p.stderr)
        return False, p.stdout + p.stderr
    return True, p.stdout

def main():
    print(f"Starting orchestration of {len(commits)} commits...")
    success_count = 0
    for idx, c in enumerate(commits, 1):
        for f in c["files"]:
            ok, out = run(f'git add "{f}"')
            if not ok:
                print(f"Failed to add {f}")
                sys.exit(1)
        
        # Check if there are staged changes
        ok, status_out = run('git status --porcelain')
        has_staged = False
        for line in status_out.splitlines():
            if line and line[0] in ['M', 'A', 'D', 'R', 'C']:
                has_staged = True
                break
        
        if has_staged:
            msg = c["msg"].replace('"', '\\"')
            ok, commit_out = run(f'git commit -m "{msg}"')
            if not ok:
                print(f"Failed commit: {msg}")
                sys.exit(1)
            print(f"[{idx}/{len(commits)}] {c['msg']}")
            success_count += 1
        else:
            print(f"[{idx}/{len(commits)}] (Skipped, no staged changes for {c['files']})")

    print(f"\nSuccessfully created {success_count} commits!")

if __name__ == "__main__":
    main()
