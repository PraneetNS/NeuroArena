const assert = require('assert');
const { MatchReplayRecorder } = require('../src/replayEngine');

console.log('==================================================');
console.log('⚡ NEURO-ARENA MATCH REPLAY & CHUNKING TEST SUITE');
console.log('==================================================');

function testStandardReplayRecording() {
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
  assert(bundle.replayId, 'Replay ID must be present');
  assert(bundle.compressedBase64, 'Base64 payload must be present');
  assert(bundle.finalChecksum, 'Final checksum must be present');

  const loaded = MatchReplayRecorder.verifyAndLoadReplay(bundle.compressedBase64);
  assert.strictEqual(loaded.frames.length, 50, 'Frame count must match 50');

  console.log(`✅ Standard Match Replay Test Passed! (Recorded 50 ticks, Checksum: ${bundle.finalChecksum})`);
}

function testReplayBookmarksAndSeekTable() {
  console.log('▶ Testing Keyframe Bookmarking & Seek Table Generation...');

  const recorder = new MatchReplayRecorder(
    'match_bm_101',
    'Biome6_SemanticExpanse',
    { id: 'p1', name: 'Cosmo' },
    { id: 'p2', name: 'Nova' }
  );

  for (let t = 0; t < 100; t++) {
    recorder.recordTick(
      t,
      { moveX: 0.1 * t, moveY: 0.05 * t },
      { moveX: -0.1 * t, moveY: -0.05 * t },
      { p1Loss: Math.max(0.01, 1.0 - t * 0.01), p2Loss: Math.max(0.02, 1.2 - t * 0.012) }
    );

    if (t === 15) {
      recorder.addBookmark(t, 'FIRST_CONVERGENCE', 'Player 1 loss fell below 0.85', 0.6);
    } else if (t === 45) {
      recorder.addBookmark(t, 'OVERFIT_DESYNC', 'Player 2 suffered validation divergence', 0.85);
    } else if (t === 99) {
      recorder.addBookmark(t, 'MATCH_VICTORY', 'Player 1 reached target accuracy', 1.0);
    }
  }

  assert.strictEqual(recorder.bookmarks.length, 3, 'Must register 3 bookmarks');
  assert.strictEqual(recorder.bookmarks[0].eventType, 'FIRST_CONVERGENCE');
  assert.strictEqual(recorder.bookmarks[1].eventType, 'OVERFIT_DESYNC');
  assert.strictEqual(recorder.bookmarks[2].eventType, 'MATCH_VICTORY');

  const seekTable = recorder.generateSeekTable(25);
  assert.strictEqual(seekTable.length, 4, '100 frames with interval 25 must yield 4 seek entries');
  assert.strictEqual(seekTable[0].tick, 0);
  assert.strictEqual(seekTable[1].tick, 25);
  assert.strictEqual(seekTable[2].tick, 50);
  assert.strictEqual(seekTable[3].tick, 75);

  console.log('✅ Replay Bookmarking & Seek Table Generation Test Passed!');
}

function testChunkedReplayExport() {
  console.log('▶ Testing Chunked Replay Streaming Export & Base64 Payload...');

  const recorder = new MatchReplayRecorder(
    'match_chunk_555',
    'Biome1_LinearSteppes',
    { id: 'arch_1', name: 'Turing' },
    { id: 'arch_2', name: 'Lovelace' }
  );

  for (let t = 0; t < 75; t++) {
    recorder.recordTick(t, { x: 1 }, { x: -1 }, { loss: 0.5 });
  }

  const { manifest, chunks } = recorder.exportChunkedReplay(30);
  assert.strictEqual(manifest.totalFrames, 75);
  assert.strictEqual(manifest.chunkSize, 30);
  assert.strictEqual(manifest.chunkCount, 3, '75 frames / 30 chunk size = 3 chunks');
  assert.strictEqual(chunks.length, 3);
  assert.strictEqual(chunks[0].frameCount, 30);
  assert.strictEqual(chunks[1].frameCount, 30);
  assert.strictEqual(chunks[2].frameCount, 15);

  assert(chunks[0].payloadBase64.length > 0, 'Chunk 0 must have base64 payload');
  assert(chunks[0].chunkHash.length === 16, 'Chunk 0 must have 16-hex hash');

  console.log('✅ Chunked Replay Streaming Export Test Passed!');
}

function testDeltaCompressionAndRestoration() {
  console.log('▶ Testing Delta Compression Ratio & Lossless Restoration...');

  const originalFrames = [];
  for (let t = 0; t < 60; t++) {
    originalFrames.push({
      t,
      i1: { moveX: 0.1, moveY: 0.2 },
      i2: { moveX: -0.1, moveY: -0.2 },
      s: {
        p1: { x: Number((10 + t * 0.05).toFixed(3)), y: 0, z: Number((5 + t * 0.02).toFixed(3)), loss: Number((0.9 - t * 0.01).toFixed(4)) },
        p2: { x: Number((-10 - t * 0.05).toFixed(3)), y: 0, z: Number((-5 - t * 0.02).toFixed(3)), loss: Number((1.1 - t * 0.015).toFixed(4)) }
      }
    });
  }

  const deltaEncoded = MatchReplayRecorder.encodeDeltaFrames(originalFrames, 20);
  assert.strictEqual(deltaEncoded.keyframes.length, 3, '60 frames with 20 interval must have 3 keyframes');
  assert.strictEqual(deltaEncoded.deltas.length, 57, 'Remaining 57 frames must be deltas');

  const restored = MatchReplayRecorder.decodeDeltaFrames(deltaEncoded);
  assert.strictEqual(restored.length, originalFrames.length, 'Restored frame count must match exactly');

  // Verify first, middle, and final tick numerical precision
  for (const idx of [0, 19, 20, 35, 59]) {
    assert.strictEqual(restored[idx].t, originalFrames[idx].t, `Tick at frame ${idx} must match`);
    assert.strictEqual(restored[idx].s.p1.x, originalFrames[idx].s.p1.x, `p1.x at frame ${idx} must match`);
    assert.strictEqual(restored[idx].s.p1.loss, originalFrames[idx].s.p1.loss, `p1.loss at frame ${idx} must match`);
  }

  console.log('✅ Delta Compression & Lossless Restoration Test Passed!');
}

function testReplayIntegrityVerification() {
  console.log('▶ Testing Rolling SHA-256 Checksum Integrity Prover...');

  const recorder = new MatchReplayRecorder(
    'match_integrity',
    'Biome0_Tutorial',
    { id: 'u1', name: 'Alpha' },
    { id: 'u2', name: 'Beta' }
  );

  for (let t = 0; t < 25; t++) {
    recorder.recordTick(t, {}, {}, { loss: 0.1 });
  }

  const rawBundle = {
    header: recorder.header,
    frameCount: recorder.frames.length,
    finalChecksum: recorder.checksumHistory[recorder.checksumHistory.length - 1],
    frames: recorder.frames
  };

  assert.strictEqual(MatchReplayRecorder.verifyReplayIntegrity(rawBundle), true, 'Valid bundle must verify true');

  // Tamper with one frame
  const tamperedBundle = JSON.parse(JSON.stringify(rawBundle));
  tamperedBundle.frames[10].s.loss = 999.0;
  assert.strictEqual(MatchReplayRecorder.verifyReplayIntegrity(tamperedBundle), false, 'Tampered frame must fail integrity verification');

  console.log('✅ Rolling SHA-256 Checksum Integrity Prover Test Passed!');
}

// Run all test cases
testStandardReplayRecording();
testReplayBookmarksAndSeekTable();
testChunkedReplayExport();
testDeltaCompressionAndRestoration();
testReplayIntegrityVerification();

console.log('🎉 All Match Replay Tests Passed Cleanly!');
