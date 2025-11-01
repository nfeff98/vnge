import { BaseNode } from '../core/BaseNode';
import { Palette } from 'lucide-react';
import { NodeParameterType } from '../core/BaseNode';

export interface Color {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

export class ColorNode extends BaseNode {
  private color: Color = { r: 255, g: 0, b: 0, a: 1 };
  private inputMode: 'rgb' | 'hex' | 'hsv' = 'rgb';
  private isUpdating: boolean = false; // Prevent recursive updates

  constructor(id: string) {
    super(id, {
      name: 'Color',
      isInput: true,
      icon: Palette,
      color: '#E91E63',
      backgroundColor: '#1a1a1a',
      borderColor: '#E91E63'
    });
  }

  getNodeDefinition() {
    return {
      type: 'color',
      inputs: this.inputMode === 'rgb' ? ['r', 'g', 'b', 'a'] 
            : this.inputMode === 'hex' ? ['hex'] 
            : ['h', 's', 'v'],
      outputs: ['color'],
      parameters: {
        inputMode: { type: NodeParameterType.ENUM, value: 'rgb', options: ['rgb', 'hex', 'hsv'] },
        ...(this.inputMode === 'rgb' ? {
          r: { type: NodeParameterType.NUMBER, value: 255, min: 0, max: 255, step: 1 },
          g: { type: NodeParameterType.NUMBER, value: 0, min: 0, max: 255, step: 1 },
          b: { type: NodeParameterType.NUMBER, value: 0, min: 0, max: 255, step: 1 },
          a: { type: NodeParameterType.NUMBER, value: 1, min: 0, max: 1, step: 0.01 }
        } : this.inputMode === 'hex' ? {
          hex: { type: NodeParameterType.STRING, value: '#FF0000' }
        } : {
          h: { type: NodeParameterType.NUMBER, value: 0, min: 0, max: 360, step: 1 },
          s: { type: NodeParameterType.NUMBER, value: 100, min: 0, max: 100, step: 1 },
          v: { type: NodeParameterType.NUMBER, value: 100, min: 0, max: 100, step: 1 }
        })
      },
      maxInputs: 4,
      maxOutputs: 10
    };
  }

  protected onParameterChanged(key: string, value: any): void {
    // Prevent infinite recursion
    if (this.isUpdating) return;
    this.isUpdating = true;

    try {
      // Sync color values between RGB, Hex, and HSV
      if (key === 'r' || key === 'g' || key === 'b' || key === 'a') {
        this.color = {
          r: this.getInput('r') as number ?? this.getParameter('r') as number,
          g: this.getInput('g') as number ?? this.getParameter('g') as number,
          b: this.getInput('b') as number ?? this.getParameter('b') as number,
          a: this.getInput('a') as number ?? this.getParameter('a') as number
        };
        // Update hex
        this.setParameter('hex', this.rgbToHex(this.color.r, this.color.g, this.color.b));
        // Update HSV
        const hsv = this.rgbToHsv(this.color.r, this.color.g, this.color.b);
        this.setParameter('h', hsv.h);
        this.setParameter('s', hsv.s);
        this.setParameter('v', hsv.v);
      } else if (key === 'hex') {
        const rgb = this.hexToRgb(value as string);
        if (rgb) {
          this.color = { ...rgb, a: this.color.a };
          this.setParameter('r', rgb.r);
          this.setParameter('g', rgb.g);
          this.setParameter('b', rgb.b);
          // Update HSV
          const hsv = this.rgbToHsv(rgb.r, rgb.g, rgb.b);
          this.setParameter('h', hsv.h);
          this.setParameter('s', hsv.s);
          this.setParameter('v', hsv.v);
        }
      } else if (key === 'h' || key === 's' || key === 'v') {
        const h = this.getParameter('h') as number;
        const s = this.getParameter('s') as number;
        const v = this.getParameter('v') as number;
        const rgb = this.hsvToRgb(h, s, v);
        this.color = { ...rgb, a: this.color.a };
        this.setParameter('r', rgb.r);
        this.setParameter('g', rgb.g);
        this.setParameter('b', rgb.b);
        this.setParameter('hex', this.rgbToHex(rgb.r, rgb.g, rgb.b));
      } else if (key === 'inputMode') {
        this.inputMode = value as 'rgb' | 'hex' | 'hsv';
      }
    } finally {
      this.isUpdating = false;
    }
  }

  async executeInternal(): Promise<void> {
    // Get values from inputs or fallback to parameters
    if (this.inputMode === 'rgb') {
      this.color = {
        r: (this.getInput('r') as number) ?? (this.getParameter('r') as number) ?? 255,
        g: (this.getInput('g') as number) ?? (this.getParameter('g') as number) ?? 0,
        b: (this.getInput('b') as number) ?? (this.getParameter('b') as number) ?? 0,
        a: (this.getInput('a') as number) ?? (this.getParameter('a') as number) ?? 1
      };
    } else if (this.inputMode === 'hex') {
      const hexValue = (this.getInput('hex') as string) ?? (this.getParameter('hex') as string) ?? '#FF0000';
      const rgb = this.hexToRgb(hexValue);
      if (rgb) {
        this.color = { ...rgb, a: this.color.a };
      }
    } else if (this.inputMode === 'hsv') {
      const h = (this.getInput('h') as number) ?? (this.getParameter('h') as number) ?? 0;
      const s = (this.getInput('s') as number) ?? (this.getParameter('s') as number) ?? 100;
      const v = (this.getInput('v') as number) ?? (this.getParameter('v') as number) ?? 100;
      const rgb = this.hsvToRgb(h, s, v);
      this.color = { ...rgb, a: this.color.a };
    }
    
    this.setOutput('color', this.color as any);
  }

  // Color conversion utilities
  private rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  private rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    const s = max === 0 ? 0 : (diff / max) * 100;
    const v = max * 100;

    if (diff !== 0) {
      if (max === r) {
        h = 60 * (((g - b) / diff) % 6);
      } else if (max === g) {
        h = 60 * (((b - r) / diff) + 2);
      } else {
        h = 60 * (((r - g) / diff) + 4);
      }
    }

    if (h < 0) h += 360;

    return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
  }

  private hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    s /= 100;
    v /= 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else if (h >= 300 && h < 360) {
      r = c; g = 0; b = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  cleanup() {
    // Nothing to cleanup
  }
}

