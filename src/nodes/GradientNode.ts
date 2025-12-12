import { NodeDataType, NodeParameterType } from '../core/BaseNode';
import { BaseWebGLNode } from '../core/BaseWebGLNode';
import { Droplets } from 'lucide-react';
import type { Color } from './ColorNode';

// Fragment shader - renders gradient based on type
const FRAGMENT_SHADER = `
precision mediump float;

uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_angle;
uniform vec2 u_position;
uniform float u_gradientType;

varying vec2 v_uv;

#define PI 3.14159265359
#define GRADIENT_LINEAR 0.0
#define GRADIENT_RADIAL 1.0
#define GRADIENT_ANGULAR 2.0

void main() {
  float t;
  
  if (u_gradientType < 0.5) {
    // Linear gradient - project UV onto angle direction
    vec2 dir = vec2(cos(u_angle), sin(u_angle));
    t = dot(v_uv - 0.5, dir) + 0.5;
    
  } else if (u_gradientType < 1.5) {
    // Radial gradient - distance from center
    float dist = distance(v_uv, u_position);
    t = dist * 2.0;
    
  } else {
    // Angular gradient - angle around center
    vec2 centered = v_uv - u_position;
    t = (atan(centered.y, centered.x) + PI) / (2.0 * PI);
  }
  
  // Clamp and interpolate colors
  t = clamp(t, 0.0, 1.0);
  vec3 color = mix(u_color1, u_color2, t);
  
  gl_FragColor = vec4(color, 1.0);
}
`;

export class GradientNode extends BaseWebGLNode {
  constructor(id: string) {
    super(id, {
      name: 'Gradient',
      isInput: true,
      icon: Droplets,
      color: '#FF6B6B',
      backgroundColor: '#1a1a1a',
      borderColor: '#FF6B6B'
    });
  }

  protected getBaseNodeDefinition() {
    return {
      type: 'gradient',
      inputs: [
        { id: 'color1', type: NodeDataType.COLOR },
        { id: 'color2', type: NodeDataType.COLOR },
        { id: 'angle', type: NodeDataType.NUMBER }
      ],
      outputs: [{ id: 'texture', type: NodeDataType.TEXTURE }],
      parameters: {
        ...this.getBaseWebGLParameters(),
        width: { type: NodeParameterType.NUMBER, value: 1024, min: 64, max: 4096, step: 64 },
        height: { type: NodeParameterType.NUMBER, value: 1024, min: 64, max: 4096, step: 64 },
        gradientType: {
          type: NodeParameterType.ENUM,
          value: 'linear',
          options: ['linear', 'radial', 'angular']
        },
        angle: { type: NodeParameterType.NUMBER, value: 0, min: 0, max: 360, step: 1 },
        centerX: { type: NodeParameterType.NUMBER, value: 0.5, min: 0, max: 1, step: 0.01 },
        centerY: { type: NodeParameterType.NUMBER, value: 0.5, min: 0, max: 1, step: 0.01 }
      },
      maxInputs: 3,
      maxOutputs: 10
    };
  }

  protected getFragmentShader(): string {
    return FRAGMENT_SHADER;
  }

  protected getOutputDimensions(): { width: number; height: number } {
    return {
      width: this.getParameter('width') as number,
      height: this.getParameter('height') as number
    };
  }

  protected getShaderUniforms(): Record<string, any> {
    // Get parameters
    const gradientType = this.getParameter('gradientType') as string;
    const angle = (this.getParameter('angle') as number) || 0;
    const centerX = (this.getParameter('centerX') as number) || 0.5;
    const centerY = (this.getParameter('centerY') as number) || 0.5;

    // Get colors from inputs or use defaults
    const color1Input = this.getInput('color1');
    const color2Input = this.getInput('color2');

    const color1: Color = (color1Input && typeof color1Input === 'object' && 'r' in color1Input)
      ? (color1Input as any)
      : { r: 0, g: 0, b: 0, a: 1 };

    const color2: Color = (color2Input && typeof color2Input === 'object' && 'r' in color2Input)
      ? (color2Input as any)
      : { r: 255, g: 255, b: 255, a: 1 };

    // Get angle from input or parameter
    const angleInput = this.getInput('angle');
    const finalAngle = (typeof angleInput === 'number' ? angleInput : angle);

    // Map gradient type to float (WebGL GLSL prefers float for branching)
    const gradientTypeMap: Record<string, number> = {
      linear: 0.0,
      radial: 1.0,
      angular: 2.0
    };

    return {
      u_color1: [color1.r / 255, color1.g / 255, color1.b / 255],
      u_color2: [color2.r / 255, color2.g / 255, color2.b / 255],
      u_angle: (finalAngle * Math.PI) / 180,
      u_position: [centerX, centerY],
      u_gradientType: gradientTypeMap[gradientType] || 0.0
    };
  }
}
