import { NodeDataType, NodeParameterType } from '../core/BaseNode';
import { BaseWebGLNode } from '../core/BaseWebGLNode';
import { Grid3x3 } from 'lucide-react';
import { computeHomography, type Point2D } from '../utils/homography';

// Fragment shader - perspective warp using homography matrix
const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_image;
uniform mat3 u_homography;
uniform vec2 u_resolution;

varying vec2 v_uv;

void main() {
  // Output UV coordinates (0-1)
  vec2 outputUV = v_uv;
  
  // Apply homography to transform output UV to input UV
  // Multiply by homography matrix
  vec3 transformed = u_homography * vec3(outputUV, 1.0);
  
  // Perspective divide
  float w = transformed.z;
  if (abs(w) < 0.0001) {
    // Avoid division by zero - output black
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  
  vec2 inputUV = transformed.xy / w;
  
  // Check if UV is outside image bounds (0-1)
  if (inputUV.x < 0.0 || inputUV.x > 1.0 || inputUV.y < 0.0 || inputUV.y > 1.0) {
    // Outside bounds - render black
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  
  // Inside bounds - sample texture
  gl_FragColor = texture2D(u_image, inputUV);
}
`;

export class WarpNode extends BaseWebGLNode {
  constructor(id: string) {
    super(id, {
      name: 'Warp',
      isInput: false,
      icon: Grid3x3,
      color: '#9C27B0',
      backgroundColor: '#1a1a1a',
      borderColor: '#9C27B0'
    });
  }

  getNodeDefinition() {
    return {
      type: 'warp',
      inputs: [
        { 
          id: 'image', 
          type: NodeDataType.CANVAS, 
          accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO, NodeDataType.TEXTURE] 
        }
      ],
      outputs: [{ id: 'image', type: NodeDataType.TEXTURE }],
      parameters: {
        ...this.getBaseWebGLParameters(),
        // Corner positions in normalized coordinates
        // Values can be outside 0-1 for projection mapping beyond image bounds
        // Order: topLeft, topRight, bottomRight, bottomLeft
        cornerTopLeftX: { type: NodeParameterType.NUMBER, value: 0.0, min: -2.0, max: 3.0, step: 0.001 },
        cornerTopLeftY: { type: NodeParameterType.NUMBER, value: 0.0, min: -2.0, max: 3.0, step: 0.001 },
        cornerTopRightX: { type: NodeParameterType.NUMBER, value: 1.0, min: -2.0, max: 3.0, step: 0.001 },
        cornerTopRightY: { type: NodeParameterType.NUMBER, value: 0.0, min: -2.0, max: 3.0, step: 0.001 },
        cornerBottomRightX: { type: NodeParameterType.NUMBER, value: 1.0, min: -2.0, max: 3.0, step: 0.001 },
        cornerBottomRightY: { type: NodeParameterType.NUMBER, value: 1.0, min: -2.0, max: 3.0, step: 0.001 },
        cornerBottomLeftX: { type: NodeParameterType.NUMBER, value: 0.0, min: -2.0, max: 3.0, step: 0.001 },
        cornerBottomLeftY: { type: NodeParameterType.NUMBER, value: 1.0, min: -2.0, max: 3.0, step: 0.001 }
      },
      maxInputs: 1,
      maxOutputs: 10
    };
  }

  protected getFragmentShader(): string {
    return FRAGMENT_SHADER;
  }

  protected getShaderUniforms(): Record<string, any> {
    // Get input texture
    const imageTexture = this.getInputAsTexture('image');
    if (!imageTexture) {
      // Return identity matrix if no input - this prevents errors
      const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      return {
        u_image: { texture: null, unit: 0 },
        u_homography: identity,
        u_resolution: [this.currentWidth, this.currentHeight]
      };
    }

    // Get corner positions from parameters
    const corners: Point2D[] = [
      {
        x: this.getParameter('cornerTopLeftX') as number,
        y: this.getParameter('cornerTopLeftY') as number
      },
      {
        x: this.getParameter('cornerTopRightX') as number,
        y: this.getParameter('cornerTopRightY') as number
      },
      {
        x: this.getParameter('cornerBottomRightX') as number,
        y: this.getParameter('cornerBottomRightY') as number
      },
      {
        x: this.getParameter('cornerBottomLeftX') as number,
        y: this.getParameter('cornerBottomLeftY') as number
      }
    ];

    // Source corners (input image unit quad)
    const srcCorners: Point2D[] = [
      { x: 0, y: 0 },  // top-left
      { x: 1, y: 0 },  // top-right
      { x: 1, y: 1 },  // bottom-right
      { x: 0, y: 1 }   // bottom-left
    ];

    // Destination corners (where input corners map to in output space)
    // The 'corners' parameter defines where input corners should appear
    const dstCorners: Point2D[] = corners;

    // Compute homography matrix that maps: input unit quad → output positions
    // This maps FROM input corners (srcCorners) TO output positions (dstCorners)
    let homography: number[];
    try {
      homography = computeHomography(srcCorners, dstCorners);
    } catch (e) {
      console.warn('WarpNode: Failed to compute homography, using identity', e);
      homography = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }
    
    // For the shader, we need the inverse: map from output UV to input UV
    // Compute inverse of 3x3 matrix
    const invHomography = this.invertMatrix3x3(homography);
    
    // Transpose for WebGL (column-major order)
    // WebGLRenderer passes false to uniformMatrix3fv, meaning it expects column-major
    // Our matrix is row-major, so we need to transpose it
    const transposed = [
      invHomography[0], invHomography[3], invHomography[6],
      invHomography[1], invHomography[4], invHomography[7],
      invHomography[2], invHomography[5], invHomography[8]
    ];

    return {
      u_image: { texture: imageTexture, unit: 0 },
      u_homography: transposed, // Pass as column-major 3x3 matrix (9 values)
      u_resolution: [this.currentWidth, this.currentHeight]
    };
  }

  /**
   * Invert a 3x3 matrix
   */
  private invertMatrix3x3(m: number[]): number[] {
    // m is row-major: [m00, m01, m02, m10, m11, m12, m20, m21, m22]
    const a = m[0], b = m[1], c = m[2];
    const d = m[3], e = m[4], f = m[5];
    const g = m[6], h = m[7], i = m[8];

    // Compute determinant
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);

    if (Math.abs(det) < 1e-10) {
      // Singular matrix, return identity
      return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    }

    const invDet = 1.0 / det;

    // Compute adjugate matrix (transpose of cofactor matrix)
    return [
      (e * i - f * h) * invDet,
      (c * h - b * i) * invDet,
      (b * f - c * e) * invDet,
      (f * g - d * i) * invDet,
      (a * i - c * g) * invDet,
      (c * d - a * f) * invDet,
      (d * h - e * g) * invDet,
      (b * g - a * h) * invDet,
      (a * e - b * d) * invDet
    ];
  }

  async executeInternal(): Promise<void> {
    // Check if input is connected
    const imageInput = this.getInput('image');
    if (!imageInput) {
      return; // Skip execution if input missing
    }

    // Let base class handle the rest
    await super.executeInternal();
  }

  /**
   * Get current corner positions as an array
   */
  getCorners(): Point2D[] {
    return [
      {
        x: this.getParameter('cornerTopLeftX') as number,
        y: this.getParameter('cornerTopLeftY') as number
      },
      {
        x: this.getParameter('cornerTopRightX') as number,
        y: this.getParameter('cornerTopRightY') as number
      },
      {
        x: this.getParameter('cornerBottomRightX') as number,
        y: this.getParameter('cornerBottomRightY') as number
      },
      {
        x: this.getParameter('cornerBottomLeftX') as number,
        y: this.getParameter('cornerBottomLeftY') as number
      }
    ];
  }

  /**
   * Set corner positions
   */
  setCorners(corners: Point2D[]): void {
    if (corners.length !== 4) {
      throw new Error('WarpNode: setCorners requires exactly 4 corners');
    }

    this.setParameter('cornerTopLeftX', corners[0].x);
    this.setParameter('cornerTopLeftY', corners[0].y);
    this.setParameter('cornerTopRightX', corners[1].x);
    this.setParameter('cornerTopRightY', corners[1].y);
    this.setParameter('cornerBottomRightX', corners[2].x);
    this.setParameter('cornerBottomRightY', corners[2].y);
    this.setParameter('cornerBottomLeftX', corners[3].x);
    this.setParameter('cornerBottomLeftY', corners[3].y);
  }
}

