/**
 * CliffordGeometricAlgebra.js
 *
 * Implements 3D Clifford Geometric Algebra Cl(3, 0) and Projective Multivector Kinematics.
 *
 * An 8-dimensional multivector M \in Cl(3, 0) has the canonical basis:
 * - Grade 0 (Scalar): s
 * - Grade 1 (Vectors): e1, e2, e3
 * - Grade 2 (Bivectors): e12, e23, e31 (generators of rotation planes)
 * - Grade 3 (Pseudoscalar): e123 = I
 *
 * Fundamental Algebraic Identities:
 * - e_i e_j + e_j e_i = 2 \delta_{ij}
 * - For vectors a, b: ab = a \cdot b + a \wedge b (Geometric Product = Inner + Outer)
 * - Rotors (Even Subalgebra Cl^+(3,0)): R = \cos(\theta/2) - \hat{B} \sin(\theta/2)
 * - Sandwich Product: v' = R v R^\dagger (Orthogonal transformation preserving lengths & angles)
 * - Bivector Torques: \tau = r \wedge F = (r_x F_y - r_y F_x) e_{12} + ...
 *
 * References:
 * - Hestenes (Reidel 1984): "Clifford Algebra to Geometric Calculus"
 * - Doran & Lasenby (Cambridge 2003): "Geometric Algebra for Physicists"
 */

class Multivector {
    /**
     * @param {Object} [coords]
     * @param {number} [coords.s=0] - Scalar (Grade 0)
     * @param {number} [coords.e1=0] - Vector X (Grade 1)
     * @param {number} [coords.e2=0] - Vector Y (Grade 1)
     * @param {number} [coords.e3=0] - Vector Z (Grade 1)
     * @param {number} [coords.e12=0] - Bivector XY (Grade 2)
     * @param {number} [coords.e23=0] - Bivector YZ (Grade 2)
     * @param {number} [coords.e31=0] - Bivector ZX (Grade 2)
     * @param {number} [coords.e123=0] - Pseudoscalar XYZ (Grade 3)
     */
    constructor(coords = {}) {
        this.s = coords.s || 0.0;
        this.e1 = coords.e1 || 0.0;
        this.e2 = coords.e2 || 0.0;
        this.e3 = coords.e3 || 0.0;
        this.e12 = coords.e12 || 0.0;
        this.e23 = coords.e23 || 0.0;
        this.e31 = coords.e31 || 0.0;
        this.e123 = coords.e123 || 0.0;
    }

    /**
     * Creates a vector multivector (Grade 1)
     */
    static fromVector(x, y, z) {
        return new Multivector({ e1: x, e2: y, e3: z });
    }

    /**
     * Creates a pure bivector (Grade 2)
     */
    static fromBivector(b12, b23, b31) {
        return new Multivector({ e12: b12, e23: b23, e31: b31 });
    }

    /**
     * Multivector Addition (A + B)
     */
    add(b) {
        return new Multivector({
            s: this.s + b.s,
            e1: this.e1 + b.e1,
            e2: this.e2 + b.e2,
            e3: this.e3 + b.e3,
            e12: this.e12 + b.e12,
            e23: this.e23 + b.e23,
            e31: this.e31 + b.e31,
            e123: this.e123 + b.e123
        });
    }

    /**
     * Scalar multiplication (c * A)
     */
    scale(c) {
        return new Multivector({
            s: this.s * c,
            e1: this.e1 * c,
            e2: this.e2 * c,
            e3: this.e3 * c,
            e12: this.e12 * c,
            e23: this.e23 * c,
            e31: this.e31 * c,
            e123: this.e123 * c
        });
    }

    /**
     * Clifford Reversion (A^\dagger): reverses order of vectors in every blade.
     * s^\dagger = s, e_i^\dagger = e_i, (e_i e_j)^\dagger = -e_i e_j, (e_1 e_2 e_3)^\dagger = -e_1 e_2 e_3
     */
    reverse() {
        return new Multivector({
            s: this.s,
            e1: this.e1,
            e2: this.e2,
            e3: this.e3,
            e12: -this.e12,
            e23: -this.e23,
            e31: -this.e31,
            e123: -this.e123
        });
    }

    /**
     * Full Geometric Product (A * B) over Cl(3, 0)
     */
    multiply(b) {
        const a = this;
        return new Multivector({
            // Grade 0: scalar terms
            s: a.s * b.s + (a.e1 * b.e1 + a.e2 * b.e2 + a.e3 * b.e3)
               - (a.e12 * b.e12 + a.e23 * b.e23 + a.e31 * b.e31)
               - a.e123 * b.e123,

            // Grade 1: vector terms
            e1: a.s * b.e1 + a.e1 * b.s
                - (a.e2 * b.e12 - a.e12 * b.e2)
                + (a.e3 * b.e31 - a.e31 * b.e3)
                - (a.e23 * b.e123 + a.e123 * b.e23),

            e2: a.s * b.e2 + a.e2 * b.s
                + (a.e1 * b.e12 - a.e12 * b.e1)
                - (a.e3 * b.e23 - a.e23 * b.e3)
                - (a.e31 * b.e123 + a.e123 * b.e31),

            e3: a.s * b.e3 + a.e3 * b.s
                + (a.e2 * b.e23 - a.e23 * b.e2)
                - (a.e1 * b.e31 - a.e31 * b.e1)
                - (a.e12 * b.e123 + a.e123 * b.e12),

            // Grade 2: bivector terms
            e12: a.s * b.e12 + a.e12 * b.s
                 + (a.e1 * b.e2 - a.e2 * b.e1)
                 - (a.e23 * b.e31 - a.e31 * b.e23)
                 + (a.e3 * b.e123 + a.e123 * b.e3),

            e23: a.s * b.e23 + a.e23 * b.s
                 + (a.e2 * b.e3 - a.e3 * b.e2)
                 - (a.e31 * b.e12 - a.e12 * b.e31)
                 + (a.e1 * b.e123 + a.e123 * b.e1),

            e31: a.s * b.e31 + a.e31 * b.s
                 + (a.e3 * b.e1 - a.e1 * b.e3)
                 - (a.e12 * b.e23 - a.e23 * b.e12)
                 + (a.e2 * b.e123 + a.e123 * b.e2),

            // Grade 3: pseudoscalar terms
            e123: a.s * b.e123 + a.e123 * b.s
                  + (a.e1 * b.e23 + a.e23 * b.e1)
                  + (a.e2 * b.e31 + a.e31 * b.e2)
                  + (a.e3 * b.e12 + a.e12 * b.e3)
        });
    }

    /**
     * Outer / Wedge Product (A \wedge B)
     */
    wedge(b) {
        // For grade-1 vectors: returns grade-2 bivector
        return new Multivector({
            e12: this.e1 * b.e2 - this.e2 * b.e1,
            e23: this.e2 * b.e3 - this.e3 * b.e2,
            e31: this.e3 * b.e1 - this.e1 * b.e3
        });
    }

    /**
     * Inner / Dot Product (A \cdot B)
     */
    dot(b) {
        return this.e1 * b.e1 + this.e2 * b.e2 + this.e3 * b.e3;
    }

    /**
     * Multivector magnitude ||A|| = \sqrt{ \langle A A^\dagger \rangle_0 }
     */
    norm() {
        const prod = this.multiply(this.reverse());
        return Math.sqrt(Math.max(0, prod.s));
    }

    /**
     * Normalizes multivector
     */
    normalize() {
        const n = this.norm();
        if (n < 1e-12) return new Multivector();
        return this.scale(1.0 / n);
    }
}

class CliffordGeometricAlgebra {
    /**
     * Constructs a Rotor R = \cos(\theta/2) - B \sin(\theta/2) for rotation around a unit bivector plane B
     * @param {Multivector} unitBivector - Unit bivector B (e12, e23, e31)
     * @param {number} theta - Rotation angle in radians
     * @returns {Multivector} Rotor
     */
    static createRotor(unitBivector, theta) {
        const half = theta * 0.5;
        const cosHalf = Math.cos(half);
        const sinHalf = Math.sin(half);
        return new Multivector({
            s: cosHalf,
            e12: -unitBivector.e12 * sinHalf,
            e23: -unitBivector.e23 * sinHalf,
            e31: -unitBivector.e31 * sinHalf
        });
    }

    /**
     * Rotates vector v by rotor R via the sandwich product: v' = R v R^\dagger
     * @param {Multivector} rotor - Even multivector
     * @param {Multivector} vector - Grade 1 multivector
     * @returns {Multivector} Rotated vector
     */
    static rotateVector(rotor, vector) {
        const rRev = rotor.reverse();
        const halfProd = rotor.multiply(vector);
        const fullProd = halfProd.multiply(rRev);
        return new Multivector({
            e1: fullProd.e1,
            e2: fullProd.e2,
            e3: fullProd.e3
        });
    }

    /**
     * Slerp interpolation between two rotors R0 and R1
     * @param {Multivector} r0
     * @param {Multivector} r1
     * @param {number} t - Interpolation parameter [0, 1]
     * @returns {Multivector}
     */
    static rotorSlerp(r0, r1, t) {
        let dot = r0.s * r1.s + r0.e12 * r1.e12 + r0.e23 * r1.e23 + r0.e31 * r1.e31;
        let target = r1;
        if (dot < 0.0) {
            target = r1.scale(-1.0);
            dot = -dot;
        }

        if (dot > 0.9995) {
            // Linear blend for close rotors
            return r0.scale(1.0 - t).add(target.scale(t)).normalize();
        }

        const theta = Math.acos(Math.min(1.0, Math.max(-1.0, dot)));
        const sinTheta = Math.sin(theta);
        const s0 = Math.sin((1.0 - t) * theta) / sinTheta;
        const s1 = Math.sin(t * theta) / sinTheta;

        return r0.scale(s0).add(target.scale(s1));
    }

    /**
     * Computes torque bivector: \tau = r \wedge F
     * @param {Multivector} r - Position vector
     * @param {Multivector} F - Force vector
     * @returns {Multivector} Bivector torque
     */
    static computeTorqueBivector(r, F) {
        return r.wedge(F);
    }
}

module.exports = { Multivector, CliffordGeometricAlgebra };
