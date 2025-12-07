import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Image as ImageIcon } from 'lucide-react';

export interface ImageMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  lastModified: number;
}

export class ImageNode extends BaseNode {
  private imageFile: File | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;
  private imageElement: HTMLImageElement | null = null;
  private needsReupload: boolean = false;
  private lastImageHash: string = '';

  constructor(id: string) {
    super(id, {
      name: 'Image',
      isInput: true,
      icon: ImageIcon,
      color: '#4CAF50',
      backgroundColor: '#1a1a1a',
      borderColor: '#4CAF50'
    });
  }

  /**
   * Set the image file and load it
   */
  setImageFile(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imageFile = file;
      this.needsReupload = false;
      // Clear hash to force recomputation
      this.lastImageHash = '';

      // Create image element to load the file
      const img = new Image();
      img.onload = () => {
        // Create canvas with image dimensions
        const canvas = this.createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);
        this.outputCanvas = canvas;
        this.imageElement = img;
        resolve();
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      // Load image from file
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get the current image file
   */
  getImageFile(): File | null {
    return this.imageFile;
  }

  /**
   * Check if image needs to be re-uploaded (after loading a saved project)
   */
  needsImageReupload(): boolean {
    return this.needsReupload;
  }

  /**
   * Mark that image needs to be re-uploaded
   */
  setNeedsReupload(needs: boolean) {
    this.needsReupload = needs;
  }

  /**
   * Get the saved filename from parameters (for display when re-upload is needed)
   */
  getSavedFileName(): string | null {
    const fileName = this.getParameter('_imageFileName') as string;
    return fileName && fileName.trim() !== '' ? fileName : null;
  }

  /**
   * Get image metadata for serialization
   */
  getImageMetadata(): ImageMetadata | null {
    if (!this.imageFile) return null;
    return {
      fileName: this.imageFile.name,
      fileSize: this.imageFile.size,
      fileType: this.imageFile.type,
      lastModified: this.imageFile.lastModified,
    };
  }

  /**
   * Restore image from metadata (called after deserialization)
   * This will set needsReupload flag since we can't restore the actual file
   */
  restoreFromMetadata(metadata: ImageMetadata) {
    // We can't restore the actual file, so mark as needing re-upload
    this.needsReupload = true;
    this.imageFile = null;
    this.outputCanvas = null;
    this.imageElement = null;
    this.lastImageHash = '';
  }

  getNodeDefinition() {
    return {
      type: 'image',
      inputs: [],
      outputs: [{ id: 'canvas', type: NodeDataType.CANVAS }],
      parameters: {
        // Store metadata for serialization (not editable by user)
        _imageFileName: {
          type: NodeParameterType.STRING,
          value: '',
        },
        _imageFileSize: {
          type: NodeParameterType.NUMBER,
          value: 0,
        },
        _imageFileType: {
          type: NodeParameterType.STRING,
          value: '',
        },
        _imageLastModified: {
          type: NodeParameterType.NUMBER,
          value: 0,
        },
      },
      maxInputs: 0,
      maxOutputs: 10
    };
  }

  /**
   * Compute hash for the current image file to detect changes
   */
  private computeImageHash(): string {
    if (!this.imageFile) {
      return 'no-image';
    }
    // Use file name, size, and lastModified to detect changes
    return `${this.imageFile.name}:${this.imageFile.size}:${this.imageFile.lastModified}`;
  }

  async executeInternal(): Promise<void> {
    const currentHash = this.computeImageHash();
    
    // If image hasn't changed and we have cached output, reuse it (no redo)
    if (currentHash === this.lastImageHash && this.outputCanvas) {
      // Decrement the redo count that was added by BaseNode.execute()
      // We do this by tracking if we're skipping
      this.redoCount = Math.max(0, this.redoCount - 1);
      this.setOutput('canvas', this.outputCanvas);
      return; // Skip - no redo
    }

    // Image changed or no cached output - recompute (redo already marked by BaseNode)
    
    if (!this.outputCanvas) {
      // If no image loaded, output empty canvas
      const emptyCanvas = this.createCanvas(1, 1);
      this.setOutput('canvas', emptyCanvas);
      this.lastImageHash = currentHash;
      return;
    }

    // Output the canvas and update hash
    this.setOutput('canvas', this.outputCanvas);
    this.lastImageHash = currentHash;
  }

  /**
   * Override to sync metadata parameters with actual file
   */
  getAllParameters() {
    const params = super.getAllParameters();
    const metadata = this.getImageMetadata();
    
    if (metadata) {
      params._imageFileName = metadata.fileName;
      params._imageFileSize = metadata.fileSize;
      params._imageFileType = metadata.fileType;
      params._imageLastModified = metadata.lastModified;
    } else {
      params._imageFileName = '';
      params._imageFileSize = 0;
      params._imageFileType = '';
      params._imageLastModified = 0;
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
    if (key.startsWith('_image') && !this.imageFile) {
      setTimeout(() => {
        const fileName = this.getParameter('_imageFileName') as string;
        if (fileName && !this.imageFile) {
          const fileSize = this.getParameter('_imageFileSize') as number || 0;
          const fileType = this.getParameter('_imageFileType') as string || '';
          const lastModified = this.getParameter('_imageLastModified') as number || 0;

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
    this.imageFile = null;
    this.outputCanvas = null;
    this.imageElement = null;
    this.lastImageHash = '';
  }
}

