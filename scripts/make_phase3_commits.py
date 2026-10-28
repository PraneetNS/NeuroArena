import subprocess
import sys

commits_phase3 = [
    # 1. ML Core Tokenizer Optimization
    {
        "files": ["Packages/ml-core/src/tokenizers/bpe.ts"],
        "msg": "perf(ml-core/bpe): cap BPE word cache size to prevent unbounded memory growth"
    },
    # 2. ML Core Trainer Memory Leak Fix
    {
        "files": ["Packages/ml-core/src/gpu/trainer.ts"],
        "msg": "fix(ml-core/gpu): bound metrics and diagnostics history to prevent memory leak"
    },
    # 3. ML Core Storage Checkpoint Optimization
    {
        "files": ["Packages/ml-core/src/gpu/storage.ts"],
        "msg": "perf(ml-core/storage): avoid redundant weight copies across checkpoint manifests in OPFS"
    },
    # 4. ML Core Throttle Stress Test Telemetry Data
    {
        "files": ["Packages/ml-core/data/runs/throttle_stress_test_10min.json"],
        "msg": "data(ml-core/runs): record 10-minute sustained throttle stress test telemetry"
    },
    # 5. Game Core Shingles Utility
    {
        "files": ["Packages/game-core/src/shingles.ts", "Packages/game-core/src/lens.ts"],
        "msg": "refactor(game-core/shingles): extract reusable 3-gram text shingle and Jaccard utilities"
    },
    # 6. Game Core Inverted Index Cleaner Filter
    {
        "files": ["Packages/game-core/src/cleaner.ts"],
        "msg": "perf(game-core/cleaner): accelerate near-duplicate shingle filter with inverted index"
    },
    # 7. Game Core Vault Persistence
    {
        "files": ["Packages/game-core/src/vault.ts"],
        "msg": "feat(game-core/vault): persist best validation loss and autopsy status to localStorage"
    },
    # 8. Game Core Tutorial Types & Telemetry
    {
        "files": ["Packages/game-core/src/tutorial/types.ts", "Packages/game-core/src/tutorial/telemetry.ts"],
        "msg": "feat(game-core/tutorial): define tutorial step schema, state interfaces, and telemetry logger"
    },
    # 9. Game Core Lumen Narrative & Codex Entries
    {
        "files": ["Packages/game-core/src/tutorial/lumenLines.ts", "Packages/game-core/src/tutorial/codexData.ts"],
        "msg": "feat(game-core/tutorial): author Lumen narrative dialog scripts and machine learning codex data"
    },
    # 10. Game Core Tutorial Director & Verification Bot
    {
        "files": [
            "Packages/game-core/src/tutorial/tutorialSteps.ts",
            "Packages/game-core/src/tutorial/director.ts",
            "Packages/game-core/src/tutorial/bot.ts",
            "Packages/game-core/src/tutorial/index.ts",
            "Packages/game-core/src/index.ts"
        ],
        "msg": "feat(game-core/tutorial): implement TutorialDirector state machine and automated verification bot"
    },
    # 11. Engine WebGPU Types & Dev Dependencies
    {
        "files": ["Packages/engine/package.json", "Packages/engine/src/env.d.ts", "pnpm-lock.yaml"],
        "msg": "chore(engine): configure WebGPU WGSL raw loader declarations and type definitions"
    },
    # 12. Engine Terrain Worker Batch Throttling
    {
        "files": ["Packages/engine/src/terrain/terrainManager.ts"],
        "msg": "perf(engine/terrain): throttle chunk build batches when worker thread is inactive"
    },
    # 13. Engine Lumen Companion 3D Entity
    {
        "files": ["Packages/engine/src/entities/lumen.ts"],
        "msg": "feat(engine/entities): implement 3D Lumen companion spirit with emissive orbital aesthetics"
    },
    # 14. Engine Camp Audio, Orrery & Loss Lantern
    {
        "files": [
            "Packages/engine/src/camp/campAudio.ts",
            "Packages/engine/src/camp/lossLantern.ts",
            "Packages/engine/src/camp/orrery.ts"
        ],
        "msg": "feat(engine/camp): create Camp audio ambiance, attention head Orrery, and loss lantern"
    },
    # 15. Engine Camp Slate, Scroll & Mentor Notes
    {
        "files": [
            "Packages/engine/src/camp/slate.ts",
            "Packages/engine/src/camp/scroll.ts",
            "Packages/engine/src/camp/mentorsNotes.ts"
        ],
        "msg": "feat(engine/camp): implement chalkboard telemetry slate, text scroll, and mentor notes"
    },
    # 16. Engine CampScene Orchestrator
    {
        "files": ["Packages/engine/src/camp/campScene.ts", "Packages/engine/src/index.ts"],
        "msg": "feat(engine/camp): orchestrate CampScene retreat environment with adaptive GPU throttling"
    },
    # 17. UI Lumen Subtitles & Codex Modal
    {
        "files": ["Packages/ui/src/tutorial/LumenSubtitles.tsx", "Packages/ui/src/codex/CodexModal.tsx"],
        "msg": "feat(ui/tutorial): add LumenSubtitles overlay and interactive Codex modal journal"
    },
    # 18. UI Camp Overlay HUD
    {
        "files": ["Packages/ui/src/camp/CampOverlay.tsx"],
        "msg": "feat(ui/camp): create CampOverlay HUD with camera controls and live throttle management"
    },
    # 19. UI Workbench Integration
    {
        "files": [
            "Packages/ui/src/workbench/RealRuntime.ts",
            "Packages/ui/src/workbench/Workbench.tsx",
            "Packages/ui/src/index.ts"
        ],
        "msg": "feat(ui/workbench): wire Camp transition triggers and Codex journal integration into Workbench"
    },
    # 20. Game Main Loop Integration
    {
        "files": ["apps/game/src/main.ts"],
        "msg": "feat(game): integrate Lumen companion, TutorialDirector, and The Camp retreat into game loop"
    },
    # 21. Agents Configuration & Skills
    {
        "files": [".agents"],
        "msg": "chore(agents): configure ponytail agent plugins, inspection skills, and rules"
    },
    # 22. Phase 3 Release Script
    {
        "files": ["scripts/make_phase3_commits.py"],
        "msg": "chore(tooling): add phase 3 commit orchestration script for tutorial and camp release"
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
    print(f"Starting orchestration of Phase 3 ({len(commits_phase3)} commits)...")
    success = 0
    for idx, c in enumerate(commits_phase3, 1):
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
            print(f"[{idx}/{len(commits_phase3)}] {c['msg']}")
            success += 1
        else:
            print(f"[{idx}/{len(commits_phase3)}] (Skipped, no staged changes for {c['files']})")

    print(f"\nPhase 3 completed: {success} commits created!")

if __name__ == "__main__":
    main()
