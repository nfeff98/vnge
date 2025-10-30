import { BaseNode } from '../core/BaseNode';
import { Grid3x3 } from 'lucide-react';
import { NodeParameterType } from '../core/BaseNode';

export class TileAndOffsetNode extends BaseNode {
  private outputCanvas: HTMLCanvasElement | null = null;
  private tempCanvas: HTMLCanvasElement | null = null;

  constructor(id: string) {
    super(id, {
      name: 'Tile & Offset',
      isInput: false,
      icon: Grid3x3,
      color: '#FF9800',
      backgroundColor: '#1a1a1a',
      borderColor: '#FF9800'
    });
  }

  getNodeDefinition() {
    return {
      type: 'tileAndOffset',
      inputs: ['image'],
      outputs: ['image'],
      parameters: {
        tileX: { type: NodeParameterType.NUMBER, value: 1, min: 0.1, max: 10, step: 0.1 },
        tileY: { type: NodeParameterType.NUMBER, value: 1, min: 0.1, max: 10, step: 0.1 },
        offsetX: { type: NodeParameterType.NUMBER, value: 0, min: -5, max: 5, step: 0.1 },
        offsetY: { type: NodeParameterType.NUMBER, value: 0, min: -5, max: 5, step: 0.1 }
      },
      maxInputs: 1,
      maxOutputs: 1
    };
  }

  async executeInternal(): Promise<void> {
    const input = this.getInput('image');
    if (!input) return;

    // Handle both canvas and video elements
    let sourceCanvas: HTMLCanvasElement;

    if (input instanceof HTMLVideoElement) {
      // Convert video to canvas
      const video = input as HTMLVideoElement;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        // Video not ready yet, skip this frame
        return;
      }

      this.tempCanvas ||= this.createCanvas(video.videoWidth, video.videoHeight);
      
      // Ensure temp canvas has correct dimensions
      if (this.tempCanvas.width !== video.videoWidth || this.tempCanvas.height !== video.videoHeight) {
        this.tempCanvas.width = video.videoWidth;
        this.tempCanvas.height = video.videoHeight;
      }

      const tempCtx = this.tempCanvas.getContext('2d')!;
      tempCtx.drawImage(video, 0, 0);
      sourceCanvas = this.tempCanvas;
    } else {
      // It's already a canvas
      sourceCanvas = input as HTMLCanvasElement;
      if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
        return;
      }
    }

    const tileX = this.getParameter('tileX') as number;
    const tileY = this.getParameter('tileY') as number;
    const offsetX = this.getParameter('offsetX') as number;
    const offsetY = this.getParameter('offsetY') as number;

    this.outputCanvas ||= this.createCanvas(sourceCanvas.width, sourceCanvas.height);
    
    // Ensure output canvas has correct dimensions
    if (this.outputCanvas.width !== sourceCanvas.width || this.outputCanvas.height !== sourceCanvas.height) {
      this.outputCanvas.width = sourceCanvas.width;
      this.outputCanvas.height = sourceCanvas.height;
    }

    const ctx = this.outputCanvas.getContext('2d')!;

    // Clear output
    ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    // Calculate scaled tile size
    // tileX = 2 means show 2 copies, so each tile is half width
    const scaledWidth = sourceCanvas.width / tileX;
    const scaledHeight = sourceCanvas.height / tileY;

    // Calculate starting position (offset shifts the pattern)
    const startX = -offsetX * scaledWidth;
    const startY = -offsetY * scaledHeight;

    // Calculate how many tiles we need to draw to cover the output
    const tilesX = Math.ceil(
      (this.outputCanvas.width + Math.abs(offsetX * scaledWidth)) / scaledWidth
    ) + 2;
    const tilesY = Math.ceil(
      (this.outputCanvas.height + Math.abs(offsetY * scaledHeight)) / scaledHeight
    ) + 2;

    // Draw the tiled pattern
    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        const drawX = startX + x * scaledWidth;
        const drawY = startY + y * scaledHeight;

        ctx.drawImage(
          sourceCanvas,
          drawX,
          drawY,
          scaledWidth,
          scaledHeight
        );
      }
    }

    this.setOutput('image', this.outputCanvas);
  }

  cleanup() {
    // Canvas will be garbage collected
  }
}
