import { BaseNode } from '../core/BaseNode';
import { Video } from 'lucide-react';

export class CameraNode extends BaseNode {
  private video: HTMLVideoElement | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;

  constructor(id: string) {
    super(id, {
      name: 'Camera',
      icon: Video,
      color: '#4CAF50',
      backgroundColor: '#1a1a1a',
      borderColor: '#4CAF50'
    });
  }

  setVideo(video: HTMLVideoElement) {
    this.video = video;
  }

  getNodeDefinition() {
    return {
      type: 'camera',
      inputs: [],
      outputs: ['video'],
      parameters: {},
      maxInputs: 0,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    if (!this.video || this.video.videoWidth === 0) {
      return;
    }

    if (!this.outputCanvas) {
      this.outputCanvas = this.createCanvas(this.video.videoWidth, this.video.videoHeight);
    }

    // Copy current video frame to canvas
    const ctx = this.outputCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(this.video, 0, 0, this.outputCanvas.width, this.outputCanvas.height);
    }

    // Set the output
    this.setOutput('video', this.outputCanvas);
  }
}
