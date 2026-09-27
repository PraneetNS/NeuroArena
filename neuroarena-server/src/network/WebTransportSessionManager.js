/**
 * WebTransportSessionManager.js
 *
 * Implements a WebTransport (QUIC / HTTP/3) multiplexed stream and datagram session manager.
 * Designed for next-generation zero-latency competitive multiplayer netcode and high-frequency
 * neuromorphic swarm telemetry in NeuroArena.
 *
 * Provides:
 * - Unreliable loss-tolerant Datagrams for high-rate agent kinematics (60-120Hz)
 * - Reliable Unidirectional Streams for telemetry log streaming
 * - Reliable Bidirectional Streams for BFT consensus voting and EWC parameter checkpoints
 * - Seamless Connection Migration across client IP/port changes
 */

const crypto = require('crypto');

const FRAME_TYPE = {
    DATAGRAM_KINEMATICS: 0x01,
    DATAGRAM_SPIKE_EVENT: 0x02,
    STREAM_CONSENSUS_BALLOT: 0x10,
    STREAM_EWC_CHECKPOINT: 0x11,
    STREAM_HEARTBEAT: 0xFF
};

class WebTransportSessionManager {
    /**
     * @param {Object} options
     * @param {number} [options.maxDatagramSize=1200] - Path MTU safe datagram limit (bytes)
     * @param {number} [options.sessionTimeoutMs=15000] - Inactivity keepalive timeout
     */
    constructor(options = {}) {
        this.maxDatagramSize = options.maxDatagramSize || 1200;
        this.sessionTimeoutMs = options.sessionTimeoutMs || 15000;

        // Map<sessionId, SessionRecord>
        this.sessions = new Map();
        // Index by client connection token for migration: Map<clientToken, sessionId>
        this.clientTokenIndex = new Map();

        this.metrics = {
            totalDatagramsSent: 0,
            totalDatagramsReceived: 0,
            totalStreamsOpened: 0,
            connectionMigrations: 0
        };
    }

    /**
     * Initializes a new WebTransport session.
     * @param {string} clientToken - Unique cryptographic token identifying client
     * @param {string} remoteAddress - Initial client IP:Port
     * @returns {Object} Session descriptor { sessionId, negotiatedMtu, maxStreams }
     */
    createSession(clientToken, remoteAddress) {
        const sessionId = 'wt_' + crypto.randomBytes(12).toString('hex');

        const session = {
            id: sessionId,
            clientToken,
            remoteAddress,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            nextStreamId: 1,
            activeStreams: new Map(),
            rttMinMs: 18.0,
            bytesInFlight: 0,
            datagramLossRate: 0.0
        };

        this.sessions.set(sessionId, session);
        this.clientTokenIndex.set(clientToken, sessionId);

        return {
            sessionId,
            negotiatedMtu: this.maxDatagramSize,
            maxStreams: 64,
            heartbeatIntervalMs: 2000
        };
    }

    /**
     * Handles mobile network connection migration (e.g., Wi-Fi to 5G switch).
     * Rebinds new remoteAddress to existing sessionId via verified clientToken.
     * @param {string} clientToken
     * @param {string} newRemoteAddress
     * @returns {string|null} Session ID if migration successful
     */
    handleConnectionMigration(clientToken, newRemoteAddress) {
        const sessionId = this.clientTokenIndex.get(clientToken);
        if (!sessionId) return null;

        const session = this.sessions.get(sessionId);
        if (!session) return null;

        session.remoteAddress = newRemoteAddress;
        session.lastActivity = Date.now();
        this.metrics.connectionMigrations++;

        return sessionId;
    }

    /**
     * Encodes and transmits an unreliable datagram to a session.
     * @param {string} sessionId
     * @param {number} frameType - FRAME_TYPE constant
     * @param {Buffer|Uint8Array} payload
     * @returns {Buffer} Encoded datagram buffer
     */
    sendDatagram(sessionId, frameType, payload) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`[WebTransport] Unknown session: ${sessionId}`);

        const header = Buffer.alloc(5);
        header.writeUInt8(frameType, 0);
        header.writeUInt32BE((Date.now() & 0xFFFFFFFF) >>> 0, 1);

        const datagram = Buffer.concat([header, Buffer.from(payload)]);
        if (datagram.length > this.maxDatagramSize) {
            throw new Error(`[WebTransport] Datagram size (${datagram.length}B) exceeds MTU ${this.maxDatagramSize}B`);
        }

        session.lastActivity = Date.now();
        this.metrics.totalDatagramsSent++;
        return datagram;
    }

    /**
     * Decodes and validates an incoming datagram packet.
     * @param {string} sessionId
     * @param {Buffer} buffer
     * @returns {Object} { frameType, timestamp, payload }
     */
    receiveDatagram(sessionId, buffer) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`[WebTransport] Unknown session: ${sessionId}`);

        if (buffer.length < 5) {
            throw new Error('[WebTransport] Malformed datagram: insufficient header length');
        }

        const frameType = buffer.readUInt8(0);
        const timestamp = buffer.readUInt32BE(1);
        const payload = Buffer.from(buffer.subarray(5));

        session.lastActivity = Date.now();
        this.metrics.totalDatagramsReceived++;

        return { frameType, timestamp, payload };
    }

    /**
     * Opens a reliable multiplexed stream within the session.
     * @param {string} sessionId
     * @param {string} type - 'UNIDIRECTIONAL' | 'BIDIRECTIONAL'
     * @returns {number} Allocated stream ID
     */
    openStream(sessionId, type = 'BIDIRECTIONAL') {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`[WebTransport] Unknown session: ${sessionId}`);

        const streamId = session.nextStreamId++;
        session.activeStreams.set(streamId, {
            streamId,
            type,
            createdAt: Date.now(),
            bytesTransferred: 0,
            isClosed: false
        });

        this.metrics.totalStreamsOpened++;
        return streamId;
    }

    /**
     * Writes framed chunk data into a reliable stream.
     * @param {string} sessionId
     * @param {number} streamId
     * @param {Buffer} chunk
     * @returns {Buffer} Framed payload
     */
    writeStreamChunk(sessionId, streamId, chunk) {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`[WebTransport] Unknown session: ${sessionId}`);

        const stream = session.activeStreams.get(streamId);
        if (!stream || stream.isClosed) {
            throw new Error(`[WebTransport] Stream ${streamId} is closed or invalid`);
        }

        // 4 bytes streamId + 4 bytes length + chunk
        const header = Buffer.alloc(8);
        header.writeUInt32BE(streamId, 0);
        header.writeUInt32BE(chunk.length, 4);

        stream.bytesTransferred += chunk.length;
        session.lastActivity = Date.now();

        return Buffer.concat([header, Buffer.from(chunk)]);
    }

    /**
     * Closes an active stream.
     * @param {string} sessionId
     * @param {number} streamId
     */
    closeStream(sessionId, streamId) {
        const session = this.sessions.get(sessionId);
        if (session && session.activeStreams.has(streamId)) {
            session.activeStreams.get(streamId).isClosed = true;
            session.activeStreams.delete(streamId);
        }
    }

    /**
     * Prunes expired stale sessions.
     * @returns {number} Pruned session count
     */
    pruneStaleSessions() {
        const now = Date.now();
        let pruned = 0;
        for (const [id, session] of this.sessions.entries()) {
            if (now - session.lastActivity > this.sessionTimeoutMs) {
                this.clientTokenIndex.delete(session.clientToken);
                this.sessions.delete(id);
                pruned++;
            }
        }
        return pruned;
    }
}

module.exports = {
    WebTransportSessionManager,
    FRAME_TYPE
};
