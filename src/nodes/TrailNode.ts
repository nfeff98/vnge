import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Zap } from 'lucide-react';
import type { Color } from './ColorNode';

export class TrailNode extends BaseNode {
  private outputCanvas: HTMLCanvasElement | null = null;
  private frameBuffer: HTMLCanvasElement[] = [];
  private tempCanvas: HTMLCanvasElement | null = null;
  private frameCounter: number = 0;

  constructor(id: string) {
    super(id, {
      name: 'Trail',
      isInput: false,
      icon: Zap,
      color: '#9C27B0',
      backgroundColor: '#1a1a1a',
      borderColor: '#9C27B0'
    });
  }

  getNodeDefinition() {
    return {
      type: 'trail',
      inputs: [{ 
        id: 'image', 
        type: NodeDataType.CANVAS, 
        accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO] 
      }],
      outputs: [{ id: 'image', type: NodeDataType.CANVAS }],
      parameters: {
        trailLength: { 
          type: NodeParameterType.NUMBER, 
          value: 5,
          min: 2,
          max: 30,
          step: 1
        },
        fadeAmount: { 
          type: NodeParameterType.NUMBER, 
          value: 0.6,
          min: 0.1,
          max: 1.0,
          step: 0.05
        },
        frameSkip: {
          type: NodeParameterType.NUMBER,
          value: 1,
          min: 1,
          max: 10,
          step: 1
        },
        blendMode: {
          type: NodeParameterType.ENUM,
          value: 'screen',
          options: ['normal', 'screen', 'lighten', 'additive', 'multiply']
        },
        clearBackground: {
          type: NodeParameterType.BOOLEAN,
          value: true
        }
      },
      maxInputs: 1,
      maxOutputs: 5
    };
  }

  protected onParameterChanged(key: string, value: any) {
    // Clear buffer when trail length or frame skip changes
    if (key === 'trailLength' || key === 'frameSkip') {
      this.frameBuffer = [];
      this.frameCounter = 0;
    }
  }

  async executeInternal(): Promise<void> {
    const input = this.getInput('image');
    if (!input) return;

    const trailLength = this.getParameter('trailLength') as number;
    const fadeAmount = this.getParameter('fadeAmount') as number;
    const frameSkip = this.getParameter('frameSkip') as number;
    const blendMode = this.getParameter('blendMode') as string;
    const clearBackground = this.getParameter('clearBackground') as boolean;

    // Convert video to canvas if needed
    let sourceCanvas: HTMLCanvasElement;

    if (input instanceof HTMLVideoElement) {
      const video = input as HTMLVideoElement;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      this.tempCanvas ||= this.createCanvas(video.videoWidth, video.videoHeight);
      if (this.tempCanvas.width !== video.videoWidth || 
          this.tempCanvas.height !== video.videoHeight) {
        this.tempCanvas.width = video.videoWidth;
        this.tempCanvas.height = video.videoHeight;
        this.frameBuffer = []; // Clear buffer on dimension change
      }

      const tempCtx = this.tempCanvas.getContext('2d')!;
      tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
      tempCtx.drawImage(video, 0, 0);
      sourceCanvas = this.tempCanvas;
    } else if (input instanceof HTMLCanvasElement) {
      sourceCanvas = input as HTMLCanvasElement;
      if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
        return;
      }
    } else {
      // Not a supported input type
      return;
    }

    // Create or resize output canvas
    this.outputCanvas ||= this.createCanvas(sourceCanvas.width, sourceCanvas.height);
    if (this.outputCanvas.width !== sourceCanvas.width || 
        this.outputCanvas.height !== sourceCanvas.height) {
      this.outputCanvas.width = sourceCanvas.width;
      this.outputCanvas.height = sourceCanvas.height;
      this.frameBuffer = []; // Clear buffer on dimension change
      this.frameCounter = 0; // Reset counter on dimension change
    }

    // Increment frame counter
    this.frameCounter++;

    // Only capture frame if we've hit the skip interval
    if (this.frameCounter >= frameSkip) {
      this.frameCounter = 0; // Reset counter
      
      // Store current frame in buffer
      const frameSnapshot = this.createCanvas(sourceCanvas.width, sourceCanvas.height);
      const snapshotCtx = frameSnapshot.getContext('2d')!;
      snapshotCtx.drawImage(sourceCanvas, 0, 0);
      
      this.frameBuffer.push(frameSnapshot);

      // Keep only the last N frames
      if (this.frameBuffer.length > trailLength) {
        this.frameBuffer.shift();
      }
    }

    // Render the trail
    const ctx = this.outputCanvas.getContext('2d')!;
    
    // Clear or keep background
    if (clearBackground) {
      ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    }

    // Set blend mode
    ctx.globalCompositeOperation = this.getCompositeOperation(blendMode);

    // Draw ONLY the buffered frames (trail) with increasing opacity
    const frameCount = this.frameBuffer.length;
    if (frameCount > 0) {
      for (let i = 0; i < frameCount; i++) {
        const frame = this.frameBuffer[i];
        
        // Calculate opacity: oldest frames are most transparent
        // Use exponential fade for more natural look
        const normalizedPosition = i / (frameCount - 1 || 1);
        const opacity = Math.pow(normalizedPosition, 1 / fadeAmount);
        
        ctx.globalAlpha = opacity;
        ctx.drawImage(frame, 0, 0);
      }
    }

    // Always draw the current frame on top at full opacity (smooth video)
    ctx.globalAlpha = 1.0;
    ctx.drawImage(sourceCanvas, 0, 0);

    // Reset context state
    ctx.globalCompositeOperation = 'source-over';

    this.setOutput('image', this.outputCanvas);
  }

  private getCompositeOperation(mode: string): GlobalCompositeOperation {
    switch (mode) {
      case 'screen': return 'screen';
      case 'lighten': return 'lighten';
      case 'additive': return 'lighter';
      case 'multiply': return 'multiply';
      case 'normal':
      default: return 'source-over';
    }
  }

  cleanup() {
    this.frameBuffer = [];
    this.outputCanvas = null;
    this.tempCanvas = null;
    this.frameCounter = 0;
  }
}

