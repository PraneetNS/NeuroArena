/**
 * @file Matrix.js
 * @description High-performance row-major Float64Array-backed matrix with cache-blocked
 * matrix multiplication, Gaussian elimination with partial pivoting, Cholesky decomposition,
 * broadcast row arithmetic, and in-place vector operations. Zero dependencies.
 */

const BLOCK_SIZE = 32; // Cache blocking tile size for L1/L2 cache locality
const EPSILON = 1e-12;

export class Matrix {
  /**
   * @param {number} rows - Number of rows (> 0)
   * @param {number} cols - Number of columns (> 0)
   * @param {Float64Array | number[] | null} [data=null] - Initial data
   */
  constructor(rows, cols, data = null) {
    if (rows <= 0 || cols <= 0) {
      throw new Error(`[Matrix] Invalid dimensions: rows=${rows}, cols=${cols}`);
    }
    this.rows = rows;
    this.cols = cols;

    if (data instanceof Float64Array) {
      if (data.length !== rows * cols) {
        throw new Error(`[Matrix] Float64Array length ${data.length} does not match ${rows * cols}`);
      }
      this.data = data;
    } else if (Array.isArray(data)) {
      if (data.length !== rows * cols) {
        throw new Error(`[Matrix] Array length ${data.length} does not match ${rows * cols}`);
      }
      this.data = new Float64Array(data);
    } else {
      this.data = new Float64Array(rows * cols);
    }
  }

  /**
   * Creates an identity matrix of size n x n.
   * @param {number} n
   * @returns {Matrix}
   */
  static identity(n) {
    const m = new Matrix(n, n);
    for (let i = 0; i < n; i++) {
      m.data[i * n + i] = 1.0;
    }
    return m;
  }

  /**
   * Creates a matrix from a 2D array [[row1], [row2], ...].
   * @param {number[][]} arr2d
   * @returns {Matrix}
   */
  static from2D(arr2d) {
    const rows = arr2d.length;
    const cols = arr2d[0].length;
    const m = new Matrix(rows, cols);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        m.data[r * cols + c] = arr2d[r][c];
      }
    }
    return m;
  }

  /**
   * Gets element at (r, c).
   * @param {number} r - Row index
   * @param {number} c - Column index
   * @returns {number}
   */
  get(r, c) {
    return this.data[r * this.cols + c];
  }

  /**
   * Sets element at (r, c).
   * @param {number} r - Row index
   * @param {number} c - Column index
   * @param {number} val - Value
   */
  set(r, c, val) {
    this.data[r * this.cols + c] = val;
  }

  /**
   * Clones matrix into a new instance.
   * @returns {Matrix}
   */
  clone() {
    const copy = new Matrix(this.rows, this.cols);
    copy.data.set(this.data);
    return copy;
  }

  /**
   * Copies values in-place from another matrix with identical dimensions.
   * @param {Matrix} other
   */
  copyFrom(other) {
    if (this.rows !== other.rows || this.cols !== other.cols) {
      throw new Error('[Matrix.copyFrom] Dimension mismatch');
    }
    this.data.set(other.data);
  }

  /**
   * Matrix transpose A^T.
   * @returns {Matrix}
   */
  transpose() {
    const result = new Matrix(this.cols, this.rows);
    const R = this.rows;
    const C = this.cols;
    const s = this.data;
    const d = result.data;

    // Cache-blocked transpose
    for (let r0 = 0; r0 < R; r0 += BLOCK_SIZE) {
      const rMax = Math.min(r0 + BLOCK_SIZE, R);
      for (let c0 = 0; c0 < C; c0 += BLOCK_SIZE) {
        const cMax = Math.min(c0 + BLOCK_SIZE, C);
        for (let r = r0; r < rMax; r++) {
          for (let c = c0; c < cMax; c++) {
            d[c * R + r] = s[r * C + c];
          }
        }
      }
    }
    return result;
  }

  /**
   * Cache-blocked matrix multiplication C = A * B.
   * @param {Matrix} B
   * @param {Matrix | null} [out=null] - Optional output matrix to avoid allocation
   * @returns {Matrix}
   */
  matmul(B, out = null) {
    if (this.cols !== B.rows) {
      throw new Error(`[Matrix.matmul] Incompatible shapes: (${this.rows},${this.cols}) vs (${B.rows},${B.cols})`);
    }

    const M = this.rows;
    const K = this.cols;
    const N = B.cols;

    const result = out || new Matrix(M, N);
    const A_data = this.data;
    const B_data = B.data;
    const C_data = result.data;

    if (out) C_data.fill(0);

    // 6-loop cache-blocked tiled GEMM
    for (let i0 = 0; i0 < M; i0 += BLOCK_SIZE) {
      const iMax = Math.min(i0 + BLOCK_SIZE, M);
      for (let k0 = 0; k0 < K; k0 += BLOCK_SIZE) {
        const kMax = Math.min(k0 + BLOCK_SIZE, K);
        for (let j0 = 0; j0 < N; j0 += BLOCK_SIZE) {
          const jMax = Math.min(j0 + BLOCK_SIZE, N);

          for (let i = i0; i < iMax; i++) {
            const iK = i * K;
            const iN = i * N;
            for (let k = k0; k < kMax; k++) {
              const a = A_data[iK + k];
              if (a === 0.0) continue;
              const kN = k * N;
              for (let j = j0; j < jMax; j++) {
                C_data[iN + j] += a * B_data[kN + j];
              }
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Element-wise addition C = A + B.
   * @param {Matrix} B
   * @returns {Matrix}
   */
  add(B) {
    if (this.rows !== B.rows || this.cols !== B.cols) {
      throw new Error('[Matrix.add] Dimension mismatch');
    }
    const result = new Matrix(this.rows, this.cols);
    const d = result.data;
    const s1 = this.data;
    const s2 = B.data;
    for (let i = 0; i < d.length; i++) {
      d[i] = s1[i] + s2[i];
    }
    return result;
  }

  /**
   * In-place element-wise addition A += B.
   * @param {Matrix} B
   * @returns {Matrix} this
   */
  addInPlace(B) {
    if (this.rows !== B.rows || this.cols !== B.cols) {
      throw new Error('[Matrix.addInPlace] Dimension mismatch');
    }
    const d = this.data;
    const s = B.data;
    for (let i = 0; i < d.length; i++) {
      d[i] += s[i];
    }
    return this;
  }

  /**
   * Element-wise subtraction C = A - B.
   * @param {Matrix} B
   * @returns {Matrix}
   */
  sub(B) {
    if (this.rows !== B.rows || this.cols !== B.cols) {
      throw new Error('[Matrix.sub] Dimension mismatch');
    }
    const result = new Matrix(this.rows, this.cols);
    const d = result.data;
    const s1 = this.data;
    const s2 = B.data;
    for (let i = 0; i < d.length; i++) {
      d[i] = s1[i] - s2[i];
    }
    return result;
  }

  /**
   * In-place element-wise subtraction A -= B.
   * @param {Matrix} B
   * @returns {Matrix} this
   */
  subInPlace(B) {
    if (this.rows !== B.rows || this.cols !== B.cols) {
      throw new Error('[Matrix.subInPlace] Dimension mismatch');
    }
    const d = this.data;
    const s = B.data;
    for (let i = 0; i < d.length; i++) {
      d[i] -= s[i];
    }
    return this;
  }

  /**
   * Hadamard product (element-wise multiplication) C = A .* B.
   * @param {Matrix} B
   * @returns {Matrix}
   */
  hadamard(B) {
    if (this.rows !== B.rows || this.cols !== B.cols) {
      throw new Error('[Matrix.hadamard] Dimension mismatch');
    }
    const result = new Matrix(this.rows, this.cols);
    const d = result.data;
    const s1 = this.data;
    const s2 = B.data;
    for (let i = 0; i < d.length; i++) {
      d[i] = s1[i] * s2[i];
    }
    return result;
  }

  /**
   * In-place Hadamard product A .*= B.
   * @param {Matrix} B
   * @returns {Matrix} this
   */
  hadamardInPlace(B) {
    if (this.rows !== B.rows || this.cols !== B.cols) {
      throw new Error('[Matrix.hadamardInPlace] Dimension mismatch');
    }
    const d = this.data;
    const s = B.data;
    for (let i = 0; i < d.length; i++) {
      d[i] *= s[i];
    }
    return this;
  }

  /**
   * In-place scalar multiplication A *= scalar.
   * @param {number} scalar
   * @returns {Matrix} this
   */
  scaleInPlace(scalar) {
    const d = this.data;
    for (let i = 0; i < d.length; i++) {
      d[i] *= scalar;
    }
    return this;
  }

  /**
   * Broadcast row addition: adds a 1 x cols vector to every row of this matrix.
   * Typically used for neural network bias addition: Y = XW + b.
   * @param {Float64Array | number[] | Matrix} vector - Length must equal this.cols
   * @returns {Matrix} this
   */
  broadcastAddRowInPlace(vector) {
    const vecData = vector instanceof Matrix ? vector.data : vector;
    if (vecData.length !== this.cols) {
      throw new Error(`[Matrix.broadcastAddRowInPlace] Vector length ${vecData.length} must equal cols ${this.cols}`);
    }
    const d = this.data;
    const cols = this.cols;
    const rows = this.rows;
    for (let r = 0; r < rows; r++) {
      const offset = r * cols;
      for (let c = 0; c < cols; c++) {
        d[offset + c] += vecData[c];
      }
    }
    return this;
  }

  /**
   * Computes column sums, returning a 1 x cols Matrix.
   * @returns {Matrix}
   */
  colSums() {
    const result = new Matrix(1, this.cols);
    const resData = result.data;
    const d = this.data;
    const cols = this.cols;
    const rows = this.rows;
    for (let r = 0; r < rows; r++) {
      const offset = r * cols;
      for (let c = 0; c < cols; c++) {
        resData[c] += d[offset + c];
      }
    }
    return result;
  }

  /**
   * Applies an arbitrary scalar function to every element, returning a new Matrix.
   * @param {function(number, number, number): number} fn - (val, row, col)
   * @returns {Matrix}
   */
  apply(fn) {
    const result = new Matrix(this.rows, this.cols);
    const d = result.data;
    const s = this.data;
    const cols = this.cols;
    for (let i = 0; i < d.length; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      d[i] = fn(s[i], r, c);
    }
    return result;
  }

  /**
   * Applies an arbitrary scalar function in-place.
   * @param {function(number, number, number): number} fn - (val, row, col)
   * @returns {Matrix} this
   */
  applyInPlace(fn) {
    const d = this.data;
    const cols = this.cols;
    for (let i = 0; i < d.length; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      d[i] = fn(d[i], r, c);
    }
    return this;
  }

  /**
   * Solves Ax = b via Gaussian elimination with partial row pivoting.
   * @param {Matrix} A - Square coefficient matrix (n x n)
   * @param {Matrix | Float64Array | number[]} b - Vector/matrix of constants (n x 1 or n)
   * @returns {Matrix} Solution x (n x 1)
   */
  static solve(A, b) {
    if (A.rows !== A.cols) {
      throw new Error(`[Matrix.solve] Matrix A must be square. Got (${A.rows},${A.cols})`);
    }
    const n = A.rows;
    const bData = b instanceof Matrix ? b.data : (b instanceof Float64Array ? b : new Float64Array(b));

    if (bData.length !== n) {
      throw new Error(`[Matrix.solve] Dimension mismatch: A is ${n}x${n} but b has length ${bData.length}`);
    }

    // Clone A and b to preserve original inputs
    const M = new Float64Array(A.data);
    const y = new Float64Array(bData);

    // Forward elimination with partial pivoting
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      let maxVal = Math.abs(M[i * n + i]);
      for (let k = i + 1; k < n; k++) {
        const val = Math.abs(M[k * n + i]);
        if (val > maxVal) {
          maxVal = val;
          maxRow = k;
        }
      }

      if (maxVal < EPSILON) {
        throw new Error(`[Matrix.solve] Matrix is singular or near-singular at pivot ${i}`);
      }

      // Swap rows in M and y
      if (maxRow !== i) {
        for (let c = i; c < n; c++) {
          const tmp = M[i * n + c];
          M[i * n + c] = M[maxRow * n + c];
          M[maxRow * n + c] = tmp;
        }
        const tmpY = y[i];
        y[i] = y[maxRow];
        y[maxRow] = tmpY;
      }

      // Eliminate below
      const pivot = M[i * n + i];
      for (let k = i + 1; k < n; k++) {
        const factor = M[k * n + i] / pivot;
        M[k * n + i] = 0.0;
        for (let c = i + 1; c < n; c++) {
          M[k * n + c] -= factor * M[i * n + c];
        }
        y[k] -= factor * y[i];
      }
    }

    // Back substitution
    const x = new Matrix(n, 1);
    const xData = x.data;
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let c = i + 1; c < n; c++) {
        sum -= M[i * n + c] * xData[c];
      }
      xData[i] = sum / M[i * n + i];
    }
    return x;
  }

  /**
   * Computes Cholesky decomposition A = L * L^T for symmetric positive-definite (SPD) matrices.
   * @param {Matrix} A - Symmetric positive-definite matrix (n x n)
   * @returns {Matrix} Lower triangular matrix L (n x n)
   */
  static cholesky(A) {
    if (A.rows !== A.cols) {
      throw new Error('[Matrix.cholesky] Matrix must be square');
    }
    const n = A.rows;
    const aData = A.data;
    const L = new Matrix(n, n);
    const lData = L.data;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0.0;
        for (let k = 0; k < j; k++) {
          sum += lData[i * n + k] * lData[j * n + k];
        }

        if (i === j) {
          const diff = aData[i * n + i] - sum;
          if (diff <= 0.0) {
            throw new Error(`[Matrix.cholesky] Matrix is not positive-definite at index (${i},${i})`);
          }
          lData[i * n + j] = Math.sqrt(diff);
        } else {
          lData[i * n + j] = (aData[i * n + j] - sum) / lData[j * n + j];
        }
      }
    }
    return L;
  }

  /**
   * Solves Ax = b for SPD systems using Cholesky factor L: L * y = b, L^T * x = y.
   * @param {Matrix} A - Symmetric positive-definite matrix (n x n)
   * @param {Matrix | Float64Array | number[]} b - Target vector (length n)
   * @returns {Matrix} Solution x (n x 1)
   */
  static solveCholesky(A, b) {
    const L = Matrix.cholesky(A);
    const n = A.rows;
    const bData = b instanceof Matrix ? b.data : (b instanceof Float64Array ? b : new Float64Array(b));
    const lData = L.data;

    // Forward solve: L y = b
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let sum = bData[i];
      for (let k = 0; k < i; k++) {
        sum -= lData[i * n + k] * y[k];
      }
      y[i] = sum / lData[i * n + i];
    }

    // Backward solve: L^T x = y
    const x = new Matrix(n, 1);
    const xData = x.data;
    for (let i = n - 1; i >= 0; i--) {
      let sum = y[i];
      for (let k = i + 1; k < n; k++) {
        sum -= lData[k * n + i] * xData[k]; // L^T[i, k] = L[k, i]
      }
      xData[i] = sum / lData[i * n + i];
    }
    return x;
  }

  /**
   * Converts matrix to a regular 2D JavaScript array.
   * @returns {number[][]}
   */
  toArray() {
    const arr = [];
    for (let r = 0; r < this.rows; r++) {
      const row = [];
      const offset = r * this.cols;
      for (let c = 0; c < this.cols; c++) {
        row.push(this.data[offset + c]);
      }
      arr.push(row);
    }
    return arr;
  }
}
