import { useEffect, useRef, useState } from 'react';
import { PipelineEngine } from '../../core/PipelineEngine';
import { CanvasStreamManager } from '../../utils/CanvasStreamManager';

interface ProfilerProps {
  pipeline: PipelineEngine;
  streamManager: CanvasStreamManager | null;
  isVisible: boolean;
  targetPipelineFPS?: number; // Target FPS from NodeEditor
}

interface NodeMetrics {
  nodeId: string;
  nodeType: string;
  avgDuration: number;
  maxDuration: number;
  redosPerSecond: number;
}

interface ProfilerData {
  nodeMetrics: NodeMetrics[];
  pipelineFPS: number;
  reactFlowFPS: number;
  memoryUsage: number;
  streamingEnabled: boolean;
  streamingFPS: number;
  streamingState: string;
}

export default function Profiler({ pipeline, streamManager, isVisible, targetPipelineFPS }: ProfilerProps) {
  const [profilerData, setProfilerData] = useState<ProfilerData>({
    nodeMetrics: [],
    pipelineFPS: 0,
    reactFlowFPS: 0,
    memoryUsage: 0,
    streamingEnabled: false,
    streamingFPS: 0,
    streamingState: 'disconnected'
  });

  const pipelineFrameCountRef = useRef(0);
  const reactFlowFrameCountRef = useRef(0);
  const lastPipelineTimeRef = useRef(performance.now());
  const lastReactFlowTimeRef = useRef(performance.now());
  const lastPipelineExecutionCountRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Enable profiling when visible
  useEffect(() => {
    if (isVisible) {
      pipeline.setProfilingEnabled(true);
    }
    return () => {
      // Don't disable if it was enabled in dev mode
      if (!import.meta.env.DEV) {
        pipeline.setProfilingEnabled(false);
      }
    };
  }, [pipeline, isVisible]);

  // Track React Flow framerate
  useEffect(() => {
    if (!isVisible) return;

    const trackReactFlowFPS = () => {
      reactFlowFrameCountRef.current++;
      animationFrameRef.current = requestAnimationFrame(trackReactFlowFPS);
    };

    animationFrameRef.current = requestAnimationFrame(trackReactFlowFPS);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVisible]);

  // Track pipeline execution count by monitoring execute calls
  useEffect(() => {
    if (!isVisible) return;
    
    // Increment counter when pipeline executes
    // We'll track this via the interval that checks for updates
    pipelineFrameCountRef.current = 0;
    lastPipelineTimeRef.current = performance.now();
  }, [isVisible, pipeline]);

  // Update profiler data periodically
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const now = performance.now();
      
      // Calculate pipeline FPS from execution stats
      const execStats = pipeline.getExecutionStats();
      const executionDelta = execStats.count - lastPipelineExecutionCountRef.current;
      const pipelineTimeDelta = (now - lastPipelineTimeRef.current) / 1000;
      
      let pipelineFPS = 0;
      if (pipelineTimeDelta >= 1 && executionDelta > 0) {
        // Calculate FPS from execution count delta
        pipelineFPS = executionDelta / pipelineTimeDelta;
        lastPipelineExecutionCountRef.current = execStats.count;
        lastPipelineTimeRef.current = now;
      } else if (targetPipelineFPS) {
        // Fallback to target FPS if we don't have enough data yet
        pipelineFPS = targetPipelineFPS;
      }

      // Calculate React Flow FPS
      const reactFlowTimeDelta = (now - lastReactFlowTimeRef.current) / 1000;
      const reactFlowFPS = reactFlowTimeDelta > 0 ? reactFlowFrameCountRef.current / reactFlowTimeDelta : 0;
      reactFlowFrameCountRef.current = 0;
      lastReactFlowTimeRef.current = now;

      // Get memory usage (if available)
      let memoryUsage = 0;
      if ((performance as any).memory) {
        memoryUsage = (performance as any).memory.usedJSHeapSize / 1048576; // Convert to MB
      }

      // Get streaming info
      const streamingEnabled = streamManager?.isStreaming() || false;
      let streamingFPS = 0;
      let streamingState = 'disconnected';
      
      if (streamManager) {
        // Get frame rate from stream manager
        streamingFPS = (streamManager as any).frameRate || 0;
        
        // Try to get connection state
        if (streamingEnabled) {
          streamingState = 'connected';
        } else {
          streamingState = 'disconnected';
        }
      }

      // Get node metrics from PipelineEngine
      const nodeMetricsMap = pipeline.getNodeMetrics();
      const nodeMetrics: NodeMetrics[] = [];
      const allNodes = pipeline.getAllNodes();
      
      for (const [nodeId, metrics] of nodeMetricsMap.entries()) {
        const node = allNodes.find(n => n.id === nodeId);
        if (node) {
          nodeMetrics.push({
            nodeId,
            nodeType: node.getNodeDefinition().type,
            avgDuration: metrics.avgDuration,
            maxDuration: metrics.maxDuration,
            redosPerSecond: metrics.redosPerSecond
          });
        }
      }
      
      // Sort by redos per second (most active first), then by duration
      nodeMetrics.sort((a, b) => {
        if (b.redosPerSecond !== a.redosPerSecond) {
          return b.redosPerSecond - a.redosPerSecond;
        }
        return b.avgDuration - a.avgDuration;
      });

      setProfilerData({
        nodeMetrics,
        pipelineFPS: Math.round(pipelineFPS * 10) / 10,
        reactFlowFPS: Math.round(reactFlowFPS * 10) / 10,
        memoryUsage: Math.round(memoryUsage * 10) / 10,
        streamingEnabled,
        streamingFPS,
        streamingState
      });
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isVisible, streamManager, pipeline, targetPipelineFPS]);

  if (!isVisible) return null;

  // Calculate width to match preview output
  // Preview output uses: outputCanvasWidth * outputCanvasDisplayScale where scale is 0.25
  // outputCanvasWidth = windowWidth, so display width = windowWidth * 0.25
  const previewDisplayWidth = window.innerWidth * 0.25;
  const previewDisplayHeight = previewDisplayWidth / (16 / 9); // 16:9 aspect ratio
  const profilerBottom = 20 + previewDisplayHeight + 20; // Position above preview (20px margin)

  return (
    <div style={{
      position: 'fixed',
      bottom: profilerBottom,
      right: 20,
      width: previewDisplayWidth,
      maxHeight: '400px',
      border: '2px solid #ccc',
      borderRadius: 8,
      backgroundColor: '#1a1a1a',
      color: '#fff',
      zIndex: 1000,
      overflow: 'auto',
      padding: 12,
      fontSize: 12,
      fontFamily: 'monospace',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{ 
        fontWeight: 'bold', 
        marginBottom: 8, 
        borderBottom: '1px solid #444',
        paddingBottom: 4
      }}>
        Profiler
      </div>
      
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Pipeline</div>
        <div style={{ paddingLeft: 8 }}>
          <div>FPS: <span style={{ color: '#4CAF50' }}>{profilerData.pipelineFPS.toFixed(1)}</span></div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>React Flow</div>
        <div style={{ paddingLeft: 8 }}>
          <div>FPS: <span style={{ color: '#4CAF50' }}>{profilerData.reactFlowFPS.toFixed(1)}</span></div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Memory</div>
        <div style={{ paddingLeft: 8 }}>
          <div>Used: <span style={{ color: '#FF9800' }}>{profilerData.memoryUsage.toFixed(1)} MB</span></div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Streaming</div>
        <div style={{ paddingLeft: 8 }}>
          <div>Status: <span style={{ 
            color: profilerData.streamingEnabled ? '#4CAF50' : '#f44336'
          }}>{profilerData.streamingState}</span></div>
          {profilerData.streamingEnabled && (
            <div>FPS: <span style={{ color: '#4CAF50' }}>{profilerData.streamingFPS}</span></div>
          )}
        </div>
      </div>

      {profilerData.nodeMetrics.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8, borderBottom: '1px solid #444', paddingBottom: 4 }}>
            Node Performance
          </div>
          <div style={{ maxHeight: '300px', overflow: 'auto' }}>
            {/* Table Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: '8px',
              padding: '6px 8px',
              borderBottom: '2px solid #444',
              fontWeight: 'bold',
              fontSize: 11,
              color: '#aaa',
              position: 'sticky',
              top: 0,
              backgroundColor: '#1a1a1a',
              zIndex: 1
            }}>
              <div>Node</div>
              <div style={{ textAlign: 'right' }}>Avg (ms)</div>
              <div style={{ textAlign: 'right' }}>Max (ms)</div>
              <div style={{ textAlign: 'right' }}>Redos/s</div>
            </div>
            {/* Table Rows */}
            {profilerData.nodeMetrics.map((metric) => (
              <div 
                key={metric.nodeId} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  gap: '8px',
                  padding: '4px 8px',
                  borderBottom: '1px solid #333',
                  fontSize: 11,
                  alignItems: 'center',
                  backgroundColor: metric.avgDuration > 16 ? 'rgba(244, 67, 54, 0.1)' : 'transparent'
                }}
              >
                <div style={{ 
                  fontWeight: '500',
                  color: metric.avgDuration > 16 ? '#f44336' : '#fff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {metric.nodeType}
                </div>
                <div style={{ 
                  textAlign: 'right',
                  color: metric.avgDuration > 16 ? '#f44336' : metric.avgDuration > 8 ? '#FF9800' : '#4CAF50',
                  fontFamily: 'monospace'
                }}>
                  {metric.avgDuration.toFixed(2)}
                </div>
                <div style={{ 
                  textAlign: 'right',
                  color: metric.maxDuration > 16 ? '#f44336' : metric.maxDuration > 8 ? '#FF9800' : '#4CAF50',
                  fontFamily: 'monospace'
                }}>
                  {metric.maxDuration.toFixed(2)}
                </div>
                <div style={{ 
                  textAlign: 'right',
                  color: metric.redosPerSecond < 0.1 ? '#4CAF50' : metric.redosPerSecond > 10 ? '#f44336' : '#FF9800',
                  fontFamily: 'monospace'
                }}>
                  {metric.redosPerSecond.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

