/**
 * WebGL utility class for managing shader compilation and rendering
 * Designed for efficient GPU-based operations that keep data on GPU
 */
export class WebGLRenderer {
  private gl: WebGLRenderingContext;
  private quadBuffer: WebGLBuffer | null = null;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      preserveDrawingBuffer: true
    });
    
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    
    this.gl = gl;
    this.setupQuad();
  }

  /**
   * Create a full-screen quad (2 triangles) for fragment shader effects
   */
  private setupQuad() {
    const vertices = new Float32Array([
      -1, -1,  // Bottom-left
       1, -1,  // Bottom-right
      -1,  1,  // Top-left
       1,  1   // Top-right
    ]);

    this.quadBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
  }

  /**
   * Compile a shader from source
   */
  private compileShaderSource(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${info}`);
    }

    return shader;
  }

  /**
   * Compile and link a shader program
   */
  compileProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const vertexShader = this.compileShaderSource(vertexSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShaderSource(fragmentSource, this.gl.FRAGMENT_SHADER);

    const program = this.gl.createProgram();
    if (!program) {
      throw new Error('Failed to create program');
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(`Program linking failed: ${info}`);
    }

    // Clean up shaders (no longer needed after linking)
    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);

    return program;
  }

  /**
   * Create a texture for rendering to
   */
  createTexture(width: number, height: number): WebGLTexture {
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture');
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );

    // Set texture parameters (no mipmaps, clamp to edge)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    return texture;
  }

  /**
   * Create a framebuffer for render-to-texture
   */
  createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error('Failed to create framebuffer');
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    );

    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${status}`);
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    return framebuffer;
  }

  /**
   * Render a full-screen quad with the given program and uniforms
   * Can render to screen (framebuffer=null) or texture (framebuffer provided)
   */
  renderQuad(
    program: WebGLProgram,
    uniforms: Record<string, any>,
    framebuffer: WebGLFramebuffer | null = null,
    width: number,
    height: number
  ) {
    // Bind framebuffer (null = screen)
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.viewport(0, 0, width, height);

    // Use program
    this.gl.useProgram(program);

    // Set uniforms
    for (const [name, value] of Object.entries(uniforms)) {
      const location = this.gl.getUniformLocation(program, name);
      if (location === null) continue;

      // Handle texture uniforms (object with texture and unit)
      if (value && typeof value === 'object' && 'texture' in value && 'unit' in value) {
        const { texture, unit } = value;
        if (texture) {
          this.gl.activeTexture(this.gl.TEXTURE0 + unit);
          this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
          this.gl.uniform1i(location, unit); // Samplers use uniform1i
        }
        continue;
      }

      if (Array.isArray(value)) {
        switch (value.length) {
          case 1:
            this.gl.uniform1f(location, value[0]);
            break;
          case 2:
            this.gl.uniform2f(location, value[0], value[1]);
            break;
          case 3:
            this.gl.uniform3f(location, value[0], value[1], value[2]);
            break;
          case 4:
            this.gl.uniform4f(location, value[0], value[1], value[2], value[3]);
            break;
          case 9:
            // 3x3 matrix (mat3) - expects column-major order (WebGL native format)
            // false = don't transpose (matrix is already in column-major)
            this.gl.uniformMatrix3fv(location, false, new Float32Array(value));
            break;
          case 16:
            // 4x4 matrix (mat4) - row-major order
            this.gl.uniformMatrix4fv(location, false, new Float32Array(value));
            break;
        }
      } else if (typeof value === 'number') {
        // Always use float for single numbers (WebGL GLSL is picky about int uniforms)
        this.gl.uniform1f(location, value);
      }
    }

    // Bind quad buffer
    const positionLocation = this.gl.getAttribLocation(program, 'a_position');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
    this.gl.enableVertexAttribArray(positionLocation);
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

    // Draw quad
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

    // Cleanup
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Convert a WebGL texture to a Canvas (CPU readback)
   * This is expensive - only use when needed!
   */
  textureToCanvas(texture: WebGLTexture, width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // Create temporary framebuffer
    const framebuffer = this.createFramebuffer(texture);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);

    // Read pixels from GPU to CPU
    const pixels = new Uint8Array(width * height * 4);
    this.gl.readPixels(0, 0, width, height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

    // Write to canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = ctx.createImageData(width, height);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    }

    // Cleanup
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.deleteFramebuffer(framebuffer);

    return canvas;
  }

  /**
   * Get the WebGL context
   */
  getContext(): WebGLRenderingContext {
    return this.gl;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.quadBuffer) {
      this.gl.deleteBuffer(this.quadBuffer);
      this.quadBuffer = null;
    }
  }
}


