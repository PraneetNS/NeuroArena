import subprocess
import sys

commits_phase2 = [
    # 21-25. Game Core
    {
        "files": ["Packages/game-core/package.json"],
        "msg": "chore(game-core): update package dependencies and build exports"
    },
    {
        "files": ["Packages/game-core/src/types.ts"],
        "msg": "feat(game-core/types): add shard telemetry, signal metrics, and sweep types"
    },
    {
        "files": ["Packages/game-core/src/lens.ts"],
        "msg": "feat(game-core/lens): optimize optical lens signals and histogram binning"
    },
    {
        "files": ["Packages/game-core/src/generator.ts"],
        "msg": "feat(game-core/generator): enhance procedural shard text and metadata generation"
    },
    {
        "files": ["Packages/game-core/src/vault.ts"],
        "msg": "feat(game-core/vault): implement persistent kept shard filtering and storage"
    },

    # 26-31. ML Core Engine & Validation
    {
        "files": ["Packages/ml-core/data/input.txt"],
        "msg": "data(ml-core): expand raw Shakespeare text training corpus partition"
    },
    {
        "files": ["Packages/ml-core/src/data/validation.ts"],
        "msg": "fix(ml-core/data): resolve Node ESM filesystem loading and upward path traversal"
    },
    {
        "files": ["Packages/ml-core/src/gpu/model.ts"],
        "msg": "feat(ml-core/gpu): add gradient clipping and diagnostics reduction pass to GpuModel"
    },
    {
        "files": ["Packages/ml-core/src/gpu/trainer.ts"],
        "msg": "perf(ml-core/gpu): optimize asynchronous training loop and staging buffer transfers"
    },
    {
        "files": ["Packages/ml-core/src/scalingRun.ts"],
        "msg": "feat(ml-core/scaling): implement multi-preset scaling matrix runner"
    },
    {
        "files": ["Packages/ml-core/src/diagnostics.ts"],
        "msg": "feat(ml-core/diagnostics): add data-size monotone interpolation and knee detectors"
    },
    {
        "files": ["Packages/ml-core/data/runs/scaling_experiment.json"],
        "msg": "data(ml-core/runs): record empirical 2,000-step multi-preset scaling results"
    },

    # 32-37. UI Workbench & Components
    {
        "files": ["Packages/ui/src/workbench/types.ts"],
        "msg": "feat(ui/types): expand ModelNodeData with absolute tokens and scaling advice"
    },
    {
        "files": ["Packages/ui/src/workbench/RealRuntime.ts"],
        "msg": "feat(ui/runtime): integrate absolute token starvation detection and baseline positioning"
    },
    {
        "files": ["Packages/ui/src/workbench/components/GraphNode.tsx"],
        "msg": "feat(ui/components): render absolute token count and baseline position in GraphNode"
    },
    {
        "files": ["Packages/ui/src/workbench/components/InspectorPanel.tsx"],
        "msg": "feat(ui/components): add interactive data scaling meter and advice in InspectorPanel"
    },
    {
        "files": ["Packages/ui/src/workbench/Workbench.tsx"],
        "msg": "feat(ui/workbench): wire live model node data to telemetry and inspector updates"
    },
    {
        "files": ["Packages/ui/src/components/VaultPanel.tsx"],
        "msg": "feat(ui/vault): implement Shard Vault filter chips and signal inspector"
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
    print(f"Starting orchestration of Phase 2 ({len(commits_phase2)} commits)...")
    success = 0
    for idx, c in enumerate(commits_phase2, 1):
        for f in c["files"]:
            ok, out = run(f'git add "{f}"')
            if not ok:
                print(f"Failed to add {f}")
                sys.exit(1)
        
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
            print(f"[{idx}/{len(commits_phase2)}] {c['msg']}")
            success += 1
        else:
            print(f"[{idx}/{len(commits_phase2)}] (Skipped, no staged changes for {c['files']})")

    print(f"\nPhase 2 completed: {success} commits created!")

if __name__ == "__main__":
    main()
