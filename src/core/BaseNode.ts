export interface NodeInput {
  id: string;
  data: HTMLCanvasElement | HTMLVideoElement | WebGLTexture | number | string | boolean | Color | null;
}

export interface NodeOutput {
  id: string;
  data: HTMLCanvasElement | HTMLVideoElement | WebGLTexture | number | string | boolean | Color | null;
}

/**
 * Data types for node inputs/outputs
 * Designed to be WebGL-ready for future texture-based operations
 */
export enum NodeDataType {
  CANVAS = 'canvas',      // HTMLCanvasElement (Canvas2D rendering)
  TEXTURE = 'texture',    // WebGLTexture (future WebGL support)
  VIDEO = 'video',        // HTMLVideoElement
  COLOR = 'color',        // Color object {r, g, b, a}
  NUMBER = 'number',      // Single numeric value
  VECTOR2 = 'vector2',    // {x, y} - for positions, scales, etc.
  VECTOR3 = 'vector3',    // {x, y, z} - for 3D operations
  VECTOR4 = 'vector4',    // {x, y, z, w} - for quaternions, RGBA, etc.
  BOOLEAN = 'boolean',    // True/false
  STRING = 'string',      // Text
  ANY = 'any'             // Accepts any type (for flexible nodes)
}

/**
 * Typed input/output definition for nodes
 */
export interface TypedNodeIO {
  id: string;
  type: NodeDataType;
  accepts?: NodeDataType[];  // For inputs: which types can connect (defaults to [type])
}

export enum NodeParameterType {
  NUMBER = 'number',
  STRING = 'string',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  ENUM = 'enum',
  COLOR = 'color'
}

export interface NodeParameter {
  type: NodeParameterType;
  value: number | string | boolean | any[] | Record<string, any>;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface NodeParameters {
  [key: string]: NodeParameter;
}

export interface NodeDefinition {
  type: string;
  inputs: TypedNodeIO[];
  outputs: TypedNodeIO[];
  parameters: NodeParameters;
  maxInputs: number;
  maxOutputs: number;
}

import type { LucideIcon } from 'lucide-react';
import type { Color } from '../nodes/ColorNode';

export interface NodeVisualConfig {
  name: string;
  isInput: boolean;
  icon: LucideIcon;
  color: string;
  backgroundColor: string;
  borderColor: string;
}

export abstract class BaseNode {
  public id: string;
  public inputs: Map<string, NodeInput> = new Map();
  public outputs: Map<string, NodeOutput> = new Map();
  public parameters: NodeParameters = {};
  public isExecuting: boolean = false;
  public visualConfig: NodeVisualConfig;
  private parameterValues: Record<string, any> = {};
  private enabled: boolean = true;

  constructor(id: string, visualConfig: NodeVisualConfig) {
    this.id = id;
    this.visualConfig = visualConfig;
    this.initializeParameters();
  }

  private initializeParameters() {
    const definition = this.getNodeDefinition();
    Object.entries(definition.parameters).forEach(([key, param]) => {
      this.parameterValues[key] = param.value;
    });
  }

  setParameter(key: string, value: any) {
    this.parameterValues[key] = value;
    this.onParameterChanged(key, value);
  }

  getParameter(key: string) {
    return this.parameterValues[key];
  }

  getAllParameters() {
    return { ...this.parameterValues };
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  // Override in subclasses for parameter-specific logic
  protected onParameterChanged(key: string, value: any) {
    // Default: do nothing
  }

  // Default execute implementation that handles bypass logic
  async execute(): Promise<void> {
    if (!this.isEnabled()) {
      // If disabled, pass input directly to output
      this.passThroughInputs();
      return;
    }
    
    // Call the actual implementation
    await this.executeInternal();
    
    // After processing, set the output if the subclass didn't already
    this.setProcessedOutput();
  }

  // Override this method in subclasses instead of execute()
  protected abstract executeInternal(): Promise<void>;

  // Helper method to set the processed output (override in subclasses if needed)
  protected setProcessedOutput() {
    // Default: do nothing - subclasses should handle their own output
  }

  // Helper method to pass inputs directly to outputs when disabled
  private passThroughInputs() {
    const nodeDefinition = this.getNodeDefinition();
    
    // For nodes with single input and single output, pass through
    if (nodeDefinition.inputs.length === 1 && nodeDefinition.outputs.length === 1) {
      const inputData = this.getInput(nodeDefinition.inputs[0].id);
      if (inputData) {
        this.setOutput(nodeDefinition.outputs[0].id, inputData);
      }
    }
  }
  
  abstract getNodeDefinition(): NodeDefinition;

  setInput(inputId: string, data: HTMLCanvasElement | HTMLVideoElement | WebGLTexture | number | string | boolean | Color | null) {
    this.inputs.set(inputId, { id: inputId, data });
  }

  getInput(inputId: string): HTMLCanvasElement | HTMLVideoElement | WebGLTexture | number | string | boolean | Color | null {
    return this.inputs.get(inputId)?.data || null;
  }

  setOutput(outputId: string, data: HTMLCanvasElement | HTMLVideoElement | WebGLTexture | number | string | boolean | Color | null) {
    this.outputs.set(outputId, { id: outputId, data });
  }

  getOutput(outputId: string): HTMLCanvasElement | HTMLVideoElement | WebGLTexture | number | string | boolean | Color | null {
    return this.outputs.get(outputId)?.data || null;
  }



  protected createCanvas(width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  protected copyCanvas(source: HTMLCanvasElement, target: HTMLCanvasElement) {
    const ctx = target.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0);
    }
  }

  // Override in subclasses to cleanup resources (camera, MediaPipe, etc.)
  cleanup() {
    // Default: do nothing - subclasses should override if needed
  }
}

/**
 * To create a new node, copy and paste this starter code into a new file and implement the following:
import { BaseNode } from '../core/BaseNode';
import {  YOUR_ICON_HERE  } from 'lucide-react';

export class YOUR_NODE_NAME extends BaseNode {
  private outputCanvas: HTMLCanvasElement | null = null;
  // any private variables you need

  constructor(id: string) {
    super(id, {
      name: 'YOUR_NODE_NAME',
      icon: YOUR_ICON_HERE,
      color: '#YOUR_COLOR_HERE',
      backgroundColor: '#1a1a1a',
      borderColor: '#YOUR_COLOR_HERE'
    });
  }

  getNodeDefinition() {
    return {
      type: 'YOUR_NODE_NAME',
      inputs: ['YOUR_INPUT_ID'], 
      outputs: ['YOUR_OUTPUT_ID'],
      parameters: {}, // any parameters you need
      maxInputs: 0,
      maxOutputs: 1
    };
  }

  async execute(): Promise<void> {
    // your code here
  }

  cleanup() {
    // any cleanup you need
  }

  
}


 */









