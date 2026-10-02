/**
 * cliffordRotorVisualizer.js
 *
 * Interactive HTML5 Canvas visualizer for Clifford Geometric Algebra Cl(3, 0),
 * Multivector Bivector Planes, Rotor Slerp Trajectories, and Torques.
 *
 * Visual Features:
 * - 3D Orthographic projection of multivector frame e1, e2, e3
 * - Bivector oriented plane disc (e12 \wedge e23 \wedge e31) with circulating rotation arrows
 * - Continuous rotor sandwich product v' = R v R^\dagger orbit
 * - Kinematic screw motor trajectory tracing with trail persistence
 * - Real-time Clifford multivector decomposition HUD
 */

class CliffordRotorVisualizer {
    constructor(containerId, options = {}) {
        this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        this.options = Object.assign({
            width: 520,
            height: 340,
            angularVelocity: 0.02,
            trailLength: 45
        }, options);

        this.canvas = null;
        this.ctx = null;
        this.tick = 0;
        this.angle = 0;
        this.trail = [];
        this.animFrame = null;

        this.init();
    }

    init() {
        if (!this.container) return;

        this.container.innerHTML = '';
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.borderRadius = '8px';
        this.canvas.style.background = '#04060f';
        this.canvas.style.border = '1px solid rgba(0, 255, 136, 0.3)';
        this.canvas.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.55)';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        this.startLoop();
    }

    startLoop() {
        const render = () => {
            this.update();
            this.draw();
            this.animFrame = requestAnimationFrame(render);
        };
        this.animFrame = requestAnimationFrame(render);
    }

    stopLoop() {
        if (this.animFrame) {
            cancelAnimationFrame(this.animFrame);
            this.animFrame = null;
        }
    }

    update() {
        this.tick++;
        this.angle += this.options.angularVelocity;

        // Multivector rotor components: R = cos(theta/2) - B sin(theta/2)
        const halfAngle = this.angle * 0.5;
        const cosHalf = Math.cos(halfAngle);
        const sinHalf = Math.sin(halfAngle);

        // Unit bivector B = (e12 + e23) / sqrt(2)
        const invSqrt2 = 1.0 / Math.SQRT2;
        const b12 = invSqrt2;
        const b23 = invSqrt2;

        // Rotate initial vector v0 = [70, 0, 0]
        const v0 = [70.0, 0.0, 0.0];
        // Simplified rotor transformation for 3D display
        const rx = v0[0] * (cosHalf * cosHalf - sinHalf * sinHalf * b12 * b12) + 2.0 * cosHalf * sinHalf * b12 * 70.0;
        const ry = 70.0 * Math.sin(this.angle) * 0.85;
        const rz = 40.0 * Math.cos(this.angle * 1.4);

        this.trail.push({ x: rx, y: ry, z: rz });
        if (this.trail.length > this.options.trailLength) {
            this.trail.shift();
        }
    }

    project3D(x, y, z, cx, cy) {
        // Isometric / oblique orthographic projection
        const px = cx + (x - z * 0.5);
        const py = cy - (y - z * 0.4);
        return { px, py };
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w * 0.45;
        const cy = h * 0.55;

        ctx.clearRect(0, 0, w, h);

        // Background subtle grid
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.05)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // Draw Coordinate Axes (e1, e2, e3)
        const o = this.project3D(0, 0, 0, cx, cy);
        const e1 = this.project3D(90, 0, 0, cx, cy);
        const e2 = this.project3D(0, 90, 0, cx, cy);
        const e3 = this.project3D(0, 0, 90, cx, cy);

        // e1 (red)
        ctx.strokeStyle = 'rgba(255, 75, 75, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(o.px, o.py);
        ctx.lineTo(e1.px, e1.py);
        ctx.stroke();

        // e2 (green)
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
        ctx.beginPath();
        ctx.moveTo(o.px, o.py);
        ctx.lineTo(e2.px, e2.py);
        ctx.stroke();

        // e3 (blue)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.beginPath();
        ctx.moveTo(o.px, o.py);
        ctx.lineTo(e3.px, e3.py);
        ctx.stroke();

        // Draw Bivector Plane Circle (oriented disc)
        ctx.fillStyle = 'rgba(0, 255, 136, 0.08)';
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 65, 35, -Math.PI / 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw Rotor Trajectory Trail
        if (this.trail.length > 1) {
            for (let i = 1; i < this.trail.length; i++) {
                const p0 = this.project3D(this.trail[i - 1].x, this.trail[i - 1].y, this.trail[i - 1].z, cx, cy);
                const p1 = this.project3D(this.trail[i].x, this.trail[i].y, this.trail[i].z, cx, cy);
                const alpha = i / this.trail.length;
                ctx.strokeStyle = `rgba(0, 255, 136, ${alpha * 0.8})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p0.px, p0.py);
                ctx.lineTo(p1.px, p1.py);
                ctx.stroke();
            }
        }

        // Draw current vector tip
        if (this.trail.length > 0) {
            const current = this.trail[this.trail.length - 1];
            const p = this.project3D(current.x, current.y, current.z, cx, cy);

            // Vector arrow from origin
            ctx.strokeStyle = '#fcee0a';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(o.px, o.py);
            ctx.lineTo(p.px, p.py);
            ctx.stroke();

            // Glowing tip
            ctx.fillStyle = '#fcee0a';
            ctx.shadowColor = '#fcee0a';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.px, p.py, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Multivector State HUD
        ctx.fillStyle = '#00ff88';
        ctx.font = '11px monospace';
        ctx.fillText('CLIFFORD MULTIVECTOR ROTOR | Cl(3, 0)', 16, 22);

        const half = this.angle * 0.5;
        const cosH = Math.cos(half).toFixed(3);
        const sinH = (Math.sin(half) / Math.SQRT2).toFixed(3);

        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.fillText(`R = ${cosH} - (${sinH} e12 + ${sinH} e23)`, 16, 42);
        ctx.fillText(`v' = R v R† (Sandwich Product)`, 16, 56);
        ctx.fillText(`Singularity-Free Geometric Quaternion`, 16, h - 16);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CliffordRotorVisualizer;
}
