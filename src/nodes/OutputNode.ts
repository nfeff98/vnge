import { BaseNode, NodeDataType } from '../core/BaseNode';
import { Monitor } from 'lucide-react';
import type { Color } from './ColorNode';
import { WebGLContextManager } from '../utils/WebGLContextManager';

// Simple passthrough shader for rendering texture to screen
const PASSTHROUGH_VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const PASSTHROUGH_FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_image;
varying vec2 v_uv;

void main() {
  gl_FragColor = texture2D(u_image, v_uv);
}
`;

export class OutputNode extends BaseNode {
  private targetCanvas: HTMLCanvasElement | null = null;
  private program: WebGLProgram | null = null;
  private quadBuffer: WebGLBuffer | null = null;

  constructor(id: string) {
    super(id, {
      name: 'Output',
      isInput: false,
      icon: Monitor,
      color: '#2196F3',
      backgroundColor: '#1a1a1a',
      borderColor: '#2196F3'
    });
  }

  setTargetCanvas(canvas: HTMLCanvasElement) {
    this.targetCanvas = canvas;
    // Reset program when canvas changes (will reinitialize on next use)
    this.program = null;
    this.quadBuffer = null;
  }

  getNodeDefinition() {
    return {
      type: 'output',
      inputs: [{ 
        id: 'image', 
        type: NodeDataType.ANY, 
        accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO, NodeDataType.TEXTURE, NodeDataType.COLOR] 
      }],
      outputs: [],
      parameters: {},
      maxInputs: 1,
      maxOutputs: 0
    };
  }

  /**
   * Initialize WebGL context and shader program for direct texture rendering
   * Uses the shared WebGL context
   */
  private initWebGL(): void {
    if (!this.targetCanvas || this.program) {
      return;
    }

    // Use shared context
    const gl = WebGLContextManager.getSharedContext();

    // Compile shaders
    const vertexShader = this.compileShader(gl, PASSTHROUGH_VERTEX_SHADER, gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(gl, PASSTHROUGH_FRAGMENT_SHADER, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
      return;
    }

    // Create program
    this.program = gl.createProgram();
    if (!this.program) {
      return;
    }

    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('OutputNode: Program linking failed:', gl.getProgramInfoLog(this.program));
      gl.deleteProgram(this.program);
      this.program = null;
      return;
    }

    // Clean up shaders
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    // Create quad buffer
    const vertices = new Float32Array([
      -1, -1,  // Bottom-left
       1, -1,  // Bottom-right
      -1,  1,  // Top-left
       1,  1   // Top-right
    ]);

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  /**
   * Compile a shader
   */
  private compileShader(gl: WebGLRenderingContext, source: string, type: number): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('OutputNode: Shader compilation failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  async executeInternal(): Promise<void> {
    const input = this.getInput('image');
    if (!input || !this.targetCanvas) {
      return;
    }

    // Check if input is a WebGL texture (not a canvas - canvases don't have __gl)
    if ((input as any).__width && (input as any).__height && (input as any).__gl && !(input instanceof HTMLCanvasElement)) {
      const texture = input as any;
      const width = texture.__width;
      const height = texture.__height;
      const sourceGl = texture.__gl as WebGLRenderingContext;

      // Initialize WebGL if needed
      this.initWebGL();

      const sharedGl = WebGLContextManager.getSharedContext();

      // Try to render directly if texture is from shared context
      if (this.program && sourceGl === sharedGl) {
        // Check if target canvas can use WebGL
        // Try to get WebGL context (this will work if canvas doesn't have 2D context yet)
        let targetGl = this.targetCanvas.getContext('webgl', { preserveDrawingBuffer: true }) ||
                       this.targetCanvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
        
        // If we can get WebGL context and it matches, render directly
        if (targetGl && targetGl === sharedGl) {
          // Resize canvas
          if (this.targetCanvas.width !== width || this.targetCanvas.height !== height) {
            this.targetCanvas.width = width;
            this.targetCanvas.height = height;
          }

          // Render texture directly to canvas (no readPixels!)
          targetGl.viewport(0, 0, width, height);
          targetGl.useProgram(this.program);
          targetGl.activeTexture(targetGl.TEXTURE0);
          targetGl.bindTexture(targetGl.TEXTURE_2D, texture);
          const imageLocation = targetGl.getUniformLocation(this.program, 'u_image');
          if (imageLocation) {
            targetGl.uniform1i(imageLocation, 0);
          }

          const positionLocation = targetGl.getAttribLocation(this.program, 'a_position');
          targetGl.bindBuffer(targetGl.ARRAY_BUFFER, this.quadBuffer);
          targetGl.enableVertexAttribArray(positionLocation);
          targetGl.vertexAttribPointer(positionLocation, 2, targetGl.FLOAT, false, 0, 0);

          targetGl.bindFramebuffer(targetGl.FRAMEBUFFER, null);
          targetGl.drawArrays(targetGl.TRIANGLE_STRIP, 0, 4);
          return; // Successfully rendered directly!
        }
      }

      // Fall back to readPixels if we can't render directly
      const ctx = this.targetCanvas.getContext('2d');
      if (ctx) {
        // Read from texture and draw to canvas
        // Use the texture's context to read pixels
        const framebuffer = sourceGl.createFramebuffer();
        sourceGl.bindFramebuffer(sourceGl.FRAMEBUFFER, framebuffer);
        sourceGl.framebufferTexture2D(
          sourceGl.FRAMEBUFFER,
          sourceGl.COLOR_ATTACHMENT0,
          sourceGl.TEXTURE_2D,
          texture,
          0
        );

        if (sourceGl.checkFramebufferStatus(sourceGl.FRAMEBUFFER) === sourceGl.FRAMEBUFFER_COMPLETE) {
          const pixels = new Uint8Array(width * height * 4);
          sourceGl.readPixels(0, 0, width, height, sourceGl.RGBA, sourceGl.UNSIGNED_BYTE, pixels);

          this.targetCanvas.width = width;
          this.targetCanvas.height = height;
          const imageData = ctx.createImageData(width, height);
          imageData.data.set(pixels);
          ctx.putImageData(imageData, 0, 0);
        }

        sourceGl.bindFramebuffer(sourceGl.FRAMEBUFFER, null);
        sourceGl.deleteFramebuffer(framebuffer);
      }
      return;
    }

    // Handle non-texture inputs with Canvas2D
    const ctx = this.targetCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);

    // Handle Color input
    if ((input as any).r !== undefined && (input as any).g !== undefined && (input as any).b !== undefined) {
      const color = input as unknown as Color;
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a ?? 1})`;
      ctx.fillRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
      return;
    }

    // Handle Video input
    if (input instanceof HTMLVideoElement) {
      const video = input as HTMLVideoElement;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }
      ctx.drawImage(video, 0, 0, this.targetCanvas.width, this.targetCanvas.height);
      return;
    }

    // Handle Canvas input (default behavior)
    if (input instanceof HTMLCanvasElement) {
      ctx.drawImage(input, 0, 0, this.targetCanvas.width, this.targetCanvas.height);
    }
  }

  cleanup() {
    const gl = WebGLContextManager.getSharedContext();
    if (this.program) {
      gl.deleteProgram(this.program);
    }
    if (this.quadBuffer) {
      gl.deleteBuffer(this.quadBuffer);
    }
    this.program = null;
    this.quadBuffer = null;
  }
}
