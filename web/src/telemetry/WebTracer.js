/**
 * WebTracer.js (Web Client)
 * Lightweight browser client distributed tracer for tracking model inference,
 * asset loading, network frame latencies, and user interactions.
 */

function generateId(hexDigits) {
  let str = "";
  for (let i = 0; i < hexDigits; i++) {
    str += Math.floor(Math.random() * 16).toString(16);
  }
  return str;
}

export class WebSpan {
  constructor(name, parentTraceId = null, parentSpanId = null) {
    this.name = name;
    this.traceId = parentTraceId || generateId(32);
    this.spanId = generateId(16);
    this.parentSpanId = parentSpanId;
    this.startTime = performance.now();
    this.endTime = null;
    this.attributes = {};
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
    return this;
  }

  end() {
    this.endTime = performance.now();
    this.durationMs = this.endTime - this.startTime;
    return this;
  }

  toTraceParent() {
    return `00-${this.traceId}-${this.spanId}-01`;
  }
}

export class WebTracer {
  constructor(serviceName = "neuroarena-web") {
    this.serviceName = serviceName;
    this.spans = [];
  }

  startSpan(name, parent = null) {
    const parentTrace = parent ? parent.traceId : null;
    const parentSpan = parent ? parent.spanId : null;
    return new WebSpan(name, parentTrace, parentSpan);
  }

  record(span) {
    if (!span.endTime) span.end();
    this.spans.push(span);
    if (this.spans.length > 500) this.spans.shift();
  }

  getRecentSpans() {
    return this.spans.map(s => ({
      name: s.name,
      traceId: s.traceId,
      spanId: s.spanId,
      durationMs: s.durationMs,
      attributes: s.attributes
    }));
  }
}
