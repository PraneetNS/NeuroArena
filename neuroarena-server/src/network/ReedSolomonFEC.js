/**
 * ReedSolomonFEC.js
 *
 * Implements Galois Field GF(2^8) Reed-Solomon Erasure Coding
 * for zero-latency burst drop mitigation in real-time WebTransport/QUIC datagrams.
 *
 * Mathematical Foundations:
 * 1. Galois Field GF(2^8) Arithmetic:
 *    - Irreducible field generator polynomial: p(x) = x^8 + x^4 + x^3 + x^2 + 1 (0x11D).
 *    - Precomputed log and exp lookup tables for O(1) field multiplication and division.
 * 2. Systematic Generator Matrix G \in GF(2^8)^{n \times k}:
 *    - Top k rows form the identity matrix I_k (systematic: source packets are untouched).
 *    - Bottom m = n - k rows form a Cauchy / Vandermonde parity matrix.
 * 3. Matrix Encoding:
 *    - Coded packets C = G \cdot S, where S = [s_1, ..., s_k]^\top are the source chunk buffers.
 * 4. Erasure Decoding via Gaussian Elimination:
 *    - If any k out of n packets are received, let G' be the k \times k submatrix
 *      corresponding to the received packet rows.
 *    - Solve G' \cdot S = C' in GF(2^8) by inverting G' to recover all k original packets.
 *
 * References:
 * - Reed, I. S., & Solomon, G. (1960): "Polynomial Codes over Certain Finite Fields", SIAM.
 * - Plank, J. S. (1997): "A Tutorial on Reed-Solomon Coding for Fault-Tolerance in RAID-like Systems", Software: Practice and Experience.
 */

class ReedSolomonFEC {
    /**
     * @param {number} [k=4] - Number of original data packets
     * @param {number} [parityCount=2] - Number of redundant parity packets (total n = k + m)
     */
    constructor(k = 4, parityCount = 2) {
        this.k = k;
        this.m = parityCount;
        this.n = this.k + this.m;

        // Initialize Galois Field GF(2^8)
        this._initGaloisField();
        this._initGeneratorMatrix();
    }

    /**
     * Initializes exp and log lookup tables for GF(2^8) with 0x11D
     * @private
     */
    _initGaloisField() {
        this.gfExp = new Uint8Array(512);
        this.gfLog = new Uint8Array(256);

        let val = 1;
        for (let i = 0; i < 255; i++) {
            this.gfExp[i] = val;
            this.gfExp[i + 255] = val;
            this.gfLog[val] = i;

            // Multiply by primitive element \alpha = 2
            val <<= 1;
            if (val & 0x100) {
                val ^= 0x11d; // Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
            }
        }
        this.gfLog[0] = 0; // Not strictly defined, but sentinel
    }

    /**
     * Field multiplication in GF(2^8)
     */
    gfMul(a, b) {
        if (a === 0 || b === 0) return 0;
        return this.gfExp[this.gfLog[a] + this.gfLog[b]];
    }

    /**
     * Field division in GF(2^8): a / b
     */
    gfDiv(a, b) {
        if (b === 0) throw new Error('Division by zero in GF(2^8)');
        if (a === 0) return 0;
        return this.gfExp[(this.gfLog[a] - this.gfLog[b] + 255) % 255];
    }

    /**
     * Constructs systematic generator matrix G = [ I_k | Vandermonde ]^\top
     * @private
     */
    _initGeneratorMatrix() {
        this.G = [];

        // Identity rows for systematic encoding
        for (let r = 0; r < this.k; r++) {
            const row = new Uint8Array(this.k);
            row[r] = 1;
            this.G.push(row);
        }

        // Cauchy / Vandermonde rows for parity
        for (let r = 0; r < this.m; r++) {
            const row = new Uint8Array(this.k);
            for (let c = 0; c < this.k; c++) {
                // Cauchy construction: 1 / (x_r ^ y_c)
                const xi = r + 1;
                const yj = this.m + c + 1;
                row[c] = this.gfDiv(1, (xi ^ yj));
            }
            this.G.push(row);
        }
    }

    /**
     * Encodes k source buffers of identical size into n coded buffers
     * @param {Uint8Array[]} sourceBuffers - Array of k buffers
     * @returns {Array<{ index: number, data: Uint8Array, isParity: boolean }>}
     */
    encode(sourceBuffers) {
        if (sourceBuffers.length !== this.k) {
            throw new Error(`Expected exactly ${this.k} source buffers`);
        }

        const packetSize = sourceBuffers[0].length;
        const codedPackets = [];

        for (let rowIdx = 0; rowIdx < this.n; rowIdx++) {
            const outBuf = new Uint8Array(packetSize);
            const genRow = this.G[rowIdx];

            for (let c = 0; c < this.k; c++) {
                const coeff = genRow[c];
                if (coeff === 0) continue;

                const src = sourceBuffers[c];
                for (let i = 0; i < packetSize; i++) {
                    outBuf[i] ^= this.gfMul(coeff, src[i]);
                }
            }

            codedPackets.push({
                index: rowIdx,
                data: outBuf,
                isParity: rowIdx >= this.k
            });
        }

        return codedPackets;
    }

    /**
     * Reconstructs all k original source buffers given any k received packets
     * @param {Array<{ index: number, data: Uint8Array }>} receivedPackets - At least k packets
     * @returns {Uint8Array[]} Reconstructed original k source buffers
     */
    decode(receivedPackets) {
        if (receivedPackets.length < this.k) {
            throw new Error(`Insufficient packets for erasure decoding: need ${this.k}, got ${receivedPackets.length}`);
        }

        // Pick first k received packets
        const selected = receivedPackets.slice(0, this.k);
        const packetSize = selected[0].data.length;

        // Build k x k submatrix A from G
        const A = [];
        for (let i = 0; i < this.k; i++) {
            const origRowIdx = selected[i].index;
            A.push(new Uint8Array(this.G[origRowIdx]));
        }

        // Invert matrix A in GF(2^8) via Gauss-Jordan elimination
        const invA = this._invertMatrix(A);

        // Recover source buffers: S = inv(A) \cdot C_selected
        const recovered = [];
        for (let r = 0; r < this.k; r++) {
            const outBuf = new Uint8Array(packetSize);
            const invRow = invA[r];

            for (let c = 0; c < this.k; c++) {
                const coeff = invRow[c];
                if (coeff === 0) continue;

                const receivedData = selected[c].data;
                for (let i = 0; i < packetSize; i++) {
                    outBuf[i] ^= this.gfMul(coeff, receivedData[i]);
                }
            }
            recovered.push(outBuf);
        }

        return recovered;
    }

    /**
     * Inverts a k x k matrix over GF(2^8) using Gauss-Jordan elimination
     * @private
     */
    _invertMatrix(mat) {
        const k = this.k;
        // Augmented matrix [mat | I]
        const aug = Array.from({ length: k }, (_, r) => {
            const row = new Uint8Array(2 * k);
            for (let c = 0; c < k; c++) row[c] = mat[r][c];
            row[k + r] = 1;
            return row;
        });

        for (let col = 0; col < k; col++) {
            // Find pivot
            let pivotRow = col;
            while (pivotRow < k && aug[pivotRow][col] === 0) {
                pivotRow++;
            }

            if (pivotRow === k) {
                throw new Error('Singular submatrix encountered in Reed-Solomon decoding');
            }

            // Swap rows
            if (pivotRow !== col) {
                const tmp = aug[col];
                aug[col] = aug[pivotRow];
                aug[pivotRow] = tmp;
            }

            // Normalize pivot row
            const pivotVal = aug[col][col];
            for (let c = 0; c < 2 * k; c++) {
                aug[col][c] = this.gfDiv(aug[col][c], pivotVal);
            }

            // Eliminate column in other rows
            for (let r = 0; r < k; r++) {
                if (r === col) continue;
                const factor = aug[r][col];
                if (factor !== 0) {
                    for (let c = 0; c < 2 * k; c++) {
                        aug[r][c] ^= this.gfMul(factor, aug[col][c]);
                    }
                }
            }
        }

        // Extract right half
        const inv = [];
        for (let r = 0; r < k; r++) {
            inv.push(aug[r].slice(k, 2 * k));
        }
        return inv;
    }
}

module.exports = ReedSolomonFEC;
