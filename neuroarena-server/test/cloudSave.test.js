const crypto = require('crypto');
const { CloudSaveHandler } = require('../src/cloudSaveHandler');

console.log('▶ Testing Cloud Save Snapshot Integrity & Revisions...');

const handler = new CloudSaveHandler();
const userId = 'user_researcher_77';

const save1 = JSON.stringify({ level: 12, biome: 'Biome2', neuronsUnlocked: 48 });
const hash1 = crypto.createHash('sha256').update(save1).digest('hex');

const res1 = handler.saveSnapshot(userId, save1, hash1);
if (!res1.success || res1.revision !== 1) throw new Error('Save 1 failed');

const save2 = JSON.stringify({ level: 13, biome: 'Biome3', neuronsUnlocked: 64 });
const hash2 = crypto.createHash('sha256').update(save2).digest('hex');

const res2 = handler.saveSnapshot(userId, save2, hash2);
if (!res2.success || res2.revision !== 2) throw new Error('Save 2 failed');

// Test Tampered Payload
const resBad = handler.saveSnapshot(userId, save2, 'bad_tampered_hash_1234');
if (resBad.success || resBad.error !== 'CHECKSUM_MISMATCH') throw new Error('Tampered save was not caught!');

const latest = handler.getLatestSnapshot(userId);
if (latest.revision !== 2 || latest.data.level !== 13) throw new Error('Latest snapshot mismatch');

console.log('✅ Cloud Save Revisioning & Cryptographic Integrity Tests Passed!');
