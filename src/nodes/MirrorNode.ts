import { BaseWebGLNode } from '../core/BaseWebGLNode';
import { NodeDataType, NodeParameterType } from '../core/BaseNode';
import { FlipHorizontal } from 'lucide-react';

// Fragment shader for mirror/flip operations
const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_image;
uniform float u_flipHorizontal;
uniform float u_flipVertical;
uniform vec2 u_resolution;

varying vec2 v_uv;

void main() {
  // Get UV coordinates
  vec2 uv = v_uv;
  
  // Apply horizontal flip (flip U coordinate)
  if (u_flipHorizontal > 0.5) {
    uv.x = 1.0 - uv.x;
  }
  
  // Apply vertical flip (flip V coordinate)
  if (u_flipVertical > 0.5) {
    uv.y = 1.0 - uv.y;
  }
  
  // Sample texture with flipped UV
  gl_FragColor = texture2D(u_image, uv);
}
`;

export class MirrorNode extends BaseWebGLNode {
  constructor(id: string) {
    super(id, {
      name: 'Mirror',
      isInput: false,
      icon: FlipHorizontal,
      color: '#FF9800',
      backgroundColor: '#1a1a1a',
      borderColor: '#FF9800'
    });
  }

  protected getBaseNodeDefinition() {
    return {
      type: 'mirror',
      inputs: [
        { 
          id: 'image', 
          type: NodeDataType.TEXTURE, 
          accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO, NodeDataType.TEXTURE] 
        }
      ],
      outputs: [{ id: 'image', type: NodeDataType.TEXTURE }],
      parameters: {
        ...this.getBaseWebGLParameters(),
        axis: { 
          type: NodeParameterType.ENUM, 
          value: 'vertical', 
          options: ['horizontal', 'vertical'] 
        }
      },
      maxInputs: 1,
      maxOutputs: 1
    };
  }

  protected getFragmentShader(): string {
    return FRAGMENT_SHADER;
  }

  protected getShaderUniforms(): Record<string, any> {
    const imageTexture = this.getInputAsTexture('image');
    if (!imageTexture) {
      return {
        u_image: { texture: null, unit: 0 },
        u_flipHorizontal: 0.0,
        u_flipVertical: 0.0,
        u_resolution: [this.currentWidth, this.currentHeight]
      };
    }

    const axis = this.getParameter('axis') as string;
    const flipHorizontal = axis === 'horizontal' ? 1.0 : 0.0;
    const flipVertical = axis === 'vertical' ? 1.0 : 0.0;

    return {
      u_image: { texture: imageTexture, unit: 0 },
      u_flipHorizontal: flipHorizontal,
      u_flipVertical: flipVertical,
      u_resolution: [this.currentWidth, this.currentHeight]
    };
  }
}
