import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Palette } from 'lucide-react';

export interface Color {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  a: number; // 0-1
}

export class ColorNode extends BaseNode {
  private cachedColor: Color | null = null;
  private lastColorHash: string = '';

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

  /**
   * Compute hash for the current color to detect changes
   */
  private computeColorHash(color: Color): string {
    return `${color.r},${color.g},${color.b},${color.a}`;
  }

  async executeInternal(): Promise<void> {
    const color = this.getParameter('color') as Color;
    const currentHash = this.computeColorHash(color);
    
    // If color hasn't changed and we have cached output, reuse it (no redo)
    if (currentHash === this.lastColorHash && this.cachedColor) {
      // Decrement the redo count that was added by BaseNode.execute()
      this.redoCount = Math.max(0, this.redoCount - 1);
      this.setOutput('color', this.cachedColor as any);
      return; // Skip - no redo
    }

    // Color changed - update cache and output (redo already marked by BaseNode)
    
    this.cachedColor = color;
    this.lastColorHash = currentHash;
    this.setOutput('color', color as any);
  }

  cleanup() {
    this.cachedColor = null;
    this.lastColorHash = '';
  }
}
