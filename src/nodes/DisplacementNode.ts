import { NodeDataType, NodeParameterType } from '../core/BaseNode';
import { BaseWebGLNode } from '../core/BaseWebGLNode';
import { Move } from 'lucide-react';

// Fragment shader - displacement effect
const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_image;
uniform sampler2D u_displacementMap;
uniform vec2 u_strength;
uniform vec2 u_resolution;

varying vec2 v_uv;

void main() {
  // Sample the displacement map
  vec4 dispSample = texture2D(u_displacementMap, v_uv);
  
  // Convert RGB to grayscale for displacement (use red channel by default)
  float displacement = dispSample.r;
  
  // Convert 0-1 to -0.5 to +0.5 range (centered displacement)
  vec2 offset = (displacement - 0.5) * u_strength / u_resolution;
  
  // Sample source image at displaced UV coordinates
  vec2 displacedUV = v_uv + offset;
  
  // Clamp to prevent sampling outside texture bounds
  displacedUV = clamp(displacedUV, 0.0, 1.0);
  
  gl_FragColor = texture2D(u_image, displacedUV);
}
`;

export class DisplacementNode extends BaseWebGLNode {
  constructor(id: string) {
    super(id, {
      name: 'Displacement',
      isInput: false,
      icon: Move,
      color: '#00BCD4',
      backgroundColor: '#1a1a1a',
      borderColor: '#00BCD4'
    });
  }

  getNodeDefinition() {
    return {
      type: 'displacement',
      inputs: [
        { id: 'image', type: NodeDataType.CANVAS, accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO, NodeDataType.TEXTURE] },
        { id: 'd_map', type: NodeDataType.CANVAS, accepts: [NodeDataType.CANVAS, NodeDataType.TEXTURE] }
      ],
      outputs: [{ id: 'image', type: NodeDataType.TEXTURE }],
      parameters: {
        strengthX: { type: NodeParameterType.NUMBER, value: 50, min: -200, max: 200, step: 1 },
        strengthY: { type: NodeParameterType.NUMBER, value: 50, min: -200, max: 200, step: 1 }
      },
      maxInputs: 2,
      maxOutputs: 10
    };
  }

  protected getFragmentShader(): string {
    return FRAGMENT_SHADER;
  }

  protected getShaderUniforms(): Record<string, any> {
    // Get textures from inputs (auto-converted by base class)
    const imageTexture = this.getInputAsTexture('image');
    const displacementTexture = this.getInputAsTexture('d_map');

    // Get parameters
    const strengthX = this.getParameter('strengthX') as number;
    const strengthY = this.getParameter('strengthY') as number;

    return {
      u_image: { texture: imageTexture, unit: 0 },
      u_displacementMap: { texture: displacementTexture, unit: 1 },
      u_strength: [strengthX, strengthY],
      u_resolution: [this.currentWidth, this.currentHeight]
    };
  }

  async executeInternal(): Promise<void> {
    // Check if inputs are connected
    const imageInput = this.getInput('image');
    const displacementInput = this.getInput('displacementMap');

    if (!imageInput || !displacementInput) {
      return; // Skip execution if inputs missing
    }

    // Let base class handle the rest
    await super.executeInternal();
  }
}
