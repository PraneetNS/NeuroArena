/**
 * High-performance binary packet serializer / deserializer for high-frequency 60Hz arena ticks.
 * Packs player position (Float32), rotation (Float32), velocity (Float16-packed), and loss (Float32).
 */
const PACKET_MAGIC = 0x4e41; // 'NA'

function packTickState(tick, playerIdInt, x, y, z, rotY, loss) {
  // Buffer size: 2(magic) + 4(tick) + 2(playerId) + 12(xyz) + 4(rotY) + 4(loss) = 28 bytes
  const buf = Buffer.allocUnsafe(28);
  buf.writeUInt16LE(PACKET_MAGIC, 0);
  buf.writeUInt32LE(tick, 2);
  buf.writeUInt16LE(playerIdInt, 6);
  buf.writeFloatLE(x, 8);
  buf.writeFloatLE(y, 12);
  buf.writeFloatLE(z, 16);
  buf.writeFloatLE(rotY, 20);
  buf.writeFloatLE(loss, 24);
  return buf;
}

function unpackTickState(buf) {
  if (buf.length < 28) throw new Error('Buffer underflow');
  const magic = buf.readUInt16LE(0);
  if (magic !== PACKET_MAGIC) throw new Error('Invalid magic header');

  return {
    tick: buf.readUInt32LE(2),
    playerIdInt: buf.readUInt16LE(6),
    x: buf.readFloatLE(8),
    y: buf.readFloatLE(12),
    z: buf.readFloatLE(16),
    rotY: buf.readFloatLE(20),
    loss: buf.readFloatLE(24)
  };
}

module.exports = { packTickState, unpackTickState, PACKET_MAGIC };
