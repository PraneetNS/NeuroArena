const { packTickState, unpackTickState } = require('../src/fastBinaryProtocol');

console.log('▶ Testing Fast Binary Network Protocol Serialization...');

const buf = packTickState(1048576, 7, 128.5, 4.2, -99.3, 180.0, 0.00345);
if (buf.length !== 28) throw new Error(`Expected 28 bytes, got ${buf.length}`);

const decoded = unpackTickState(buf);
if (decoded.tick !== 1048576) throw new Error('Tick mismatch');
if (decoded.playerIdInt !== 7) throw new Error('PlayerId mismatch');
if (Math.abs(decoded.x - 128.5) > 1e-4) throw new Error('X coordinate mismatch');
if (Math.abs(decoded.y - 4.2) > 1e-4) throw new Error('Y coordinate mismatch');
if (Math.abs(decoded.z - (-99.3)) > 1e-4) throw new Error('Z coordinate mismatch');
if (Math.abs(decoded.rotY - 180.0) > 1e-4) throw new Error('Rotation mismatch');
if (Math.abs(decoded.loss - 0.00345) > 1e-4) throw new Error('Loss mismatch');

console.log('✅ Fast Binary Protocol Pack/Unpack Passed Cleanly (28-byte footprint)!');
