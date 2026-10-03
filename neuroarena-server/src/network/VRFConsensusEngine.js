/**
 * VRFConsensusEngine.js
 *
 * Implements Verifiable Random Function (VRF) Cryptographic Sortition
 * and Dynamic Shard Leader Election based on RFC 9381 principles
 * with non-interactive zero-knowledge proofs (Fiat-Shamir).
 *
 * Mathematical Foundations:
 * 1. Discrete Logarithm Group (\mathbb{Z}_p^* or Elliptic Curve):
 *    - Generator g, secret key x \in \mathbb{Z}_q, public key y = g^x.
 * 2. Hash to Curve / Group:
 *    - Given input message \alpha, H = HashToGroup(\alpha).
 * 3. VRF Hash & Proof Evaluation:
 *    - Gamma = H^x
 *    - Random nonce k \in \mathbb{Z}_q
 *    - Commitments: u = g^k, v = H^k
 *    - Challenge c = Hash(g, H, y, Gamma, u, v) (Fiat-Shamir heuristic)
 *    - Response s = k + c * x \pmod q
 *    - Proof \pi = (Gamma, c, s)
 *    - Output hash \beta = Hash(Gamma)
 * 4. VRF Verification:
 *    - Given (y, \alpha, \beta, \pi = (Gamma, c, s)):
 *      H = HashToGroup(\alpha)
 *      u' = g^s \cdot y^{-c}
 *      v' = H^s \cdot Gamma^{-c}
 *      c' = Hash(g, H, y, Gamma, u', v')
 *      Verify c' == c and \beta == Hash(Gamma).
 * 5. Cryptographic Sortition:
 *    - An agent or validator is elected shard leader for round r if:
 *        int(\beta) / 2^{256} < Threshold(Weight)
 *
 * References:
 * - RFC 9381 (2023): "Verifiable Random Functions (VRFs)"
 * - Micali, Rabin, Vadhan (FOCS 1999): "Verifiable Random Functions"
 * - Gilad et al. (SOSP 2017): "Algorand: Scaling Byzantine Agreements for Cryptocurrencies"
 */

const crypto = require('crypto');

class VRFConsensusEngine {
    constructor() {
        // Safe prime p and generator g for finite field discrete log demonstration
        // 256-bit prime modulus
        this.p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'); // secp256k1 p
        this.g = 2n;
        this.q = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BB5BF562DEBACD3E7'); // secp256k1 order
        this.shards = new Map();
    }

    /**
     * Modular exponentiation: base^exp mod modulus
     * @private
     */
    _modPow(base, exp, mod) {
        let res = 1n;
        let b = ((base % mod) + mod) % mod;
        let e = exp;
        while (e > 0n) {
            if (e & 1n) res = (res * b) % mod;
            b = (b * b) % mod;
            e >>= 1n;
        }
        return res;
    }

    /**
     * Generates a keypair (sk, pk)
     * @returns {{secretKey: string, publicKey: string}}
     */
    generateKeyPair() {
        const randBytes = crypto.randomBytes(32);
        const sk = (BigInt('0x' + randBytes.toString('hex')) % (this.q - 1n)) + 1n;
        const pk = this._modPow(this.g, sk, this.p);

        return {
            secretKey: sk.toString(16),
            publicKey: pk.toString(16)
        };
    }

    /**
     * Hashes an arbitrary message into a group element H \in \mathbb{Z}_p^*
     * @param {string} alpha
     * @returns {bigint}
     */
    hashToGroup(alpha) {
        const hash = crypto.createHash('sha256').update(alpha).digest('hex');
        const hBig = (BigInt('0x' + hash) % (this.p - 3n)) + 2n;
        return hBig;
    }

    /**
     * Evaluates the VRF output \beta and zero-knowledge proof \pi = (\Gamma, c, s)
     * 
     * @param {string} secretKeyHex
     * @param {string} alpha - Seed / round identifier
     * @returns {{beta: string, proof: {gamma: string, c: string, s: string}}}
     */
    prove(secretKeyHex, alpha) {
        const x = BigInt('0x' + secretKeyHex);
        const y = this._modPow(this.g, x, this.p);
        const H = this.hashToGroup(alpha);

        // Gamma = H^x mod p
        const gamma = this._modPow(H, x, this.p);

        // Ephemeral random nonce k
        const randBytes = crypto.randomBytes(32);
        const k = (BigInt('0x' + randBytes.toString('hex')) % (this.q - 1n)) + 1n;

        // Commitments: u = g^k mod p, v = H^k mod p
        const u = this._modPow(this.g, k, this.p);
        const v = this._modPow(H, k, this.p);

        // Fiat-Shamir challenge c = Hash(g, H, y, gamma, u, v) mod q
        const hashInput = `${this.g.toString(16)}:${H.toString(16)}:${y.toString(16)}:${gamma.toString(16)}:${u.toString(16)}:${v.toString(16)}`;
        const cHash = crypto.createHash('sha256').update(hashInput).digest('hex');
        const c = BigInt('0x' + cHash) % this.q;

        // Response s = (k + c * x) mod q
        const s = (k + c * x) % this.q;

        // Output hash \beta = Hash(gamma)
        const beta = crypto.createHash('sha256').update(gamma.toString(16)).digest('hex');

        return {
            beta,
            proof: {
                gamma: gamma.toString(16),
                c: c.toString(16),
                s: s.toString(16)
            }
        };
    }

    /**
     * Verifies that the VRF output \beta and proof \pi are valid for public key y and input \alpha
     * 
     * @param {string} publicKeyHex
     * @param {string} alpha
     * @param {string} beta
     * @param {Object} proof - { gamma, c, s }
     * @returns {boolean}
     */
    verify(publicKeyHex, alpha, beta, proof) {
        try {
            const y = BigInt('0x' + publicKeyHex);
            const gamma = BigInt('0x' + proof.gamma);
            const c = BigInt('0x' + proof.c);
            const s = BigInt('0x' + proof.s);
            const H = this.hashToGroup(alpha);

            // Recompute \beta candidate from gamma
            const expectedBeta = crypto.createHash('sha256').update(gamma.toString(16)).digest('hex');
            if (expectedBeta !== beta) return false;

            // Reconstruct commitments:
            // u' = g^s * y^{-c} mod p = g^s * (y^c)^{-1} mod p
            // v' = H^s * gamma^{-c} mod p = H^s * (gamma^c)^{-1} mod p
            const gs = this._modPow(this.g, s, this.p);
            const yc = this._modPow(y, c, this.p);
            const ycInv = this._modInverse(yc, this.p);
            const uPrime = (gs * ycInv) % this.p;

            const Hs = this._modPow(H, s, this.p);
            const gammaC = this._modPow(gamma, c, this.p);
            const gammaCInv = this._modInverse(gammaC, this.p);
            const vPrime = (Hs * gammaCInv) % this.p;

            // Recompute challenge c'
            const hashInput = `${this.g.toString(16)}:${H.toString(16)}:${y.toString(16)}:${gamma.toString(16)}:${uPrime.toString(16)}:${vPrime.toString(16)}`;
            const cPrimeHash = crypto.createHash('sha256').update(hashInput).digest('hex');
            const cPrime = BigInt('0x' + cPrimeHash) % this.q;

            return cPrime === c;
        } catch {
            return false;
        }
    }

    /**
     * Cryptographic Sortition: determines if a candidate validator wins leadership
     * for round / shard based on VRF output and weight.
     * 
     * @param {string} beta - VRF hash output
     * @param {number} selectionProbability - Probability threshold in [0, 1]
     * @returns {boolean}
     */
    isLeaderElected(beta, selectionProbability = 0.25) {
        const hashNum = BigInt('0x' + beta);
        const max256 = 1n << 256n;
        const threshold = BigInt(Math.floor(Number(max256) * selectionProbability));
        return hashNum < threshold;
    }

    /**
     * Modular multiplicative inverse using Extended Euclidean Algorithm
     * @private
     */
    _modInverse(a, m) {
        let [m0, x0, x1] = [m, 0n, 1n];
        let val = ((a % m) + m) % m;
        if (m === 1n) return 0n;

        while (val > 1n) {
            const q = val / m0;
            [val, m0] = [m0, val % m0];
            [x0, x1] = [x1 - q * x0, x0];
        }

        if (x1 < 0n) x1 += m;
        return x1;
    }
}

module.exports = VRFConsensusEngine;
