import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Palette } from 'lucide-react';

export interface Color {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

export class ColorNode extends BaseNode {
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
      inputs: [],
      outputs: [{ id: 'color', type: NodeDataType.COLOR }],
      parameters: {
        color: { 
          type: NodeParameterType.COLOR, 
          value: { r: 255, g: 0, b: 0, a: 1 }
        }
      },
      maxInputs: 0,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    const color = this.getParameter('color') as Color;
    this.setOutput('color', color as any);
  }

  cleanup() {
    // Nothing to cleanup
  }
}
