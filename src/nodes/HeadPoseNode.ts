import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { ScanFace } from 'lucide-react';
import type { ProcessedMediaPipeData, Vector3D } from './MediaPipeNode';

/**
 * Extracts head pose (rotation and position) from MediaPipe processed data
 */
export class HeadPoseNode extends BaseNode {
  constructor(id: string) {
    super(id, {
      name: 'Head Pose',
      isInput: false,
      icon: ScanFace,
      color: '#8B5CF6',
      backgroundColor: '#1a1a1a',
      borderColor: '#8B5CF6'
    });
  }

  getNodeDefinition() {
    return {
      type: 'headPose',
      inputs: [
        { id: 'data', type: NodeDataType.ANY }
      ],
      outputs: [
        { id: 'rotation', type: NodeDataType.VECTOR3 },      // Pitch, Yaw, Roll in degrees
        { id: 'position', type: NodeDataType.VECTOR3 },      // Face center position
        { id: 'pitch', type: NodeDataType.NUMBER },
        { id: 'yaw', type: NodeDataType.NUMBER },
        { id: 'roll', type: NodeDataType.NUMBER },
        { id: 'confidence', type: NodeDataType.NUMBER }
      ],
      parameters: {
        faceIndex: {
          type: NodeParameterType.NUMBER,
          value: 0,
          min: 0,
          max: 3,
          step: 1
        }
      },
      maxInputs: 1,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    const inputData = this.getInput('data') as ProcessedMediaPipeData;
    const faceIndex = this.getParameter('faceIndex') as number || 0;

    if (!inputData || inputData.mode !== 'face' || !inputData.faces || !inputData.faces[faceIndex]) {
      // Clear outputs if no valid face data
      this.setOutput('rotation', null);
      this.setOutput('position', null);
      this.setOutput('pitch', 0);
      this.setOutput('yaw', 0);
      this.setOutput('roll', 0);
      this.setOutput('confidence', 0);
      return;
    }

    const face = inputData.faces[faceIndex];
    const headPose = face.headPose;

    // Output rotation as vector
    this.setOutput('rotation', headPose.rotation);
    
    // Output position (face center)
    this.setOutput('position', face.center);
    
    // Output individual rotation components
    this.setOutput('pitch', headPose.rotation.x);
    this.setOutput('yaw', headPose.rotation.y);
    this.setOutput('roll', headPose.rotation.z);
    
    // Output confidence
    this.setOutput('confidence', headPose.confidence);
  }

  protected setProcessedOutput() {
    // Outputs are already set in executeInternal
  }
}

