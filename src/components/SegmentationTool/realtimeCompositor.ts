/**
 * Real-time Anaglyph Compositor using Segment-Based Depth
 * Creates separate canvas layers for each SEGMENT (not pixel)
 * Keeps segments coherent - no shattering!
 */

interface SegmentLayer {
  segmentColor: string; // RGB key
  depth: number;
  redCanvas: HTMLCanvasElement;
  cyanCanvas: HTMLCanvasElement;
  intensityMultiplier: number; // Per-layer intensity control
}

/**
 * Class to handle real-time anaglyph compositing with per-segment depth
 */
export class RealtimeAnaglyphCompositor {
  private originalImageData: ImageData;
  private segmentationMaskData: ImageData;
  private edgeMap: Float32Array;
  private width: number;
  private height: number;
  
  // Base layer with original image
  private baseImageCanvas: HTMLCanvasElement;
  
  // Edge overlay layer (original colors with edge-based alpha)
  private edgeCanvas: HTMLCanvasElement;
  
  // Segment layers - each segment gets its own depth
  private layers: SegmentLayer[] = [];
  
  // Container to hold all stacked canvases
  private container: HTMLDivElement;
  
  // Current anaglyph parameters (stored for download)
  private currentStereoIntensity: number = 0;
  private currentSeparationAngle: number = 0;

  constructor(
    originalImage: HTMLImageElement, 
    depthMap: Float32Array,
    segmentationMask?: HTMLImageElement,
    edgeMap?: Float32Array
  ) {
    this.width = originalImage.width;
    this.height = originalImage.height;
    this.edgeMap = edgeMap || new Float32Array(this.width * this.height);

    // Extract original image data
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(originalImage, 0, 0);
    this.originalImageData = tempCtx.getImageData(0, 0, this.width, this.height);

    // Extract segmentation mask if provided
    if (segmentationMask) {
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = this.width;
      maskCanvas.height = this.height;
      const maskCtx = maskCanvas.getContext('2d')!;
      maskCtx.drawImage(segmentationMask, 0, 0);
      this.segmentationMaskData = maskCtx.getImageData(0, 0, this.width, this.height);
    } else {
      // Use depth map to reconstruct approximate segments
      this.segmentationMaskData = this.depthMapToSegmentMask(depthMap);
    }

    // Create container
    this.container = document.createElement('div');
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = 'auto';
    this.container.style.display = 'inline-block';
    
    // Calculate display size (max width/height to fit viewport)
    const maxWidth = Math.min(this.width, window.innerWidth * 0.9);
    const maxHeight = Math.min(this.height, window.innerHeight * 0.8);
    const scale = Math.min(maxWidth / this.width, maxHeight / this.height, 1);
    
    const displayWidth = this.width * scale;
    const displayHeight = this.height * scale;
    
    this.container.style.width = `${displayWidth}px`;
    this.container.style.height = `${displayHeight}px`;
    this.container.style.backgroundColor = 'black';

    // Create base image layer (full color, bottom layer)
    this.baseImageCanvas = this.createCanvas();
    this.baseImageCanvas.style.mixBlendMode = 'normal';
    this.baseImageCanvas.style.opacity = '0.3'; // Default 30% opacity
    const baseCtx = this.baseImageCanvas.getContext('2d')!;
    baseCtx.putImageData(this.originalImageData, 0, 0);
    this.container.appendChild(this.baseImageCanvas);

    // Generate segment-based layers on top
    this.generateSegmentLayers(depthMap);
    
    // Create edge overlay layer (original colors with edge-based alpha on TOP)
    this.edgeCanvas = this.createCanvas();
    this.edgeCanvas.style.mixBlendMode = 'normal';
    this.edgeCanvas.style.opacity = '1.0';
    this.edgeCanvas.style.zIndex = '1000'; // On top of everything
    this.generateEdgeOverlay();
    this.container.appendChild(this.edgeCanvas);
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    return canvas;
  }

  /**
   * Convert depth map to segmentation mask (fallback if mask not provided)
   */
  private depthMapToSegmentMask(depthMap: Float32Array): ImageData {
    const imageData = new ImageData(this.width, this.height);
    const pixels = imageData.data;
    
    for (let i = 0; i < depthMap.length; i++) {
      const depth = depthMap[i];
      // Discretize into 10 levels
      const level = Math.round(depth * 9);
      const color = level * 28; // 0-252 range
      
      const idx = i * 4;
      pixels[idx] = color;
      pixels[idx + 1] = color;
      pixels[idx + 2] = color;
      pixels[idx + 3] = 255;
    }
    
    return imageData;
  }

  /**
   * Generate edge overlay using Sobel map as alpha mask
   * Original full-color image with edge-based transparency
   */
  private generateEdgeOverlay(): void {
    const pixels = this.originalImageData.data;
    const numPixels = this.width * this.height;

    const edgeImageData = new ImageData(this.width, this.height);
    const edgePixels = edgeImageData.data;

    // Original colors where edges are, transparent where no edges
    for (let i = 0; i < numPixels; i++) {
      const idx = i * 4;
      const edgeStrength = this.edgeMap[i];
      
      // Use original RGB colors
      edgePixels[idx] = pixels[idx];
      edgePixels[idx + 1] = pixels[idx + 1];
      edgePixels[idx + 2] = pixels[idx + 2];
      
      // Alpha based on edge strength (white edges = opaque, black = transparent)
      edgePixels[idx + 3] = Math.round(edgeStrength * 255);
    }

    const edgeCtx = this.edgeCanvas.getContext('2d')!;
    edgeCtx.putImageData(edgeImageData, 0, 0);
  }

  /**
   * Generate separate layers for each SEGMENT (not individual pixels)
   * Each segment moves as a coherent unit
   */
  private generateSegmentLayers(depthMap: Float32Array): void {
    const originalPixels = this.originalImageData.data;
    const maskPixels = this.segmentationMaskData.data;
    const numPixels = this.width * this.height;

    // Group pixels by segment color (from segmentation mask)
    const segments = new Map<string, { pixels: Set<number>; depthSum: number; count: number }>();
    
    for (let i = 0; i < numPixels; i++) {
      const maskIdx = i * 4;
      const r = maskPixels[maskIdx];
      const g = maskPixels[maskIdx + 1];
      const b = maskPixels[maskIdx + 2];
      
      // Use segment color as key
      const segmentKey = `${r},${g},${b}`;
      
      if (!segments.has(segmentKey)) {
        segments.set(segmentKey, { pixels: new Set(), depthSum: 0, count: 0 });
      }
      
      const segment = segments.get(segmentKey)!;
      segment.pixels.add(i);
      segment.depthSum += depthMap[i];
      segment.count++;
    }

    // Convert to layers and calculate average depth per segment
    const layerData: Array<{ segmentColor: string; depth: number; pixels: Set<number> }> = [];
    
    for (const [segmentColor, data] of segments) {
      const avgDepth = data.depthSum / data.count;
      layerData.push({
        segmentColor,
        depth: avgDepth,
        pixels: data.pixels
      });
    }

    // AMPLIFY DEPTH RANGE: Find min/max and stretch to use full 0-1 range
    const depths = layerData.map(l => l.depth);
    const minDepth = Math.min(...depths);
    const maxDepth = Math.max(...depths);
    const depthRange = maxDepth - minDepth;
    
    // Normalize and stretch depths for more dramatic parallax
    if (depthRange > 0) {
      for (const layer of layerData) {
        // Normalize to 0-1 range
        layer.depth = (layer.depth - minDepth) / depthRange;
        // Optional: Apply power curve for even more dramatic effect
        // Uncomment next line for exponential separation:
        // layer.depth = Math.pow(layer.depth, 1.5);
      }
    }

    // Sort by depth (back to front)
    layerData.sort((a, b) => a.depth - b.depth);

    // Create canvas layers for each segment
    for (const segment of layerData) {
      const redCanvas = this.createCanvas();
      const cyanCanvas = this.createCanvas();
      
      // Set blend modes
      redCanvas.style.mixBlendMode = 'lighten';
      cyanCanvas.style.mixBlendMode = 'lighten';

      // Create image data for this segment
      const redImageData = new ImageData(this.width, this.height);
      const cyanImageData = new ImageData(this.width, this.height);
      const redPixels = redImageData.data;
      const cyanPixels = cyanImageData.data;

      // Fill in pixels for this segment only
      for (const pixelIndex of segment.pixels) {
        const idx = pixelIndex * 4;
        
        // Red channel only
        redPixels[idx] = originalPixels[idx];
        redPixels[idx + 1] = 0;
        redPixels[idx + 2] = 0;
        redPixels[idx + 3] = 255;

        // Cyan (green + blue) only
        cyanPixels[idx] = 0;
        cyanPixels[idx + 1] = originalPixels[idx + 1];
        cyanPixels[idx + 2] = originalPixels[idx + 2];
        cyanPixels[idx + 3] = 255;
      }

      // Draw on canvases
      const redCtx = redCanvas.getContext('2d')!;
      redCtx.putImageData(redImageData, 0, 0);

      const cyanCtx = cyanCanvas.getContext('2d')!;
      cyanCtx.putImageData(cyanImageData, 0, 0);

      // Add to container
      this.container.appendChild(redCanvas);
      this.container.appendChild(cyanCanvas);

      // Store layer info
      this.layers.push({
        segmentColor: segment.segmentColor,
        depth: segment.depth,
        redCanvas,
        cyanCanvas,
        intensityMultiplier: 1.0 // Default: full intensity
      });
    }
  }

  /**
   * Update anaglyph with new parameters - TRULY INSTANT!
   * Each segment moves as a coherent unit based on its depth
   */
  updateAnaglyph(stereoIntensity: number, separationAngle: number): void {
    // Store current parameters for download
    this.currentStereoIntensity = stereoIntensity;
    this.currentSeparationAngle = separationAngle;
    
    // Convert angle to radians
    const angleRad = (separationAngle * Math.PI) / 180;
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    // Update each layer with its own depth-based shift AND intensity multiplier
    for (const layer of this.layers) {
      const shiftMagnitude = (layer.depth - 0.5) * stereoIntensity * layer.intensityMultiplier;
      const shiftX = shiftMagnitude * cosAngle;
      const shiftY = shiftMagnitude * sinAngle;

      // Left eye (red) shifts negative
      layer.redCanvas.style.transform = `translate(${-shiftX}px, ${-shiftY}px)`;
      
      // Right eye (cyan) shifts positive
      layer.cyanCanvas.style.transform = `translate(${shiftX}px, ${shiftY}px)`;
    }
  }

  /**
   * Set intensity multiplier for a specific layer
   */
  setLayerIntensity(layerIndex: number, multiplier: number): void {
    if (layerIndex >= 0 && layerIndex < this.layers.length) {
      this.layers[layerIndex].intensityMultiplier = multiplier;
    }
  }

  /**
   * Get layer information for UI
   */
  getLayers(): Array<{ index: number; depth: number; segmentColor: string; intensity: number }> {
    return this.layers.map((layer, index) => ({
      index,
      depth: layer.depth,
      segmentColor: layer.segmentColor,
      intensity: layer.intensityMultiplier
    }));
  }

  /**
   * Update base layer opacity to control fill effect
   */
  setBaseOpacity(opacity: number): void {
    this.baseImageCanvas.style.opacity = opacity.toString();
  }

  /**
   * Update edge overlay opacity to control sharpness
   */
  setEdgeOpacity(opacity: number): void {
    this.edgeCanvas.style.opacity = opacity.toString();
  }

  /**
   * Get the container element
   */
  getContainer(): HTMLDivElement {
    return this.container;
  }

  /**
   * Convert current state to data URL for download
   * Renders the container at full resolution by drawing each layer in order
   * This matches the display exactly by replicating the same rendering pipeline
   */
  toDataURL(): string {
    try {
      // Recalculate shifts using stored parameters (same logic as updateAnaglyph)
      const angleRad = (this.currentSeparationAngle * Math.PI) / 180;
      const cosAngle = Math.cos(angleRad);
      const sinAngle = Math.sin(angleRad);

      // Create two canvases: one for red channel, one for cyan channel
      // We'll render everything to both, then combine at the end
      const redCanvas = document.createElement('canvas');
      redCanvas.width = this.width;
      redCanvas.height = this.height;
      const redCtx = redCanvas.getContext('2d')!;

      const cyanCanvas = document.createElement('canvas');
      cyanCanvas.width = this.width;
      cyanCanvas.height = this.height;
      const cyanCtx = cyanCanvas.getContext('2d')!;

      // Draw black background on both
      redCtx.fillStyle = 'black';
      redCtx.fillRect(0, 0, this.width, this.height);
      cyanCtx.fillStyle = 'black';
      cyanCtx.fillRect(0, 0, this.width, this.height);

      // Step 1: Draw base image first (bottom layer, normal blend, with opacity)
      const baseOpacity = parseFloat(this.baseImageCanvas.style.opacity || '0.3');
      if (baseOpacity > 0) {
        redCtx.globalAlpha = baseOpacity;
        cyanCtx.globalAlpha = baseOpacity;
        redCtx.globalCompositeOperation = 'source-over';
        cyanCtx.globalCompositeOperation = 'source-over';
        redCtx.drawImage(this.baseImageCanvas, 0, 0);
        cyanCtx.drawImage(this.baseImageCanvas, 0, 0);
        redCtx.globalAlpha = 1.0;
        cyanCtx.globalAlpha = 1.0;
      }

      // Step 2: Draw all layers with their calculated shifts (lighten blend mode)
      redCtx.globalCompositeOperation = 'lighten';
      cyanCtx.globalCompositeOperation = 'lighten';

      for (const layer of this.layers) {
        // Recalculate shift (EXACT same logic as updateAnaglyph)
        const shiftMagnitude = (layer.depth - 0.5) * this.currentStereoIntensity * layer.intensityMultiplier;
        const shiftX = shiftMagnitude * cosAngle;
        const shiftY = shiftMagnitude * sinAngle;

        // Left eye (red) shifts negative - EXACT same as updateAnaglyph
        const redShiftX = -shiftX;
        const redShiftY = -shiftY;
        
        // Right eye (cyan) shifts positive - EXACT same as updateAnaglyph
        const cyanShiftX = shiftX;
        const cyanShiftY = shiftY;

        // Draw red canvas to red channel canvas at shifted position
        // Use direct coordinates to ensure shift is applied correctly
        redCtx.drawImage(layer.redCanvas, redShiftX, redShiftY);
        
        // Draw cyan canvas to cyan channel canvas at shifted position
        // Use direct coordinates to ensure shift is applied correctly
        cyanCtx.drawImage(layer.cyanCanvas, cyanShiftX, cyanShiftY);
      }

      // Step 3: Draw edge overlay last (top layer, normal blend, with opacity)
      const edgeOpacity = parseFloat(this.edgeCanvas.style.opacity || '1.0');
      if (edgeOpacity > 0) {
        redCtx.globalAlpha = edgeOpacity;
        cyanCtx.globalAlpha = edgeOpacity;
        redCtx.globalCompositeOperation = 'source-over';
        cyanCtx.globalCompositeOperation = 'source-over';
        redCtx.drawImage(this.edgeCanvas, 0, 0);
        cyanCtx.drawImage(this.edgeCanvas, 0, 0);
        redCtx.globalAlpha = 1.0;
        cyanCtx.globalAlpha = 1.0;
      }

      // Get image data from both canvases
      const redData = redCtx.getImageData(0, 0, this.width, this.height);
      const cyanData = cyanCtx.getImageData(0, 0, this.width, this.height);

      // Create final output canvas and combine channels
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = this.width;
      outputCanvas.height = this.height;
      const ctx = outputCanvas.getContext('2d')!;
      const outputData = ctx.createImageData(this.width, this.height);

      // Combine: Red from red canvas, Green+Blue from cyan canvas
      for (let i = 0; i < this.width * this.height; i++) {
        const idx = i * 4;
        outputData.data[idx] = redData.data[idx];           // Red from red canvas
        outputData.data[idx + 1] = cyanData.data[idx + 1]; // Green from cyan canvas
        outputData.data[idx + 2] = cyanData.data[idx + 2]; // Blue from cyan canvas
        outputData.data[idx + 3] = 255;                    // Alpha
      }

      ctx.putImageData(outputData, 0, 0);
      return outputCanvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating anaglyph download:', error);
      // Fallback: return a black canvas
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = this.width;
      fallbackCanvas.height = this.height;
      return fallbackCanvas.toDataURL('image/png');
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.container.remove();
  }

  /**
   * Get container dimensions for consistent sizing
   */
  getContainerDimensions(): { width: string; height: string } {
    return {
      width: this.container.style.width,
      height: this.container.style.height
    };
  }
}
