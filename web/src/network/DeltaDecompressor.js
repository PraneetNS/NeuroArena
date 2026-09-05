/**
 * DeltaDecompressor.js (Web Client)
 * High-performance binary delta decompressor with fixed-point arithmetic for browser clients.
 */

export const DELTA_MAGIC = 0x4e44; // 'ND'

export const FLAG_POS_X = 1 << 0;
export const FLAG_POS_Y = 1 << 1;
export const FLAG_POS_Z = 1 << 2;
export const FLAG_ROT_Y = 1 << 3;
export const FLAG_LOSS  = 1 << 4;
export const FLAG_VEL   = 1 << 5;

const POS_SCALE = 1000;
const ROT_SCALE = 65535 / 360.0;
const LOSS_SCALE = 10000;

export class DeltaDecompressor {
  constructor() {
    this.baselines = new Map();
  }

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

  decompress(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 9) throw new Error("Delta buffer underflow");
    
    const magic = view.getUint16(0, true);
    if (magic !== DELTA_MAGIC) throw new Error("Invalid delta magic");

    const tick = view.getUint32(2, true);
    const entityId = view.getUint16(6, true);
    const flags = view.getUint8(8);

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
      x = base.x + view.getInt16(offset, true) / POS_SCALE;
      offset += 2;
    }
    if (flags & FLAG_POS_Y) {
      y = base.y + view.getInt16(offset, true) / POS_SCALE;
      offset += 2;
    }
    if (flags & FLAG_POS_Z) {
      z = base.z + view.getInt16(offset, true) / POS_SCALE;
      offset += 2;
    }
    if (flags & FLAG_ROT_Y) {
      rotY = view.getUint16(offset, true) / ROT_SCALE;
      offset += 2;
    }
    if (flags & FLAG_LOSS) {
      loss = base.loss + view.getInt16(offset, true) / LOSS_SCALE;
      offset += 2;
    }
    if (flags & FLAG_VEL) {
      vx = base.vx + view.getInt16(offset, true) / POS_SCALE;
      vz = base.vz + view.getInt16(offset + 2, true) / POS_SCALE;
      offset += 4;
    }

    const state = { tick, entityId, x, y, z, rotY, loss, vx, vz };
    this.setBaseline(entityId, state);
    return state;
  }
}
