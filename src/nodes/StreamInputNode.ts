import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Monitor } from 'lucide-react';

export class StreamInputNode extends BaseNode {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;
  private animationFrameId: number | null = null;
  private isCapturing: boolean = false;

  constructor(id: string) {
    super(id, {
      name: 'Stream Input',
      isInput: true,
      icon: Monitor,
      color: '#FF9800',
      backgroundColor: '#1a1a1a',
      borderColor: '#FF9800'
    });
  }

  /**
   * Start screen capture using getDisplayMedia
   */
  async startCapture(): Promise<void> {
    if (this.isCapturing) {
      return; // Already capturing
    }

    try {
      // Check for HTTPS
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('Screen capture requires HTTPS or localhost');
      }

      // Get screen capture stream
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: false // We don't need audio for now
      });

      // Handle stream end (user stops sharing)
      this.stream.getVideoTracks()[0].onended = () => {
        console.log('[StreamInput] User stopped sharing');
        this.stopCapture();
      };

      // Create video element
      this.video = document.createElement('video');
      this.video.srcObject = this.stream;
      this.video.autoplay = true;
      this.video.playsInline = true;
      this.video.muted = true;

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        const onLoadedMetadata = () => {
          this.video!.removeEventListener('loadedmetadata', onLoadedMetadata);
          this.video!.removeEventListener('error', onError);
          resolve(void 0);
        };
        
        const onError = (e: Event) => {
          this.video!.removeEventListener('loadedmetadata', onLoadedMetadata);
          this.video!.removeEventListener('error', onError);
          reject(e);
        };
        
        this.video!.addEventListener('loadedmetadata', onLoadedMetadata);
        this.video!.addEventListener('error', onError);
        
        this.video!.play().catch(reject);
      });

      // Create canvas with video dimensions
      const canvas = this.createCanvas(this.video.videoWidth, this.video.videoHeight);
      this.outputCanvas = canvas;

      // Start drawing loop
      this.startDrawingLoop();
      this.isCapturing = true;
    } catch (error) {
      console.error('[StreamInput] Failed to start capture:', error);
      this.cleanupCapture();
      throw error;
    }
  }

  /**
   * Stop screen capture
   */
  stopCapture(): void {
    this.isCapturing = false;
    this.cleanupCapture();
  }

  /**
   * Start the drawing loop to continuously draw video frames to canvas
   */
  private startDrawingLoop() {
    if (!this.video || !this.outputCanvas) return;

    const draw = () => {
      if (!this.video || !this.outputCanvas) return;

      // Check if video dimensions changed and resize canvas if needed
      if (this.outputCanvas.width !== this.video.videoWidth || 
          this.outputCanvas.height !== this.video.videoHeight) {
        this.outputCanvas.width = this.video.videoWidth;
        this.outputCanvas.height = this.video.videoHeight;
      }

      const ctx = this.outputCanvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas before drawing
      ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);

      // Get crop parameters (for future use)
      const cropX = this.getParameter('cropX') as number || 0;
      const cropY = this.getParameter('cropY') as number || 0;
      const cropWidth = this.getParameter('cropWidth') as number || this.video.videoWidth;
      const cropHeight = this.getParameter('cropHeight') as number || this.video.videoHeight;

      // For now, draw full frame (cropping will be implemented later)
      // When cropping is implemented, we'll use:
      // ctx.drawImage(this.video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      ctx.drawImage(this.video, 0, 0);

      // Continue the loop
      this.animationFrameId = requestAnimationFrame(draw);
    };

    // Start the loop
    this.animationFrameId = requestAnimationFrame(draw);
  }

  /**
   * Stop the drawing loop
   */
  private stopDrawingLoop() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Clean up capture resources
   */
  private cleanupCapture() {
    this.stopDrawingLoop();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }

    this.outputCanvas = null;
    this.isCapturing = false;
  }

  /**
   * Check if currently capturing
   */
  isStreaming(): boolean {
    return this.isCapturing && this.stream !== null;
  }

  getNodeDefinition() {
    return {
      type: 'streamInput',
      inputs: [],
      outputs: [{ id: 'canvas', type: NodeDataType.CANVAS }],
      parameters: {
        // Region cropping parameters (for future implementation)
        cropX: {
          type: NodeParameterType.NUMBER,
          value: 0,
          min: 0,
          max: 10000,
        },
        cropY: {
          type: NodeParameterType.NUMBER,
          value: 0,
          min: 0,
          max: 10000,
        },
        cropWidth: {
          type: NodeParameterType.NUMBER,
          value: 1920,
          min: 1,
          max: 10000,
        },
        cropHeight: {
          type: NodeParameterType.NUMBER,
          value: 1080,
          min: 1,
          max: 10000,
        },
      },
      maxInputs: 0,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    // If enabled and capturing, output the canvas
    if (this.isEnabled() && this.isCapturing && this.outputCanvas) {
      this.setOutput('canvas', this.outputCanvas);
    } else {
      // If disabled or not capturing, output empty canvas
      if (!this.outputCanvas) {
        const emptyCanvas = this.createCanvas(1, 1);
        this.setOutput('canvas', emptyCanvas);
      } else {
        this.setOutput('canvas', this.outputCanvas);
      }
    }
  }

  // Override setEnabled to handle capture lifecycle
  setEnabled(enabled: boolean) {
    super.setEnabled(enabled);
    
    if (!enabled && this.isCapturing) {
      // Stop capture when disabled
      this.stopCapture();
    }
  }

  cleanup() {
    this.cleanupCapture();
  }
}

