# Shader Development Guide

This guide helps you develop and debug WebGL shaders in the VNGE project.

## Development Tools

### Built-in Validation

The project includes a shader validator (`src/utils/shaderValidator.ts`) that runs automatically in development mode. It checks for:

- Empty shaders
- Missing `void main()` functions
- WebGL 1.0 incompatibilities (break/continue statements)
- Float loop counters (should be int)
- Missing precision declarations
- Missing output assignments (gl_FragColor/gl_Position)

Errors and warnings are logged to the console when shaders are compiled.

### VS Code Extensions (Recommended)

Install these extensions for better GLSL development:

1. **Shader languages support for VS Code** (`slevesque.shader`)
   - Syntax highlighting for GLSL
   - Basic error detection
   - Code snippets

2. **GLSL Lint** (`dtoplak.vscode-glsllint`)
   - Real-time GLSL linting
   - Catches syntax errors before runtime

### Manual Validation

You can manually validate shaders using the validator:

```typescript
import { validateShaderProgram } from './utils/shaderValidator';

const vertexShader = `...`;
const fragmentShader = `...`;

const result = validateShaderProgram(vertexShader, fragmentShader);
if (!result.valid) {
  console.error('Shader errors:', result.errors);
}
```

## WebGL 1.0 Compatibility

### Common Issues

1. **No `break` or `continue` in loops**
   ```glsl
   // ❌ BAD
   for (int i = 0; i < 8; i++) {
     if (i >= octaves) break;
     // ...
   }
   
   // ✅ GOOD
   for (int i = 0; i < 8; i++) {
     float contribution = step(float(i), octaves);
     // Use contribution to conditionally apply
   }
   ```

2. **Loop counters must be `int`, not `float`**
   ```glsl
   // ❌ BAD
   for (float i = 0.0; i < octaves; i++) { }
   
   // ✅ GOOD
   for (int i = 0; i < 8; i++) { }
   ```

3. **Bitwise operations on `int` are limited**
   ```glsl
   // ❌ BAD (may not work)
   int hash = x & 255;
   
   // ✅ GOOD (use float-based hashing)
   float hash = mod(x, 256.0);
   ```

4. **Fragment shaders must declare precision**
   ```glsl
   precision mediump float;
   ```

## Debugging Tips

### 1. Check Console Errors

When a shader fails to compile, check the browser console. The error will include:
- Shader compilation error message
- Full vertex shader source
- Full fragment shader source

### 2. Test Shaders in Isolation

Create a simple test shader first:

```glsl
precision mediump float;
varying vec2 v_uv;

void main() {
  gl_FragColor = vec4(v_uv, 0.0, 1.0);
}
```

If this works, gradually add complexity.

### 3. Use Shader Validator

The built-in validator catches many issues before runtime. Check the console in development mode.

### 4. Validate Uniforms

Make sure all uniforms used in the shader are provided in `getShaderUniforms()`:

```typescript
protected getShaderUniforms(): Record<string, any> {
  return {
    u_myUniform: value,  // Must match shader uniform name exactly
  };
}
```

## Resources

- [WebGL 1.0 Specification](https://www.khronos.org/registry/webgl/specs/1.0/)
- [GLSL ES 1.00 Reference](https://www.khronos.org/registry/OpenGL/specs/es/2.0/GLSL_ES_Specification_1.00.pdf)
- [WebGL Shader Validator](https://webglfundamentals.org/webgl/lessons/webgl-shaders-and-glsl.html)

## Example: Adding a New WebGL Node

1. Extend `BaseWebGLNode`
2. Implement `getFragmentShader()` and `getShaderUniforms()`
3. Test in development mode - validation will run automatically
4. Check console for any warnings or errors

```typescript
export class MyNode extends BaseWebGLNode {
  protected getFragmentShader(): string {
    return `
      precision mediump float;
      uniform vec3 u_color;
      varying vec2 v_uv;
      
      void main() {
        gl_FragColor = vec4(u_color, 1.0);
      }
    `;
  }
  
  protected getShaderUniforms(): Record<string, any> {
    return {
      u_color: [1.0, 0.0, 0.0]
    };
  }
}
```


