/**
 * Homography matrix calculation for perspective transformation
 * Used for quad warping in projection mapping
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Compute a 3x3 homography matrix that maps source points to destination points
 * Uses Direct Linear Transform (DLT) algorithm
 * 
 * @param srcPoints - 4 source points (corners of input quad)
 * @param dstPoints - 4 destination points (corners of output quad)
 * @returns 3x3 homography matrix as flat array [m00, m01, m02, m10, m11, m12, m20, m21, m22]
 */
export function computeHomography(
  srcPoints: Point2D[],
  dstPoints: Point2D[]
): number[] {
  if (srcPoints.length !== 4 || dstPoints.length !== 4) {
    throw new Error('Homography requires exactly 4 point pairs');
  }

  // Build the A matrix for DLT (8x9 matrix)
  const A: number[][] = [];
  
  for (let i = 0; i < 4; i++) {
    const src = srcPoints[i];
    const dst = dstPoints[i];
    
    // Two rows per point pair
    A.push([
      -src.x, -src.y, -1, 0, 0, 0, src.x * dst.x, src.y * dst.x, dst.x
    ]);
    A.push([
      0, 0, 0, -src.x, -src.y, -1, src.x * dst.y, src.y * dst.y, dst.y
    ]);
  }

  // Solve for null space of A using SVD-like approach
  // For simplicity, we'll use a basic approach: find eigenvector of A^T * A
  // corresponding to smallest eigenvalue
  
  // Compute A^T * A (9x9 matrix)
  const ATA: number[][] = [];
  for (let i = 0; i < 9; i++) {
    ATA[i] = [];
    for (let j = 0; j < 9; j++) {
      let sum = 0;
      for (let k = 0; k < 8; k++) {
        sum += A[k][i] * A[k][j];
      }
      ATA[i][j] = sum;
    }
  }

  // Find eigenvector corresponding to smallest eigenvalue
  // Using power iteration on inverse (or simpler: use QR decomposition)
  // For simplicity, we'll use a more direct approach with Gaussian elimination
  
  const h = solveEigenvector(ATA);
  
  // Normalize so h[8] = 1 (or scale appropriately)
  if (Math.abs(h[8]) > 1e-10) {
    const scale = 1.0 / h[8];
    for (let i = 0; i < 9; i++) {
      h[i] *= scale;
    }
  }

  // Return as 3x3 matrix (row-major)
  return [
    h[0], h[1], h[2],
    h[3], h[4], h[5],
    h[6], h[7], h[8]
  ];
}

/**
 * Solve for the eigenvector corresponding to the smallest eigenvalue
 * Using SVD-like approach: find null space via QR decomposition
 */
function solveEigenvector(matrix: number[][]): number[] {
  const n = matrix.length;
  
  // Use QR decomposition to find null space
  // For a 9x9 matrix, we want the eigenvector of A^T * A with smallest eigenvalue
  // Simplified: use power iteration on (A^T * A)^-1 to find largest eigenvector of inverse
  // Or more directly: use Gaussian elimination to solve (A^T * A) * x = 0
  
  // Create a copy for Gaussian elimination
  const A = matrix.map(row => [...row]);
  
  // Gaussian elimination with partial pivoting
  for (let i = 0; i < n - 1; i++) {
    // Find pivot
    let maxRow = i;
    let maxVal = Math.abs(A[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxVal) {
        maxVal = Math.abs(A[k][i]);
        maxRow = k;
      }
    }
    
    // Swap rows
    if (maxRow !== i) {
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
    }
    
    // Skip if pivot is too small
    if (Math.abs(A[i][i]) < 1e-10) {
      continue;
    }
    
    // Eliminate
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
    }
  }

  // Back substitution to find null space
  // Start from the last row and work backwards
  const result = new Array(n).fill(0);
  result[n - 1] = 1.0; // Set last element to 1
  
  for (let i = n - 2; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += A[i][j] * result[j];
    }
    if (Math.abs(A[i][i]) > 1e-10) {
      result[i] = -sum / A[i][i];
    } else {
      // If diagonal is zero, set to 0
      result[i] = 0;
    }
  }

  // Normalize the result
  const norm = Math.sqrt(result.reduce((sum, val) => sum + val * val, 0));
  if (norm > 1e-10) {
    for (let i = 0; i < n; i++) {
      result[i] /= norm;
    }
  }

  return result;
}

/**
 * Apply homography transformation to a point
 */
export function applyHomography(h: number[], point: Point2D): Point2D {
  const x = point.x;
  const y = point.y;
  
  const w = h[6] * x + h[7] * y + h[8];
  
  if (Math.abs(w) < 1e-10) {
    return { x: 0, y: 0 };
  }
  
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w
  };
}

