import { BaseNode } from '../core/BaseNode';
import { Video } from 'lucide-react';

export class CameraNode extends BaseNode {
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private isInitialized: boolean = false;

  constructor(id: string) {
    super(id, {
      name: 'Camera',
      isInput: true,
      icon: Video,
      color: '#4CAF50',
      backgroundColor: '#1a1a1a',
      borderColor: '#4CAF50'
    });
  }

  async initializeCamera() {
    if (this.isInitialized) return;

    try {
      // Check for HTTPS
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('Camera access requires HTTPS or localhost');
      }

      // Get camera stream
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        } 
      });

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

      this.isInitialized = true;
    } catch (error) {
      console.error('Camera initialization error:', error);
      this.cleanupCamera();
      throw error;
    }
  }

  private cleanupCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }

    this.isInitialized = false;
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
    // If enabled, ensure camera is initialized
    if (this.isEnabled()) {
      if (!this.isInitialized) {
        try {
          await this.initializeCamera();
        } catch (error) {
          console.error('Failed to initialize camera:', error);
          return;
        }
      }
      
      // Pass the video element directly (not as canvas)
      if (this.video && this.video.videoWidth > 0) {
        this.setOutput('video', this.video);
      }
    } else {
      // If disabled, cleanup camera and clear output
      if (this.isInitialized) {
        this.cleanupCamera();
      }
      this.setOutput('video', null);
    }
  }

  // Override setEnabled to handle camera lifecycle
  setEnabled(enabled: boolean) {
    super.setEnabled(enabled);
    
    if (!enabled && this.isInitialized) {
      // Clean up camera when disabled
      this.cleanupCamera();
    }
  }

  cleanup() {
    this.cleanupCamera();
  }
}
