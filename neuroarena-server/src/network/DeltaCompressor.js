/**
 * DeltaCompressor.js
 * High-performance adaptive delta compression with bit-packed change masks
 * and fixed-point/half-float quantization for high-frequency 60Hz arena networking.
 */

const DELTA_MAGIC = 0x4e44; // 'ND' (Neuro Delta)

const FLAG_POS_X = 1 << 0;
const FLAG_POS_Y = 1 << 1;
const FLAG_POS_Z = 1 << 2;
const FLAG_ROT_Y = 1 << 3;
const FLAG_LOSS  = 1 << 4;
const FLAG_VEL   = 1 << 5;

// Fixed-point scaling factors
const POS_SCALE = 1000; // 1mm precision
const ROT_SCALE = 65535 / 360.0; // 0.0055 degree precision
const LOSS_SCALE = 10000; // 0.0001 precision

class DeltaCompressor {
  constructor() {
    this.baselines = new Map(); // entityId -> lastKnownState
  }

  /**
   * Reset baseline for an entity (e.g. on client connect or keyframe)
   */
  setBaseline(entityId, state) {
    this.baselines.set(entityId, {
      tick: state.tick || 0,
      x: state.x || 0,
      y: state.y || 0,
      z: state.z || 0,
      rotY: state.rotY || 0,
      loss: state.loss || 0,
      vx: state.vx || 0,
      vz: state.vz || 0
    });
  }

  removeBaseline(entityId) {
    this.baselines.delete(entityId);
  }

  /**
   * Compress currentState against baseline.
   * Returns Buffer.
   */
  compress(entityId, currentState) {
    const base = this.baselines.get(entityId) || {
      tick: 0, x: 0, y: 0, z: 0, rotY: 0, loss: 0, vx: 0, vz: 0
    };

    let flags = 0;
    const dx = currentState.x - base.x;
    const dy = currentState.y - base.y;
    const dz = currentState.z - base.z;
    const drotY = (currentState.rotY - base.rotY + 360) % 360;
    const dloss = currentState.loss - base.loss;
    const dvx = (currentState.vx || 0) - base.vx;
    const dvz = (currentState.vz || 0) - base.vz;

    const threshold = 0.001;
    if (Math.abs(dx) > threshold) flags |= FLAG_POS_X;
    if (Math.abs(dy) > threshold) flags |= FLAG_POS_Y;
    if (Math.abs(dz) > threshold) flags |= FLAG_POS_Z;
    if (Math.abs(drotY) > 0.05 && Math.abs(drotY - 360) > 0.05) flags |= FLAG_ROT_Y;
    if (Math.abs(dloss) > 0.0001) flags |= FLAG_LOSS;
    if (Math.abs(dvx) > threshold || Math.abs(dvz) > threshold) flags |= FLAG_VEL;

    // Allocate dynamic buffer
    // Base header: 2(magic) + 4(tick) + 2(entityId) + 1(flags) = 9 bytes
    let size = 9;
    if (flags & FLAG_POS_X) size += 2; // int16 delta
    if (flags & FLAG_POS_Y) size += 2; // int16 delta
    if (flags & FLAG_POS_Z) size += 2; // int16 delta
    if (flags & FLAG_ROT_Y) size += 2; // uint16 quantized
    if (flags & FLAG_LOSS)  size += 2; // int16 delta
    if (flags & FLAG_VEL)   size += 4; // 2x int16

    const buf = Buffer.allocUnsafe(size);
    buf.writeUInt16LE(DELTA_MAGIC, 0);
    buf.writeUInt32LE(currentState.tick, 2);
    buf.writeUInt16LE(entityId, 6);
    buf.writeUInt8(flags, 8);

    let offset = 9;
    if (flags & FLAG_POS_X) {
      const q = Math.max(-32768, Math.min(32767, Math.round(dx * POS_SCALE)));
      buf.writeInt16LE(q, offset);
      offset += 2;
    }
    if (flags & FLAG_POS_Y) {
      const q = Math.max(-32768, Math.min(32767, Math.round(dy * POS_SCALE)));
      buf.writeInt16LE(q, offset);
      offset += 2;
    }
    if (flags & FLAG_POS_Z) {
      const q = Math.max(-32768, Math.min(32767, Math.round(dz * POS_SCALE)));
      buf.writeInt16LE(q, offset);
      offset += 2;
    }
    if (flags & FLAG_ROT_Y) {
      const q = Math.round(((currentState.rotY % 360 + 360) % 360) * ROT_SCALE) & 0xFFFF;
      buf.writeUInt16LE(q, offset);
      offset += 2;
    }
    if (flags & FLAG_LOSS) {
      const q = Math.max(-32768, Math.min(32767, Math.round(dloss * LOSS_SCALE)));
      buf.writeInt16LE(q, offset);
      offset += 2;
    }
    if (flags & FLAG_VEL) {
      const qvx = Math.max(-32768, Math.min(32767, Math.round(dvx * POS_SCALE)));
      const qvz = Math.max(-32768, Math.min(32767, Math.round(dvz * POS_SCALE)));
      buf.writeInt16LE(qvx, offset);
      buf.writeInt16LE(qvz, offset + 2);
      offset += 4;
    }

    // Update baseline to new state
    this.setBaseline(entityId, currentState);

    return buf;
  }

  /**
   * Decompress Buffer against stored baseline.
   */
  decompress(buf) {
    if (buf.length < 9) throw new Error('Delta buffer underflow');
    const magic = buf.readUInt16LE(0);
    if (magic !== DELTA_MAGIC) throw new Error('Invalid delta magic header');

    const tick = buf.readUInt32LE(2);
    const entityId = buf.readUInt16LE(6);
    const flags = buf.readUInt8(8);

    const base = this.baselines.get(entityId) || {
      tick: 0, x: 0, y: 0, z: 0, rotY: 0, loss: 0, vx: 0, vz: 0
    };

    let offset = 9;
    let x = base.x;
    let y = base.y;
    let z = base.z;
    let rotY = base.rotY;
    let loss = base.loss;
    let vx = base.vx;
    let vz = base.vz;

    if (flags & FLAG_POS_X) {
      x = base.x + buf.readInt16LE(offset) / POS_SCALE;
      offset += 2;
    }
    if (flags & FLAG_POS_Y) {
      y = base.y + buf.readInt16LE(offset) / POS_SCALE;
      offset += 2;
    }
    if (flags & FLAG_POS_Z) {
      z = base.z + buf.readInt16LE(offset) / POS_SCALE;
      offset += 2;
    }
    if (flags & FLAG_ROT_Y) {
      rotY = (buf.readUInt16LE(offset) / ROT_SCALE);
      offset += 2;
    }
    if (flags & FLAG_LOSS) {
      loss = base.loss + buf.readInt16LE(offset) / LOSS_SCALE;
      offset += 2;
    }
    if (flags & FLAG_VEL) {
      vx = base.vx + buf.readInt16LE(offset) / POS_SCALE;
      vz = base.vz + buf.readInt16LE(offset + 2) / POS_SCALE;
      offset += 4;
    }

    const reconstructed = { tick, entityId, x, y, z, rotY, loss, vx, vz };
    this.setBaseline(entityId, reconstructed);
    return reconstructed;
  }
}

module.exports = {
  DeltaCompressor,
  DELTA_MAGIC,
  FLAGS: { FLAG_POS_X, FLAG_POS_Y, FLAG_POS_Z, FLAG_ROT_Y, FLAG_LOSS, FLAG_VEL }
};
