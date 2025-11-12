import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Hand } from 'lucide-react';
import type { ProcessedMediaPipeData, Vector3D } from './MediaPipeNode';

/**
 * Extracts hand center positions from MediaPipe processed data
 */
export class HandCenterNode extends BaseNode {
  constructor(id: string) {
    super(id, {
      name: 'Hand Center',
      isInput: false,
      icon: Hand,
      color: '#10B981',
      backgroundColor: '#1a1a1a',
      borderColor: '#10B981'
    });
  }

  getNodeDefinition() {
    return {
      type: 'handCenter',
      inputs: [
        { id: 'data', type: NodeDataType.ANY }
      ],
      outputs: [
        { id: 'center0', type: NodeDataType.VECTOR3 },
        { id: 'center1', type: NodeDataType.VECTOR3 },
        { id: 'allCenters', type: NodeDataType.ANY },     // Vector3D[]
        { id: 'count', type: NodeDataType.NUMBER }
      ],
      parameters: {},
      maxInputs: 1,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    const inputData = this.getInput('data') as ProcessedMediaPipeData;

    if (!inputData || inputData.mode !== 'hands' || !inputData.hands) {
      // Clear outputs if no valid hand data
      this.setOutput('center0', null);
      this.setOutput('center1', null);
      this.setOutput('allCenters', []);
      this.setOutput('count', 0);
      return;
    }

    const hands = inputData.hands;
    const centers: Vector3D[] = hands.map(hand => hand.center);

    // Output individual centers (up to 2)
    this.setOutput('center0', hands[0]?.center || null);
    this.setOutput('center1', hands[1]?.center || null);
    
    // Output array of all centers
    this.setOutput('allCenters', centers);
    
    // Output count
    this.setOutput('count', hands.length);
  }

  protected setProcessedOutput() {
    // Outputs are already set in executeInternal
  }
}

