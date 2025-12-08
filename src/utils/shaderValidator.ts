/**
 * Shader validation utility for development-time GLSL error checking
 * This helps catch shader compilation errors before runtime
 */

/**
 * Validates GLSL shader syntax (basic checks)
 * Note: Full validation requires WebGL context, but this catches common issues
 */
export function validateShader(shaderSource: string, type: 'vertex' | 'fragment'): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic syntax checks
  if (!shaderSource.trim()) {
    errors.push('Shader source is empty');
    return { valid: false, errors, warnings };
  }

  // Check for required precision in fragment shaders
  if (type === 'fragment' && !shaderSource.includes('precision')) {
    warnings.push('Fragment shader should declare precision (e.g., "precision mediump float;")');
  }

  // Check for main function
  if (!shaderSource.includes('void main()')) {
    errors.push('Shader must contain "void main()" function');
  }

  // Check for common WebGL 1.0 incompatibilities
  if (shaderSource.includes('break;')) {
    errors.push('WebGL 1.0 does not support "break" statements in loops. Use conditionals instead.');
  }

  if (shaderSource.includes('continue;')) {
    errors.push('WebGL 1.0 does not support "continue" statements in loops.');
  }

  // Check for bitwise operations on int (problematic in WebGL 1.0)
  const bitwisePattern = /int\s+\w+\s*[&|^]/;
  if (bitwisePattern.test(shaderSource)) {
    warnings.push('Bitwise operations on int types may not work in WebGL 1.0. Consider using float-based hashing.');
  }

  // Check for for loops with float counters (should use int)
  const floatLoopPattern = /for\s*\(\s*float\s+\w+\s*=/;
  if (floatLoopPattern.test(shaderSource)) {
    errors.push('For loop counters must be int, not float. Use: for (int i = 0; i < N; i++)');
  }

  // Check for undefined variables (basic check)
  const uniformPattern = /uniform\s+\w+\s+(\w+)/g;
  const usedUniforms = new Set<string>();
  let match;
  while ((match = uniformPattern.exec(shaderSource)) !== null) {
    usedUniforms.add(match[1]);
  }

  // Check if gl_FragColor is set in fragment shader
  if (type === 'fragment' && !shaderSource.includes('gl_FragColor')) {
    errors.push('Fragment shader must set gl_FragColor');
  }

  // Check if gl_Position is set in vertex shader
  if (type === 'vertex' && !shaderSource.includes('gl_Position')) {
    errors.push('Vertex shader must set gl_Position');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates a complete shader program (vertex + fragment)
 */
export function validateShaderProgram(
  vertexSource: string,
  fragmentSource: string
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const vertexResult = validateShader(vertexSource, 'vertex');
  const fragmentResult = validateShader(fragmentSource, 'fragment');

  return {
    valid: vertexResult.valid && fragmentResult.valid,
    errors: [...vertexResult.errors, ...fragmentResult.errors],
    warnings: [...vertexResult.warnings, ...fragmentResult.warnings]
  };
}

/**
 * Runtime shader validation using WebGL context
 * This actually compiles the shader to catch real errors
 */
export function validateShaderRuntime(
  gl: WebGLRenderingContext,
  shaderSource: string,
  type: number
): {
  valid: boolean;
  error: string | null;
  infoLog: string | null;
} {
  const shader = gl.createShader(type);
  if (!shader) {
    return {
      valid: false,
      error: 'Failed to create shader',
      infoLog: null
    };
  }

  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  const infoLog = gl.getShaderInfoLog(shader);

  gl.deleteShader(shader);

  return {
    valid: compiled,
    error: compiled ? null : 'Shader compilation failed',
    infoLog
  };
}

