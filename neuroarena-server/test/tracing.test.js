const assert = require('assert');
const { TracingEngine, Span } = require('../src/telemetry/TracingEngine');

console.log('▶ Testing OpenTelemetry W3C Distributed Tracing Engine...');

const tracer = new TracingEngine('neuroarena-matchmaker', { maxBufferSize: 10 });

// 1. Root span creation
const rootSpan = tracer.startSpan('Matchmaking.FindMatch', {
  attributes: { 'player.tier': 'scholar', 'region': 'us-east' }
});

assert.strictEqual(rootSpan.name, 'Matchmaking.FindMatch');
assert.strictEqual(rootSpan.traceId.length, 32);
assert.strictEqual(rootSpan.spanId.length, 16);
assert.strictEqual(rootSpan.parentSpanId, null);

// 2. Child span creation & context propagation
const childSpan = tracer.startSpan('Glicko2.ComputeBracket', {}, rootSpan);
assert.strictEqual(childSpan.traceId, rootSpan.traceId, 'Child span must inherit parent traceId');
assert.strictEqual(childSpan.parentSpanId, rootSpan.spanId, 'Child parentSpanId must match root spanId');

childSpan.addEvent('bracket_expanded', { radius: 150 });
childSpan.end();
assert(childSpan.durationMs >= 0, 'Span durationMs must be recorded');

rootSpan.end();
tracer.recordSpan(childSpan);
tracer.recordSpan(rootSpan);

// 3. W3C Header Serialization & Parsing
const header = rootSpan.toTraceParentHeader();
const parsed = tracer.parseTraceParent(header);
assert.strictEqual(parsed.traceId, rootSpan.traceId);
assert.strictEqual(parsed.parentSpanId, rootSpan.spanId);

// 4. Batch Export
const batch = tracer.exportBatch();
assert.strictEqual(batch.spans.length, 2);
assert.strictEqual(batch.resource.service, 'neuroarena-matchmaker');

console.log('✅ OpenTelemetry W3C Distributed Tracing Tests Passed Cleanly!');
