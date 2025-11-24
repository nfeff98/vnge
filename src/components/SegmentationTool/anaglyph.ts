/**
 * Anaglyph Generation Module
 * Creates 3D anaglyph effects based on segmentation masks
 */

interface SegmentationParams {
  method: 'kmeans' | 'auto';
  clusters: number;
  labThreshold?: number;
  hueThreshold?: number;
  stereoIntensity: number;
  separationAngle: number;
}

/**
 * Generate anaglyph image from original image and segmentation mask
 * @param originalImage - The original image
 * @param maskDataUrl - Data URL of the segmentation mask
 * @param params - Segmentation parameters (used for depth calculation)
 * @returns Data URL of the anaglyph image
 */
export async function generateAnaglyph(
  originalImage: HTMLImageElement,
  maskDataUrl: string,
  params: SegmentationParams
): Promise<string> {
  // Load mask image
  const maskImage = new Image();
  maskImage.src = maskDataUrl;
  
  await new Promise((resolve, reject) => {
    maskImage.onload = resolve;
    maskImage.onerror = reject;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  canvas.width = originalImage.width;
  canvas.height = originalImage.height;

  // Get original image data
  ctx.drawImage(originalImage, 0, 0);
  const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Get mask data
  ctx.drawImage(maskImage, 0, 0);
  const maskData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Generate depth map from segmentation mask
  const depthMap = generateDepthMap(maskData, params);

  // Create anaglyph effect
  const anaglyphData = createAnaglyphEffect(
    originalData, 
    depthMap, 
    params.stereoIntensity, 
    params.separationAngle
  );

  // Put anaglyph data back on canvas
  ctx.putImageData(anaglyphData, 0, 0);

  return canvas.toDataURL('image/png');
}

/**
 * Generate depth map from segmentation mask
 * Different segments get different depth values
 * TODO: Improve depth assignment based on:
 * - Semantic understanding of segments
 * - User-defined depth per segment
 * - Gradient-based depth within segments
 */
function generateDepthMap(
  maskData: ImageData,
  params: SegmentationParams
): Float32Array {
  const pixels = maskData.data;
  const numPixels = maskData.width * maskData.height;
  const depthMap = new Float32Array(numPixels);

  // Map each unique color in mask to a depth value
  const colorToDepth = new Map<string, number>();
  let depthLevel = 0;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    
    const colorKey = `${r},${g},${b}`;
    
    if (!colorToDepth.has(colorKey)) {
      // Assign depth based on brightness of the segment color
      const brightness = (r + g + b) / 3;
      // Normalize to 0-1 range, then map to depth range
      const depth = brightness / 255;
      colorToDepth.set(colorKey, depth);
    }
    
    depthMap[i] = colorToDepth.get(colorKey)!;
  }

  return depthMap;
}

/**
 * Create anaglyph effect using red-cyan method
 * Now supports arbitrary separation angles for creative effects
 * @param originalData - Original image data
 * @param depthMap - Depth values for each pixel
 * @param stereoIntensity - Magnitude of the parallax shift
 * @param separationAngle - Angle of the separation vector in degrees (0° = horizontal)
 */
function createAnaglyphEffect(
  originalData: ImageData,
  depthMap: Float32Array,
  stereoIntensity: number,
  separationAngle: number
): ImageData {
  const width = originalData.width;
  const height = originalData.height;
  const pixels = originalData.data;
  const numPixels = width * height;

  // Create output image data
  const anaglyphData = new ImageData(width, height);
  const output = anaglyphData.data;

  // Convert angle to radians
  const angleRad = (separationAngle * Math.PI) / 180;
  
  // Calculate separation vector components
  // 0° = horizontal right, 90° = vertical down, etc.
  const maxShift = stereoIntensity;
  const cosAngle = Math.cos(angleRad);
  const sinAngle = Math.sin(angleRad);

  // Create left (red) and right (cyan) views
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const depth = depthMap[y * width + x];
      
      // Calculate shift based on depth and angle
      // Closer objects (higher depth) shift more
      const shiftMagnitude = (depth - 0.5) * maxShift;
      const shiftX = Math.round(shiftMagnitude * cosAngle);
      const shiftY = Math.round(shiftMagnitude * sinAngle);
      
      // Left eye (red channel) - shift in negative direction
      const leftX = x - shiftX;
      const leftY = y - shiftY;
      let leftR = 0, leftG = 0, leftB = 0;
      
      if (leftX >= 0 && leftX < width && leftY >= 0 && leftY < height) {
        const leftIdx = (leftY * width + leftX) * 4;
        leftR = pixels[leftIdx];
        leftG = pixels[leftIdx + 1];
        leftB = pixels[leftIdx + 2];
      }
      
      // Right eye (cyan channels) - shift in positive direction
      const rightX = x + shiftX;
      const rightY = y + shiftY;
      let rightR = 0, rightG = 0, rightB = 0;
      
      if (rightX >= 0 && rightX < width && rightY >= 0 && rightY < height) {
        const rightIdx = (rightY * width + rightX) * 4;
        rightR = pixels[rightIdx];
        rightG = pixels[rightIdx + 1];
        rightB = pixels[rightIdx + 2];
      }
      
      // Combine: Red from left eye, Green and Blue from right eye
      output[idx] = leftR;           // Red channel from left view
      output[idx + 1] = rightG;      // Green channel from right view
      output[idx + 2] = rightB;      // Blue channel from right view
      output[idx + 3] = 255;         // Alpha
    }
  }

  return anaglyphData;
}

/**
 * Alternative anaglyph method: Dubois method (more advanced)
 * TODO: Implement this for better color preservation
 * Reference: http://www.site.uottawa.ca/~edubois/anaglyph/
 */
export function generateDuboisAnaglyph(
  originalImage: HTMLImageElement,
  maskDataUrl: string,
  params: SegmentationParams
): Promise<string> {
  // TODO: Implement Dubois method
  // This method uses color transformation matrices for better results
  throw new Error('Dubois method not yet implemented');
}

