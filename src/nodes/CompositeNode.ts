import { BaseWebGLNode } from '../core/BaseWebGLNode';
import { NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Layers } from 'lucide-react';
import type { Color } from './ColorNode';

// Fragment shader with blend mode support
const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_base;
uniform sampler2D u_layer;
uniform float u_blendMode;
uniform vec2 u_resolution;

varying vec2 v_uv;

// Blend mode functions
vec3 blendNormal(vec3 base, vec3 layer, float alpha) {
  return mix(base, layer, alpha);
}

vec3 blendMultiply(vec3 base, vec3 layer, float alpha) {
  return mix(base, base * layer, alpha);
}

vec3 blendScreen(vec3 base, vec3 layer, float alpha) {
  return mix(base, 1.0 - (1.0 - base) * (1.0 - layer), alpha);
}

vec3 blendOverlay(vec3 base, vec3 layer, float alpha) {
  vec3 result = mix(
    vec3(2.0 * base * layer),
    vec3(1.0 - 2.0 * (1.0 - base) * (1.0 - layer)),
    step(0.5, base)
  );
  return mix(base, result, alpha);
}

vec3 blendDarken(vec3 base, vec3 layer, float alpha) {
  return mix(base, min(base, layer), alpha);
}

vec3 blendLighten(vec3 base, vec3 layer, float alpha) {
  return mix(base, max(base, layer), alpha);
}

vec3 blendColorDodge(vec3 base, vec3 layer, float alpha) {
  vec3 result = base / (1.0 - layer + 0.0001);
  result = min(result, vec3(1.0));
  return mix(base, result, alpha);
}

vec3 blendColorBurn(vec3 base, vec3 layer, float alpha) {
  vec3 result = 1.0 - (1.0 - base) / (layer + 0.0001);
  result = max(result, vec3(0.0));
  return mix(base, result, alpha);
}

vec3 blendHardLight(vec3 base, vec3 layer, float alpha) {
  vec3 result = mix(
    vec3(2.0 * base * layer),
    vec3(1.0 - 2.0 * (1.0 - base) * (1.0 - layer)),
    step(0.5, layer)
  );
  return mix(base, result, alpha);
}

vec3 blendSoftLight(vec3 base, vec3 layer, float alpha) {
  vec3 result = mix(
    base - (1.0 - 2.0 * layer) * base * (1.0 - base),
    base + (2.0 * layer - 1.0) * (sqrt(base) - base),
    step(0.5, layer)
  );
  return mix(base, result, alpha);
}

vec3 blendDifference(vec3 base, vec3 layer, float alpha) {
  return mix(base, abs(base - layer), alpha);
}

vec3 blendExclusion(vec3 base, vec3 layer, float alpha) {
  return mix(base, base + layer - 2.0 * base * layer, alpha);
}

// HSL color space helpers for hue, saturation, color, luminosity
vec3 rgb2hsl(vec3 c) {
  float maxVal = max(max(c.r, c.g), c.b);
  float minVal = min(min(c.r, c.g), c.b);
  float delta = maxVal - minVal;
  float l = (maxVal + minVal) / 2.0;
  float h = 0.0;
  float s = 0.0;
  
  if (delta != 0.0) {
    s = l < 0.5 ? delta / (maxVal + minVal) : delta / (2.0 - maxVal - minVal);
    
    if (maxVal == c.r) {
      h = mod(((c.g - c.b) / delta + (c.g < c.b ? 6.0 : 0.0)) / 6.0, 1.0);
    } else if (maxVal == c.g) {
      h = ((c.b - c.r) / delta + 2.0) / 6.0;
    } else {
      h = ((c.r - c.g) / delta + 4.0) / 6.0;
    }
  }
  
  return vec3(h, s, l);
}

vec3 hsl2rgb(vec3 hsl) {
  float h = hsl.x;
  float s = hsl.y;
  float l = hsl.z;
  
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - c / 2.0;
  
  vec3 rgb;
  if (h < 1.0/6.0) {
    rgb = vec3(c, x, 0.0);
  } else if (h < 2.0/6.0) {
    rgb = vec3(x, c, 0.0);
  } else if (h < 3.0/6.0) {
    rgb = vec3(0.0, c, x);
  } else if (h < 4.0/6.0) {
    rgb = vec3(0.0, x, c);
  } else if (h < 5.0/6.0) {
    rgb = vec3(x, 0.0, c);
  } else {
    rgb = vec3(c, 0.0, x);
  }
  
  return rgb + vec3(m);
}

vec3 blendHue(vec3 base, vec3 layer, float alpha) {
  vec3 baseHSL = rgb2hsl(base);
  vec3 layerHSL = rgb2hsl(layer);
  vec3 result = hsl2rgb(vec3(layerHSL.x, baseHSL.y, baseHSL.z));
  return mix(base, result, alpha);
}

vec3 blendSaturation(vec3 base, vec3 layer, float alpha) {
  vec3 baseHSL = rgb2hsl(base);
  vec3 layerHSL = rgb2hsl(layer);
  vec3 result = hsl2rgb(vec3(baseHSL.x, layerHSL.y, baseHSL.z));
  return mix(base, result, alpha);
}

vec3 blendColor(vec3 base, vec3 layer, float alpha) {
  vec3 baseHSL = rgb2hsl(base);
  vec3 layerHSL = rgb2hsl(layer);
  vec3 result = hsl2rgb(vec3(layerHSL.x, layerHSL.y, baseHSL.z));
  return mix(base, result, alpha);
}

vec3 blendLuminosity(vec3 base, vec3 layer, float alpha) {
  vec3 baseHSL = rgb2hsl(base);
  vec3 layerHSL = rgb2hsl(layer);
  vec3 result = hsl2rgb(vec3(baseHSL.x, baseHSL.y, layerHSL.z));
  return mix(base, result, alpha);
}

void main() {
  vec4 baseColor = texture2D(u_base, v_uv);
  vec4 layerColor = texture2D(u_layer, v_uv);
  
  vec3 result;
  float alpha = layerColor.a;
  
  // Blend mode selection (cast float to int for comparison)
  int blendMode = int(u_blendMode);
  if (blendMode == 0) {
    result = blendNormal(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 1) {
    result = blendMultiply(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 2) {
    result = blendScreen(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 3) {
    result = blendOverlay(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 4) {
    result = blendDarken(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 5) {
    result = blendLighten(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 6) {
    result = blendColorDodge(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 7) {
    result = blendColorBurn(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 8) {
    result = blendHardLight(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 9) {
    result = blendSoftLight(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 10) {
    result = blendDifference(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 11) {
    result = blendExclusion(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 12) {
    result = blendHue(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 13) {
    result = blendSaturation(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 14) {
    result = blendColor(baseColor.rgb, layerColor.rgb, alpha);
  } else if (blendMode == 15) {
    result = blendLuminosity(baseColor.rgb, layerColor.rgb, alpha);
  } else {
    result = blendNormal(baseColor.rgb, layerColor.rgb, alpha);
  }
  
  // Composite alpha
  float finalAlpha = baseColor.a + layerColor.a * (1.0 - baseColor.a);
  gl_FragColor = vec4(result, finalAlpha);
}
`;

export class CompositeNode extends BaseWebGLNode {
  constructor(id: string) {
    super(id, {
      name: 'Composite',
      icon: Layers,
      isInput: false,
      color: '#9C27B0',
      backgroundColor: '#1a1a1a',
      borderColor: '#9C27B0'
    });
  }

  protected getBaseNodeDefinition() {
    return {
      type: 'composite',
      inputs: [
        { 
          id: 'base', 
          type: NodeDataType.TEXTURE, 
          accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO, NodeDataType.TEXTURE, NodeDataType.COLOR] 
        },
        { 
          id: 'layer', 
          type: NodeDataType.TEXTURE, 
          accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO, NodeDataType.TEXTURE, NodeDataType.COLOR] 
        }
      ],
      outputs: [{ id: 'composite', type: NodeDataType.TEXTURE }],
      parameters: {
        ...this.getBaseWebGLParameters(),
        blendMode: {
          type: NodeParameterType.ENUM,
          value: 'normal',
          options: [
            'normal',
            'multiply',
            'screen',
            'overlay',
            'darken',
            'lighten',
            'color-dodge',
            'color-burn',
            'hard-light',
            'soft-light',
            'difference',
            'exclusion',
            'hue',
            'saturation',
            'color',
            'luminosity'
          ]
        }
      },
      maxInputs: 2,
      maxOutputs: 1
    };
  }

  protected getFragmentShader(): string {
    return FRAGMENT_SHADER;
  }

  protected getShaderUniforms(): Record<string, any> {
    const baseTexture = this.getInputAsTexture('base');
    const layerTexture = this.getInputAsTexture('layer');
    
    if (!baseTexture || !layerTexture) {
      return {
        u_base: { texture: null, unit: 0 },
        u_layer: { texture: null, unit: 1 },
        u_blendMode: 0,
        u_resolution: [this.currentWidth, this.currentHeight]
      };
    }

    const blendModeMap: Record<string, number> = {
      'normal': 0,
      'multiply': 1,
      'screen': 2,
      'overlay': 3,
      'darken': 4,
      'lighten': 5,
      'color-dodge': 6,
      'color-burn': 7,
      'hard-light': 8,
      'soft-light': 9,
      'difference': 10,
      'exclusion': 11,
      'hue': 12,
      'saturation': 13,
      'color': 14,
      'luminosity': 15
    };

    const blendMode = this.getParameter('blendMode') as string;
    const blendModeIndex = blendModeMap[blendMode] || 0;

    return {
      u_base: { texture: baseTexture, unit: 0 },
      u_layer: { texture: layerTexture, unit: 1 },
      u_blendMode: blendModeIndex,
      u_resolution: [this.currentWidth, this.currentHeight]
    };
  }

  protected getOutputDimensions(): { width: number; height: number } {
    // Get dimensions from base input, fallback to layer, then default
    const base = this.getInput('base');
    const layer = this.getInput('layer');
    
    // Try base first
    if (base) {
      const dims = this.getInputDimensions(base);
      if (dims) return dims;
    }
    
    // Try layer
    if (layer) {
      const dims = this.getInputDimensions(layer);
      if (dims) return dims;
    }
    
    // Fallback
    return { width: 1920, height: 1080 };
  }

  /**
   * Override to handle Color inputs by converting to texture
   */
  protected getInputAsTexture(inputId: string): WebGLTexture | null {
    const input = this.getInput(inputId);
    
    // Handle Color objects - create a 1x1 texture
    if ((input as any).r !== undefined && (input as any).g !== undefined && (input as any).b !== undefined) {
      const color = input as any;
      const gl = this.renderer!.getContext();
      const texture = gl.createTexture();
      if (!texture) throw new Error('Failed to create texture');
      
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D, 
        0, 
        gl.RGBA, 
        1, 
        1, 
        0, 
        gl.RGBA, 
        gl.UNSIGNED_BYTE,
        new Uint8Array([color.r, color.g, color.b, Math.round((color.a ?? 1) * 255)])
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      // Track for cleanup
      this.createdTextures.add(texture);
      return texture;
    }
    
    // Use base class implementation for other types
    return super.getInputAsTexture(inputId);
  }

  async executeInternal(): Promise<void> {
    const base = this.getInput('base');
    const layer = this.getInput('layer');

      // If only base is connected, pass it through
    if (!layer) {
      if (base) {
        // If base is already a texture, pass it through directly
        if ((base as any).__width && (base as any).__height) {
        this.setOutput('composite', base);
      return;
    }
        // For canvas/video/color, we need to render it to a texture
        // Use a simple passthrough shader by calling base class with single input
        // But we need both inputs for the shader, so create a transparent layer
        // Actually, simpler: just convert to texture and output
        const dims = this.getInputDimensions(base);
        if (dims) {
          this.initWebGL(dims.width, dims.height);
          const baseTexture = this.getInputAsTexture('base');
          if (baseTexture) {
            // Create output texture with metadata
            const outputTexture = baseTexture as any;
            outputTexture.__width = dims.width;
            outputTexture.__height = dims.height;
            outputTexture.__gl = this.renderer!.getContext();
            this.setOutput('composite', outputTexture);
          }
        }
      }
      return;
    }

    if (!base) {
      // If only layer, pass it through
      if ((layer as any).__width && (layer as any).__height) {
        this.setOutput('composite', layer);
        return;
      }
      // Convert to texture
      const dims = this.getInputDimensions(layer);
      if (dims) {
        this.initWebGL(dims.width, dims.height);
        const layerTexture = this.getInputAsTexture('layer');
        if (layerTexture) {
          const outputTexture = layerTexture as any;
          outputTexture.__width = dims.width;
          outputTexture.__height = dims.height;
          outputTexture.__gl = this.renderer!.getContext();
          this.setOutput('composite', outputTexture);
        }
      }
      return;
    }

    // Both inputs present - do the composite
    await super.executeInternal();
  }
}
