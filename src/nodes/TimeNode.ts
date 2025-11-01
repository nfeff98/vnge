import { BaseNode } from '../core/BaseNode';
import { Clock } from 'lucide-react';

export class TimeNode extends BaseNode {
  private startTime: number | null = null;

  constructor(id: string) {
    super(id, {
      name: 'Time',
      isInput: false,
      icon: Clock,
      color: '#FF9800',
      backgroundColor: '#1a1a1a',
      borderColor: '#FF9800'
    });
  }

  getNodeDefinition() {
    return {
      type: 'time',
      inputs: [],
      outputs: ['time'],
      parameters: {},
      maxInputs: 0,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    // Initialize start time on first execution
    if (this.startTime === null) {
      this.startTime = performance.now();
    }

    // Calculate elapsed time in seconds
    const currentTime = performance.now();
    const elapsedSeconds = (currentTime - this.startTime) / 1000;

    this.setOutput('time', elapsedSeconds as any);
  }

  cleanup() {
    // Reset start time on cleanup
    this.startTime = null;
  }
}

