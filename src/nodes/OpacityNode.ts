import { BaseNode } from '../core/BaseNode';
import { Droplet } from 'lucide-react';
import { NodeParameterType } from '../core/BaseNode';

export class OpacityNode extends BaseNode {
  private outputCanvas: HTMLCanvasElement | null = null;
  private tempCanvas: HTMLCanvasElement | null = null;

  constructor(id: string) {
    super(id, {
      name: 'Opacity',
      icon: Droplet,
      isInput: false,
      color: '#03A9F4',
      backgroundColor: '#1a1a1a',
      borderColor: '#03A9F4'
    });
  }

  getNodeDefinition() {
    return {
      type: 'opacity',
      inputs: ['image'],
      outputs: ['image'],
      parameters: {
        opacity: { type: NodeParameterType.NUMBER, value: 1, min: 0, max: 1, step: 0.01 }
      },
      maxInputs: 1,
      maxOutputs: 1
    };
  }

  async executeInternal(): Promise<void> {
    const input = this.getInput('image');
    if (!input) return;

    const opacity = this.getParameter('opacity') as number;

    // If opacity is 1, just pass through
    if (opacity === 1) {
      this.setOutput('image', input);
      return;
    }

    // Convert video to canvas if needed
    let sourceCanvas: HTMLCanvasElement;

    if (input instanceof HTMLVideoElement) {
      const video = input as HTMLVideoElement;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return;
      }

      this.tempCanvas ||= this.createCanvas(video.videoWidth, video.videoHeight);
      if (this.tempCanvas.width !== video.videoWidth || this.tempCanvas.height !== video.videoHeight) {
        this.tempCanvas.width = video.videoWidth;
        this.tempCanvas.height = video.videoHeight;
      }

      const tempCtx = this.tempCanvas.getContext('2d')!;
      tempCtx.drawImage(video, 0, 0);
      sourceCanvas = this.tempCanvas;
    } else {
      sourceCanvas = input as HTMLCanvasElement;
      if (sourceCanvas.width === 0 || sourceCanvas.height === 0) {
        return;
      }
    }

    // Create output canvas
    this.outputCanvas ||= this.createCanvas(sourceCanvas.width, sourceCanvas.height);
    if (this.outputCanvas.width !== sourceCanvas.width || this.outputCanvas.height !== sourceCanvas.height) {
      this.outputCanvas.width = sourceCanvas.width;
      this.outputCanvas.height = sourceCanvas.height;
    }

    const ctx = this.outputCanvas.getContext('2d')!;

    // Clear canvas
    ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

    // Draw with opacity
    ctx.globalAlpha = opacity;
    ctx.drawImage(sourceCanvas, 0, 0);
    ctx.globalAlpha = 1.0;

    this.setOutput('image', this.outputCanvas);
  }

  cleanup() {
    // Canvas will be garbage collected
  }
}

