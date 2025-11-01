import { BaseNode } from '../core/BaseNode';
import { Monitor } from 'lucide-react';
import type { Color } from './ColorNode';

export class OutputNode extends BaseNode {
  private targetCanvas: HTMLCanvasElement | null = null;

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
  }

  getNodeDefinition() {
    return {
      type: 'output',
      inputs: ['image'],
      outputs: [],
      parameters: {},
      maxInputs: 1,
      maxOutputs: 0
    };
  }

  async executeInternal(): Promise<void> {
    const input = this.getInput('image');
    if (!input || !this.targetCanvas) {
      return;
    }

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
}
