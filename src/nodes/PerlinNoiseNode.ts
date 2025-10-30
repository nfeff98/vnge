import { BaseNode } from '../core/BaseNode';
import { Cloud } from 'lucide-react';
import { NodeParameterType } from '../core/BaseNode';
import type { Color } from './ColorNode';

export class PerlinNoiseNode extends BaseNode {
  private outputCanvas: HTMLCanvasElement | null = null;
  private permutation: number[] = [];

  constructor(id: string) {
    super(id, {
      name: 'Perlin Noise',
      isInput: true,
      icon: Cloud,
      color: '#795548',
      backgroundColor: '#1a1a1a',
      borderColor: '#795548'
    });
    this.initializePermutation();
  }

  getNodeDefinition() {
    return {
      type: 'perlinNoise',
      inputs: ['color1', 'color2'], // Optional color inputs
      outputs: ['image'],
      parameters: {
        width: { type: NodeParameterType.NUMBER, value: 640, min: 1, max: 3840, step: 1 },
        height: { type: NodeParameterType.NUMBER, value: 480, min: 1, max: 2160, step: 1 },
        scale: { type: NodeParameterType.NUMBER, value: 50, min: 1, max: 500, step: 1 },
        octaves: { type: NodeParameterType.NUMBER, value: 4, min: 1, max: 8, step: 1 },
        persistence: { type: NodeParameterType.NUMBER, value: 0.5, min: 0, max: 1, step: 0.1 },
        lacunarity: { type: NodeParameterType.NUMBER, value: 2, min: 1, max: 4, step: 0.1 },
        seed: { type: NodeParameterType.NUMBER, value: 0, min: 0, max: 10000, step: 1 }
      },
      maxInputs: 2,
      maxOutputs: 1
    };
  }

  private initializePermutation(seed: number = 0) {
    // Initialize permutation table for Perlin noise
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle based on seed
    const random = this.seededRandom(seed);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Duplicate for easier indexing
    this.permutation = [...p, ...p];
  }

  private seededRandom(seed: number) {
    return function() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  protected onParameterChanged(key: string, value: any): void {
    if (key === 'seed') {
      this.initializePermutation(value as number);
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  private noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = this.fade(x);
    const v = this.fade(y);

    const a = this.permutation[X] + Y;
    const aa = this.permutation[a];
    const ab = this.permutation[a + 1];
    const b = this.permutation[X + 1] + Y;
    const ba = this.permutation[b];
    const bb = this.permutation[b + 1];

    return this.lerp(
      this.lerp(this.grad(this.permutation[aa], x, y), this.grad(this.permutation[ba], x - 1, y), u),
      this.lerp(this.grad(this.permutation[ab], x, y - 1), this.grad(this.permutation[bb], x - 1, y - 1), u),
      v
    );
  }

  private fBm(x: number, y: number, octaves: number, persistence: number, lacunarity: number): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  async executeInternal(): Promise<void> {
    const width = this.getParameter('width') as number;
    const height = this.getParameter('height') as number;
    const scale = this.getParameter('scale') as number;
    const octaves = this.getParameter('octaves') as number;
    const persistence = this.getParameter('persistence') as number;
    const lacunarity = this.getParameter('lacunarity') as number;

    // Get color inputs or use defaults (black and white)
    const color1Input = this.getInput('color1');
    const color2Input = this.getInput('color2');


    // Check if inputs are Color objects, otherwise use defaults
    const color1: Color = (color1Input && typeof color1Input === 'object' && 'r' in color1Input) 
      ? (color1Input as any)
      : { r: 0, g: 0, b: 0, a: 1 }; // Black
    
    const color2: Color = (color2Input && typeof color2Input === 'object' && 'r' in color2Input)
      ? (color2Input as any)
      : { r: 255, g: 255, b: 255, a: 1 }; // White


    // Create output canvas
    this.outputCanvas ||= this.createCanvas(width, height);
    if (this.outputCanvas.width !== width || this.outputCanvas.height !== height) {
      this.outputCanvas.width = width;
      this.outputCanvas.height = height;
    }

    const ctx = this.outputCanvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Generate perlin noise
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const nx = x / scale;
        const ny = y / scale;

        // Get noise value (-1 to 1) and normalize to (0 to 1)
        const noiseValue = (this.fBm(nx, ny, octaves, persistence, lacunarity) + 1) / 2;

        // Interpolate between color1 and color2
        const idx = (y * width + x) * 4;
        data[idx] = Math.round(color1.r + (color2.r - color1.r) * noiseValue);
        data[idx + 1] = Math.round(color1.g + (color2.g - color1.g) * noiseValue);
        data[idx + 2] = Math.round(color1.b + (color2.b - color1.b) * noiseValue);
        data[idx + 3] = Math.round((color1.a + (color2.a - color1.a) * noiseValue) * 255);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    this.setOutput('image', this.outputCanvas);
  }

  cleanup() {
    // Canvas will be garbage collected
  }
}

