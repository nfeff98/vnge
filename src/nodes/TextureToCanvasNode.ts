import { BaseNode, NodeDataType } from '../core/BaseNode';
import { ImageDown } from 'lucide-react';

/**
 * TextureToCanvasNode - Converts WebGL textures to Canvas
 * 
 * This is a bridge node that performs GPU→CPU transfer.
 * Only use when you need to output to Canvas2D or composite with Canvas nodes.
 * 
 * For pure GPU pipelines (gradient→blur→color correct), keep everything as textures!
 */
export class TextureToCanvasNode extends BaseNode {
  constructor(id: string) {
    super(id, {
      name: 'Texture to Canvas',
      isInput: false,
      icon: ImageDown,
      color: '#9C27B0',
      backgroundColor: '#1a1a1a',
      borderColor: '#9C27B0'
    });
  }

  getNodeDefinition() {
    return {
      type: 'textureToCanvas',
      inputs: [{ id: 'texture', type: NodeDataType.TEXTURE }],
      outputs: [{ id: 'canvas', type: NodeDataType.CANVAS }],
      parameters: {},
      maxInputs: 1,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    const textureInput = this.getInput('texture');
    
    if (!textureInput) {
      return;
    }

    // Check if input is actually a WebGLTexture
    // (It's an opaque object, but we can check if it has the right prototype)
    if (typeof textureInput !== 'object') {
      console.warn('TextureToCanvasNode: Input is not a texture object');
      return;
    }

    // Extract texture metadata (we'll need to store this with the texture)
    // For now, we'll use a convention: textures have __width and __height properties
    const texture = textureInput as any;
    
    if (!texture.__width || !texture.__height || !texture.__gl) {
      console.warn('TextureToCanvasNode: Texture missing required metadata (__width, __height, __gl)');
      return;
    }

    const width = texture.__width;
    const height = texture.__height;
    const gl = texture.__gl as WebGLRenderingContext;

    // Create output canvas
    const canvas = this.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Read pixels from texture
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    // Check if framebuffer is complete
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      console.error('TextureToCanvasNode: Framebuffer incomplete');
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);
      return;
    }

    // Read pixels from GPU to CPU
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Write to canvas
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    // Cleanup
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);

    // Output canvas
    this.setOutput('canvas', canvas);
  }

  cleanup() {
    // No resources to cleanup
  }
}


