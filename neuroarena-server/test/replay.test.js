const { MatchReplayRecorder } = require('../src/replayEngine');

console.log('▶ Testing Match Replay Recording & Deterministic Verification...');

const recorder = new MatchReplayRecorder(
  'match_9921',
  'Biome3_VarianceTundra',
  { id: 'p1', name: 'Alice' },
  { id: 'p2', name: 'Bob' }
);

for (let t = 0; t < 50; t++) {
  recorder.recordTick(
    t,
    { moveX: 0.5, moveY: 0.2, trainStep: true },
    { moveX: -0.3, moveY: 0.8, trainStep: false },
    { p1Loss: 0.54 - t * 0.008, p2Loss: 0.82 - t * 0.005 }
  );
}

const bundle = recorder.exportReplayBundle();
if (!bundle.replayId || !bundle.compressedBase64 || !bundle.finalChecksum) {
  throw new Error('Replay bundle export failed');
}

const loaded = MatchReplayRecorder.verifyAndLoadReplay(bundle.compressedBase64);
if (loaded.frames.length !== 50) {
  throw new Error(`Expected 50 frames, got ${loaded.frames.length}`);
}

console.log(`✅ Match Replay Test Passed! (Recorded 50 ticks, Checksum: ${bundle.finalChecksum})`);
