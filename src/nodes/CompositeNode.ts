import { BaseNode, NodeDataType } from '../core/BaseNode';
import { Layers } from 'lucide-react';
import { NodeParameterType } from '../core/BaseNode';
import type { Color } from './ColorNode';

export class CompositeNode extends BaseNode {
  private outputCanvas: HTMLCanvasElement | null = null;
  private cachedBaseCanvas: HTMLCanvasElement | null = null;
  private cachedLayerCanvas: HTMLCanvasElement | null = null;
  private cachedOutputCanvas: HTMLCanvasElement | null = null;
  private lastBaseHash: string = '';
  private lastLayerHash: string = '';
  private lastBlendMode: string = '';
  private lastTargetWidth: number = 0;
  private lastTargetHeight: number = 0;
  private lastBaseInput: any = null;
  private lastLayerInput: any = null;

  constructor(id: string) {
    super(id, {
      name: 'Composite',
      icon: Layers,
      isInput: false,
      color: '#9C27B0',
      backgroundColor: '#1a1a1a',
      borderColor: '#9C27B0'
    });
  }

  getNodeDefinition() {
    return {
      type: 'composite',
      inputs: [
        { id: 'base', type: NodeDataType.CANVAS, accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO, NodeDataType.COLOR] },
        { id: 'layer', type: NodeDataType.CANVAS, accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO, NodeDataType.COLOR] }
      ],
      outputs: [{ id: 'composite', type: NodeDataType.CANVAS }],
      parameters: {
        blendMode: {
          type: NodeParameterType.ENUM,
          value: 'normal',
          options: [
            'normal',
            'multiply',
            'screen',
            'overlay',
            'darken',
            'lighten',
            'color-dodge',
            'color-burn',
            'hard-light',
            'soft-light',
            'difference',
            'exclusion',
            'hue',
            'saturation',
            'color',
            'luminosity'
          ]
        },
        static: {
          type: NodeParameterType.BOOLEAN,
          value: false
        }
      },
      maxInputs: 2,
      maxOutputs: 1
    };
  }

  /**
   * Compute a hash for an input to detect changes
   * For static mode, we track input reference and dimensions
   */
  private computeInputHash(input: any): string {
    if (!input) return '';
    
    // Video is always dynamic - use currentTime
    if (input instanceof HTMLVideoElement) {
      return `video:${input.currentTime}:${input.videoWidth}x${input.videoHeight}`;
    }
    
    // WebGLTexture - always dynamic (recreated each frame)
    if ((input as any).__width && (input as any).__height) {
      return `texture:${(input as any).__width}x${(input as any).__height}`;
    }
    
    // Canvas - use reference and dimensions
    if (input instanceof HTMLCanvasElement) {
      return `canvas:${input.width}x${input.height}:${input}`;
    }
    
    // Color - use RGB values
    if ((input as any).r !== undefined) {
      const color = input as any;
      return `color:${color.r},${color.g},${color.b},${color.a ?? 1}`;
    }
    
    return JSON.stringify(input);
  }

  async executeInternal(): Promise<void> {
    const base = this.getInput('base');
    const layer = this.getInput('layer');
    const isStatic = this.getParameter('static') as boolean;

    if (!base || !layer) {
      // If only base is connected, pass it through
      if (base) {
        this.setOutput('composite', base);
      }
      // Clear caches when inputs disconnected
      this.cachedBaseCanvas = null;
      this.cachedLayerCanvas = null;
      this.cachedOutputCanvas = null;
      this.lastBaseHash = '';
      this.lastLayerHash = '';
      return;
    }

    if (typeof(base) !== 'object' || typeof(layer) !== 'object') {
      return;
    }

    // Compute input hashes for change detection
    const baseHash = this.computeInputHash(base);
    const layerHash = this.computeInputHash(layer);
    const blendMode = this.getParameter('blendMode') as string;

    // Check if inputs changed (for static mode caching)
    const baseChanged = base !== this.lastBaseInput;
    const layerChanged = layer !== this.lastLayerInput;
    const inputsChanged = baseChanged || layerChanged;

    // Determine dimensions - prioritize canvas/video/texture dimensions, fallback to default
    let targetWidth = 640;
    let targetHeight = 480;
    
    // Check base for dimensions
    if (base) {
      // Check if it's a WebGLTexture
      if ((base as any).__width && (base as any).__height) {
        targetWidth = (base as any).__width;
        targetHeight = (base as any).__height;
      } else if (!(base as any).r) {
        // It's a canvas or video element
        const baseEl = base as HTMLCanvasElement | HTMLVideoElement;
        if (baseEl instanceof HTMLVideoElement) {
          targetWidth = baseEl.videoWidth || 640;
          targetHeight = baseEl.videoHeight || 480;
        } else if (baseEl instanceof HTMLCanvasElement) {
          targetWidth = baseEl.width || 640;
          targetHeight = baseEl.height || 480;
        }
      }
    }
    
    // Check layer for dimensions (use larger resolution if both have dimensions)
    if (layer) {
      let layerWidth = 640;
      let layerHeight = 480;
      
      // Check if it's a WebGLTexture
      if ((layer as any).__width && (layer as any).__height) {
        layerWidth = (layer as any).__width;
        layerHeight = (layer as any).__height;
      } else if (!(layer as any).r) {
        // It's a canvas or video element
        const layerEl = layer as HTMLCanvasElement | HTMLVideoElement;
        if (layerEl instanceof HTMLVideoElement) {
          layerWidth = layerEl.videoWidth || 640;
          layerHeight = layerEl.videoHeight || 480;
        } else if (layerEl instanceof HTMLCanvasElement) {
          layerWidth = layerEl.width || 640;
          layerHeight = layerEl.height || 480;
        }
      }
      
      // Use the maximum resolution to preserve quality
      if (layerWidth * layerHeight > targetWidth * targetHeight) {
        targetWidth = layerWidth;
        targetHeight = layerHeight;
      }
    }

    // Check dimensions changed
    const dimensionsChanged = targetWidth !== this.lastTargetWidth || targetHeight !== this.lastTargetHeight;

    // In static mode, check if we can reuse cached output
    if (isStatic && !inputsChanged && !dimensionsChanged && 
        baseHash === this.lastBaseHash && layerHash === this.lastLayerHash && 
        blendMode === this.lastBlendMode && this.cachedOutputCanvas) {
      // All inputs are static and haven't changed, reuse cached output (no redo)
      // Decrement the redo count that was added by BaseNode.execute()
      this.redoCount = Math.max(0, this.redoCount - 1);
      this.setOutput('composite', this.cachedOutputCanvas);
      return; // Skip - no redo
    }

    // Actually recomputing (redo already marked by BaseNode)

    // Convert inputs to canvas - cache if static mode
    let baseCanvas: HTMLCanvasElement | null;
    if (isStatic && !baseChanged && !dimensionsChanged && this.cachedBaseCanvas) {
      // Base is static and hasn't changed, reuse cached canvas
      baseCanvas = this.cachedBaseCanvas;
    } else {
      baseCanvas = await this.ensureCanvas(base, targetWidth, targetHeight);
      // Cache if static mode
      if (baseCanvas && isStatic) {
        this.cachedBaseCanvas = baseCanvas;
      } else {
        this.cachedBaseCanvas = null;
      }
    }

    let layerCanvas: HTMLCanvasElement | null;
    if (isStatic && !layerChanged && !dimensionsChanged && this.cachedLayerCanvas) {
      // Layer is static and hasn't changed, reuse cached canvas
      layerCanvas = this.cachedLayerCanvas;
    } else {
      layerCanvas = await this.ensureCanvas(layer, targetWidth, targetHeight);
      // Cache if static mode
      if (layerCanvas && isStatic) {
        this.cachedLayerCanvas = layerCanvas;
      } else {
        this.cachedLayerCanvas = null;
      }
    }

    if (!baseCanvas || !layerCanvas) return;

    // Create output canvas
    this.outputCanvas ||= this.createCanvas(baseCanvas.width, baseCanvas.height);
    if (this.outputCanvas.width !== baseCanvas.width || this.outputCanvas.height !== baseCanvas.height) {
      this.outputCanvas.width = baseCanvas.width;
      this.outputCanvas.height = baseCanvas.height;
    }

    const ctx = this.outputCanvas.getContext('2d')!;

    // Draw base layer
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(baseCanvas, 0, 0);

    // Draw layer with blend mode (both canvases should already be at the same resolution)
    ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
    ctx.drawImage(layerCanvas, 0, 0);

    // Reset
    ctx.globalCompositeOperation = 'source-over';

    // Cache output if static mode
    if (isStatic) {
      // Create a copy of the output canvas for caching
      const cachedOutput = this.createCanvas(this.outputCanvas.width, this.outputCanvas.height);
      const cachedCtx = cachedOutput.getContext('2d')!;
      cachedCtx.drawImage(this.outputCanvas, 0, 0);
      this.cachedOutputCanvas = cachedOutput;
    } else {
      this.cachedOutputCanvas = null;
    }

    // Update cache tracking
    this.lastBaseHash = baseHash;
    this.lastLayerHash = layerHash;
    this.lastBlendMode = blendMode;
    this.lastTargetWidth = targetWidth;
    this.lastTargetHeight = targetHeight;
    this.lastBaseInput = base;
    this.lastLayerInput = layer;

    this.setOutput('composite', this.outputCanvas);
  }

  private async ensureCanvas(
    input: HTMLCanvasElement | HTMLVideoElement | WebGLTexture | Color | null,
    width: number = 640,
    height: number = 480
  ): Promise<HTMLCanvasElement | null> {
    if (!input) return null;

    // Check if input is a Color object
    if ((input as any).r !== undefined && (input as any).g !== undefined && (input as any).b !== undefined) {
      const color = input as Color;
      const canvas = this.createCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      
      // Fill canvas with solid color
      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a ?? 1})`;
      ctx.fillRect(0, 0, width, height);
      
      return canvas;
    }

    // Check if input is a WebGLTexture (has __width, __height metadata)
    if ((input as any).__width && (input as any).__height && (input as any).__gl) {
      const texture = input as any;
      const gl = texture.__gl as WebGLRenderingContext;
      const texWidth = texture.__width;
      const texHeight = texture.__height;

      // Convert texture to canvas at target resolution
      const canvas = this.createCanvas(width, height);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, input, 0);

      // Read pixels at original texture resolution
      const pixels = new Uint8Array(texWidth * texHeight * 4);
      gl.readPixels(0, 0, texWidth, texHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Create temporary canvas at texture resolution
      const tempCanvas = this.createCanvas(texWidth, texHeight);
      const tempCtx = tempCanvas.getContext('2d')!;
      const imageData = tempCtx.createImageData(texWidth, texHeight);
      imageData.data.set(pixels);
      tempCtx.putImageData(imageData, 0, 0);

      // Scale to target resolution using high-quality scaling
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tempCanvas, 0, 0, width, height);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(framebuffer);

      return canvas;
    }

    if (input instanceof HTMLVideoElement) {
      const video = input as HTMLVideoElement;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return null;
      }

      // Create canvas at target resolution and scale video to it
      const canvas = this.createCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, 0, 0, width, height);
      return canvas;
    }

    // Handle HTMLCanvasElement - scale to target resolution if dimensions differ
    if (input instanceof HTMLCanvasElement) {
      const sourceCanvas = input as HTMLCanvasElement;
      if (sourceCanvas.width === width && sourceCanvas.height === height) {
        // Already at target resolution, return as-is
        return sourceCanvas;
      }
      
      // Scale to target resolution
      const canvas = this.createCanvas(width, height);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sourceCanvas, 0, 0, width, height);
      return canvas;
    }

    return null;
  }

  cleanup() {
    // Clear caches
    this.cachedBaseCanvas = null;
    this.cachedLayerCanvas = null;
    this.cachedOutputCanvas = null;
    this.outputCanvas = null;
    this.lastBaseHash = '';
    this.lastLayerHash = '';
    this.lastBlendMode = '';
    this.lastBaseInput = null;
    this.lastLayerInput = null;
  }

  // Override setInput to clear cache when connections change
  setInput(inputId: string, data: HTMLCanvasElement | HTMLVideoElement | WebGLTexture | number | string | boolean | Color | null) {
    // If input is being disconnected (set to null), clear cache
    if (data === null) {
      if (inputId === 'base') {
        this.cachedBaseCanvas = null;
        this.lastBaseHash = '';
        this.lastBaseInput = null;
      } else if (inputId === 'layer') {
        this.cachedLayerCanvas = null;
        this.lastLayerHash = '';
        this.lastLayerInput = null;
      }
      // Clear output cache when any input is disconnected
      this.cachedOutputCanvas = null;
    }
    super.setInput(inputId, data);
  }
}

