/**
 * Image Segmentation Module
 * Implements k-means clustering and auto-segmentation for image processing
 * Enhanced with Sobel edge detection for sharper boundaries
 */

interface SegmentationParams {
  method: 'kmeans' | 'auto';
  clusters: number;
  labThreshold?: number;
  hueThreshold?: number;
  stereoIntensity: number;
  separationAngle: number;
  edgeWeight?: number;
  sobelIntensity: number;
}

/**
 * Main segmentation function
 * @param image - HTMLImageElement to segment
 * @param params - Segmentation parameters
 * @returns Object containing the mask data URL, depth map, edge map, and sobel visualization
 */
export async function segmentImage(
  image: HTMLImageElement,
  params: SegmentationParams
): Promise<{ maskDataUrl: string; depthMap: Float32Array; edgeMap: Float32Array; sobelDataUrl: string }> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // Apply Sobel edge detection for edge-aware segmentation
  const edgeMap = sobelEdgeDetection(pixels, canvas.width, canvas.height, params.sobelIntensity);

  let segmentedData: Uint8ClampedArray;

  if (params.method === 'kmeans') {
    segmentedData = kMeansSegmentation(pixels, canvas.width, canvas.height, params, edgeMap);
  } else {
    segmentedData = autoSegmentation(pixels, canvas.width, canvas.height);
  }

  // Create mask image
  const maskImageData = ctx.createImageData(canvas.width, canvas.height);
  maskImageData.data.set(segmentedData);
  ctx.putImageData(maskImageData, 0, 0);

  const maskDataUrl = canvas.toDataURL('image/png');

  // Generate depth map from the segmentation
  const depthMap = generateDepthMapFromSegmentation(segmentedData, canvas.width, canvas.height);

  // Create sobel edge visualization for debugging (reuse existing edge map)
  const sobelDataUrl = generateSobelVisualization(edgeMap, canvas.width, canvas.height);

  return { maskDataUrl, depthMap, edgeMap, sobelDataUrl };
}

/**
 * Generate Sobel visualization from existing edge map (memory efficient)
 */
function generateSobelVisualization(
  edgeMap: Float32Array,
  width: number,
  height: number
): string {
  const sobelCanvas = document.createElement('canvas');
  sobelCanvas.width = width;
  sobelCanvas.height = height;
  const sobelCtx = sobelCanvas.getContext('2d')!;
  
  const sobelImageData = sobelCtx.createImageData(width, height);
  const sobelPixels = sobelImageData.data;
  const numPixels = width * height;
  
  // Direct conversion to grayscale
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const edgeStrength = Math.round(edgeMap[i] * 255);
    sobelPixels[idx] = edgeStrength;
    sobelPixels[idx + 1] = edgeStrength;
    sobelPixels[idx + 2] = edgeStrength;
    sobelPixels[idx + 3] = 255;
  }
  
  sobelCtx.putImageData(sobelImageData, 0, 0);
  const dataUrl = sobelCanvas.toDataURL('image/png');
  
  // Clean up
  sobelCanvas.width = 0;
  sobelCanvas.height = 0;
  
  return dataUrl;
}

/**
 * Sobel Edge Detection
 * Computes edge magnitude at each pixel using Sobel operators
 * @param sobelIntensity - Power curve to strengthen edges (1.0 = linear, higher = stronger edges)
 * @returns Float32Array of edge magnitudes (0-1 range)
 */
function sobelEdgeDetection(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  sobelIntensity: number = 1.0
): Float32Array {
  const numPixels = width * height;
  const edgeMap = new Float32Array(numPixels);
  
  // Convert to grayscale first for edge detection
  const gray = new Float32Array(numPixels);
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    gray[i] = (pixels[idx] * 0.299 + pixels[idx + 1] * 0.587 + pixels[idx + 2] * 0.114) / 255;
  }

  // Sobel kernels
  const sobelX = [
    [-1, 0, 1],
    [-2, 0, 2],
    [-1, 0, 1]
  ];
  
  const sobelY = [
    [-1, -2, -1],
    [ 0,  0,  0],
    [ 1,  2,  1]
  ];

  // Apply Sobel operator
  let maxMagnitude = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;

      // Convolve with Sobel kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIdx = (y + ky) * width + (x + kx);
          const kernelValue = gray[pixelIdx];
          
          gx += kernelValue * sobelX[ky + 1][kx + 1];
          gy += kernelValue * sobelY[ky + 1][kx + 1];
        }
      }

      // Calculate edge magnitude
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const idx = y * width + x;
      edgeMap[idx] = magnitude;
      
      if (magnitude > maxMagnitude) {
        maxMagnitude = magnitude;
      }
    }
  }

  // Normalize to 0-1 range and apply intensity curve efficiently
  if (maxMagnitude > 0) {
    const invMaxMag = 1.0 / maxMagnitude;
    
    // First normalization pass
    for (let i = 0; i < numPixels; i++) {
      edgeMap[i] *= invMaxMag;
    }
    
    if (sobelIntensity !== 1.0) {
      // Use a combination of threshold and contrast enhancement
      // This creates stark lines without crushing everything to black
      const threshold = 0.1; // Base threshold for what counts as an edge
      
      for (let i = 0; i < numPixels; i++) {
        const val = edgeMap[i];
        
        if (val < threshold) {
          // Below threshold: push toward black
          edgeMap[i] = val * (1.0 / sobelIntensity);
        } else {
          // Above threshold: enhance contrast
          // Map [threshold, 1] to [0, 1] then apply curve, then map back
          const normalized = (val - threshold) / (1.0 - threshold);
          const enhanced = Math.pow(normalized, 1.0 / sobelIntensity); // Inverse for enhancement
          edgeMap[i] = threshold + enhanced * (1.0 - threshold);
        }
      }
      
      // Final stretch to ensure full range usage
      let newMin = Infinity;
      let newMax = -Infinity;
      for (let i = 0; i < numPixels; i++) {
        if (edgeMap[i] < newMin) newMin = edgeMap[i];
        if (edgeMap[i] > newMax) newMax = edgeMap[i];
      }
      
      const newRange = newMax - newMin;
      if (newRange > 0) {
        for (let i = 0; i < numPixels; i++) {
          edgeMap[i] = (edgeMap[i] - newMin) / newRange;
        }
      }
    }
  }

  return edgeMap;
}

/**
 * K-Means clustering segmentation
 * Now uses Lab and Hue thresholds to weight the distance calculations
 * Enhanced with Sobel edge detection for sharper boundaries
 * - labThreshold affects how much lightness differences matter
 * - hueThreshold affects how much hue differences matter
 * - edgeWeight affects how much edges influence clustering
 */
function kMeansSegmentation(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  params: SegmentationParams,
  edgeMap: Float32Array
): Uint8ClampedArray {
  const k = params.clusters;
  const labWeight = (params.labThreshold || 50) / 50; // Normalize around 1.0
  const hueWeight = (params.hueThreshold || 30) / 30; // Normalize around 1.0
  const edgeWeight = (params.edgeWeight || 50) / 50; // Normalize around 1.0
  const numPixels = width * height;
  const colors: number[][] = [];
  const labColors: number[][] = [];
  const hsvColors: number[][] = [];
  
  // Extract RGB values and convert to LAB and HSV for better color perception
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const rgb = [pixels[idx], pixels[idx + 1], pixels[idx + 2]];
    colors.push(rgb);
    labColors.push(rgbToLab(rgb[0], rgb[1], rgb[2]));
    hsvColors.push(rgbToHsv(rgb[0], rgb[1], rgb[2]));
  }

  // Initialize centroids randomly
  const centroids: number[][] = [];
  const usedIndices = new Set<number>();
  
  for (let i = 0; i < k; i++) {
    let randomIdx;
    do {
      randomIdx = Math.floor(Math.random() * numPixels);
    } while (usedIndices.has(randomIdx));
    
    usedIndices.add(randomIdx);
    centroids.push([...colors[randomIdx]]);
  }

  // Also track centroids in LAB and HSV space
  const labCentroids: number[][] = centroids.map(rgb => rgbToLab(rgb[0], rgb[1], rgb[2]));
  const hsvCentroids: number[][] = centroids.map(rgb => rgbToHsv(rgb[0], rgb[1], rgb[2]));

  // K-means iterations
  const maxIterations = 10;
  const assignments = new Array(numPixels).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assignment step - using weighted distance based on thresholds and edges
    for (let i = 0; i < numPixels; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      // Get edge strength at this pixel
      const edgeStrength = edgeMap[i];

      for (let c = 0; c < k; c++) {
        // Combine RGB, LAB (lightness), and Hue distances with weights
        const rgbDist = euclideanDistance(colors[i], centroids[c]);
        const labDist = Math.abs(labColors[i][0] - labCentroids[c][0]) * labWeight;
        const hueDist = Math.abs(hsvColors[i][0] - hsvCentroids[c][0]) * hueWeight;
        
        // Edge weight makes pixels on edges MORE resistant to changing clusters
        // High edge strength = pixel is sticky, less likely to join distant clusters
        // This keeps edges as boundaries between segments
        const edgeResistance = 1.0 + (edgeStrength * edgeWeight * 0.5);
        
        const dist = (rgbDist + labDist * 10 + hueDist * 10) * edgeResistance;
        
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }

      assignments[i] = bestCluster;
    }

    // Update step
    const newCentroids: number[][] = Array(k).fill(0).map(() => [0, 0, 0]);
    const counts = Array(k).fill(0);

    for (let i = 0; i < numPixels; i++) {
      const cluster = assignments[i];
      newCentroids[cluster][0] += colors[i][0];
      newCentroids[cluster][1] += colors[i][1];
      newCentroids[cluster][2] += colors[i][2];
      counts[cluster]++;
    }

    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        centroids[c][0] = newCentroids[c][0] / counts[c];
        centroids[c][1] = newCentroids[c][1] / counts[c];
        centroids[c][2] = newCentroids[c][2] / counts[c];
        // Update LAB and HSV centroids too
        labCentroids[c] = rgbToLab(centroids[c][0], centroids[c][1], centroids[c][2]);
        hsvCentroids[c] = rgbToHsv(centroids[c][0], centroids[c][1], centroids[c][2]);
      }
    }
  }

  // Create segmented image with distinct colors for each cluster
  const segmented = new Uint8ClampedArray(numPixels * 4);
  const clusterColors = generateDistinctColors(k);

  for (let i = 0; i < numPixels; i++) {
    const cluster = assignments[i];
    const color = clusterColors[cluster];
    const idx = i * 4;
    
    segmented[idx] = color[0];
    segmented[idx + 1] = color[1];
    segmented[idx + 2] = color[2];
    segmented[idx + 3] = 255;
  }

  return segmented;
}

/**
 * Auto-segmentation using simple thresholding
 * TODO: Implement more sophisticated auto-segmentation:
 * - Edge detection (Canny, Sobel)
 * - Region growing
 * - Watershed algorithm
 * - Deep learning-based segmentation (if using TensorFlow.js)
 */
function autoSegmentation(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const numPixels = width * height;
  const segmented = new Uint8ClampedArray(numPixels * 4);

  // Simple brightness-based segmentation
  // TODO: Replace with more sophisticated algorithm
  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = pixels[idx];
    const g = pixels[idx + 1];
    const b = pixels[idx + 2];
    
    // Calculate brightness
    const brightness = (r + g + b) / 3;
    
    // Segment into 3 regions based on brightness
    let color: number[];
    if (brightness < 85) {
      color = [255, 0, 0]; // Dark regions - Red
    } else if (brightness < 170) {
      color = [0, 255, 0]; // Medium regions - Green
    } else {
      color = [0, 0, 255]; // Bright regions - Blue
    }
    
    segmented[idx] = color[0];
    segmented[idx + 1] = color[1];
    segmented[idx + 2] = color[2];
    segmented[idx + 3] = 255;
  }

  return segmented;
}

/**
 * Calculate Euclidean distance between two RGB colors
 */
function euclideanDistance(color1: number[], color2: number[]): number {
  const dr = color1[0] - color2[0];
  const dg = color1[1] - color2[1];
  const db = color1[2] - color2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Generate visually distinct colors for clusters
 */
function generateDistinctColors(k: number): number[][] {
  const colors: number[][] = [];
  
  for (let i = 0; i < k; i++) {
    const hue = (i * 360) / k;
    const rgb = hslToRgb(hue, 70, 50);
    colors.push(rgb);
  }
  
  return colors;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): number[] {
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }
  
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

/**
 * Convert RGB to LAB color space
 * LAB is perceptually uniform - better for color comparisons
 */
function rgbToLab(r: number, g: number, b: number): number[] {
  // Normalize RGB to 0-1
  r = r / 255;
  g = g / 255;
  b = b / 255;

  // Convert to linear RGB
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Convert to XYZ
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  // Convert to LAB
  x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

  const L = (116 * y) - 16;
  const a = 500 * (x - y);
  const B = 200 * (y - z);

  return [L, a, B];
}

/**
 * Convert RGB to HSV color space
 * Good for hue-based segmentation
 */
function rgbToHsv(r: number, g: number, b: number): number[] {
  r = r / 255;
  g = g / 255;
  b = b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;

  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;

  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / diff + 2) / 6;
    } else {
      h = ((r - g) / diff + 4) / 6;
    }
  }

  return [h * 360, s * 100, v * 100];
}

/**
 * Generate depth map from segmented image data
 * Maps each segment color to a depth value based on brightness
 */
function generateDepthMapFromSegmentation(
  segmentedData: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array {
  const numPixels = width * height;
  const depthMap = new Float32Array(numPixels);

  // Map each unique color in mask to a depth value
  const colorToDepth = new Map<string, number>();

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = segmentedData[idx];
    const g = segmentedData[idx + 1];
    const b = segmentedData[idx + 2];
    
    const colorKey = `${r},${g},${b}`;
    
    if (!colorToDepth.has(colorKey)) {
      // Assign depth based on brightness of the segment color
      const brightness = (r + g + b) / 3;
      // Normalize to 0-1 range
      const depth = brightness / 255;
      colorToDepth.set(colorKey, depth);
    }
    
    depthMap[i] = colorToDepth.get(colorKey)!;
  }

  return depthMap;
}

