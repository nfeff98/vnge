# Remaining Optimization Todos

## Overview
This document lists remaining performance optimizations for the VNGE pipeline system. Completed optimizations include: adaptive framerate (MediaPipe detection), execution profiling, static caching for ImageNode/ColorNode/CompositeNode, React Flow memoization, and NodeComponent display throttling.

---

## Pipeline-Level Optimizations

### 1. **Change Detection & Dirty Tracking System**
- **Status**: Partially implemented (ImageNode, ColorNode, CompositeNode have basic caching)
- **Goal**: Implement comprehensive change detection to skip execution of nodes when inputs/parameters haven't changed
- **Approach**:
  - Add `isDirty()` method to `BaseNode` that checks if inputs/parameters changed since last execution
  - Track input hashes/values and parameter values in `BaseNode`
  - Skip `executeInternal()` if node is not dirty (already handled by caching in some nodes, but should be generalized)
  - Consider dependency graph analysis to mark downstream nodes as dirty when upstream changes
- **Files**: `src/core/BaseNode.ts`, `src/core/PipelineEngine.ts`
- **Priority**: High

### 2. **WebGL Texture Reuse & Pooling**
- **Status**: Basic texture reuse exists in `BaseWebGLNode`, but could be improved
- **Goal**: Minimize texture creation/deletion overhead
- **Approach**:
  - Implement texture pool for common dimensions
  - Reuse textures across frames when dimensions match
  - Track texture lifecycle more carefully to avoid leaks
  - Consider texture atlasing for small textures
- **Files**: `src/core/BaseWebGLNode.ts`, `src/utils/WebGLRenderer.ts`
- **Priority**: Medium

### 3. **Pipeline Execution Batching**
- **Status**: Not implemented
- **Goal**: Batch multiple node executions to reduce overhead
- **Approach**:
  - Group nodes by execution type (WebGL, Canvas, CPU)
  - Batch WebGL operations where possible
  - Use `requestAnimationFrame` for visual updates, `setTimeout` for non-visual
- **Files**: `src/core/PipelineEngine.ts`
- **Priority**: Low

### 4. **Memory Management & Cleanup**
- **Status**: Basic cleanup exists, but could be more aggressive
- **Goal**: Reduce memory footprint, especially for large graphs
- **Approach**:
  - Implement automatic cleanup of unused node outputs
  - Clear cached textures/canvases when nodes are disconnected
  - Add memory pressure detection and cleanup
  - Profile memory usage in profiler
- **Files**: `src/core/BaseNode.ts`, `src/core/BaseWebGLNode.ts`, `src/components/NodeEditor/Profiler.tsx`
- **Priority**: Medium

---

## Node-Level Optimizations

### 5. **Convert Canvas Nodes to WebGL**
- **Status**: Not started
- **Goal**: Improve performance by moving Canvas2D operations to GPU
- **Nodes to Convert**:
  - **TileAndOffsetNode** (`src/nodes/TileAndOffsetNode.ts`)
    - Currently uses Canvas2D `drawImage` in loops
    - WebGL shader can tile texture with UV coordinates
    - Significant performance gain for large tiling operations
  - **OpacityNode** (`src/nodes/OpacityNode.ts`)
    - Simple alpha blending - very easy WebGL conversion
    - Currently uses `globalAlpha` on Canvas2D
  - **MirrorNode** (`src/nodes/MirrorNode.ts`)
    - Uses Canvas2D transforms (`scale`, `translate`)
    - WebGL can flip with UV coordinate manipulation
  - **PerlinNoiseNode** (`src/nodes/PerlinNoiseNode.ts`)
    - Currently CPU-based per-pixel loop
    - WebGL shader can generate noise on GPU (much faster)
    - Already has WebGL infrastructure (`BaseWebGLNode` exists)
  - **CompositeNode** (`src/nodes/CompositeNode.ts`)
    - Most complex - uses Canvas2D `globalCompositeOperation`
    - WebGL can handle blend modes via shader
    - May need multiple shader variants for different blend modes
- **Approach**:
  - Extend `BaseWebGLNode` for each node
  - Implement fragment shaders for each operation
  - Maintain backward compatibility with Canvas outputs if needed
  - Test performance improvements
- **Files**: All node files listed above
- **Priority**: High (especially PerlinNoiseNode and TileAndOffsetNode)

### 6. **Add Static Caching to Additional Nodes**
- **Status**: ImageNode, ColorNode, CompositeNode done
- **Goal**: Prevent unnecessary recalculations for nodes with static inputs
- **Nodes to Optimize**:
  - **TrailNode** (`src/nodes/TrailNode.ts`)
    - If input is static (ImageNode), trail should only update when time changes
    - Cache trail state when input is static
  - **GradientNode** (`src/nodes/GradientNode.ts`)
    - Already WebGL, but could cache if parameters don't change
    - Check if parameters are static (no TimeNode inputs)
  - **MathNode** (`src/nodes/MathNode.ts`)
    - Cache result if all inputs are static
  - **ArrayOperationsNode** (`src/nodes/ArrayOperationsNode.ts`)
    - Cache result if inputs are static
- **Approach**:
  - Similar to ImageNode/ColorNode: hash inputs/parameters
  - Skip `executeInternal()` if hash unchanged
  - Call `markRedo()` only when actually recalculating
- **Files**: All node files listed above
- **Priority**: Medium

### 7. **Optimize Time-Driven Nodes**
- **Status**: Not optimized
- **Goal**: Efficiently handle nodes that update based on time
- **Approach**:
  - TimeNode should only update once per frame (already likely)
  - Nodes that depend on TimeNode should detect if TimeNode is connected
  - Consider time-based dirty tracking (only recalculate if time changed)
- **Files**: `src/nodes/TimeNode.ts`, nodes that use TimeNode
- **Priority**: Low

### 8. **Video/Camera Input Optimization**
- **Status**: Basic handling exists
- **Goal**: Optimize video frame processing
- **Approach**:
  - Cache video-to-canvas conversions when possible
  - Use WebGL textures directly from video elements (already done in BaseWebGLNode)
  - Avoid unnecessary canvas copies
  - Consider using `ImageBitmap` API for better performance
- **Files**: `src/nodes/CameraNode.ts`, `src/hooks/useCamera.ts`, nodes that process video
- **Priority**: Medium

---

## React Flow & UI Optimizations

### 9. **React Flow Performance Improvements**
- **Status**: Basic memoization done, but could be improved
- **Goal**: Reduce UI lag with large graphs
- **Approach**:
  - Virtualize node rendering (only render visible nodes)
  - Further optimize `NodeComponent` re-renders
  - Use `React.memo` with custom comparison functions
  - Debounce/throttle edge updates
  - Consider using `react-window` or similar for large node lists
- **Files**: `src/components/NodeEditor/NodeEditor.tsx`, `src/components/NodeEditor/NodeComponent.tsx`
- **Priority**: Medium

### 10. **Profiler Enhancements**
- **Status**: Basic profiler exists
- **Goal**: Better visibility into performance bottlenecks
- **Approach**:
  - Add frame time graph/histogram
  - Show memory usage per node
  - Track WebGL draw calls
  - Show texture count and sizes
  - Add warnings for nodes exceeding performance thresholds
  - Export profiling data
- **Files**: `src/components/NodeEditor/Profiler.tsx`
- **Priority**: Low

---

## Streaming & Fullscreen Optimizations

### 11. **Fullscreen Broadcast Performance**
- **Status**: Basic streaming works but can be laggy
- **Goal**: Improve fullscreen view performance
- **Approach**:
  - Optimize `CanvasStreamManager` frame capture
  - Use `OffscreenCanvas` if supported
  - Reduce capture framerate if needed (adaptive)
  - Consider WebCodecs API for better encoding
  - Optimize BroadcastChannel message size
  - Use `requestVideoFrameCallback` for video elements
- **Files**: `src/utils/CanvasStreamManager.ts`, `src/fullscreen.tsx`
- **Priority**: Medium

### 12. **WebRTC Streaming Optimization**
- **Status**: Not implemented (if needed)
- **Goal**: Better streaming performance than BroadcastChannel
- **Approach**:
  - Use WebRTC for lower latency
  - Implement adaptive bitrate
  - Use hardware acceleration if available
- **Files**: `src/utils/CanvasStreamManager.ts`
- **Priority**: Low (only if BroadcastChannel is insufficient)

---

## Advanced Optimizations

### 13. **WebWorker Offloading**
- **Status**: Not implemented
- **Goal**: Offload CPU-intensive operations to workers
- **Approach**:
  - Move PerlinNoiseNode CPU calculations to worker (if not converted to WebGL)
  - Offload MediaPipe processing if possible
  - Use workers for heavy math operations
  - Consider SharedArrayBuffer for zero-copy data transfer
- **Files**: New worker files, affected node files
- **Priority**: Low (WebGL conversion may make this unnecessary)

### 14. **WebAssembly Acceleration**
- **Status**: Not implemented
- **Goal**: Further accelerate CPU-bound operations
- **Approach**:
  - Compile critical algorithms to WASM
  - Use WASM for image processing if needed
  - Consider using existing WASM libraries (e.g., OpenCV.js)
- **Files**: New WASM files, affected node files
- **Priority**: Low (WebGL should handle most cases)

### 15. **Pipeline Parallelization**
- **Status**: Not implemented
- **Goal**: Execute independent node branches in parallel
- **Approach**:
  - Analyze dependency graph for parallel execution opportunities
  - Use `Promise.all()` for independent nodes
  - Consider Web Workers for true parallelism
  - Be careful with shared resources (WebGL context)
- **Files**: `src/core/PipelineEngine.ts`
- **Priority**: Low (complexity may not be worth it)

---

## Testing & Validation

### 16. **Performance Benchmarking Suite**
- **Status**: Not implemented
- **Goal**: Automated performance testing
- **Approach**:
  - Create test scenarios with various graph sizes
  - Measure FPS, memory usage, execution times
  - Track regressions
  - Compare before/after optimizations
- **Files**: New test files
- **Priority**: Low

### 17. **Performance Regression Detection**
- **Status**: Not implemented
- **Goal**: Catch performance regressions early
- **Approach**:
  - Add performance budgets to CI/CD
  - Alert on FPS drops or memory increases
  - Track performance metrics over time
- **Files**: CI/CD configuration
- **Priority**: Low

---

## Summary by Priority

### High Priority
1. Convert Canvas nodes to WebGL (especially PerlinNoiseNode, TileAndOffsetNode)
2. Comprehensive change detection & dirty tracking system

### Medium Priority
3. Add static caching to additional nodes (TrailNode, GradientNode, MathNode, etc.)
4. WebGL texture reuse & pooling improvements
5. Memory management & cleanup
6. Video/Camera input optimization
7. React Flow performance improvements
8. Fullscreen broadcast performance

### Low Priority
9. Profiler enhancements
10. Pipeline execution batching
11. Time-driven node optimization
12. WebWorker offloading
13. WebAssembly acceleration
14. Pipeline parallelization
15. Performance benchmarking suite
16. Performance regression detection
17. WebRTC streaming optimization

---

## Notes

- **WebGL vs Canvas**: WebGL conversion should be prioritized for nodes that process large images or run frequently. Canvas2D is fine for simple operations on small images.
- **Static vs Dynamic**: The static caching system works well for ImageNode/ColorNode. Consider extending this pattern to other nodes, but be careful with nodes that have time-based or video inputs.
- **Profiling**: The current profiler provides good visibility. Enhancements should focus on actionable insights (which nodes are slow, why, how to fix).
- **Memory**: Large graphs can consume significant memory. Aggressive cleanup and texture pooling will help.
- **React Flow**: UI performance is important for user experience. Virtualization may be necessary for graphs with 100+ nodes.

