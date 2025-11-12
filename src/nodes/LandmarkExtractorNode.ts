import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { MapPin } from 'lucide-react';
import type { ProcessedMediaPipeData, Vector3D } from './MediaPipeNode';

/**
 * Extracts specific landmarks from MediaPipe processed data
 * Works with both hands and faces
 */
export class LandmarkExtractorNode extends BaseNode {
  constructor(id: string) {
    super(id, {
      name: 'Landmark Extractor',
      isInput: false,
      icon: MapPin,
      color: '#F59E0B',
      backgroundColor: '#1a1a1a',
      borderColor: '#F59E0B'
    });
  }

  getNodeDefinition() {
    return {
      type: 'landmarkExtractor',
      inputs: [
        { id: 'data', type: NodeDataType.ANY }
      ],
      outputs: [
        { id: 'landmarks', type: NodeDataType.ANY },        // Vector3D[] - all or filtered
        { id: 'landmark0', type: NodeDataType.VECTOR3 },    // First requested landmark
        { id: 'landmark1', type: NodeDataType.VECTOR3 },    // Second requested landmark
        { id: 'count', type: NodeDataType.NUMBER }
      ],
      parameters: {
        entityIndex: {
          type: NodeParameterType.NUMBER,
          value: 0,
          min: 0,
          max: 10,
          step: 1
        },
        landmarkIndices: {
          type: NodeParameterType.STRING,
          value: 'all'  // 'all' or comma-separated indices like '0,8,12,16,20'
        },
        extractType: {
          type: NodeParameterType.ENUM,
          value: 'all',
          options: ['all', 'fingerTips', 'keyPoints', 'custom']
        }
      },
      maxInputs: 1,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    const inputData = this.getInput('data') as ProcessedMediaPipeData;
    const entityIndex = this.getParameter('entityIndex') as number || 0;
    const extractType = this.getParameter('extractType') as string;
    const landmarkIndicesStr = this.getParameter('landmarkIndices') as string;

    if (!inputData) {
      this.clearOutputs();
      return;
    }

    let landmarks: Vector3D[] = [];

    // Extract landmarks based on mode
    if (inputData.mode === 'hands' && inputData.hands && inputData.hands[entityIndex]) {
      const hand = inputData.hands[entityIndex];
      
      switch (extractType) {
        case 'fingerTips':
          landmarks = hand.fingerTips;
          break;
        case 'custom':
          landmarks = this.extractCustomLandmarks(hand.landmarks, landmarkIndicesStr);
          break;
        case 'all':
        default:
          landmarks = hand.landmarks;
          break;
      }
    } else if (inputData.mode === 'face' && inputData.faces && inputData.faces[entityIndex]) {
      const face = inputData.faces[entityIndex];
      
      switch (extractType) {
        case 'keyPoints':
          landmarks = [
            face.keyPoints.noseTip,
            face.keyPoints.leftEye,
            face.keyPoints.rightEye,
            face.keyPoints.leftMouth,
            face.keyPoints.rightMouth,
            face.keyPoints.chin
          ];
          break;
        case 'custom':
          landmarks = this.extractCustomLandmarks(face.landmarks, landmarkIndicesStr);
          break;
        case 'all':
        default:
          landmarks = face.landmarks;
          break;
      }
    }

    // Set outputs
    this.setOutput('landmarks', landmarks);
    this.setOutput('landmark0', landmarks[0] || null);
    this.setOutput('landmark1', landmarks[1] || null);
    this.setOutput('count', landmarks.length);
  }

  private extractCustomLandmarks(allLandmarks: Vector3D[], indicesStr: string): Vector3D[] {
    if (indicesStr === 'all' || !indicesStr) {
      return allLandmarks;
    }

    try {
      const indices = indicesStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      return indices
        .filter(idx => idx >= 0 && idx < allLandmarks.length)
        .map(idx => allLandmarks[idx]);
    } catch (e) {
      console.error('Invalid landmark indices format:', e);
      return [];
    }
  }

  private clearOutputs() {
    this.setOutput('landmarks', []);
    this.setOutput('landmark0', null);
    this.setOutput('landmark1', null);
    this.setOutput('count', 0);
  }

  protected setProcessedOutput() {
    // Outputs are already set in executeInternal
  }
}

