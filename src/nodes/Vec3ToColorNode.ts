import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Pipette } from 'lucide-react';
import type { Color } from './ColorNode';
import type { Vector3D } from './MediaPipeNode';

/**
 * Converts Vec3 or individual number inputs to a Color
 * Supports RGB and HSL modes with range normalization
 */
export class Vec3ToColorNode extends BaseNode {
  constructor(id: string) {
    super(id, {
      name: 'Vec3 to Color',
      isInput: false,
      icon: Pipette,
      color: '#A855F7',
      backgroundColor: '#1a1a1a',
      borderColor: '#A855F7'
    });
  }

  getNodeDefinition() {
    return {
      type: 'vec3ToColor',
      inputs: [
        { id: 'vector', type: NodeDataType.VECTOR3 },
        { id: 'r', type: NodeDataType.NUMBER },
        { id: 'g', type: NodeDataType.NUMBER },
        { id: 'b', type: NodeDataType.NUMBER },
        { id: 'a', type: NodeDataType.NUMBER }
      ],
      outputs: [
        { id: 'color', type: NodeDataType.COLOR }
      ],
      parameters: {
        mode: {
          type: NodeParameterType.ENUM,
          value: 'rgb',
          options: ['rgb', 'hsl']
        },
        inputRange: {
          type: NodeParameterType.ENUM,
          value: '0-1',
          options: ['0-1', '0-255', '0-360']
        },
        r: {
          type: NodeParameterType.NUMBER,
          value: 255,
          min: 0,
          max: 255,
          step: 1
        },
        g: {
          type: NodeParameterType.NUMBER,
          value: 255,
          min: 0,
          max: 255,
          step: 1
        },
        b: {
          type: NodeParameterType.NUMBER,
          value: 255,
          min: 0,
          max: 255,
          step: 1
        },
        a: {
          type: NodeParameterType.NUMBER,
          value: 1,
          min: 0,
          max: 1,
          step: 0.01
        }
      },
      maxInputs: 5,
      maxOutputs: 1
    };
  }

  async executeInternal(): Promise<void> {
    const mode = this.getParameter('mode') as string;
    const inputRange = this.getParameter('inputRange') as string;

    // Get values - prioritize individual inputs, then vector, then parameters
    let val1: number, val2: number, val3: number, alpha: number;

    // Check for vector input first
    const vectorInput = this.getInput('vector') as Vector3D;
    if (vectorInput && typeof vectorInput === 'object' && 'x' in vectorInput) {
      val1 = vectorInput.x;
      val2 = vectorInput.y;
      val3 = vectorInput.z;
    } else {
      // Use individual inputs or parameters
      val1 = (this.getInput('r') ?? this.getParameter('r')) as number;
      val2 = (this.getInput('g') ?? this.getParameter('g')) as number;
      val3 = (this.getInput('b') ?? this.getParameter('b')) as number;
    }

    alpha = (this.getInput('a') ?? this.getParameter('a')) as number;

    // Normalize values based on input range
    val1 = this.normalizeValue(val1, inputRange);
    val2 = this.normalizeValue(val2, inputRange);
    val3 = this.normalizeValue(val3, inputRange);
    alpha = Math.max(0, Math.min(1, alpha)); // Alpha is always 0-1

    let color: Color;

    if (mode === 'hsl') {
      // Convert HSL to RGB
      // H: 0-360, S: 0-1, L: 0-1 (after normalization)
      const h = val1 * 360; // Normalize to 0-360
      const s = Math.max(0, Math.min(1, val2));
      const l = Math.max(0, Math.min(1, val3));
      
      const rgb = this.hslToRgb(h, s, l);
      color = { r: rgb.r, g: rgb.g, b: rgb.b, a: alpha };
    } else {
      // RGB mode - convert to 0-255 range
      const r = Math.round(Math.max(0, Math.min(255, val1 * 255)));
      const g = Math.round(Math.max(0, Math.min(255, val2 * 255)));
      const b = Math.round(Math.max(0, Math.min(255, val3 * 255)));
      
      color = { r, g, b, a: alpha };
    }

    this.setOutput('color', color);
  }

  private normalizeValue(value: number, inputRange: string): number {
    switch (inputRange) {
      case '0-255':
        return value / 255;
      case '0-360':
        return value / 360;
      case '0-1':
      default:
        return value;
    }
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    // Normalize h to 0-360
    h = ((h % 360) + 360) % 360;
    
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    
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
    } else {
      r = c; g = 0; b = x;
    }
    
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }

  protected setProcessedOutput() {
    // Output is already set in executeInternal
  }
}

