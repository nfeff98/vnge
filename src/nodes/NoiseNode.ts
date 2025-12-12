import { NodeDataType, NodeParameterType } from '../core/BaseNode';
import { BaseWebGLNode } from '../core/BaseWebGLNode';
import { Cloud } from 'lucide-react';
import type { Color } from './ColorNode';

// Fragment shader with Perlin, Simplex, and Voronoi noise implementations
const FRAGMENT_SHADER = `
precision mediump float;

uniform vec3 u_color1;
uniform vec3 u_color2;
uniform float u_scale;
uniform float u_octaves;
uniform float u_persistence;
uniform float u_lacunarity;
uniform float u_seed;
uniform float u_noiseType;
uniform float u_time;
uniform vec2 u_resolution;

varying vec2 v_uv;

#define PI 3.14159265359
#define NOISE_PERLIN 0.0
#define NOISE_SIMPLEX 1.0
#define NOISE_VORONOI 2.0

// Hash function for pseudo-random values
vec3 hash3(vec3 p) {
  vec3 p2 = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                 dot(p, vec3(269.5, 183.3, 246.1)),
                 dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p2) * 43758.5453123);
}

vec2 hash2(vec2 p) {
  vec2 p2 = vec2(dot(p, vec2(127.1, 311.7)),
                 dot(p, vec2(269.5, 183.3)));
  return fract(sin(p2) * 43758.5453123);
}

float hash(vec2 p) {
  vec2 p2 = vec2(dot(p, vec2(127.1, 311.7)),
                 dot(p, vec2(269.5, 183.3)));
  return fract(sin(p2.x + p2.y) * 43758.5453123);
}

// Smooth interpolation
float smoothstep5(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// Gradient function for Perlin noise (2D)
float grad2D(float hash, float x, float y) {
  // Use hash to create a pseudo-random angle
  float angle = hash * 6.28318; // 2*PI
  vec2 dir = vec2(cos(angle), sin(angle));
  return dot(dir, vec2(x, y));
}

// Gradient function for Perlin noise (3D)
float grad3D(float hash, float x, float y, float z) {
  // Use hash to create a pseudo-random 3D direction
  float angle1 = hash * 6.28318; // 2*PI
  float angle2 = (hash * 0.618034) * 6.28318; // Golden ratio for better distribution
  vec3 dir = vec3(cos(angle1) * sin(angle2), sin(angle1) * sin(angle2), cos(angle2));
  return dot(dir, vec3(x, y, z));
}

// Hash-based permutation (seeded, returns float)
float perm(float x) {
  float seed = u_seed * 0.0001;
  return fract(sin(x * 12.9898 + seed) * 43758.5453) * 256.0;
}

// Perlin Noise (3D)
float perlinNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  
  // Get corner hashes for 8 corners of the cube
  // Use different prime multipliers for each dimension to avoid collisions
  float h000 = perm(i.x) + perm(i.y * 57.0) + perm(i.z * 113.0);
  float h001 = perm(i.x) + perm(i.y * 57.0) + perm((i.z + 1.0) * 113.0);
  float h010 = perm(i.x) + perm((i.y + 1.0) * 57.0) + perm(i.z * 113.0);
  float h011 = perm(i.x) + perm((i.y + 1.0) * 57.0) + perm((i.z + 1.0) * 113.0);
  float h100 = perm(i.x + 1.0) + perm(i.y * 57.0) + perm(i.z * 113.0);
  float h101 = perm(i.x + 1.0) + perm(i.y * 57.0) + perm((i.z + 1.0) * 113.0);
  float h110 = perm(i.x + 1.0) + perm((i.y + 1.0) * 57.0) + perm(i.z * 113.0);
  float h111 = perm(i.x + 1.0) + perm((i.y + 1.0) * 57.0) + perm((i.z + 1.0) * 113.0);
  
  // Get gradients for each corner
  float g000 = grad3D(perm(h000), f.x, f.y, f.z);
  float g001 = grad3D(perm(h001), f.x, f.y, f.z - 1.0);
  float g010 = grad3D(perm(h010), f.x, f.y - 1.0, f.z);
  float g011 = grad3D(perm(h011), f.x, f.y - 1.0, f.z - 1.0);
  float g100 = grad3D(perm(h100), f.x - 1.0, f.y, f.z);
  float g101 = grad3D(perm(h101), f.x - 1.0, f.y, f.z - 1.0);
  float g110 = grad3D(perm(h110), f.x - 1.0, f.y - 1.0, f.z);
  float g111 = grad3D(perm(h111), f.x - 1.0, f.y - 1.0, f.z - 1.0);
  
  // Interpolate using smoothstep
  float u = smoothstep5(f.x);
  float v = smoothstep5(f.y);
  float w = smoothstep5(f.z);
  
  // Trilinear interpolation
  return mix(
    mix(
      mix(g000, g100, u),
      mix(g010, g110, u),
      v
    ),
    mix(
      mix(g001, g101, u),
      mix(g011, g111, u),
      v
    ),
    w
  );
}

// Simplex Noise (3D) - seeded
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
  return mod289(((x * 34.0) + 1.0) * x);
}

float simplexNoise(vec3 v) {
  // 3D Simplex noise - simplified implementation
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  float seed = u_seed * 0.0001;
  
  // First corner
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  
  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  
  // Permutations (add seed offset)
  i = mod289(i + vec3(seed));
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  
  // Gradients: 7x7 points over a square, mapped onto an octahedron
  float n_ = 0.142857142857; // 1.0/7.0
  vec3 ns = n_ * D.wyz - D.xzx;
  
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  
  // Normalize gradients
  vec4 norm = vec4(1.79284291400159 - 0.85373472095314 * vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  
  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// Voronoi Noise (3D Cellular) - seeded
float voronoiNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  
  float minDist = 8.0;
  float seed = u_seed * 0.0001;
  
  // Check 3x3x3 grid around current cell
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec3 neighbor = vec3(float(x), float(y), float(z));
        vec3 cell = i + neighbor;
        // Use seeded hash for consistent randomness
        vec3 point = hash3(cell + vec3(seed)) + neighbor;
        vec3 diff = point - f;
        float dist = length(diff);
        minDist = min(minDist, dist);
      }
    }
  }
  
  return minDist;
}

// Fractal Brownian Motion (fBm) for Perlin (3D)
float fBmPerlin(vec3 p) {
  float total = 0.0;
  float frequency = 1.0;
  float amplitude = 1.0;
  float maxValue = 0.0;
  
  int octaves = int(u_octaves);
  for (int i = 0; i < 8; i++) {
    // Only contribute if i < octaves (step returns 1.0 when first arg < second arg)
    float contribution = step(float(i), u_octaves);
    total += perlinNoise(p * frequency) * amplitude * contribution;
    maxValue += amplitude * contribution;
    amplitude *= u_persistence;
    frequency *= u_lacunarity;
  }
  
  return maxValue > 0.0 ? total / maxValue : 0.0;
}

// Fractal Brownian Motion (fBm) for Simplex (3D)
float fBmSimplex(vec3 p) {
  float total = 0.0;
  float frequency = 1.0;
  float amplitude = 1.0;
  float maxValue = 0.0;
  
  int octaves = int(u_octaves);
  for (int i = 0; i < 8; i++) {
    // Only contribute if i < octaves (step returns 1.0 when first arg < second arg)
    float contribution = step(float(i), u_octaves);
    total += simplexNoise(p * frequency) * amplitude * contribution;
    maxValue += amplitude * contribution;
    amplitude *= u_persistence;
    frequency *= u_lacunarity;
  }
  
  return maxValue > 0.0 ? total / maxValue : 0.0;
}

// Fractal Brownian Motion (fBm) for Voronoi (3D)
float fBmVoronoi(vec3 p) {
  float total = 0.0;
  float frequency = 1.0;
  float amplitude = 1.0;
  float maxValue = 0.0;
  
  int octaves = int(u_octaves);
  for (int i = 0; i < 8; i++) {
    // Only contribute if i < octaves (step returns 1.0 when first arg < second arg)
    float contribution = step(float(i), u_octaves);
    // Voronoi returns distance (0 to ~1.4), normalize to -1 to 1 range
    float noise = voronoiNoise(p * frequency);
    noise = (noise - 0.7) * 1.4; // Center and scale
    total += noise * amplitude * contribution;
    maxValue += amplitude * contribution;
    amplitude *= u_persistence;
    frequency *= u_lacunarity;
  }
  
  return maxValue > 0.0 ? total / maxValue : 0.0;
}

void main() {
  vec2 uv = v_uv * u_resolution / u_scale;
  
  // Construct 3D coordinate: XY from UV, Z from time
  // When time = 0, this matches the original 2D behavior exactly
  vec3 P = vec3(uv.x, uv.y, u_time);
  
  float noiseValue;
  
  if (u_noiseType < 0.5) {
    // Perlin Noise (3D)
    noiseValue = fBmPerlin(P);
  } else if (u_noiseType < 1.5) {
    // Simplex Noise (3D)
    noiseValue = fBmSimplex(P);
  } else {
    // Voronoi Noise (3D)
    noiseValue = fBmVoronoi(P);
  }
  
  // Normalize noise value to 0-1 range
  noiseValue = (noiseValue + 1.0) * 0.5;
  noiseValue = clamp(noiseValue, 0.0, 1.0);
  
  // Interpolate between colors
  vec3 color = mix(u_color1, u_color2, noiseValue);
  
  gl_FragColor = vec4(color, 1.0);
}
`;

export class NoiseNode extends BaseWebGLNode {
  constructor(id: string) {
    super(id, {
      name: 'Noise',
      isInput: true,
      icon: Cloud,
      color: '#795548',
      backgroundColor: '#1a1a1a',
      borderColor: '#795548'
    });
  }

  protected getBaseNodeDefinition() {
    return {
      type: 'noise',
      inputs: [
        { id: 'color1', type: NodeDataType.COLOR },
        { id: 'color2', type: NodeDataType.COLOR },
        { id: 'time', type: NodeDataType.NUMBER }
      ],
      outputs: [{ id: 'image', type: NodeDataType.TEXTURE }],
      parameters: {
        ...this.getBaseWebGLParameters(),
        noiseType: {
          type: NodeParameterType.ENUM,
          value: 'perlin',
          options: ['perlin', 'simplex', 'voronoi']
        },
        width: { type: NodeParameterType.NUMBER, value: 640, min: 1, max: 3840, step: 1 },
        height: { type: NodeParameterType.NUMBER, value: 480, min: 1, max: 2160, step: 1 },
        scale: { type: NodeParameterType.NUMBER, value: 50, min: 1, max: 500, step: 1 },
        octaves: { type: NodeParameterType.NUMBER, value: 4, min: 1, max: 8, step: 1 },
        persistence: { type: NodeParameterType.NUMBER, value: 0.5, min: 0, max: 1, step: 0.1 },
        lacunarity: { type: NodeParameterType.NUMBER, value: 2, min: 1, max: 4, step: 0.1 },
        seed: { type: NodeParameterType.NUMBER, value: 0, min: 0, max: 10000, step: 1 },
        time: { 
          type: NodeParameterType.NUMBER, 
          value: 0, 
          min: -1000, 
          max: 1000, 
          step: 0.1,
          // Note: This parameter enables 3D noise animation. Connect a TimeNode to the 'time' input for automatic animation.
        }
      },
      maxInputs: 3,
      maxOutputs: 5
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
    // Get colors from inputs or use defaults
    const color1Input = this.getInput('color1');
    const color2Input = this.getInput('color2');

    const color1: Color = (color1Input && typeof color1Input === 'object' && 'r' in color1Input)
      ? (color1Input as any)
      : { r: 0, g: 0, b: 0, a: 1 }; // Black

    const color2: Color = (color2Input && typeof color2Input === 'object' && 'r' in color2Input)
      ? (color2Input as any)
      : { r: 255, g: 255, b: 255, a: 1 }; // White

    // Get parameters
    const noiseType = this.getParameter('noiseType') as string;
    const scale = this.getParameter('scale') as number;
    const octaves = this.getParameter('octaves') as number;
    const persistence = this.getParameter('persistence') as number;
    const lacunarity = this.getParameter('lacunarity') as number;
    const seed = this.getParameter('seed') as number;
    
    // Get time from input or parameter (input takes precedence)
    const timeInput = this.getInput('time');
    const time = (typeof timeInput === 'number' ? timeInput : (this.getParameter('time') as number)) || 0;

    // Map noise type to float
    const noiseTypeMap: Record<string, number> = {
      perlin: 0.0,
      simplex: 1.0,
      voronoi: 2.0
    };

    return {
      u_color1: [color1.r / 255, color1.g / 255, color1.b / 255],
      u_color2: [color2.r / 255, color2.g / 255, color2.b / 255],
      u_scale: scale,
      u_octaves: octaves,
      u_persistence: persistence,
      u_lacunarity: lacunarity,
      u_seed: seed,
      u_time: time,
      u_noiseType: noiseTypeMap[noiseType] || 0.0,
      u_resolution: [this.currentWidth, this.currentHeight]
    };
  }
}

