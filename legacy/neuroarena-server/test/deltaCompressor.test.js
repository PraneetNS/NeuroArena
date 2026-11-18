const assert = require('assert');
const { DeltaCompressor, FLAGS } = require('../src/network/DeltaCompressor');

console.log('▶ Testing Adaptive Delta Compression & Bit-Packing Engine...');

const compressor = new DeltaCompressor();
const decompressor = new DeltaCompressor();

const entityId = 42;

// Initial state
const state0 = {
  tick: 100,
  x: 10.500,
  y: 0.000,
  z: -25.125,
  rotY: 180.0,
  loss: 0.4500,
  vx: 1.2,
  vz: -0.8
};

compressor.setBaseline(entityId, state0);
decompressor.setBaseline(entityId, state0);

// Tick 1: Small positional delta
const state1 = {
  tick: 101,
  x: 10.512, // +0.012m
  y: 0.000,
  z: -25.120, // +0.005m
  rotY: 182.5,
  loss: 0.4490,
  vx: 1.2,
  vz: -0.8
};

const buf1 = compressor.compress(entityId, state1);
// Check size reduction
assert(buf1.length < 28, `Delta packet size (${buf1.length}B) must be smaller than raw 28B packet`);

const decoded1 = decompressor.decompress(buf1);
assert.strictEqual(decoded1.tick, 101);
assert.strictEqual(decoded1.entityId, 42);
assert(Math.abs(decoded1.x - state1.x) < 0.002, `X error (${decoded1.x} vs ${state1.x}) must be < 2mm`);
assert(Math.abs(decoded1.z - state1.z) < 0.002, `Z error must be < 2mm`);
assert(Math.abs(decoded1.rotY - state1.rotY) < 0.1, `RotY error must be < 0.1 deg`);
assert(Math.abs(decoded1.loss - state1.loss) < 0.0002, `Loss error must be < 0.0002`);

// Tick 2: Zero movement, only loss update
const state2 = {
  tick: 102,
  x: 10.512,
  y: 0.000,
  z: -25.120,
  rotY: 182.5,
  loss: 0.4200,
  vx: 1.2,
  vz: -0.8
};

const buf2 = compressor.compress(entityId, state2);
// Header (9) + Loss (2) = 11 bytes!
assert.strictEqual(buf2.length, 11, `Sparse delta buffer size should be 11 bytes, got ${buf2.length}`);

const decoded2 = decompressor.decompress(buf2);
assert.strictEqual(decoded2.tick, 102);
assert(Math.abs(decoded2.loss - 0.4200) < 0.0002);

console.log(`✅ Delta Compressor verified! Raw 28B -> Delta ${buf1.length}B (${Math.round((1 - buf1.length/28)*100)}% bandwidth reduction)`);
