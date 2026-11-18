/**
 * RiemannianManifoldOptimizer.js
 *
 * Implements Lie Group SE(3) and SO(3) Riemannian Manifold Optimization
 * for 6-DOF drone attitude control, camera gimbal stability, and singularity-free trajectory synthesis.
 *
 * Mathematical Foundations:
 * - Special Orthogonal Group SO(3) and Special Euclidean Group SE(3)
 * - Lie Algebra se(3) tangent space with Hat (^) and Vee (v) isomorphisms
 * - Matrix Exponential Map: \exp: se(3) -> SE(3) via Rodrigues formulation
 * - Matrix Logarithmic Map: \log: SE(3) -> se(3)
 * - Geodesic interpolation: T(t) = T_0 * exp(t * log(T_0^{-1} * T_1))
 * - Riemannian Gradient Step: T_{k+1} = T_k * exp(-\eta * grad_R f(T_k))
 *
 * References:
 * - Absil, Mahony, Sepulchre (2008): "Optimization Algorithms on Matrix Manifolds"
 * - Murray, Li, Sastry (1994): "A Mathematical Introduction to Robotic Manipulation"
 */

class RiemannianManifoldOptimizer {
    constructor() {}

    /**
     * Skew-symmetric 3x3 matrix for vector w = [wx, wy, wz]
     */
    static hatSO3(w) {
        return [
            0, -w[2], w[1],
            w[2], 0, -w[0],
            -w[1], w[0], 0
        ];
    }

    /**
     * Vee operator extracting vector w from skew-symmetric 3x3 matrix
     */
    static veeSO3(omegaMat) {
        return [
            omegaMat[7], // -w0 = omegaMat[5] -> w0 = omegaMat[7]
            omegaMat[2],
            omegaMat[3]
        ];
    }

    /**
     * Exponential map from Lie algebra so(3) vector w to rotation matrix R (Rodrigues formula)
     * @param {Array<number>} w - [wx, wy, wz]
     * @returns {Array<number>} 9-element row-major 3x3 rotation matrix
     */
    static expSO3(w) {
        const theta = Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
        const I = [
            1, 0, 0,
            0, 1, 0,
            0, 0, 1
        ];

        if (theta < 1e-7) {
            return I;
        }

        const K = this.hatSO3(w);
        const invTheta = 1.0 / theta;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);

        // K^2
        const K2 = [
            K[0]*K[0] + K[1]*K[3] + K[2]*K[6], K[0]*K[1] + K[1]*K[4] + K[2]*K[7], K[0]*K[2] + K[1]*K[5] + K[2]*K[8],
            K[3]*K[0] + K[4]*K[3] + K[5]*K[6], K[3]*K[1] + K[4]*K[4] + K[5]*K[7], K[3]*K[2] + K[4]*K[5] + K[5]*K[8],
            K[6]*K[0] + K[7]*K[3] + K[8]*K[6], K[6]*K[1] + K[7]*K[4] + K[8]*K[7], K[6]*K[2] + K[7]*K[5] + K[8]*K[8]
        ];

        const c1 = sinT * invTheta;
        const c2 = (1.0 - cosT) * (invTheta * invTheta);

        const R = new Array(9);
        for (let i = 0; i < 9; i++) {
            R[i] = I[i] + c1 * K[i] + c2 * K2[i];
        }
        return R;
    }

    /**
     * Logarithmic map from SO(3) rotation matrix R to Lie algebra vector w in so(3)
     * @param {Array<number>} R - 9-element 3x3 rotation matrix
     * @returns {Array<number>} [wx, wy, wz]
     */
    static logSO3(R) {
        const trace = R[0] + R[4] + R[8];
        const cosTheta = Math.max(-1.0, Math.min(1.0, (trace - 1.0) / 2.0));
        const theta = Math.acos(cosTheta);

        if (theta < 1e-7) {
            return [0, 0, 0];
        }

        const factor = theta / (2.0 * Math.sin(theta));
        return [
            factor * (R[7] - R[5]),
            factor * (R[2] - R[6]),
            factor * (R[3] - R[1])
        ];
    }

    /**
     * Multiplies two 3x3 matrices in row-major order
     */
    static multiply3x3(A, B) {
        const C = new Array(9);
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                C[r * 3 + c] = A[r * 3 + 0] * B[0 * 3 + c] +
                              A[r * 3 + 1] * B[1 * 3 + c] +
                              A[r * 3 + 2] * B[2 * 3 + c];
            }
        }
        return C;
    }

    /**
     * Transpose of 3x3 matrix (which is the inverse for SO(3))
     */
    static transpose3x3(R) {
        return [
            R[0], R[3], R[6],
            R[1], R[4], R[7],
            R[2], R[5], R[8]
        ];
    }

    /**
     * Multiplies 3x3 matrix R by 3-vector v
     */
    static multiplyMatVec(R, v) {
        return [
            R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
            R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
            R[6] * v[0] + R[7] * v[1] + R[8] * v[2]
        ];
    }

    /**
     * Exponential map on SE(3) for twist \xi = [u, w] where u is linear, w is angular
     * @param {Array<number>} twist - [ux, uy, uz, wx, wy, wz]
     * @returns {Object} { R: Array(9), p: Array(3) }
     */
    static expSE3(twist) {
        const u = [twist[0], twist[1], twist[2]];
        const w = [twist[3], twist[4], twist[5]];
        const theta = Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);

        const R = this.expSO3(w);

        if (theta < 1e-7) {
            return { R, p: u };
        }

        const K = this.hatSO3(w);
        const invTheta = 1.0 / theta;
        const sinT = Math.sin(theta);
        const cosT = Math.cos(theta);

        // K^2
        const K2 = [
            K[0]*K[0] + K[1]*K[3] + K[2]*K[6], K[0]*K[1] + K[1]*K[4] + K[2]*K[7], K[0]*K[2] + K[1]*K[5] + K[2]*K[8],
            K[3]*K[0] + K[4]*K[3] + K[5]*K[6], K[3]*K[1] + K[4]*K[4] + K[5]*K[7], K[3]*K[2] + K[4]*K[5] + K[5]*K[8],
            K[6]*K[0] + K[7]*K[3] + K[8]*K[6], K[6]*K[1] + K[7]*K[4] + K[8]*K[7], K[6]*K[2] + K[7]*K[5] + K[8]*K[8]
        ];

        // V = I + (1 - cosT)/theta^2 * K + (theta - sinT)/theta^3 * K^2
        const c1 = (1.0 - cosT) * (invTheta * invTheta);
        const c2 = (theta - sinT) * (invTheta * invTheta * invTheta);

        const V = [
            1 + c1*K[0] + c2*K2[0],     c1*K[1] + c2*K2[1],     c1*K[2] + c2*K2[2],
                c1*K[3] + c2*K2[3], 1 + c1*K[4] + c2*K2[4],     c1*K[5] + c2*K2[5],
                c1*K[6] + c2*K2[6],     c1*K[7] + c2*K2[7], 1 + c1*K[8] + c2*K2[8]
        ];

        const p = this.multiplyMatVec(V, u);
        return { R, p };
    }

    /**
     * Computes the geodesic distance between two SO(3) poses: d(R1, R2) = ||log(R1^T * R2)||
     */
    static geodesicDistanceSO3(R1, R2) {
        const R1T = this.transpose3x3(R1);
        const relR = this.multiply3x3(R1T, R2);
        const w = this.logSO3(relR);
        return Math.sqrt(w[0] * w[0] + w[1] * w[1] + w[2] * w[2]);
    }

    /**
     * Evaluates geodesic interpolation along SO(3): R(t) = R1 * exp(t * log(R1^T * R2))
     */
    static slerpSO3(R1, R2, t) {
        const R1T = this.transpose3x3(R1);
        const relR = this.multiply3x3(R1T, R2);
        const w = this.logSO3(relR);
        const scaledW = [w[0] * t, w[1] * t, w[2] * t];
        const stepR = this.expSO3(scaledW);
        return this.multiply3x3(R1, stepR);
    }

    /**
     * Riemannian Gradient Descent step on SO(3) minimizing error to target attitude RTarget:
     * R_{k+1} = R_k * exp(-\eta * log(R_target^T * R_k))
     */
    static gradientStepSO3(currentR, targetR, stepSize = 0.1) {
        const targetRT = this.transpose3x3(targetR);
        const errR = this.multiply3x3(targetRT, currentR);
        const errW = this.logSO3(errR);
        const stepW = [-stepSize * errW[0], -stepSize * errW[1], -stepSize * errW[2]];
        const deltaR = this.expSO3(stepW);
        return this.multiply3x3(currentR, deltaR);
    }
}

module.exports = RiemannianManifoldOptimizer;
