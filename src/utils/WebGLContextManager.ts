/**
 * Shared WebGL context manager
 * All WebGL nodes share the same context to avoid expensive cross-context texture copies
 */
export class WebGLContextManager {
  private static sharedContext: WebGLRenderingContext | null = null;
  private static sharedCanvas: HTMLCanvasElement | null = null;

  /**
   * Get the shared WebGL context
   * Creates it if it doesn't exist
   */
  static getSharedContext(): WebGLRenderingContext {
    if (!this.sharedContext) {
      this.sharedCanvas = document.createElement('canvas');
      const gl = this.sharedCanvas.getContext('webgl', {
        premultipliedAlpha: false,
        preserveDrawingBuffer: true
      });
      
      if (!gl) {
        throw new Error('WebGL not supported');
      }
      
      this.sharedContext = gl;
    }
    return this.sharedContext;
  }

  /**
   * Get the shared canvas (creates context if needed)
   */
  static getSharedCanvas(): HTMLCanvasElement {
    if (!this.sharedCanvas) {
      this.getSharedContext(); // Initialize
    }
    return this.sharedCanvas!;
  }

  /**
   * Cleanup (for testing or if needed)
   */
  static cleanup() {
    this.sharedContext = null;
    this.sharedCanvas = null;
  }
}

