import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Calculator } from 'lucide-react';
import type { Vector3D } from './MediaPipeNode';

/**
 * Performs operations on arrays of Vector3D data
 * Useful for averaging landmarks, calculating velocities, etc.
 */
export class ArrayOperationsNode extends BaseNode {
  private previousArray: Vector3D[] | null = null;
  private previousTimestamp: number = 0;

  constructor(id: string) {
    super(id, {
      name: 'Array Operations',
      isInput: false,
      icon: Calculator,
      color: '#06B6D4',
      backgroundColor: '#1a1a1a',
      borderColor: '#06B6D4'
    });
  }

  getNodeDefinition() {
    return {
      type: 'arrayOperations',
      inputs: [
        { id: 'array', type: NodeDataType.ANY }  // Vector3D[]
      ],
      outputs: [
        { id: 'result', type: NodeDataType.VECTOR3 },
        { id: 'magnitude', type: NodeDataType.NUMBER },
        { id: 'x', type: NodeDataType.NUMBER },
        { id: 'y', type: NodeDataType.NUMBER },
        { id: 'z', type: NodeDataType.NUMBER }
      ],
      parameters: {
        operation: {
          type: NodeParameterType.ENUM,
          value: 'average',
          options: ['average', 'sum', 'velocity', 'center', 'spread']
        },
        smoothing: {
          type: NodeParameterType.NUMBER,
          value: 0,
          min: 0,
          max: 1,
          step: 0.1
        }
      },
      maxInputs: 1,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    const inputArray = this.getInput('array') as Vector3D[];
    const operation = this.getParameter('operation') as string;
    const smoothing = this.getParameter('smoothing') as number || 0;

    if (!inputArray || !Array.isArray(inputArray) || inputArray.length === 0) {
      this.clearOutputs();
      return;
    }

    let result: Vector3D = { x: 0, y: 0, z: 0 };

    switch (operation) {
      case 'average':
        result = this.calculateAverage(inputArray);
        break;
      case 'sum':
        result = this.calculateSum(inputArray);
        break;
      case 'velocity':
        result = this.calculateVelocity(inputArray);
        break;
      case 'center':
        result = this.calculateCenter(inputArray);
        break;
      case 'spread':
        result = this.calculateSpread(inputArray);
        break;
    }

    // Apply smoothing if enabled
    if (smoothing > 0 && this.previousArray) {
      const prevResult = this.getStoredResult();
      if (prevResult) {
        result = {
          x: prevResult.x * smoothing + result.x * (1 - smoothing),
          y: prevResult.y * smoothing + result.y * (1 - smoothing),
          z: prevResult.z * smoothing + result.z * (1 - smoothing)
        };
      }
    }

    // Store for next frame
    this.previousArray = [...inputArray];
    this.storeResult(result);

    // Calculate magnitude
    const magnitude = Math.sqrt(result.x ** 2 + result.y ** 2 + result.z ** 2);

    // Set outputs
    this.setOutput('result', result);
    this.setOutput('magnitude', magnitude);
    this.setOutput('x', result.x);
    this.setOutput('y', result.y);
    this.setOutput('z', result.z);
  }

  private calculateAverage(array: Vector3D[]): Vector3D {
    const sum = this.calculateSum(array);
    return {
      x: sum.x / array.length,
      y: sum.y / array.length,
      z: sum.z / array.length
    };
  }

  private calculateSum(array: Vector3D[]): Vector3D {
    return array.reduce(
      (acc, vec) => ({
        x: acc.x + vec.x,
        y: acc.y + vec.y,
        z: acc.z + vec.z
      }),
      { x: 0, y: 0, z: 0 }
    );
  }

  private calculateVelocity(array: Vector3D[]): Vector3D {
    if (!this.previousArray || this.previousArray.length !== array.length) {
      return { x: 0, y: 0, z: 0 };
    }

    const currentTimestamp = Date.now();
    const deltaTime = (currentTimestamp - this.previousTimestamp) / 1000; // Convert to seconds
    
    if (deltaTime === 0) {
      return { x: 0, y: 0, z: 0 };
    }

    // Calculate average velocity across all points
    let totalDx = 0, totalDy = 0, totalDz = 0;
    
    for (let i = 0; i < array.length; i++) {
      totalDx += (array[i].x - this.previousArray[i].x) / deltaTime;
      totalDy += (array[i].y - this.previousArray[i].y) / deltaTime;
      totalDz += (array[i].z - this.previousArray[i].z) / deltaTime;
    }

    this.previousTimestamp = currentTimestamp;

    return {
      x: totalDx / array.length,
      y: totalDy / array.length,
      z: totalDz / array.length
    };
  }

  private calculateCenter(array: Vector3D[]): Vector3D {
    // Calculate bounding box center
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const vec of array) {
      minX = Math.min(minX, vec.x);
      minY = Math.min(minY, vec.y);
      minZ = Math.min(minZ, vec.z);
      maxX = Math.max(maxX, vec.x);
      maxY = Math.max(maxY, vec.y);
      maxZ = Math.max(maxZ, vec.z);
    }

    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2
    };
  }

  private calculateSpread(array: Vector3D[]): Vector3D {
    // Calculate standard deviation in each axis
    const avg = this.calculateAverage(array);
    
    let sumSqDiffX = 0, sumSqDiffY = 0, sumSqDiffZ = 0;
    for (const vec of array) {
      sumSqDiffX += (vec.x - avg.x) ** 2;
      sumSqDiffY += (vec.y - avg.y) ** 2;
      sumSqDiffZ += (vec.z - avg.z) ** 2;
    }

    return {
      x: Math.sqrt(sumSqDiffX / array.length),
      y: Math.sqrt(sumSqDiffY / array.length),
      z: Math.sqrt(sumSqDiffZ / array.length)
    };
  }

  private storeResult(result: Vector3D) {
    // Store in a simple property for next frame
    (this as any)._storedResult = result;
  }

  private getStoredResult(): Vector3D | null {
    return (this as any)._storedResult || null;
  }

  private clearOutputs() {
    this.setOutput('result', { x: 0, y: 0, z: 0 });
    this.setOutput('magnitude', 0);
    this.setOutput('x', 0);
    this.setOutput('y', 0);
    this.setOutput('z', 0);
  }

  protected setProcessedOutput() {
    // Outputs are already set in executeInternal
  }
}

