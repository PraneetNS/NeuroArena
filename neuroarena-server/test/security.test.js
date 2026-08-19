const { SecurityManager } = require('../src/securityMiddleware');

console.log('▶ Testing Security Manager (Signatures, Nonces, Rate-Limiting)...');

const sec = new SecurityManager('test-secret-12345');
const ip = '192.168.1.100';
const nonce = 'random_nonce_abc123';
const timestamp = Date.now();
const payload = { action: 'submit_model', score: 98.5 };

const dataToSign = `${nonce}:${timestamp}:${JSON.stringify(payload)}`;
const signature = sec.signPayload(dataToSign);

// 1. Valid Request
const res1 = sec.validateRequestSecurity(ip, nonce, timestamp, signature, payload);
if (!res1.valid) throw new Error(`Valid request rejected: ${res1.reason}`);

// 2. Nonce Replay Attempt
const res2 = sec.validateRequestSecurity(ip, nonce, timestamp, signature, payload);
if (res2.valid || res2.reason !== 'NONCE_REPLAYED') throw new Error('Nonce replay was not blocked!');

// 3. Invalid Signature Attempt
const res3 = sec.validateRequestSecurity(ip, 'new_nonce_456', timestamp, 'deadbeefbadsignature', payload);
if (res3.valid || res3.reason !== 'INVALID_SIGNATURE') throw new Error('Invalid signature was not blocked!');

// 4. Stale Timestamp
const res4 = sec.validateRequestSecurity(ip, 'new_nonce_789', timestamp - 120000, signature, payload);
if (res4.valid || res4.reason !== 'TIMESTAMP_EXPIRED') throw new Error('Expired timestamp was not blocked!');

console.log('✅ Security Manager Anti-Tamper & Anti-Replay Tests Passed Cleanly!');
