import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  addEdge,
  type Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  type NodeTypes,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { PipelineEngine } from '../../core/PipelineEngine';
import { CameraNode } from '../../nodes/CameraNode';
import { MediaPipeNode } from '../../nodes/MediaPipeNode';
import { HandCenterNode } from '../../nodes/HandCenterNode';
import { HeadPoseNode } from '../../nodes/HeadPoseNode';
import { LandmarkExtractorNode } from '../../nodes/LandmarkExtractorNode';
import { ArrayOperationsNode } from '../../nodes/ArrayOperationsNode';
import { Vec3SplitNode } from '../../nodes/Vec3SplitNode';
import { Vec3ToColorNode } from '../../nodes/Vec3ToColorNode';
import { OutputNode } from '../../nodes/OutputNode';
import { ColorNode } from '../../nodes/ColorNode';
import { PerlinNoiseNode } from '../../nodes/PerlinNoiseNode';
import { CompositeNode } from '../../nodes/CompositeNode';
import { OpacityNode } from '../../nodes/OpacityNode';
import { TimeNode } from '../../nodes/TimeNode';
import { MathNode } from '../../nodes/MathNode';
import NodeComponent from './NodeComponent';

import ContextMenu from './ContextMenu';
import { MirrorNode } from '../../nodes/MirrorNode';
import { TileAndOffsetNode } from '../../nodes/TileAndOffsetNode';
import { GradientNode } from '../../nodes/GradientNode';
import { TextureToCanvasNode } from '../../nodes/TextureToCanvasNode';
import { DisplacementNode } from '../../nodes/DisplacementNode';
import { TrailNode } from '../../nodes/TrailNode';
import UIMenu from './UIMenu';
import { useProjectManager } from '../../hooks/useProjectManager';
import type { BaseNode } from '../../core/BaseNode';
import { Maximize2, X } from 'lucide-react';

const nodeTypes: NodeTypes = {
  default: NodeComponent,
};

const initialNodes: Node[] = [
  {
    id: 'output-1',
    type: 'default',
    position: { x: 400, y: 300 },
    data: { node: null }, // Will be set when nodes are created
  },
];

const initialEdges: Edge[] = [];

export default function NodeEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [pipeline] = useState(() => new PipelineEngine());
  const [isExecuting, setIsExecuting] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId?: string;
    edgeId?: string;
  } | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Handle project loaded from file
  const handleProjectLoaded = useCallback((newNodes: Node[], newEdges: Edge[], pipelineNodes: BaseNode[]) => {
    // Clear existing pipeline
    pipeline.clear();

    // If loading an empty project (new project), create a default output node
    if (pipelineNodes.length === 0) {
      const outputNode = new OutputNode('output-1');
      if (canvasRef.current) {
        outputNode.setTargetCanvas(canvasRef.current);
      }
      pipeline.addNode(outputNode);

      const outputReactNode: Node = {
        id: 'output-1',
        type: 'default',
        position: { x: 400, y: 300 },
        data: { node: outputNode },
      };

      setNodes([outputReactNode]);
      setEdges([]);
      return;
    }

    // Add nodes to pipeline
    pipelineNodes.forEach(node => {
      pipeline.addNode(node);
    });

    // Recreate connections
    newEdges.forEach(edge => {
      pipeline.connect(
        edge.source,
        edge.sourceHandle || 'default',
        edge.target,
        edge.targetHandle || 'default'
      );
    });

    // Update React Flow state
    setNodes(newNodes);
    setEdges(newEdges);
  }, [pipeline, setNodes, setEdges, canvasRef]);

  // Project manager hook
  const projectManager = useProjectManager({
    pipeline,
    nodes,
    edges,
    canvasRef,
    onProjectLoaded: handleProjectLoaded,
  });

  // Mark project as dirty when nodes or edges change
  useEffect(() => {
    // Don't mark dirty on initial load
    if (nodes.length > 0 || edges.length > 0) {
      projectManager.markDirty();
    }
  }, [nodes, edges]);

  // Initialize pipeline with nodes
  useEffect(() => {
    // Clear existing nodes
    pipeline.clear();

    // Create only an output node
    const outputNode = new OutputNode('output-1');

    // Set target canvas for output node
    if (canvasRef.current) {
      outputNode.setTargetCanvas(canvasRef.current);
    }

    // Add node to pipeline
    pipeline.addNode(outputNode);

    // Update React Flow nodes with actual node instances and connection counts
    setNodes(prevNodes => 
      prevNodes.map(node => {
        const inputConnections = edges.filter(edge => edge.target === node.id).length;
        const outputConnections = edges.filter(edge => edge.source === node.id).length;
        
        return {
          ...node,
          data: { 
            ...node.data, 
            node: pipeline.getNode(node.id) || null,
            inputConnections,
            outputConnections
          }
        };
      })
    );

  }, [pipeline]);

  // Update node connection counts when edges change
  useEffect(() => {
    setNodes(prevNodes => 
      prevNodes.map(node => {
        const inputConnections = edges.filter(edge => edge.target === node.id).length;
        const outputConnections = edges.filter(edge => edge.source === node.id).length;
        
        return {
          ...node,
          data: { 
            ...node.data, 
            inputConnections,
            outputConnections
          }
        };
      })
    );
  }, [edges]);

  const executePipeline = useCallback(async () => {
    if (isExecuting) return;
    
    // Check if we have a valid pipeline (camera -> processing -> output)
    const hasOutputNode = pipeline.getAllNodes().some(node => node.visualConfig.name === 'Output');
    if (!hasOutputNode) {
      setPipelineError('No output node found. Add an Output node to see the result.');
      return;
    }

    // Check if we have a valid path from camera to output
    const allNodes = pipeline.getAllNodes();
    const hasValidPath = () => {
      const inputNodes = allNodes.filter(node => node.visualConfig.isInput);
      const outputNodes = allNodes.filter(node => node.visualConfig.name === 'Output');
      
      if (inputNodes.length === 0 || outputNodes.length === 0) {
        return false;
      }

      // Check if any camera can reach any output through the connection graph
      const canReachOutput = (startNodeId: string, visited = new Set<string>()): boolean => {
        if (visited.has(startNodeId)) return false;
        visited.add(startNodeId);
        
        const node = pipeline.getNode(startNodeId);
        if (!node) return false;
        
        if (node.visualConfig.name === 'Output') return true;
        
        // Check all outgoing connections
        const outgoingEdges = edges.filter(edge => edge.source === startNodeId);
        return outgoingEdges.some(edge => canReachOutput(edge.target, new Set(visited)));
      };

      return inputNodes.some(inputNode => canReachOutput(inputNode.id));
    };

    if (!hasValidPath()) {
      setPipelineError('No valid path from input to output. Connect an input to the output node.');
      return;
    }

    // Clear any previous errors if we have a valid pipeline
    setPipelineError(null);
    
    setIsExecuting(true);
    try {
      await pipeline.execute();
    } catch (error) {
      console.error('Pipeline execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [pipeline, isExecuting, edges]);

  // Validate connection during drag (for visual feedback)
  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!connection.source || !connection.target) return false;
      
      const sourceNode = pipeline.getNode(connection.source);
      const targetNode = pipeline.getNode(connection.target);
      
      if (!sourceNode || !targetNode) return false;

      const sourceDef = sourceNode.getNodeDefinition();
      const targetDef = targetNode.getNodeDefinition();

      // Check if target node can accept more inputs
      const currentInputs = edges.filter(edge => edge.target === connection.target).length;
      if (currentInputs >= targetDef.maxInputs) return false;

      // Check if source node can provide more outputs
      const currentOutputs = edges.filter(edge => edge.source === connection.source).length;
      if (currentOutputs >= sourceDef.maxOutputs) return false;

      // Validate type compatibility
      return pipeline.validateConnection(
        connection.source,
        connection.sourceHandle || 'default',
        connection.target,
        connection.targetHandle || 'default'
      );
    },
    [edges, pipeline]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      // Use the same validation logic
      if (!isValidConnection(params)) {
        console.warn('Cannot connect: Connection validation failed');
        return;
      }

      const edge = addEdge(params, edges);
      setEdges(edge);
      
      // Update pipeline connections (now returns boolean for success)
      const connected = pipeline.connect(
        params.source!,
        params.sourceHandle || 'default',
        params.target!,
        params.targetHandle || 'default'
      );

      if (!connected) {
        console.error('Failed to create pipeline connection');
        return;
      }

      // Clear any pipeline errors when making new connections
      setPipelineError(null);
      
      // Trigger pipeline execution to check if we can resume
      setTimeout(() => {
        executePipeline();
      }, 100); // Small delay to ensure state is updated
    },
    [edges, pipeline, executePipeline, isValidConnection]
  );

  // Context menu handlers
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    // Close any existing context menu first
    setContextMenu(null);
    // Then open new one
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    });
  }, []);

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    // Close any existing context menu first
    setContextMenu(null);
    // Then open new one
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      edgeId: edge.id,
    });
  }, []);

  const handlePaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault();
    // Close any existing context menu first
    setContextMenu(null);
    // Then open new one
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu is closed via onPaneClick and ContextMenu's internal click-outside handler

  const addNode = useCallback((nodeType: string, position: { x: number; y: number }) => {
    const nodeId = `${nodeType}-${Date.now()}`;
    
    // Create the actual pipeline node
    let pipelineNode;
    switch (nodeType) {
      case 'camera':
        pipelineNode = new CameraNode(nodeId);
        break;
      case 'mediapipe':
      case 'handTracking':  // Backward compatibility
        pipelineNode = new MediaPipeNode(nodeId);
        break;
      case 'handCenter':
        pipelineNode = new HandCenterNode(nodeId);
        break;
      case 'headPose':
        pipelineNode = new HeadPoseNode(nodeId);
        break;
      case 'landmarkExtractor':
        pipelineNode = new LandmarkExtractorNode(nodeId);
        break;
      case 'arrayOperations':
        pipelineNode = new ArrayOperationsNode(nodeId);
        break;
      case 'vec3Split':
        pipelineNode = new Vec3SplitNode(nodeId);
        break;
      case 'vec3ToColor':
        pipelineNode = new Vec3ToColorNode(nodeId);
        break;
      case 'output':
        pipelineNode = new OutputNode(nodeId);
        if (canvasRef.current) pipelineNode.setTargetCanvas(canvasRef.current);
        break;
      case 'mirror':
        pipelineNode = new MirrorNode(nodeId);
        break;
      case 'tileAndOffset':
        pipelineNode = new TileAndOffsetNode(nodeId);
        break;
      case 'gradient':
        pipelineNode = new GradientNode(nodeId);
        break;
      case 'textureToCanvas':
        pipelineNode = new TextureToCanvasNode(nodeId);
        break;
      case 'displacement':
        pipelineNode = new DisplacementNode(nodeId);
        break;
      case 'color':
        pipelineNode = new ColorNode(nodeId);
        break;
      case 'perlinNoise':
        pipelineNode = new PerlinNoiseNode(nodeId);
        break;
      case 'composite':
        pipelineNode = new CompositeNode(nodeId);
        break;
      case 'opacity':
        pipelineNode = new OpacityNode(nodeId);
        break;
      case 'time':
        pipelineNode = new TimeNode(nodeId);
        break;
      case 'math':
        pipelineNode = new MathNode(nodeId);
        break;
      case 'trail':
        pipelineNode = new TrailNode(nodeId);
        break;
      default:
        return;
    }

    // Add to pipeline
    pipeline.addNode(pipelineNode);

    // Add to React Flow
    const newNode = {
      id: nodeId,
      type: 'default',
      position,
      data: { node: pipelineNode },
    };

    setNodes(prev => [...prev, newNode]);
  }, [pipeline]);

  const deleteNode = useCallback((nodeId: string) => {
    // Check if this is an output node
    const node = pipeline.getNode(nodeId);
    if (node && node.visualConfig.name === 'Output') {
      console.warn('Cannot delete output node');
      return;
    }

    // Remove from pipeline
    pipeline.removeNode(nodeId);
    
    // Remove from React Flow
    setNodes(prev => prev.filter(node => node.id !== nodeId));
    setEdges(prev => prev.filter(edge => edge.source !== nodeId && edge.target !== nodeId));

    // Check if we still have an output node
    const hasOutputNode = pipeline.getAllNodes().some(node => node.visualConfig.name === 'Output');
    if (!hasOutputNode) {
      console.error('Pipeline error: No output node remaining. Pipeline stopped.');
      setIsExecuting(false);
    }
    
    // Trigger pipeline execution to check if we need to stop
    setTimeout(() => {
      executePipeline();
    }, 100);
  }, [pipeline, executePipeline]);

  const deleteEdge = useCallback((edgeId: string) => {
    // Remove from pipeline
    const edge = edges.find(e => e.id === edgeId);
    if (edge) {
      pipeline.disconnect(edge.source, edge.target);
    }
    
    // Remove from React Flow
    setEdges(prev => prev.filter(edge => edge.id !== edgeId));
    
    // Trigger pipeline execution to check if we need to stop
    setTimeout(() => {
      executePipeline();
    }, 100);
  }, [pipeline, edges, executePipeline]);

  // Helper functions for context menu
  const hasOutputNode = useCallback(() => {
    return pipeline.getAllNodes().some(node => node.visualConfig.name === 'Output');
  }, [pipeline]);

  const isOutputNode = useCallback((nodeId: string) => {
    const node = pipeline.getNode(nodeId);
    return node ? node.visualConfig.name === 'Output' : false;
  }, [pipeline]);

  // Auto-execute pipeline
  useEffect(() => {
    const interval = setInterval(executePipeline, 1000 / 15); // 15 FPS to give MediaPipe time to process
    return () => clearInterval(interval);
  }, [executePipeline]);

  // Toggle mini map when 'm' key is pressed
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'm') {
        setShowMiniMap(!showMiniMap);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showMiniMap]);

  // Keyboard shortcuts for file operations
  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Ctrl/Cmd key
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (modifierKey) {
        // Ctrl+S or Cmd+S - Save
        if (event.key === 's' && !event.shiftKey) {
          event.preventDefault();
          if (projectManager.needsSave()) {
            await projectManager.saveAs();
          } else {
            await projectManager.save();
          }
        }
        // Ctrl+Shift+S or Cmd+Shift+S - Save As
        else if (event.key === 's' && event.shiftKey) {
          event.preventDefault();
          await projectManager.saveAs();
        }
        // Ctrl+O or Cmd+O - Open
        else if (event.key === 'o') {
          event.preventDefault();
          await projectManager.open();
        }
        // Ctrl+N or Cmd+N - New
        else if (event.key === 'n') {
          event.preventDefault();
          projectManager.newProject();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [projectManager]);

  // Warn user before closing window with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (projectManager.projectState.isDirty) {
        event.preventDefault();
        // Modern browsers require returnValue to be set
        event.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [projectManager.projectState.isDirty]);    

  const [fullScreen, setFullScreen] = useState(false);

  const toggleFullScreen = () => {
    setFullScreen(!fullScreen);
  };

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const outputCanvasScaleFactor = fullScreen ? 1 : 0.25;
  const outputCanvasWidth = windowWidth * outputCanvasScaleFactor;
  const aspectRatio = 16 / 9;
  const outputCanvasHeight = outputCanvasWidth / aspectRatio;

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        onNodeContextMenu={handleNodeContextMenu}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneContextMenu={handlePaneContextMenu}
        onPaneClick={() => {
          // Close context menu when clicking on the pane (backdrop)
          if (contextMenu) {
            setContextMenu(null);
          }
        }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls />
        {showMiniMap && <MiniMap />}
      </ReactFlow>
      
      {/* Output Canvas */}
      <div style={{
        position: 'fixed',
        bottom: fullScreen ? 0 : 20,
        right: fullScreen ? 0 : 20,
        border: '2px solid #ccc',
        borderRadius: 8,
        backgroundColor: '#000',
        zIndex: 1000,
        overflow: 'hidden',
        top: fullScreen ? 0 : undefined,
        left: fullScreen ? 0 : undefined,
       
      }}>
        <button onClick={toggleFullScreen} className="absolute top-0 right-0">
          {fullScreen ? <X size={16} /> : <Maximize2 size={16} />}
        </button>
        <canvas
          ref={canvasRef}
          width={outputCanvasWidth}
          height={outputCanvasHeight}
          style={{
            display: 'block',
          }}
        />
        
        {/* Error Overlay */}
        {pipelineError && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ff6b6b',
            padding: '20px',
            textAlign: 'center',
            zIndex: 1001,
          }}>
            <div style={{
              fontSize: '24px',
              marginBottom: '10px',
            }}>
              ⚠️
            </div>
            <div style={{
              fontSize: '14px',
              lineHeight: '1.4',
              maxWidth: '300px',
            }}>
              {pipelineError}
            </div>
          </div>
        )}
      </div>
      
      {/* Status */}
      <UIMenu 
        onNew={projectManager.newProject}
        onOpen={projectManager.open}
        onSave={async () => {
          if (projectManager.needsSave()) {
            await projectManager.saveAs();
          } else {
            await projectManager.save();
          }
        }}
        onSaveAs={projectManager.saveAs}
        fileName={projectManager.projectState.fileName}
        isDirty={projectManager.projectState.isDirty}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          edgeId={contextMenu.edgeId}
          onClose={closeContextMenu}
          onAddNode={addNode}
          onDeleteNode={deleteNode}
          onDeleteEdge={deleteEdge}
          hasOutputNode={hasOutputNode()}
          isOutputNode={contextMenu.nodeId ? isOutputNode(contextMenu.nodeId) : false}
        />
      )}
    </div>
  );
}
