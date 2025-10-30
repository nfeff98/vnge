import { BaseNode } from '../core/BaseNode';
import { Monitor } from 'lucide-react';

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
    const inputCanvas = this.getInput('image');
    if (!inputCanvas || !this.targetCanvas) {
      return;
    }

    // Copy input to target canvas
    const ctx = this.targetCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.targetCanvas.width, this.targetCanvas.height);
      ctx.drawImage(inputCanvas, 0, 0, this.targetCanvas.width, this.targetCanvas.height);
    }
  }
}
