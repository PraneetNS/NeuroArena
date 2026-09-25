/**
 * DistributedTracingContext.js
 * W3C TraceContext (traceparent & tracestate) and OpenTelemetry baggage propagation engine.
 * Facilitates end-to-end distributed latency tracing across client WebSockets, Colyseus game rooms,
 * matchmaking routers, and background federated training workers.
 */

const crypto = require('crypto');

class DistributedTracingContext {
    constructor(serviceName = 'neuroarena-core') {
        this.serviceName = serviceName;
        this.activeSpans = new Map(); // spanId -> span metadata
    }

    generateTraceId() {
        return crypto.randomBytes(16).toString('hex'); // 32 hex chars
    }

    generateSpanId() {
        return crypto.randomBytes(8).toString('hex'); // 16 hex chars
    }

    /**
     * Parses a W3C traceparent header:
     * Format: version(2)-traceId(32)-parentSpanId(16)-traceFlags(2)
     * e.g. "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
     */
    parseTraceparent(header) {
        if (!header || typeof header !== 'string') {
            return this.createRootContext();
        }

        const parts = header.trim().split('-');
        if (parts.length !== 4 || parts[0] !== '00' || parts[1].length !== 32 || parts[2].length !== 16) {
            return this.createRootContext();
        }

        return {
            version: parts[0],
            traceId: parts[1],
            parentSpanId: parts[2],
            traceFlags: parts[3],
            sampled: (parseInt(parts[3], 16) & 1) === 1
        };
    }

    /**
     * Formats context into standard W3C traceparent string.
     */
    formatTraceparent(traceId, spanId, sampled = true) {
        const flags = sampled ? '01' : '00';
        return `00-${traceId}-${spanId}-${flags}`;
    }

    /**
     * Creates a new root trace context.
     */
    createRootContext(sampled = true) {
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();
        return {
            version: '00',
            traceId,
            spanId,
            parentSpanId: null,
            traceFlags: sampled ? '01' : '00',
            sampled
        };
    }

    /**
     * Starts a child span linked to parent context.
     */
    startSpan(name, parentContext, attributes = {}) {
        const traceId = parentContext ? parentContext.traceId : this.generateTraceId();
        const parentSpanId = parentContext ? (parentContext.spanId || parentContext.parentSpanId) : null;
        const spanId = this.generateSpanId();
        const startTime = process.hrtime.bigint();

        const span = {
            spanId,
            traceId,
            parentSpanId,
            name,
            serviceName: this.serviceName,
            startTime,
            endTime: null,
            durationMs: null,
            status: 'UNSET', // UNSET, OK, ERROR
            attributes: { ...attributes },
            traceparent: this.formatTraceparent(traceId, spanId, parentContext ? parentContext.sampled : true)
        };

        this.activeSpans.set(spanId, span);
        return span;
    }

    /**
     * Ends span and records duration.
     */
    endSpan(spanId, status = 'OK', error = null) {
        const span = this.activeSpans.get(spanId);
        if (!span) return null;

        const endTime = process.hrtime.bigint();
        span.endTime = endTime;
        // Convert nanoseconds to milliseconds float
        span.durationMs = Number(endTime - span.startTime) / 1e6;
        span.status = status;
        if (error) {
            span.attributes['error.message'] = error.message || String(error);
            span.status = 'ERROR';
        }

        this.activeSpans.delete(spanId);
        return span;
    }

    /**
     * Parses baggage string: "key1=value1,key2=value2"
     */
    parseBaggage(header) {
        const baggage = {};
        if (!header || typeof header !== 'string') return baggage;

        const entries = header.split(',');
        for (const entry of entries) {
            const [k, v] = entry.split('=').map(s => s.trim());
            if (k && v) baggage[k] = decodeURIComponent(v);
        }
        return baggage;
    }
}

module.exports = DistributedTracingContext;
