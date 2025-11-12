import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Split } from 'lucide-react';
import type { Vector3D } from './MediaPipeNode';

/**
 * Splits a Vector3D into individual x, y, z components
 */
export class Vec3SplitNode extends BaseNode {
  constructor(id: string) {
    super(id, {
      name: 'Vec3 Split',
      isInput: false,
      icon: Split,
      color: '#EC4899',
      backgroundColor: '#1a1a1a',
      borderColor: '#EC4899'
    });
  }

  getNodeDefinition() {
    return {
      type: 'vec3Split',
      inputs: [
        { id: 'vector', type: NodeDataType.VECTOR3 }
      ],
      outputs: [
        { id: 'x', type: NodeDataType.NUMBER },
        { id: 'y', type: NodeDataType.NUMBER },
        { id: 'z', type: NodeDataType.NUMBER },
        { id: 'magnitude', type: NodeDataType.NUMBER }
      ],
      parameters: {},
      maxInputs: 1,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    const vector = this.getInput('vector') as Vector3D;

    if (!vector || typeof vector !== 'object') {
      // Clear outputs if no valid vector
      this.setOutput('x', 0);
      this.setOutput('y', 0);
      this.setOutput('z', 0);
      this.setOutput('magnitude', 0);
      return;
    }

    const x = vector.x ?? 0;
    const y = vector.y ?? 0;
    const z = vector.z ?? 0;

    // Calculate magnitude
    const magnitude = Math.sqrt(x * x + y * y + z * z);

    // Set outputs
    this.setOutput('x', x);
    this.setOutput('y', y);
    this.setOutput('z', z);
    this.setOutput('magnitude', magnitude);
  }

  protected setProcessedOutput() {
    // Outputs are already set in executeInternal
  }
}

