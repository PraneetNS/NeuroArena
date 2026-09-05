/**
 * TracingEngine.js
 * OpenTelemetry-compliant W3C distributed tracing engine with parent-child span hierarchy
 * and high-throughput ring-buffer span exporter.
 */

const crypto = require('crypto');

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

class Span {
  constructor(name, context = {}, parentSpan = null) {
    this.name = name;
    this.traceId = context.traceId || (parentSpan ? parentSpan.traceId : randomHex(16));
    this.spanId = randomHex(8);
    this.parentSpanId = parentSpan ? parentSpan.spanId : (context.parentSpanId || null);
    this.startTimeNs = process.hrtime.bigint ? Number(process.hrtime.bigint()) : Date.now() * 1e6;
    this.endTimeNs = null;
    this.durationMs = null;
    this.attributes = { ...context.attributes };
    this.events = [];
    this.status = { code: 'OK' };
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  addEvent(name, attributes = {}) {
    this.events.push({
      name,
      timestampNs: process.hrtime.bigint ? Number(process.hrtime.bigint()) : Date.now() * 1e6,
      attributes
    });
    return this;
  }

  setStatus(code, message = '') {
    this.status = { code, message };
    return this;
  }

  end() {
    this.endTimeNs = process.hrtime.bigint ? Number(process.hrtime.bigint()) : Date.now() * 1e6;
    this.durationMs = (this.endTimeNs - this.startTimeNs) / 1e6;
    return this;
  }

  toTraceParentHeader() {
    return `00-${this.traceId}-${this.spanId}-01`;
  }
}

class TracingEngine {
  constructor(serviceName = 'neuroarena-server', options = {}) {
    this.serviceName = serviceName;
    this.maxBufferSize = options.maxBufferSize || 2048;
    this.completedSpans = [];
  }

  startSpan(name, context = {}, parentSpan = null) {
    return new Span(name, context, parentSpan);
  }

  recordSpan(span) {
    if (!span.endTimeNs) span.end();
    if (this.completedSpans.length >= this.maxBufferSize) {
      this.completedSpans.shift(); // Evict oldest
    }
    this.completedSpans.push(span);
  }

  parseTraceParent(header) {
    if (!header || typeof header !== 'string') return null;
    const parts = header.split('-');
    if (parts.length !== 4 || parts[0] !== '00') return null;
    return {
      traceId: parts[1],
      parentSpanId: parts[2],
      traceFlags: parts[3]
    };
  }

  exportBatch() {
    const batch = [...this.completedSpans];
    this.completedSpans = [];
    return {
      resource: { service: this.serviceName, timestamp: new Date().toISOString() },
      spans: batch.map(s => ({
        traceId: s.traceId,
        spanId: s.spanId,
        parentSpanId: s.parentSpanId,
        name: s.name,
        durationMs: s.durationMs,
        attributes: s.attributes,
        events: s.events,
        status: s.status
      }))
    };
  }
}

module.exports = { TracingEngine, Span };
