# ADR 002: Zero-Dependency Custom Neural Tensor Runtime Engine

## Status
Accepted

## Context
Standard ML frameworks (TensorFlow, PyTorch, ONNX Runtime) introduce large binary footprints (50MB–200MB), high memory overhead, and complex WebAssembly/C# bindings that degrade mobile and browser boot times.

## Decision
Implement a pure, zero-dependency C# and ES6 TypeScript neural tensor runtime:
1. **Dense Matrix GEMM**: Custom vectorized SIMD and Parallel.For multi-threaded dense matrix multiplication.
2. **Backpropagation**: Explicit analytical gradient tape tracking with Adam and SGD with Momentum optimizers.
3. **Softmax Attention**: Numerically stable max-subtracted Softmax and scaled dot-product attention.

## Consequences
- ✅ Ultra-lightweight payload (<50KB total binary size addition)
- ✅ 100% portable across Unity C# (iOS, Android, Windows, macOS, Linux) and Web (PWA/WebGL)
- ✅ Zero external C++ native library linking issues
