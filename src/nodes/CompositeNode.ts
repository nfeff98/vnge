import { BaseNode } from '../core/BaseNode';
import { Layers } from 'lucide-react';
import { NodeParameterType } from '../core/BaseNode';

export class CompositeNode extends BaseNode {
  private outputCanvas: HTMLCanvasElement | null = null;

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
      inputs: ['base', 'layer'],
      outputs: ['composite'],
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
        }
      },
      maxInputs: 2,
      maxOutputs: 1
    };
  }

  async executeInternal(): Promise<void> {
    const base = this.getInput('base');
    const layer = this.getInput('layer');

    if (!base || !layer) {
      // If only base is connected, pass it through
      if (base) {
        this.setOutput('composite', base);
      }
      return;
    }

    // Convert video to canvas if needed
    const baseCanvas = await this.ensureCanvas(base);
    const layerCanvas = await this.ensureCanvas(layer);

    if (!baseCanvas || !layerCanvas) return;

    // Create output canvas
    this.outputCanvas ||= this.createCanvas(baseCanvas.width, baseCanvas.height);
    if (this.outputCanvas.width !== baseCanvas.width || this.outputCanvas.height !== baseCanvas.height) {
      this.outputCanvas.width = baseCanvas.width;
      this.outputCanvas.height = baseCanvas.height;
    }

    const ctx = this.outputCanvas.getContext('2d')!;
    const blendMode = this.getParameter('blendMode') as string;

    // Draw base layer
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(baseCanvas, 0, 0);

    // Draw layer with blend mode
    ctx.globalCompositeOperation = blendMode as GlobalCompositeOperation;
    ctx.drawImage(layerCanvas, 0, 0, baseCanvas.width, baseCanvas.height);

    // Reset
    ctx.globalCompositeOperation = 'source-over';

    this.setOutput('composite', this.outputCanvas);
  }

  private async ensureCanvas(input: HTMLCanvasElement | HTMLVideoElement | null): Promise<HTMLCanvasElement | null> {
    if (!input) return null;

    if (input instanceof HTMLVideoElement) {
      const video = input as HTMLVideoElement;
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return null;
      }

      const canvas = this.createCanvas(video.videoWidth, video.videoHeight);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      return canvas;
    }

    return input as HTMLCanvasElement;
  }

  cleanup() {
    // Canvas will be garbage collected
  }
}

