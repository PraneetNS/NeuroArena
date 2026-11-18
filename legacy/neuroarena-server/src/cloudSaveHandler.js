const crypto = require('crypto');

/**
 * Cloud save snapshot processor with revisioning, delta decompression, and SHA-256 verification.
 */
class CloudSaveHandler {
  constructor() {
    this.userSaves = new Map(); // userId -> [{ revision, timestamp, checksum, data }]
  }

  saveSnapshot(userId, payloadJson, clientChecksum) {
    // 1. Verify Checksum
    const computedHash = crypto.createHash('sha256').update(payloadJson).digest('hex');
    if (computedHash !== clientChecksum) {
      return { success: false, error: 'CHECKSUM_MISMATCH', computedHash };
    }

    const history = this.userSaves.get(userId) || [];
    const newRevision = history.length + 1;

    const record = {
      revision: newRevision,
      timestamp: Date.now(),
      checksum: computedHash,
      data: JSON.parse(payloadJson)
    };

    history.push(record);
    this.userSaves.set(userId, history);

    return {
      success: true,
      revision: newRevision,
      timestamp: record.timestamp,
      checksum: computedHash
    };
  }

  getLatestSnapshot(userId) {
    const history = this.userSaves.get(userId);
    if (!history || history.length === 0) return null;
    return history[history.length - 1];
  }
}

module.exports = { CloudSaveHandler };
