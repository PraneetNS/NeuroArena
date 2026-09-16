/**
 * NeuroArena - Mathematical Iconography System
 * Custom procedural vector glyphs for Machine Learning concepts.
 * No generic stock icons (FontAwesome/Material). Each glyph embodies
 * an exact mathematical operation or geometric construct from ML.
 *
 * Compatible with Node.js and modern browsers (UMD pattern).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NeuroArenaMathIcons = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Helper to construct SVG tag wrapper
   */
  function wrapSvg(paths, options = {}) {
    const size = options.size || 24;
    const stroke = options.stroke || 'currentColor';
    const strokeWidth = options.strokeWidth || 1.75;
    const fill = options.fill || 'none';
    const className = options.className ? ` class="${options.className}"` : '';
    const id = options.id ? ` id="${options.id}"` : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${className}${id}>${paths}</svg>`;
  }

  const GLYPHS = {
    /**
     * 1. Gradient Arrow: Vector field direction indicating steepest descent (-∇J)
     */
    'gradient-arrow': {
      label: 'Gradient Vector (∇J)',
      description: 'Steepest descent gradient vector with field lines and directional arrow head',
      category: 'optimization',
      render: (opts) => wrapSvg(`
        <!-- Contour line hint -->
        <path d="M 3 20 C 8 18 16 18 21 21" stroke-dasharray="2 2" opacity="0.4" />
        <path d="M 5 15 C 10 13 15 13 20 16" stroke-dasharray="2 2" opacity="0.6" />
        <!-- Descent arrow -->
        <line x1="5" y1="19" x2="18" y2="6" />
        <polyline points="11 6 18 6 18 13" />
        <!-- Delta dot -->
        <circle cx="5" cy="19" r="1.5" fill="${opts?.stroke || 'currentColor'}" />
      `, opts)
    },

    /**
     * 2. Decision Boundary: Hyperplane dividing binary classes (w·x + b = 0)
     */
    'decision-boundary': {
      label: 'Decision Boundary (w·x + b = 0)',
      description: 'Separating hyperplane with support vector margins and sample clusters',
      category: 'classification',
      render: (opts) => wrapSvg(`
        <!-- Separating Hyperplane -->
        <line x1="2" y1="22" x2="22" y2="2" stroke-width="${(opts?.strokeWidth || 1.75) * 1.25}" />
        <!-- Margin boundaries -->
        <line x1="5" y1="23" x2="23" y2="5" stroke-dasharray="2 2" opacity="0.5" />
        <line x1="1" y1="19" x2="19" y2="1" stroke-dasharray="2 2" opacity="0.5" />
        <!-- Class A Positive Points (circles) -->
        <circle cx="6" cy="7" r="1.5" fill="${opts?.stroke || 'currentColor'}" />
        <circle cx="10" cy="4" r="1.5" fill="${opts?.stroke || 'currentColor'}" />
        <!-- Class B Negative Points (crosses) -->
        <path d="M 17 18 L 19 20 M 19 18 L 17 20" />
        <path d="M 14 14 L 16 16 M 16 14 L 14 16" />
      `, opts)
    },

    /**
     * 3. Regularization: L1 Lasso Diamond circumscribed within L2 Ridge Circle
     */
    'regularization-penalty': {
      label: 'Regularization Constraint (L1/L2)',
      description: 'L1 norm diamond geometry intersecting an L2 norm hypersphere constraint',
      category: 'regularization',
      render: (opts) => wrapSvg(`
        <!-- Coordinate axes -->
        <line x1="12" y1="2" x2="12" y2="22" opacity="0.3" />
        <line x1="2" y1="12" x2="22" y2="12" opacity="0.3" />
        <!-- L2 Ridge Circle -->
        <circle cx="12" cy="12" r="8" stroke-dasharray="3 2" opacity="0.7" />
        <!-- L1 Lasso Diamond -->
        <polygon points="12 4 20 12 12 20 4 12" />
        <!-- Optimum vertex point -->
        <circle cx="12" cy="4" r="1.5" fill="${opts?.stroke || 'currentColor'}" />
      `, opts)
    },

    /**
     * 4. Decision Split: Hierarchical dendrogram tree node bifurcation
     */
    'decision-split': {
      label: 'Decision Tree Split (Entropy/Gini)',
      description: 'Hierarchical node partitioning feature space into pure child leaves',
      category: 'tree-models',
      render: (opts) => wrapSvg(`
        <!-- Root node -->
        <circle cx="12" cy="5" r="2.5" fill="${opts?.stroke || 'currentColor'}" fill-opacity="0.2" />
        <!-- Branch lines -->
        <path d="M 12 7.5 L 12 11 L 6 15 L 6 18" />
        <path d="M 12 11 L 18 15 L 18 18" />
        <!-- Left child node -->
        <rect x="4" y="18" width="4" height="4" rx="0.5" />
        <!-- Right child node -->
        <circle cx="18" cy="20" r="2" />
      `, opts)
    },

    /**
     * 5. Activation Curve: Sigmoid σ(z) = 1 / (1 + e^-z) with asymptote lines
     */
    'activation-curve': {
      label: 'Activation Function (σ / ReLU / GeLU)',
      description: 'Sigmoid non-linear saturation curve with upper and lower horizontal asymptotes',
      category: 'neural-networks',
      render: (opts) => wrapSvg(`
        <!-- Coordinate axes -->
        <line x1="3" y1="12" x2="21" y2="12" opacity="0.3" />
        <line x1="12" y1="3" x2="12" y2="21" opacity="0.3" />
        <!-- Asymptote lines -->
        <line x1="3" y1="5" x2="21" y2="5" stroke-dasharray="2 3" opacity="0.3" />
        <line x1="3" y1="19" x2="21" y2="19" stroke-dasharray="2 3" opacity="0.3" />
        <!-- Smooth S-curve -->
        <path d="M 3 19 C 8 19 9 12 12 12 C 15 12 16 5 21 5" stroke-width="${(opts?.strokeWidth || 1.75) * 1.25}" />
      `, opts)
    },

    /**
     * 6. Embedding Vector: Latent angle projection with cosine similarity θ
     */
    'embedding-vector': {
      label: 'Embedding Cosine Angle (cos θ)',
      description: 'Latent feature space vector projection showing cosine similarity angle θ',
      category: 'representation',
      render: (opts) => wrapSvg(`
        <!-- Vector u -->
        <line x1="4" y1="20" x2="20" y2="16" />
        <polyline points="17 14 20 16 18 19" />
        <!-- Vector v -->
        <line x1="4" y1="20" x2="14" y2="4" />
        <polyline points="10 5 14 4 15 9" />
        <!-- Origin point -->
        <circle cx="4" cy="20" r="1.5" fill="${opts?.stroke || 'currentColor'}" />
        <!-- Angle arc -->
        <path d="M 10 18.5 C 10 16 8 13.5 6.5 12" stroke-dasharray="2 1" />
        <!-- Dimension axes hints -->
        <line x1="4" y1="20" x2="4" y2="22" opacity="0.4" />
        <line x1="2" y1="20" x2="4" y2="20" opacity="0.4" />
      `, opts)
    },

    /**
     * 7. Loss Contour: Convex elliptical loss basin J(θ) with convergence trajectory
     */
    'loss-contour': {
      label: 'Loss Surface Basin (J(θ))',
      description: 'Concentric convex iso-loss contours with gradient trajectory to global minimum',
      category: 'optimization',
      render: (opts) => wrapSvg(`
        <!-- Outer ellipse -->
        <ellipse cx="12" cy="12" rx="9.5" ry="6.5" transform="rotate(-20 12 12)" opacity="0.4" />
        <!-- Middle ellipse -->
        <ellipse cx="12" cy="12" rx="6" ry="4" transform="rotate(-20 12 12)" opacity="0.7" />
        <!-- Inner ellipse -->
        <ellipse cx="12" cy="12" rx="2.5" ry="1.5" transform="rotate(-20 12 12)" />
        <!-- Minimum star dot -->
        <circle cx="12" cy="12" r="1.25" fill="${opts?.stroke || 'currentColor'}" />
        <!-- Trajectory path -->
        <path d="M 4 5 Q 8 10 12 12" stroke-dasharray="2 2" />
      `, opts)
    },

    /**
     * 8. Anomaly Hazard: Isolated outlier point with radiating perturbation rings
     */
    'anomaly-hazard': {
      label: 'Outlier Perturbation (Hazard)',
      description: 'Anomalous sample residing outside manifold with radiating threat ripples',
      category: 'distribution',
      render: (opts) => wrapSvg(`
        <!-- Data manifold cluster -->
        <ellipse cx="7" cy="15" rx="4" ry="3" opacity="0.3" stroke-dasharray="2 2" />
        <circle cx="6" cy="14" r="1" fill="${opts?.stroke || 'currentColor'}" opacity="0.5" />
        <circle cx="8" cy="16" r="1" fill="${opts?.stroke || 'currentColor'}" opacity="0.5" />
        <circle cx="7" cy="13" r="1" fill="${opts?.stroke || 'currentColor'}" opacity="0.5" />
        <!-- Outlier isolated point -->
        <circle cx="17" cy="7" r="2" fill="${opts?.stroke || 'currentColor'}" />
        <!-- Hazard ripples -->
        <circle cx="17" cy="7" r="4.5" stroke-dasharray="2 2" opacity="0.7" />
        <circle cx="17" cy="7" r="7" stroke-dasharray="1 3" opacity="0.4" />
      `, opts)
    },

    /**
     * 9. Learning Rate Step: Gauge indicating parameter step size (η·∇)
     */
    'learning-rate-step': {
      label: 'Learning Rate Step (η·∇)',
      description: 'Quantized step gauge depicting adaptive learning rate scalar updates',
      category: 'optimization',
      render: (opts) => wrapSvg(`
        <!-- Gauge arc -->
        <path d="M 4 18 A 9 9 0 1 1 20 18" opacity="0.35" />
        <!-- Filled step ticks -->
        <line x1="4" y1="18" x2="6.5" y2="16.5" />
        <line x1="5.5" y1="11" x2="8" y2="11.5" />
        <line x1="12" y1="3" x2="12" y2="6" stroke-width="${(opts?.strokeWidth || 1.75) * 1.5}" />
        <line x1="18.5" y1="11" x2="16" y2="11.5" opacity="0.4" />
        <line x1="20" y1="18" x2="17.5" y2="16.5" opacity="0.4" />
        <!-- Dial needle pointing at optimal eta -->
        <line x1="12" y1="15" x2="12" y2="6.5" stroke-width="${opts?.strokeWidth || 1.75}" />
        <circle cx="12" cy="15" r="2" fill="${opts?.stroke || 'currentColor'}" />
      `, opts)
    },

    /**
     * 10. Tensor Crystal: Multidimensional isometric crystal grid (X ∈ R^(n×d×k))
     */
    'tensor-crystal': {
      label: 'Tensor Crystal (X ∈ ℝ^(n×d×k))',
      description: 'Rank-3 isometric multi-dimensional tensor lattice with highlighted slice',
      category: 'architecture',
      render: (opts) => wrapSvg(`
        <!-- Front isometric face -->
        <polygon points="12 2 20 6.5 20 15.5 12 11" opacity="0.9" />
        <!-- Left isometric face -->
        <polygon points="12 2 4 6.5 4 15.5 12 11" opacity="0.7" />
        <!-- Bottom isometric face -->
        <polygon points="12 11 20 15.5 12 20 4 15.5" opacity="0.4" />
        <!-- Tensor slice coordinate gridlines -->
        <line x1="12" y1="6.5" x2="16" y2="8.75" opacity="0.5" />
        <line x1="12" y1="6.5" x2="8" y2="8.75" opacity="0.5" />
        <line x1="12" y1="11" x2="12" y2="20" opacity="0.6" />
        <circle cx="12" cy="2" r="1.2" fill="${opts?.stroke || 'currentColor'}" />
      `, opts)
    },

    /**
     * 11. Attention Matrix: Scaled Dot-Product Softmax(Q·Kᵀ / √d)·V
     */
    'attention-matrix': {
      label: 'Attention Matrix (Softmax(QKᵀ/√d))',
      description: 'Cross-attention heat-weight matrix lattice with query-key alignment vectors',
      category: 'architecture',
      render: (opts) => wrapSvg(`
        <!-- 3x3 Attention Grid Frame -->
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <!-- Softmax Heat Weights (Cells) -->
        <rect x="5.5" y="5.5" width="4" height="4" fill="${opts?.stroke || 'currentColor'}" opacity="0.8" />
        <rect x="10" y="5.5" width="4" height="4" fill="${opts?.stroke || 'currentColor'}" opacity="0.2" />
        <rect x="14.5" y="5.5" width="4" height="4" fill="${opts?.stroke || 'currentColor'}" opacity="0.4" />
        <rect x="5.5" y="10" width="4" height="4" fill="${opts?.stroke || 'currentColor'}" opacity="0.3" />
        <rect x="10" y="10" width="4" height="4" fill="${opts?.stroke || 'currentColor'}" opacity="0.9" />
        <rect x="14.5" y="10" width="4" height="4" fill="${opts?.stroke || 'currentColor'}" opacity="0.2" />
        <rect x="5.5" y="14.5" width="4" height="4" fill="${opts?.stroke || 'currentColor'}" opacity="0.1" />
        <rect x="10" y="14.5" width="4" height="4" fill="${opts?.stroke || 'currentColor'}" opacity="0.3" />
        <rect x="14.5" y="14.5" width="4" height="4" fill="${opts?.stroke || 'currentColor'}" opacity="0.75" />
      `, opts)
    },

    /**
     * 12. Convolution Kernel: Spatial feature sliding filter (I * K)
     */
    'convolution-kernel': {
      label: 'Convolution Kernel (I * K)',
      description: '2D sliding receptive field kernel with feature map projection',
      category: 'architecture',
      render: (opts) => wrapSvg(`
        <!-- Input Image Feature Map Canvas -->
        <rect x="3" y="3" width="13" height="13" rx="1.5" stroke-dasharray="2 2" opacity="0.6" />
        <!-- Sliding 3x3 Kernel Focus Box -->
        <rect x="8" y="8" width="13" height="13" rx="1.5" stroke-width="${(opts?.strokeWidth || 1.75) * 1.1}" />
        <!-- Kernel Center Stride Crosshair -->
        <circle cx="14.5" cy="14.5" r="2" fill="${opts?.stroke || 'currentColor'}" />
        <!-- Projection Vector -->
        <line x1="16" y1="8" x2="20" y2="4" stroke-dasharray="1.5 1.5" opacity="0.8" />
      `, opts)
    }
  };

  return {
    /**
     * List all available glyph identifiers
     */
    getGlyphNames: function () {
      return Object.keys(GLYPHS);
    },

    /**
     * Get glyph metadata
     */
    getGlyphMeta: function (name) {
      if (!GLYPHS[name]) return null;
      return {
        id: name,
        label: GLYPHS[name].label,
        description: GLYPHS[name].description,
        category: GLYPHS[name].category
      };
    },

    /**
     * Render SVG string for a given glyph name and options
     * @param {string} name - Glyph key (e.g. 'gradient-arrow')
     * @param {Object} options - { size, stroke, strokeWidth, fill, className, id }
     */
    renderSvg: function (name, options) {
      const glyph = GLYPHS[name];
      if (!glyph) {
        console.warn(`[NeuroArenaMathIcons] Unknown glyph '${name}'. Falling back to tensor-crystal.`);
        return GLYPHS['tensor-crystal'].render(options);
      }
      return glyph.render(options);
    },

    /**
     * Inject icon into an existing DOM element
     * @param {HTMLElement|string} target - DOM element or selector string
     * @param {string} name - Glyph key
     * @param {Object} options - SVG render options
     */
    inject: function (target, name, options) {
      if (typeof document === 'undefined') return;
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (el) {
        el.innerHTML = this.renderSvg(name, options);
      }
    },

    /**
     * Raw glyph dictionary
     */
    glyphs: GLYPHS
  };
});
