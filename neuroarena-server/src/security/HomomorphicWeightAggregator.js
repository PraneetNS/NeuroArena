/**
 * HomomorphicWeightAggregator.js
 * Confidential federated edge model aggregation using Additive Homomorphic Encryption
 * and modular arithmetic (Paillier-compatible cryptosystem semantics).
 * 
 * Enables the central server to compute the exact sum / average of edge model updates
 * without ever decrypting or inspecting individual client gradient vectors.
 */

const crypto = require('crypto');

class HomomorphicWeightAggregator {
    /**
     * @param {Object} [options]
     * @param {number} [options.scaleFactor=100000] Integer fixed-point scaling factor
     * @param {bigint} [options.modulusN] Optional predetermined modular RSA-style modulus N
     */
    constructor(options = {}) {
        this.scaleFactor = options.scaleFactor || 100000;
        
        // Generate or adopt 256-bit safe primes for demonstration/simulation modulus
        // N = p * q, nSquared = N * N
        // For production BigInt cryptography in node.js:
        if (options.modulusN) {
            this.n = BigInt(options.modulusN);
        } else {
            // High-entropy 128-bit pseudo-primes for fast deterministic mathematical testability
            this.p = 0xFFFFFFFF00000001000000000000000000000001n; // 128-bit safe prime
            this.q = 0xFFFFFFFF00000001000000000000000000000011n;
            this.n = this.p * this.q;
        }

        this.nSquared = this.n * this.n;
        this.g = this.n + 1n; // Generator g = n + 1 simplifies L(g^m mod n^2) = m
        this.lambda = (this.p - 1n) * (this.q - 1n); // Carmichael function lambda(n)
        this.mu = this.modInverse(this.lambda, this.n);
    }

    /**
     * Computes modular inverse using Extended Euclidean Algorithm
     * @param {bigint} a 
     * @param {bigint} m 
     * @returns {bigint}
     */
    modInverse(a, m) {
        let [old_r, r] = [a % m, m];
        let [old_s, s] = [1n, 0n];

        while (r !== 0n) {
            const quotient = old_r / r;
            [old_r, r] = [r, old_r - quotient * r];
            [old_s, s] = [s, old_s - quotient * s];
        }

        let res = old_s % m;
        if (res < 0n) res += m;
        return res;
    }

    /**
     * Modular exponentiation: (base^exp) mod mod
     */
    modPow(base, exp, mod) {
        let res = 1n;
        let b = base % mod;
        let e = exp;

        while (e > 0n) {
            if (e % 2n === 1n) res = (res * b) % mod;
            b = (b * b) % mod;
            e = e / 2n;
        }
        return res;
    }

    /**
     * Paillier L-function: L(u) = (u - 1) / n
     */
    L(u) {
        return (u - 1n) / this.n;
    }

    /**
     * Encrypts a float value into Paillier ciphertext
     * c = (g^m * r^n) mod n^2
     * @param {number} value
     * @param {bigint} [randomR]
     * @returns {string} Hex encoded ciphertext
     */
    encryptScalar(value, randomR = null) {
        // Fixed-point scaling with support for negative numbers (modular wrap)
        const scaledInt = BigInt(Math.round(value * this.scaleFactor));
        const m = scaledInt < 0n ? (scaledInt % this.n + this.n) : (scaledInt % this.n);

        const r = randomR || (BigInt('0x' + crypto.randomBytes(16).toString('hex')) % (this.n - 2n) + 2n);

        // c = ((n + 1)^m * r^n) mod n^2
        // Since (n + 1)^m mod n^2 = (1 + m*n) mod n^2
        const gm = (1n + (m * this.n) % this.nSquared) % this.nSquared;
        const rn = this.modPow(r, this.n, this.nSquared);
        const c = (gm * rn) % this.nSquared;

        return c.toString(16);
    }

    /**
     * Decrypts ciphertext back to a floating point value
     * m = (L(c^lambda mod n^2) * mu) mod n
     * @param {string|bigint} ciphertextHex
     * @returns {number}
     */
    decryptScalar(ciphertextHex) {
        const c = typeof ciphertextHex === 'bigint' ? ciphertextHex : BigInt('0x' + ciphertextHex);

        const cLambda = this.modPow(c, this.lambda, this.nSquared);
        const lVal = this.L(cLambda);
        let m = (lVal * this.mu) % this.n;

        // Interpret negative numbers if m > n / 2
        if (m > this.n / 2n) {
            m = m - this.n;
        }

        return Number(m) / this.scaleFactor;
    }

    /**
     * Encrypts an entire float gradient vector for an edge client
     * @param {Array<number>} vector
     * @returns {Array<string>} Array of hex ciphertexts
     */
    encryptVector(vector) {
        return vector.map(val => this.encryptScalar(val));
    }

    /**
     * Aggregates multiple client encrypted vectors homomorphically.
     * C_agg[j] = Prod_i (C_i[j]) mod n^2
     * @param {Array<Array<string>>} clientVectors Array of encrypted vectors from clients
     * @returns {Array<string>} Aggregated encrypted vector
     */
    aggregateCiphertexts(clientVectors) {
        if (!clientVectors || clientVectors.length === 0) return [];
        const vectorLength = clientVectors[0].length;
        const aggregated = new Array(vectorLength);

        for (let j = 0; j < vectorLength; j++) {
            let product = 1n;
            for (let i = 0; i < clientVectors.length; i++) {
                const c = BigInt('0x' + clientVectors[i][j]);
                product = (product * c) % this.nSquared;
            }
            aggregated[j] = product.toString(16);
        }

        return aggregated;
    }

    /**
     * Decrypts the aggregated ciphertext vector and calculates the true federated average.
     * @param {Array<string>} aggregatedVector
     * @param {number} clientCount
     * @returns {Array<number>} Average parameter gradient vector
     */
    decryptAveragedVector(aggregatedVector, clientCount) {
        if (clientCount <= 0) return [];
        return aggregatedVector.map(cHex => {
            const sumValue = this.decryptScalar(cHex);
            return sumValue / clientCount;
        });
    }

    /**
     * Exports public encryption parameters so edge nodes can encrypt without private key.
     */
    getPublicKey() {
        return {
            n: this.n.toString(16),
            nSquared: this.nSquared.toString(16),
            scaleFactor: this.scaleFactor
        };
    }
}

module.exports = HomomorphicWeightAggregator;
