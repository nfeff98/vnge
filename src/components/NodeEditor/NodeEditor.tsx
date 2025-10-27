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
import { HandTrackingNode } from '../../nodes/HandTrackingNode';
import { OutputNode } from '../../nodes/OutputNode';

import NodeComponent from './NodeComponent';
import ContextMenu from './ContextMenu';
import { MirrorNode } from '../../nodes/MirrorNode';

const nodeTypes: NodeTypes = {
  default: NodeComponent,
};

const initialNodes: Node[] = [
  {
    id: 'camera-1',
    type: 'default',
    position: { x: 100, y: 100 },
    data: { node: null }, // Will be set when nodes are created
  },
  {
    id: 'hand-tracking-1',
    type: 'default',
    position: { x: 400, y: 100 },
    data: { node: null }, // Will be set when nodes are created
  },
  {
    id: 'output-1',
    type: 'default',
    position: { x: 700, y: 100 },
    data: { node: null }, // Will be set when nodes are created
  },
];

const initialEdges: Edge[] = [
  {
    id: 'camera-to-hand',
    source: 'camera-1',
    target: 'hand-tracking-1',
    sourceHandle: 'video',
    targetHandle: 'video',
  },
  {
    id: 'hand-to-output',
    source: 'hand-tracking-1',
    target: 'output-1',
    sourceHandle: 'result',
    targetHandle: 'image',
  },
];

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

  // Initialize pipeline with nodes
  useEffect(() => {
    // Clear existing nodes
    pipeline.clear();

    // Create node instances
    const cameraNode = new CameraNode('camera-1');
    const handTrackingNode = new HandTrackingNode('hand-tracking-1');
    const outputNode = new OutputNode('output-1');

    // Set target canvas for output node
    if (canvasRef.current) {
      outputNode.setTargetCanvas(canvasRef.current);
    }

    // Add nodes to pipeline
    pipeline.addNode(cameraNode);
    pipeline.addNode(handTrackingNode);
    pipeline.addNode(outputNode);

    // Connect nodes
    pipeline.connect('camera-1', 'video', 'hand-tracking-1', 'video');
    pipeline.connect('hand-tracking-1', 'result', 'output-1', 'image');

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
      const cameraNodes = allNodes.filter(node => node.visualConfig.name === 'Camera');
      const outputNodes = allNodes.filter(node => node.visualConfig.name === 'Output');
      
      if (cameraNodes.length === 0 || outputNodes.length === 0) {
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

      return cameraNodes.some(cameraNode => canReachOutput(cameraNode.id));
    };

    if (!hasValidPath()) {
      setPipelineError('No valid path from camera to output. Connect the camera to the output node.');
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

  const onConnect = useCallback(
    (params: Connection) => {
      // Validate connection limits
      const sourceNode = pipeline.getNode(params.source!);
      const targetNode = pipeline.getNode(params.target!);
      
      if (!sourceNode || !targetNode) {
        console.warn('Cannot connect: Node not found');
        return;
      }

      const sourceDef = sourceNode.getNodeDefinition();
      const targetDef = targetNode.getNodeDefinition();

      // Check if target node can accept more inputs
      const currentInputs = edges.filter(edge => edge.target === params.target).length;
      if (currentInputs >= targetDef.maxInputs) {
        console.warn(`Cannot connect: Target node ${params.target} has reached max inputs (${targetDef.maxInputs})`);
        return;
      }

      // Check if source node can provide more outputs
      const currentOutputs = edges.filter(edge => edge.source === params.source).length;
      if (currentOutputs >= sourceDef.maxOutputs) {
        console.warn(`Cannot connect: Source node ${params.source} has reached max outputs (${sourceDef.maxOutputs})`);
        return;
      }

      const edge = addEdge(params, edges);
      setEdges(edge);
      
      // Update pipeline connections
      pipeline.connect(
        params.source!,
        params.sourceHandle || 'default',
        params.target!,
        params.targetHandle || 'default'
      );

      // Clear any pipeline errors when making new connections
      setPipelineError(null);
      
      // Trigger pipeline execution to check if we can resume
      setTimeout(() => {
        executePipeline();
      }, 100); // Small delay to ensure state is updated
    },
    [edges, pipeline, executePipeline]
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
      case 'handTracking':
        pipelineNode = new HandTrackingNode(nodeId);
        break;
      case 'output':
        pipelineNode = new OutputNode(nodeId);
        if (canvasRef.current) pipelineNode.setTargetCanvas(canvasRef.current);
        break;
      case 'mirror':
        pipelineNode = new MirrorNode(nodeId);
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

  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  const outputCanvasScaleFactor = 0.25;
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
        bottom: 20,
        right: 20,
        border: '2px solid #ccc',
        borderRadius: 8,
        backgroundColor: '#000',
        zIndex: 1000,
        overflow: 'hidden',
      }}>
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
      <div style={{
        position: 'fixed',
        top: 20,
        left: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        zIndex: 1000,
      }}>
        <div>Camera: Ready</div>
        <div>Pipeline: {isExecuting ? 'Running' : 'Stopped'}</div>
        <div>Output: {hasOutputNode() ? '✅ Connected' : '❌ Missing'}</div>
        {pipelineError && <div style={{ color: '#ff6b6b' }}>Pipeline: {pipelineError}</div>}
      </div>

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
