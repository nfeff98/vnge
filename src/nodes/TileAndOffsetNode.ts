import { NodeDataType, NodeParameterType } from '../core/BaseNode';
import { BaseWebGLNode } from '../core/BaseWebGLNode';
import { Grid3x3 } from 'lucide-react';

// Fragment shader - tiles texture with offset
const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_image;
uniform vec2 u_tile;
uniform vec2 u_offset;

varying vec2 v_uv;

void main() {
  // Multiply UV by tile count to repeat texture
  // Subtract offset to shift the pattern (negative offset shifts left/up, matching Canvas2D behavior)
  vec2 tiledUV = (v_uv * u_tile) - u_offset;
  
  // Use fract() to wrap coordinates for seamless tiling
  tiledUV = fract(tiledUV);
  
  // Sample texture at tiled UV coordinates
  gl_FragColor = texture2D(u_image, tiledUV);
}
`;

export class TileAndOffsetNode extends BaseWebGLNode {
  constructor(id: string) {
    super(id, {
      name: 'Tile & Offset',
      isInput: false,
      icon: Grid3x3,
      color: '#FF9800',
      backgroundColor: '#1a1a1a',
      borderColor: '#FF9800'
    });
  }

  protected getBaseNodeDefinition() {
    return {
      type: 'tileAndOffset',
      inputs: [
        { id: 'image', type: NodeDataType.CANVAS, accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO, NodeDataType.TEXTURE] },
        { id: 'tileX', type: NodeDataType.NUMBER },
        { id: 'tileY', type: NodeDataType.NUMBER },
        { id: 'offsetX', type: NodeDataType.NUMBER },
        { id: 'offsetY', type: NodeDataType.NUMBER }
      ],
      outputs: [{ id: 'image', type: NodeDataType.TEXTURE }],
      parameters: {
        ...this.getBaseWebGLParameters(),
        tileX: { type: NodeParameterType.NUMBER, value: 1, min: 0.1, max: 10, step: 0.1 },
        tileY: { type: NodeParameterType.NUMBER, value: 1, min: 0.1, max: 10, step: 0.1 },
        offsetX: { type: NodeParameterType.NUMBER, value: 0, min: -5, max: 5, step: 0.1 },
        offsetY: { type: NodeParameterType.NUMBER, value: 0, min: -5, max: 5, step: 0.1 }
      },
      maxInputs: 5,
      maxOutputs: 5
    };
  }

  protected getFragmentShader(): string {
    return FRAGMENT_SHADER;
  }

  protected getShaderUniforms(): Record<string, any> {
    // Get input texture (auto-converted by base class)
    const imageTexture = this.getInputAsTexture('image');
    
    if (!imageTexture) {
      return {};
    }

    // Get tile and offset values (from inputs or parameters)
    const tileX = (this.getInput('tileX') as number) ?? (this.getParameter('tileX') as number) ?? 1;
    const tileY = (this.getInput('tileY') as number) ?? (this.getParameter('tileY') as number) ?? 1;
    const offsetX = (this.getInput('offsetX') as number) ?? (this.getParameter('offsetX') as number) ?? 0;
    const offsetY = (this.getInput('offsetY') as number) ?? (this.getParameter('offsetY') as number) ?? 0;

    return {
      u_image: { texture: imageTexture, unit: 0 },
      u_tile: [tileX, tileY],
      u_offset: [offsetX, offsetY]
    };
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
}
