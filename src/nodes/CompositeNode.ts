import { BaseNode } from '../core/BaseNode';
import { Layers } from 'lucide-react';
import { NodeParameterType } from '../core/BaseNode';
import type { Color } from './ColorNode';

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

    if (typeof(base) !== 'object' || typeof(layer) !== 'object') {
      return;
    }

    // Determine dimensions - prioritize canvas/video dimensions, fallback to default
    let targetWidth = 640;
    let targetHeight = 480;
    
    if (base && !(base as any).r) {
      const baseEl = base as HTMLCanvasElement | HTMLVideoElement;
      if (baseEl instanceof HTMLVideoElement) {
        targetWidth = baseEl.videoWidth || 640;
        targetHeight = baseEl.videoHeight || 480;
      } else {
        targetWidth = baseEl.width || 640;
        targetHeight = baseEl.height || 480;
      }
    } else if (layer && !(layer as any).r) {
      const layerEl = layer as HTMLCanvasElement | HTMLVideoElement;
      if (layerEl instanceof HTMLVideoElement) {
        targetWidth = layerEl.videoWidth || 640;
        targetHeight = layerEl.videoHeight || 480;
      } else {
        targetWidth = layerEl.width || 640;
        targetHeight = layerEl.height || 480;
      }
    }

    // Convert inputs to canvas
    const baseCanvas = await this.ensureCanvas(base, targetWidth, targetHeight);
    const layerCanvas = await this.ensureCanvas(layer, targetWidth, targetHeight);

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

  private async ensureCanvas(
    input: HTMLCanvasElement | HTMLVideoElement | Color | null,
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

