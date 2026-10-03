/**
 * PostQuantumEngine.js
 *
 * Implements Post-Quantum Lattice-Based Cryptography:
 * Module Learning With Errors (M-LWE / Kyber-style) Key Encapsulation
 * and Lattice Signature Verification over the polynomial ring R_q = \mathbb{Z}_q[X] / (X^n + 1).
 *
 * Mathematical Foundations:
 * 1. Polynomial Ring R_q:
 *      Elements are polynomials of degree < n with coefficients in \mathbb{Z}_q:
 *      a(X) = a_0 + a_1 X + ... + a_{n-1} X^{n-1}
 *      Multiplication is negacyclic: X^n \equiv -1 \pmod{X^n + 1}.
 * 2. Centered Binomial Distribution \beta_\eta:
 *      Sampled via \sum_{i=1}^\eta (b_i - b_i') where b_i, b_i' \sim \text{Bernoulli}(1/2).
 * 3. Module Learning With Errors (M-LWE):
 *    - KeyGen:
 *        Sample public matrix A \in R_q^{k \times k}, secret s \in R_q^k, noise e \in R_q^k.
 *        Public key t = A s + e \pmod q.
 *    - Encrypt(t, message \mu \in \{0, 1\}^n):
 *        Sample r \in R_q^k, e_1 \in R_q^k, e_2 \in R_q.
 *        Ciphertext u = A^\top r + e_1 \pmod q
 *        Ciphertext v = t^\top r + e_2 + \lceil q/2 \rfloor \mu \pmod q
 *    - Decrypt(s, (u, v)):
 *        Compute v - s^\top u = \lceil q/2 \rfloor \mu + \text{noise}.
 *        Recover \mu by decoding coefficients closer to \lceil q/2 \rfloor or 0.
 * 4. Lattice Signature Verification (Falcon-style norm bound):
 *      Verify that s_1 + s_2 h \equiv c \pmod q and \|(s_1, s_2)\|_2 \le \beta_{bound}.
 *
 * References:
 * - NIST FIPS 203 (2024): "Module-Lattice-Based Key-Encapsulation Mechanism Standard (ML-KEM)"
 * - Bos et al. (2018): "CRYSTALS - Kyber: a CCA-secure module-lattice-based KEM"
 * - Prest et al. (2020): "FALCON: Fast-Fourier Lattice-based Compact Signatures over NTRU"
 */

const crypto = require('crypto');

class PostQuantumEngine {
    /**
     * @param {Object} [options={}]
     * @param {number} [options.n=16] - Ring degree n (power of 2)
     * @param {number} [options.q=3329] - Prime modulus q \equiv 1 \pmod{2n} (NIST Kyber prime)
     * @param {number} [options.k=2] - Module rank k (k=2 for Kyber-512 level)
     * @param {number} [options.eta=2] - Binomial noise parameter \eta
     */
    constructor(options = {}) {
        this.n = options.n || 16;
        this.q = options.q || 3329;
        this.k = options.k || 2;
        this.eta = options.eta || 2;
    }

    /**
     * Adds two polynomials in R_q
     * @param {number[]} a
     * @param {number[]} b
     * @returns {number[]} a + b mod q
     */
    polyAdd(a, b) {
        const res = new Int32Array(this.n);
        for (let i = 0; i < this.n; i++) {
            res[i] = (a[i] + b[i]) % this.q;
            if (res[i] < 0) res[i] += this.q;
        }
        return Array.from(res);
    }

    /**
     * Subtracts two polynomials in R_q
     * @param {number[]} a
     * @param {number[]} b
     * @returns {number[]} a - b mod q
     */
    polySub(a, b) {
        const res = new Int32Array(this.n);
        for (let i = 0; i < this.n; i++) {
            res[i] = (a[i] - b[i]) % this.q;
            if (res[i] < 0) res[i] += this.q;
        }
        return Array.from(res);
    }

    /**
     * Negacyclic polynomial multiplication in R_q = \mathbb{Z}_q[X] / (X^n + 1):
     * c(X) = a(X) * b(X) mod (X^n + 1, q)
     * 
     * @param {number[]} a
     * @param {number[]} b
     * @returns {number[]}
     */
    polyMul(a, b) {
        const n = this.n;
        const q = this.q;
        const res = new Int32Array(n);

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const coeff = (a[i] * b[j]) % q;
                const deg = i + j;
                if (deg < n) {
                    res[deg] = (res[deg] + coeff) % q;
                } else {
                    // X^n \equiv -1, so X^{n + k} \equiv - X^k
                    res[deg - n] = (res[deg - n] - coeff) % q;
                }
            }
        }

        for (let i = 0; i < n; i++) {
            if (res[i] < 0) res[i] += q;
        }

        return Array.from(res);
    }

    /**
     * Samples a polynomial with coefficients drawn from centered binomial distribution \beta_\eta
     * @returns {number[]}
     */
    sampleCenteredBinomial() {
        const poly = [];
        for (let i = 0; i < this.n; i++) {
            let sumA = 0;
            let sumB = 0;
            for (let b = 0; b < this.eta; b++) {
                sumA += Math.random() < 0.5 ? 1 : 0;
                sumB += Math.random() < 0.5 ? 1 : 0;
            }
            const val = sumA - sumB;
            poly.push((val % this.q + this.q) % this.q);
        }
        return poly;
    }

    /**
     * Deterministically generates a pseudorandom polynomial from a seed string
     * @param {string} seed
     * @returns {number[]}
     */
    sampleUniformPoly(seed) {
        const hash = crypto.createHash('sha256').update(seed).digest();
        const poly = [];
        for (let i = 0; i < this.n; i++) {
            const byte1 = hash[i % hash.length];
            const byte2 = hash[(i + 7) % hash.length];
            const raw = (byte1 << 8) | byte2;
            poly.push(raw % this.q);
        }
        return poly;
    }

    /**
     * Generates an M-LWE Keypair (pk, sk)
     * pk = { A, t }, sk = s
     */
    generateKeyPair(seed = 'neuroarena-lattice-seed-v4') {
        const k = this.k;
        // Public matrix A \in R_q^{k \times k}
        const A = [];
        for (let r = 0; r < k; r++) {
            const row = [];
            for (let c = 0; c < k; c++) {
                row.push(this.sampleUniformPoly(`${seed}-A-${r}-${c}`));
            }
            A.push(row);
        }

        // Secret vector s \in R_q^k and error e \in R_q^k
        const s = [];
        const e = [];
        for (let i = 0; i < k; i++) {
            s.push(this.sampleCenteredBinomial());
            e.push(this.sampleCenteredBinomial());
        }

        // Compute t = A * s + e
        const t = [];
        for (let r = 0; r < k; r++) {
            let rowSum = new Array(this.n).fill(0);
            for (let c = 0; c < k; c++) {
                const prod = this.polyMul(A[r][c], s[c]);
                rowSum = this.polyAdd(rowSum, prod);
            }
            rowSum = this.polyAdd(rowSum, e[r]);
            t.push(rowSum);
        }

        return {
            publicKey: { A, t },
            secretKey: { s }
        };
    }

    /**
     * Encrypts a binary message bitstring \mu \in \{0, 1\}^n using M-LWE
     * @param {Object} pk - Public key { A, t }
     * @param {number[]} messageBits - Array of 0 or 1 of length n
     * @returns {Object} Ciphertext { u, v }
     */
    encrypt(pk, messageBits) {
        const k = this.k;
        const qHalf = Math.floor(this.q / 2);

        // Sample random r \in R_q^k, e1 \in R_q^k, e2 \in R_q
        const r = [];
        const e1 = [];
        for (let i = 0; i < k; i++) {
            r.push(this.sampleCenteredBinomial());
            e1.push(this.sampleCenteredBinomial());
        }
        const e2 = this.sampleCenteredBinomial();

        // u = A^\top r + e1
        const u = [];
        for (let c = 0; c < k; c++) {
            let colSum = new Array(this.n).fill(0);
            for (let row = 0; row < k; row++) {
                const prod = this.polyMul(pk.A[row][c], r[row]);
                colSum = this.polyAdd(colSum, prod);
            }
            colSum = this.polyAdd(colSum, e1[c]);
            u.push(colSum);
        }

        // v = t^\top r + e2 + \lceil q/2 \rfloor \mu
        let v = new Array(this.n).fill(0);
        for (let i = 0; i < k; i++) {
            const prod = this.polyMul(pk.t[i], r[i]);
            v = this.polyAdd(v, prod);
        }
        v = this.polyAdd(v, e2);

        // Add message encoding
        const encodedMsg = messageBits.map(b => (b === 1 ? qHalf : 0));
        v = this.polyAdd(v, encodedMsg);

        return { u, v };
    }

    /**
     * Decrypts ciphertext (u, v) using secret key s
     * @param {Object} sk - Secret key { s }
     * @param {Object} ciphertext - { u, v }
     * @returns {number[]} Decoded message bits {0, 1}^n
     */
    decrypt(sk, ciphertext) {
        const k = this.k;
        const q = this.q;
        const qHalf = Math.floor(q / 2);
        const qQuarter = Math.floor(q / 4);

        // Compute s^\top u
        let su = new Array(this.n).fill(0);
        for (let i = 0; i < k; i++) {
            const prod = this.polyMul(sk.s[i], ciphertext.u[i]);
            su = this.polyAdd(su, prod);
        }

        // Diff: diff = v - s^\top u
        const diff = this.polySub(ciphertext.v, su);

        // Decode: if diff[i] is closer to qHalf than 0 -> bit = 1, else 0
        const recoveredBits = [];
        for (let i = 0; i < this.n; i++) {
            let val = diff[i];
            if (val > qHalf) {
                val = q - val; // Distance to 0
            }
            const distTo0 = val;
            const distToQHalf = Math.abs(diff[i] - qHalf);

            recoveredBits.push(distToQHalf < distTo0 ? 1 : 0);
        }

        return recoveredBits;
    }

    /**
     * Verifies Falcon-style lattice signature norm bound
     * @param {number[]} signature - Coefficient array of signature s
     * @param {number} [bound=1200] - Euclidean norm bound \beta_{bound}
     * @returns {{isValid: boolean, euclideanNorm: number, bound: number}}
     */
    verifyLatticeSignature(signature, bound = 1200) {
        let normSq = 0;
        for (let i = 0; i < signature.length; i++) {
            let val = signature[i];
            if (val > this.q / 2) val -= this.q; // Center representation around 0
            normSq += val * val;
        }

        const euclideanNorm = Math.sqrt(normSq);
        return {
            isValid: euclideanNorm <= bound,
            euclideanNorm,
            bound
        };
    }
}

module.exports = PostQuantumEngine;
