import type { Node, Edge } from '@xyflow/react';
import { PipelineEngine } from '../core/PipelineEngine';
import { BaseNode } from '../core/BaseNode';

// Import all node types for reconstruction
import { CameraNode } from '../nodes/CameraNode';
import { MediaPipeNode } from '../nodes/MediaPipeNode';
import { HandCenterNode } from '../nodes/HandCenterNode';
import { HeadPoseNode } from '../nodes/HeadPoseNode';
import { LandmarkExtractorNode } from '../nodes/LandmarkExtractorNode';
import { ArrayOperationsNode } from '../nodes/ArrayOperationsNode';
import { Vec3SplitNode } from '../nodes/Vec3SplitNode';
import { Vec3ToColorNode } from '../nodes/Vec3ToColorNode';
import { OutputNode } from '../nodes/OutputNode';
import { ColorNode } from '../nodes/ColorNode';
import { PerlinNoiseNode } from '../nodes/PerlinNoiseNode';
import { CompositeNode } from '../nodes/CompositeNode';
import { OpacityNode } from '../nodes/OpacityNode';
import { TimeNode } from '../nodes/TimeNode';
import { MathNode } from '../nodes/MathNode';
import { MirrorNode } from '../nodes/MirrorNode';
import { TileAndOffsetNode } from '../nodes/TileAndOffsetNode';
import { GradientNode } from '../nodes/GradientNode';
import { TextureToCanvasNode } from '../nodes/TextureToCanvasNode';
import { DisplacementNode } from '../nodes/DisplacementNode';
import { TrailNode } from '../nodes/TrailNode';
import { ImageNode } from '../nodes/ImageNode';
import { WarpNode } from '../nodes/WarpNode';

export interface SerializedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  parameters: Record<string, any>;
  enabled: boolean;
}

export interface SerializedConnection {
  from: string;
  to: string;
  fromOutput: string;
  toInput: string;
}

export interface ProjectData {
  version: string;
  metadata: {
    created: string;
    modified: string;
    name: string;
  };
  pipeline: {
    nodes: SerializedNode[];
    connections: SerializedConnection[];
  };
}

/**
 * Helper function to sanitize parameters and remove non-serializable objects
 */
function sanitizeParameters(params: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(params)) {
    // Skip functions, DOM elements, and other non-serializable types
    if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      // Recursively sanitize arrays
      sanitized[key] = value.map(item => 
        typeof item === 'object' && item !== null ? sanitizeParameters(item) : item
      );
    } else if (typeof value === 'object' && 
               !(value instanceof HTMLElement) && 
               !(value instanceof Element)) {
      // Recursively sanitize plain objects (but not DOM elements)
      sanitized[key] = sanitizeParameters(value);
    }
    // Skip everything else (functions, DOM elements, etc.)
  }
  
  return sanitized;
}

/**
 * Serialize the current pipeline state to JSON
 */
export function serializePipeline(
  nodes: Node[],
  edges: Edge[],
  pipeline: PipelineEngine,
  projectName: string = 'Untitled'
): ProjectData {
  const serializedNodes: SerializedNode[] = nodes.map(node => {
    const pipelineNode = pipeline.getNode(node.id);
    const rawParameters = pipelineNode?.getAllParameters() || {};
    
    return {
      id: node.id,
      type: pipelineNode?.getNodeDefinition().type || 'unknown',
      position: { x: node.position.x, y: node.position.y }, // Only copy position values
      parameters: sanitizeParameters(rawParameters),
      enabled: pipelineNode?.isEnabled() ?? true,
    };
  });

  const serializedConnections: SerializedConnection[] = pipeline.getConnections();

  const now = new Date().toISOString();
  
  return {
    version: '1.0',
    metadata: {
      created: now,
      modified: now,
      name: projectName,
    },
    pipeline: {
      nodes: serializedNodes,
      connections: serializedConnections,
    },
  };
}

/**
 * Deserialize project data and reconstruct the pipeline
 */
export function deserializePipeline(
  projectData: ProjectData,
  canvasRef: HTMLCanvasElement | null
): {
  nodes: Node[];
  edges: Edge[];
  pipelineNodes: BaseNode[];
} {
  // Validate project data
  if (!projectData.pipeline || !projectData.pipeline.nodes) {
    throw new Error('Invalid project file: missing pipeline data');
  }

  const pipelineNodes: BaseNode[] = [];
  const reactFlowNodes: Node[] = [];
  const reactFlowEdges: Edge[] = [];

  // Recreate pipeline nodes
  for (const serializedNode of projectData.pipeline.nodes) {
    const node = createNodeInstance(
      serializedNode.type,
      serializedNode.id,
      canvasRef
    );

    if (!node) {
      console.warn(`Unknown node type: ${serializedNode.type}, skipping`);
      continue;
    }

    // Restore parameters
    Object.entries(serializedNode.parameters).forEach(([key, value]) => {
      node.setParameter(key, value);
    });

    // Restore enabled state
    node.setEnabled(serializedNode.enabled);

    pipelineNodes.push(node);

    // Create React Flow node
    reactFlowNodes.push({
      id: serializedNode.id,
      type: 'default',
      position: serializedNode.position,
      data: { node },
    });
  }

  // Recreate edges
  projectData.pipeline.connections.forEach((conn, index) => {
    reactFlowEdges.push({
      id: `edge-${index}`,
      source: conn.from,
      target: conn.to,
      sourceHandle: conn.fromOutput,
      targetHandle: conn.toInput,
    });
  });

  return {
    nodes: reactFlowNodes,
    edges: reactFlowEdges,
    pipelineNodes,
  };
}

/**
 * Create a node instance based on type
 */
function createNodeInstance(
  type: string,
  id: string,
  canvasRef: HTMLCanvasElement | null
): BaseNode | null {
  let node: BaseNode | null = null;

  switch (type.toLowerCase()) {
    case 'camera':
      node = new CameraNode(id);
      break;
    case 'mediapipe':
    case 'handtracking':  // Backward compatibility for old projects
      node = new MediaPipeNode(id);
      break;
    case 'handcenter':
      node = new HandCenterNode(id);
      break;
    case 'headpose':
      node = new HeadPoseNode(id);
      break;
    case 'landmarkextractor':
      node = new LandmarkExtractorNode(id);
      break;
    case 'arrayoperations':
      node = new ArrayOperationsNode(id);
      break;
    case 'vec3split':
      node = new Vec3SplitNode(id);
      break;
    case 'vec3tocolor':
      node = new Vec3ToColorNode(id);
      break;
    case 'output':
      node = new OutputNode(id);
      if (canvasRef && node instanceof OutputNode) {
        node.setTargetCanvas(canvasRef);
      }
      break;
    case 'mirror':
      node = new MirrorNode(id);
      break;
    case 'tileandoffset':
      node = new TileAndOffsetNode(id);
      break;
    case 'gradient':
      node = new GradientNode(id);
      break;
    case 'texturetocanvas':
      node = new TextureToCanvasNode(id);
      break;
    case 'displacement':
      node = new DisplacementNode(id);
      break;
    case 'color':
      node = new ColorNode(id);
      break;
    case 'perlinnoise':
      node = new PerlinNoiseNode(id);
      break;
    case 'composite':
      node = new CompositeNode(id);
      break;
    case 'opacity':
      node = new OpacityNode(id);
      break;
    case 'time':
      node = new TimeNode(id);
      break;
    case 'math':
      node = new MathNode(id);
      break;
    case 'trail':
      node = new TrailNode(id);
      break;
    case 'image':
      node = new ImageNode(id);
      break;
    case 'warp':
      node = new WarpNode(id);
      break;
    default:
      return null;
  }

  return node;
}

/**
 * Validate project data structure
 */
export function validateProjectData(data: any): data is ProjectData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  if (!data.version || typeof data.version !== 'string') {
    return false;
  }

  if (!data.pipeline || typeof data.pipeline !== 'object') {
    return false;
  }

  if (!Array.isArray(data.pipeline.nodes) || !Array.isArray(data.pipeline.connections)) {
    return false;
  }

  return true;
}

