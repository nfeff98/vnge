import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Video as VideoIcon } from 'lucide-react';

export interface VideoMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  lastModified: number;
}

export class VideoNode extends BaseNode {
  private videoFile: File | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private needsReupload: boolean = false;
  private lastVideoHash: string = '';
  private animationFrameId: number | null = null;

  constructor(id: string) {
    super(id, {
      name: 'Video',
      isInput: true,
      icon: VideoIcon,
      color: '#9C27B0',
      backgroundColor: '#1a1a1a',
      borderColor: '#9C27B0'
    });
  }

  /**
   * Set the video file and load it
   */
  setVideoFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      // Clean up previous video
      this.cleanupVideo();

      this.videoFile = file;
      this.needsReupload = false;
      // Clear hash to force recomputation
      this.lastVideoHash = '';

      // Create video element to load the file
      const video = document.createElement('video');
      video.loop = true;
      video.muted = true; // Required for autoplay in most browsers
      video.playsInline = true; // Required for mobile

      video.onloadedmetadata = () => {
        // Create canvas with video dimensions
        const canvas = this.createCanvas(video.videoWidth, video.videoHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        this.outputCanvas = canvas;
        this.videoElement = video;

        // Start playing the video
        video.play().then(() => {
          // Start drawing loop
          this.startDrawingLoop();
          resolve();
        }).catch((error) => {
          reject(new Error(`Failed to play video: ${error.message}`));
        });
      };

      video.onerror = () => {
        reject(new Error('Failed to load video'));
      };

      // Load video from file
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          video.src = e.target.result as string;
        }
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Start the drawing loop to continuously draw video frames to canvas
   */
  private startDrawingLoop() {
    if (!this.videoElement || !this.outputCanvas) return;

    const draw = () => {
      if (!this.videoElement || !this.outputCanvas) return;

      const ctx = this.outputCanvas.getContext('2d');
      if (!ctx) return;

      // Draw current video frame to canvas
      ctx.drawImage(this.videoElement, 0, 0);

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
   * Clean up video element and stop drawing
   */
  private cleanupVideo() {
    this.stopDrawingLoop();
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement.load();
      this.videoElement = null;
    }
  }

  /**
   * Get the current video file
   */
  getVideoFile(): File | null {
    return this.videoFile;
  }

  /**
   * Check if video needs to be re-uploaded (after loading a saved project)
   */
  needsVideoReupload(): boolean {
    return this.needsReupload;
  }

  /**
   * Mark that video needs to be re-uploaded
   */
  setNeedsReupload(needs: boolean) {
    this.needsReupload = needs;
  }

  /**
   * Get the saved filename from parameters (for display when re-upload is needed)
   */
  getSavedFileName(): string | null {
    const fileName = this.getParameter('_videoFileName') as string;
    return fileName && fileName.trim() !== '' ? fileName : null;
  }

  /**
   * Get video metadata for serialization
   */
  getVideoMetadata(): VideoMetadata | null {
    if (!this.videoFile) return null;
    return {
      fileName: this.videoFile.name,
      fileSize: this.videoFile.size,
      fileType: this.videoFile.type,
      lastModified: this.videoFile.lastModified,
    };
  }

  /**
   * Restore video from metadata (called after deserialization)
   * This will set needsReupload flag since we can't restore the actual file
   */
  restoreFromMetadata(metadata: VideoMetadata) {
    // We can't restore the actual file, so mark as needing re-upload
    this.needsReupload = true;
    this.videoFile = null;
    this.outputCanvas = null;
    this.cleanupVideo();
    this.lastVideoHash = '';
  }

  getNodeDefinition() {
    return {
      type: 'video',
      inputs: [],
      outputs: [{ id: 'canvas', type: NodeDataType.CANVAS }],
      parameters: {
        // Store metadata for serialization (not editable by user)
        _videoFileName: {
          type: NodeParameterType.STRING,
          value: '',
        },
        _videoFileSize: {
          type: NodeParameterType.NUMBER,
          value: 0,
        },
        _videoFileType: {
          type: NodeParameterType.STRING,
          value: '',
        },
        _videoLastModified: {
          type: NodeParameterType.NUMBER,
          value: 0,
        },
      },
      maxInputs: 0,
      maxOutputs: 10
    };
  }

  /**
   * Compute hash for the current video file to detect changes
   */
  private computeVideoHash(): string {
    if (!this.videoFile) {
      return 'no-video';
    }
    // Use file name, size, and lastModified to detect changes
    return `${this.videoFile.name}:${this.videoFile.size}:${this.videoFile.lastModified}`;
  }

  async executeInternal(): Promise<void> {
    const currentHash = this.computeVideoHash();
    
    // If video hasn't changed and we have cached output, reuse it (no redo)
    if (currentHash === this.lastVideoHash && this.outputCanvas) {
      // Decrement the redo count that was added by BaseNode.execute()
      // We do this by tracking if we're skipping
      this.redoCount = Math.max(0, this.redoCount - 1);
      this.setOutput('canvas', this.outputCanvas);
      return; // Skip - no redo
    }

    // Video changed or no cached output - recompute (redo already marked by BaseNode)
    
    if (!this.outputCanvas) {
      // If no video loaded, output empty canvas
      const emptyCanvas = this.createCanvas(1, 1);
      this.setOutput('canvas', emptyCanvas);
      this.lastVideoHash = currentHash;
      return;
    }

    // Output the canvas and update hash
    this.setOutput('canvas', this.outputCanvas);
    this.lastVideoHash = currentHash;
  }

  /**
   * Override to sync metadata parameters with actual file
   */
  getAllParameters() {
    const params = super.getAllParameters();
    const metadata = this.getVideoMetadata();
    
    if (metadata) {
      params._videoFileName = metadata.fileName;
      params._videoFileSize = metadata.fileSize;
      params._videoFileType = metadata.fileType;
      params._videoLastModified = metadata.lastModified;
    } else {
      params._videoFileName = '';
      params._videoFileSize = 0;
      params._videoFileType = '';
      params._videoLastModified = 0;
    }

    return params;
  }

  /**
   * Override to restore metadata on load
   * This is called when loading a saved project - we can't restore the actual file,
   * so we mark it as needing re-upload
   */
  setParameter(key: string, value: any) {
    super.setParameter(key, value);

    // After all metadata parameters might be set, check if we need to restore
    // We use a small delay to ensure all parameters are set first
    if (key.startsWith('_video') && !this.videoFile) {
      setTimeout(() => {
        const fileName = this.getParameter('_videoFileName') as string;
        if (fileName && !this.videoFile) {
          const fileSize = this.getParameter('_videoFileSize') as number || 0;
          const fileType = this.getParameter('_videoFileType') as string || '';
          const lastModified = this.getParameter('_videoLastModified') as number || 0;

          this.restoreFromMetadata({
            fileName,
            fileSize,
            fileType,
            lastModified,
          });
        }
      }, 0);
    }
  }

  cleanup() {
    this.cleanupVideo();
    this.videoFile = null;
    this.outputCanvas = null;
    this.lastVideoHash = '';
  }
}

