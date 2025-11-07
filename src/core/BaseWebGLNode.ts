import { BaseNode } from './BaseNode';
import { WebGLRenderer } from '../utils/WebGLRenderer';

interface NodeMetadata {
  name: string;
  isInput: boolean;
  icon: any;
  color: string;
  backgroundColor: string;
  borderColor: string;
}

/**
 * Abstract base class for WebGL-based nodes.
 * Handles all the boilerplate: context creation, texture uploads, 
 * dimension management, framebuffer setup, and cleanup.
 * 
 * Child classes only need to:
 * 1. Implement getVertexShader() and getFragmentShader()
 * 2. Implement getShaderUniforms() to provide uniform values
 * 3. Optionally override getOutputDimensions() for custom sizing
 */
export abstract class BaseWebGLNode extends BaseNode {
  protected canvas: HTMLCanvasElement | null = null;
  protected renderer: WebGLRenderer | null = null;
  protected program: WebGLProgram | null = null;
  protected outputTexture: WebGLTexture | null = null;
  protected framebuffer: WebGLFramebuffer | null = null;
  protected currentWidth: number = 0;
  protected currentHeight: number = 0;

  // Track textures we created (vs received) for proper cleanup
  private createdTextures: Set<WebGLTexture> = new Set();

  constructor(id: string, metadata: NodeMetadata) {
    super(id, metadata);
  }

  /**
   * Child classes implement this to return vertex shader source.
   * Most nodes can use the default pass-through vertex shader.
   */
  protected getVertexShader(): string {
    return `
      attribute vec2 a_position;
      varying vec2 v_uv;
      
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
  }

  /**
   * Child classes MUST implement this to return fragment shader source.
   */
  protected abstract getFragmentShader(): string;

  /**
   * Child classes MUST implement this to return shader uniforms.
   * Called during rendering with the current execution context.
   */
  protected abstract getShaderUniforms(): Record<string, any>;

  /**
   * Child classes can override this to specify custom output dimensions.
   * Default: use dimensions from the first input, or 1024x1024 if no inputs.
   */
  protected getOutputDimensions(): { width: number; height: number } {
    // Try to get dimensions from first input
    const definition = this.getNodeDefinition();
    if (definition.inputs.length > 0) {
      const firstInput = this.getInput(definition.inputs[0].id);
      if (firstInput) {
        const dims = this.getInputDimensions(firstInput);
        if (dims) return dims;
      }
    }

    // Fallback to default dimensions
    return { width: 1024, height: 1024 };
  }

  /**
   * Automatically converts any input (CANVAS, VIDEO, TEXTURE) to a WebGLTexture.
   * Tracks created textures for cleanup.
   */
  protected getInputAsTexture(inputId: string): WebGLTexture | null {
    const input = this.getInput(inputId);
    if (!input) return null;

    const gl = this.renderer!.getContext();

    // Already a WebGLTexture - return as-is (don't track, we didn't create it)
    if ((input as any).__gl) {
      return input as any;
    }

    // Convert Canvas to texture
    if (input instanceof HTMLCanvasElement) {
      const texture = this.uploadCanvasToTexture(gl, input);
      this.createdTextures.add(texture);
      return texture;
    }

    // Convert Video to texture
    if (input instanceof HTMLVideoElement) {
      const texture = this.uploadVideoToTexture(gl, input);
      this.createdTextures.add(texture);
      return texture;
    }

    return null;
  }

  /**
   * Helper to detect dimensions from any input type.
   */
  protected getInputDimensions(input: any): { width: number; height: number } | null {
    if ((input as any).__width) {
      return { width: (input as any).__width, height: (input as any).__height };
    }
    if (input instanceof HTMLCanvasElement) {
      return { width: input.width, height: input.height };
    }
    if (input instanceof HTMLVideoElement) {
      return { width: input.videoWidth, height: input.videoHeight };
    }
    return null;
  }

  /**
   * Upload HTMLCanvasElement to WebGL texture.
   */
  private uploadCanvasToTexture(gl: WebGLRenderingContext, canvas: HTMLCanvasElement): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  /**
   * Upload HTMLVideoElement to WebGL texture.
   */
  private uploadVideoToTexture(gl: WebGLRenderingContext, video: HTMLVideoElement): WebGLTexture {
    const texture = gl.createTexture();
    if (!texture) throw new Error('Failed to create texture');

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return texture;
  }

  /**
   * Initialize or resize WebGL context and output framebuffer.
   */
  protected initWebGL(width: number, height: number) {
    // Initial setup
    if (!this.renderer) {
      this.canvas = this.createCanvas(width, height);
      this.renderer = new WebGLRenderer(this.canvas);
      this.program = this.renderer.compileProgram(this.getVertexShader(), this.getFragmentShader());
    }

    // Resize if needed
    if (width !== this.currentWidth || height !== this.currentHeight) {
      this.canvas!.width = width;
      this.canvas!.height = height;
      this.currentWidth = width;
      this.currentHeight = height;

      const gl = this.renderer.getContext();

      // Recreate output texture and framebuffer
      if (this.outputTexture) {
        gl.deleteTexture(this.outputTexture);
        if (this.framebuffer) {
          gl.deleteFramebuffer(this.framebuffer);
        }
      }

      this.outputTexture = this.renderer.createTexture(width, height);
      this.framebuffer = this.renderer.createFramebuffer(this.outputTexture);
    }
  }

  /**
   * Render the shader with provided uniforms to the output texture.
   */
  protected renderToOutputTexture(uniforms: Record<string, any>) {
    this.renderer!.renderQuad(
      this.program!,
      uniforms,
      this.framebuffer,
      this.currentWidth,
      this.currentHeight
    );
  }

  /**
   * Create output texture with metadata for downstream nodes.
   */
  protected createOutputTexture(): WebGLTexture {
    const textureWithMetadata = this.outputTexture as any;
    textureWithMetadata.__width = this.currentWidth;
    textureWithMetadata.__height = this.currentHeight;
    textureWithMetadata.__gl = this.renderer!.getContext();
    return textureWithMetadata;
  }

  /**
   * Default executeInternal - child classes can override for custom logic.
   */
  async executeInternal(): Promise<void> {
    try {
      // Get output dimensions
      const { width, height } = this.getOutputDimensions();
      
      // Validate dimensions
      if (!width || !height || width <= 0 || height <= 0) {
        console.warn(`${this.getNodeDefinition().type}: Invalid dimensions ${width}x${height}`);
        return;
      }

      // Initialize WebGL
      this.initWebGL(width, height);

      // Clear created textures from previous frame
      const gl = this.renderer!.getContext();
      this.createdTextures.forEach(tex => gl.deleteTexture(tex));
      this.createdTextures.clear();

      // Get uniforms from child class
      const uniforms = this.getShaderUniforms();

      // Render
      this.renderToOutputTexture(uniforms);

      // Output texture
      const outputId = this.getNodeDefinition().outputs[0]?.id;
      if (outputId) {
        this.setOutput(outputId, this.createOutputTexture());
      }
    } catch (error) {
      console.error(`${this.getNodeDefinition().type} execution error:`, error);
    }
  }

  /**
   * Cleanup WebGL resources.
   */
  cleanup() {
    if (this.renderer) {
      const gl = this.renderer.getContext();
      
      // Delete output resources
      if (this.outputTexture) gl.deleteTexture(this.outputTexture);
      if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
      if (this.program) gl.deleteProgram(this.program);

      // Delete textures we created
      this.createdTextures.forEach(tex => gl.deleteTexture(tex));
      this.createdTextures.clear();

      this.renderer.cleanup();
    }

    this.canvas = null;
    this.renderer = null;
    this.program = null;
    this.outputTexture = null;
    this.framebuffer = null;
  }
}

