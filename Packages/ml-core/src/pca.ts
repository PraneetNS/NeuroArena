/**
 * NeuroArena ML-Core: Embedding Geometry, Power-Iteration PCA & Nearest Neighbors.
 *
 * Implements hand-derived numerical methods for high-dimensional representation analysis:
 * - Hand-written power iteration for principal component analysis (no external libraries)
 * - Explained-variance ratio per component
 * - Cosine-similarity nearest neighbor search
 * - Token categorical classification
 * - Shared basis projection for checkpoint morphing / scrubbing
 */

export type TokenCategory =
  | 'whitespace'
  | 'punctuation'
  | 'capitalized'
  | 'lowercase'
  | 'subword'
  | 'character_name';

export interface TokenCategoryMeta {
  category: TokenCategory;
  label: string;
  colorVar: string; // Design system CSS variable
}

export const CATEGORY_METAS: Record<TokenCategory, TokenCategoryMeta> = {
  character_name: {
    category: 'character_name',
    label: 'Character / Proper Name',
    colorVar: 'var(--na-accent)' // Lantern Amber
  },
  capitalized: {
    category: 'capitalized',
    label: 'Capitalized Word',
    colorVar: 'var(--na-accent-cool)' // Signal Teal
  },
  lowercase: {
    category: 'lowercase',
    label: 'Lowercase Word',
    colorVar: 'var(--na-text)' // Scholarly Light Parchment
  },
  subword: {
    category: 'subword',
    label: 'Subword / Morpheme',
    colorVar: 'var(--na-warning)' // Soft Amber / Gold
  },
  punctuation: {
    category: 'punctuation',
    label: 'Punctuation',
    colorVar: 'var(--na-muted)' // Slate Muted
  },
  whitespace: {
    category: 'whitespace',
    label: 'Whitespace / Formatting',
    colorVar: 'var(--na-faint)' // Deep Faint Border Slate
  }
};

const COMMON_SHAKESPEARE_CHARACTERS = new Set([
  'HAMLET', 'ROMEO', 'JULIET', 'OTHELLO', 'MACBETH', 'LEAR', 'BRUTUS',
  'ANTONY', 'CLEOPATRA', 'IAGO', 'HORATIO', 'CASSIO', 'CLAUDIUS', 'POLONIUS',
  'OPHELIA', 'GERTRUDE', 'KING', 'QUEEN', 'LORD', 'LADY', 'DUKE', 'PRINCE',
  'FALSTAFF', 'HOTSPUR', 'GLOUCESTER', 'EDGAR', 'EDMUND', 'KENT', 'CORDELLIA',
  'DESDEMONA', 'EMILIA', 'SHYLOCK', 'PORTIA', 'ANTONIO', 'BASSANIO', 'VIOLA',
  'OLIVIA', 'MALVOLIO', 'ORLANDO', 'ROSALIND', 'TOUCHSTONE', 'PROSPERO', 'MIRANDA',
  'ARIEL', 'CALIBAN', 'BENVOLIO', 'TYBALT', 'MERCUTIO', 'NURSE'
]);

/**
 * Classifies a token into one of 6 scholarly semantic categories.
 */
export function categorizeToken(_tokenId: number, tokenStr: string): TokenCategory {
  if (!tokenStr || tokenStr.length === 0) return 'whitespace';

  // Whitespace / Newline
  if (/^\s+$/.test(tokenStr) || tokenStr.includes('\n') || tokenStr.includes('\r')) {
    return 'whitespace';
  }

  // Pure Punctuation
  if (/^[.,!?;:'"()\-–—\[\]{}<>/\\|@#$%^&*+=~`]+$/.test(tokenStr.trim())) {
    return 'punctuation';
  }

  const clean = tokenStr.trim();
  const upper = clean.toUpperCase();

  // Character Name / Dramatic Persona
  if (COMMON_SHAKESPEARE_CHARACTERS.has(upper) || (/^[A-Z]{3,}$/.test(clean) && !clean.includes(' '))) {
    return 'character_name';
  }

  // Capitalized word
  if (/^[A-Z][a-z]+$/.test(clean)) {
    return 'capitalized';
  }

  // Lowercase word
  if (/^[a-z]+$/.test(clean)) {
    return 'lowercase';
  }

  // Subword / piece / affix
  return 'subword';
}

export interface PcaResult {
  components: Float32Array[]; // [3] unit eigenvectors, length dModel each
  mean: Float32Array; // Mean vector of length dModel
  explainedVarianceRatio: number[]; // [3]
  totalVariance: number;
  eigenvalues: number[]; // [3]
  coordinates: Float32Array; // [V * 3]
}

/**
 * Hand-written Power Iteration for top K Principal Components.
 * Centers the data and performs orthogonal deflation for each component.
 */
export function computeEmbeddingPca(
  tokEmb: Float32Array | Float64Array,
  vocabSize: number,
  dModel: number,
  numComponents = 3,
  maxIterations = 50
): PcaResult {
  const V = vocabSize;
  const D = dModel;

  // 1. Compute Mean Vector
  const mean = new Float32Array(D);
  for (let d = 0; d < D; d++) {
    let sum = 0;
    for (let v = 0; v < V; v++) {
      sum += tokEmb[v * D + d];
    }
    mean[d] = sum / V;
  }

  // 2. Mean-center matrix X
  const X = new Float32Array(V * D);
  for (let v = 0; v < V; v++) {
    const offset = v * D;
    for (let d = 0; d < D; d++) {
      X[offset + d] = tokEmb[offset + d] - mean[d];
    }
  }

  // 3. Compute Total Variance = sum(X_vd^2) / V
  let totalVarianceSum = 0;
  for (let i = 0; i < V * D; i++) {
    totalVarianceSum += X[i] * X[i];
  }
  const totalVariance = totalVarianceSum / V;

  const components: Float32Array[] = [];
  const eigenvalues: number[] = [];
  const explainedVarianceRatio: number[] = [];

  // Working copy of X for deflation
  const Xdef = new Float32Array(X);

  // 4. Power Iteration with Deflation for each component
  for (let k = 0; k < numComponents; k++) {
    // Initial deterministic pseudo-random unit vector
    const v = new Float32Array(D);
    let initNorm = 0;
    for (let d = 0; d < D; d++) {
      // Deterministic PRNG formula based on component index and dimension
      const r = Math.sin((k + 1) * 997 + d * 101) * 0.5 + 0.5;
      v[d] = r - 0.5;
      initNorm += v[d] * v[d];
    }
    initNorm = Math.sqrt(initNorm);
    for (let d = 0; d < D; d++) v[d] /= initNorm;

    // Power iterations: v <- X^T (X v)
    const u = new Float32Array(V);
    const w = new Float32Array(D);

    for (let iter = 0; iter < maxIterations; iter++) {
      // u = X * v
      for (let i = 0; i < V; i++) {
        const off = i * D;
        let dot = 0;
        for (let d = 0; d < D; d++) {
          dot += Xdef[off + d] * v[d];
        }
        u[i] = dot;
      }

      // w = X^T * u
      w.fill(0);
      for (let i = 0; i < V; i++) {
        const off = i * D;
        const uVal = u[i];
        for (let d = 0; d < D; d++) {
          w[d] += Xdef[off + d] * uVal;
        }
      }

      // Normalize w
      let normSq = 0;
      for (let d = 0; d < D; d++) normSq += w[d] * w[d];
      const norm = Math.sqrt(normSq);
      if (norm < 1e-12) break;

      for (let d = 0; d < D; d++) {
        v[d] = w[d] / norm;
      }
    }

    // Eigenvalue lambda = ||X v||^2 / V
    let uNormSq = 0;
    for (let i = 0; i < V; i++) {
      const off = i * D;
      let dot = 0;
      for (let d = 0; d < D; d++) {
        dot += Xdef[off + d] * v[d];
      }
      uNormSq += dot * dot;
    }
    const lambda = uNormSq / V;
    eigenvalues.push(lambda);
    explainedVarianceRatio.push(totalVariance > 0 ? lambda / totalVariance : 0);

    const comp = new Float32Array(v);
    components.push(comp);

    // Deflate: Xdef = Xdef - (Xdef v) v^T
    for (let i = 0; i < V; i++) {
      const off = i * D;
      let dot = 0;
      for (let d = 0; d < D; d++) {
        dot += Xdef[off + d] * comp[d];
      }
      for (let d = 0; d < D; d++) {
        Xdef[off + d] -= dot * comp[d];
      }
    }
  }

  // 5. Project all tokens onto the top 3 components: coords = (X - mean) @ components^T
  const coordinates = projectEmbeddingsToBasis(tokEmb, { components, mean }, vocabSize, dModel);

  return {
    components,
    mean,
    explainedVarianceRatio,
    totalVariance,
    eigenvalues,
    coordinates
  };
}

/**
 * Projects an embedding matrix onto an existing PCA basis (components and mean).
 * Used by checkpoint scrubber to morph embeddings in a shared coordinate space.
 */
export function projectEmbeddingsToBasis(
  tokEmb: Float32Array | Float64Array,
  basis: { components: Float32Array[]; mean: Float32Array },
  vocabSize: number,
  dModel: number
): Float32Array {
  const V = vocabSize;
  const D = dModel;
  const K = basis.components.length;
  const out = new Float32Array(V * K);

  for (let v = 0; v < V; v++) {
    const vOffset = v * D;
    const outOffset = v * K;

    for (let k = 0; k < K; k++) {
      const comp = basis.components[k];
      let dot = 0;
      for (let d = 0; d < D; d++) {
        const val = tokEmb[vOffset + d] - basis.mean[d];
        dot += val * comp[d];
      }
      out[outOffset + k] = dot;
    }
  }

  return out;
}

export interface NearestNeighborItem {
  tokenId: number;
  similarity: number;
}

/**
 * Finds the K nearest neighbors for a target token by cosine similarity in original embedding space.
 */
export function findNearestNeighbors(
  targetIdx: number,
  tokEmb: Float32Array | Float64Array,
  vocabSize: number,
  dModel: number,
  k = 8
): NearestNeighborItem[] {
  if (targetIdx < 0 || targetIdx >= vocabSize) return [];

  const targetOffset = targetIdx * dModel;
  let targetNormSq = 0;
  for (let d = 0; d < dModel; d++) {
    const val = tokEmb[targetOffset + d];
    targetNormSq += val * val;
  }
  const targetNorm = Math.sqrt(targetNormSq) + 1e-12;

  const results: NearestNeighborItem[] = [];

  for (let v = 0; v < vocabSize; v++) {
    if (v === targetIdx) continue;

    const vOffset = v * dModel;
    let dot = 0;
    let vNormSq = 0;
    for (let d = 0; d < dModel; d++) {
      const val = tokEmb[vOffset + d];
      dot += tokEmb[targetOffset + d] * val;
      vNormSq += val * val;
    }
    const vNorm = Math.sqrt(vNormSq) + 1e-12;
    const similarity = dot / (targetNorm * vNorm);

    results.push({ tokenId: v, similarity });
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, k);
}
