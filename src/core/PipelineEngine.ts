import { BaseNode, NodeDataType, type TypedNodeIO } from './BaseNode';

export interface Connection {
  from: string;
  to: string;
  fromOutput: string;
  toInput: string;
}

export interface ExecutionProfile {
  nodeId: string;
  nodeType: string;
  duration: number;
  redos: number; // Number of actual recalculations (not cached)
}

export class PipelineEngine {
  private nodes: Map<string, BaseNode> = new Map();
  private connections: Connection[] = [];
  private isExecuting: boolean = false;
  private enableProfiling: boolean = false;
  private recentProfiles: ExecutionProfile[] = [];
  private profileHistory: Array<{ profiles: ExecutionProfile[]; timestamp: number }> = [];
  private readonly maxHistorySize = 60; // Keep last 60 executions
  private executionCount: number = 0;
  private lastExecutionTime: number = 0;

  addNode(node: BaseNode) {
    this.nodes.set(node.id, node);
  }

  removeNode(nodeId: string) {
    // Cleanup the node before removing it
    const node = this.nodes.get(nodeId);
    if (node) {
      node.cleanup();
    }
    
    this.nodes.delete(nodeId);
    // Remove all connections involving this node
    this.connections = this.connections.filter(
      conn => conn.from !== nodeId && conn.to !== nodeId
    );
  }

  connect(fromNodeId: string, fromOutput: string, toNodeId: string, toInput: string): boolean {
    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);
    
    if (!fromNode || !toNode) {
      console.warn('Cannot connect: One or both nodes not found');
      return false;
    }
    
    // Validate type compatibility
    const fromDef = fromNode.getNodeDefinition();
    const toDef = toNode.getNodeDefinition();
    
    const outputDef = fromDef.outputs.find(o => o.id === fromOutput);
    const inputDef = toDef.inputs.find(i => i.id === toInput);
    
    if (!outputDef || !inputDef) {
      console.warn('Cannot connect: Invalid input/output handles');
      return false;
    }
    
    // Check type compatibility
    if (!this.isTypeCompatible(outputDef, inputDef)) {
      console.warn(`Type mismatch: Cannot connect ${outputDef.type} output to ${inputDef.type} input (accepts: ${inputDef.accepts?.join(', ') || inputDef.type})`);
      return false;
    }
    
    const connection: Connection = {
      from: fromNodeId,
      to: toNodeId,
      fromOutput,
      toInput
    };
    
    this.connections.push(connection);
    return true;
  }
  
  /**
   * Check if an output type can connect to an input type
   */
  private isTypeCompatible(output: TypedNodeIO, input: TypedNodeIO): boolean {
    // ANY type accepts everything
    if (input.type === NodeDataType.ANY) {
      return true;
    }
    
    // If input has explicit accepts list, check against it
    if (input.accepts && input.accepts.length > 0) {
      return input.accepts.includes(output.type);
    }
    
    // Otherwise, types must match exactly
    return output.type === input.type;
  }
  
  /**
   * Validate if a connection would be valid (without actually creating it)
   * Useful for UI to show invalid connections
   */
  validateConnection(fromNodeId: string, fromOutput: string, toNodeId: string, toInput: string): boolean {
    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);
    
    if (!fromNode || !toNode) return false;
    
    const fromDef = fromNode.getNodeDefinition();
    const toDef = toNode.getNodeDefinition();
    
    const outputDef = fromDef.outputs.find(o => o.id === fromOutput);
    const inputDef = toDef.inputs.find(i => i.id === toInput);
    
    if (!outputDef || !inputDef) return false;
    
    return this.isTypeCompatible(outputDef, inputDef);
  }

  disconnect(fromNodeId: string, toNodeId: string) {
    this.connections = this.connections.filter(
      conn => !(conn.from === fromNodeId && conn.to === toNodeId)
    );
  }

  /**
   * Enable or disable execution profiling
   */
  setProfilingEnabled(enabled: boolean) {
    this.enableProfiling = enabled;
  }

  async execute(): Promise<void> {
    if (this.isExecuting) {
      console.warn('Pipeline is already executing');
      return;
    }

    this.isExecuting = true;
    this.executionCount++;
    this.lastExecutionTime = performance.now();
    const profileData: ExecutionProfile[] = [];

    try {
      // Get execution order using topological sort
      const executionOrder = this.getExecutionOrder();
      
      // Execute nodes in order
      for (const nodeId of executionOrder) {
        const node = this.nodes.get(nodeId);
        if (node) {
          // Transfer data from connected nodes
          this.transferData(nodeId);
          
          // Execute the node with profiling
          const start = performance.now();
          await node.execute();
          const duration = performance.now() - start;
          
          if (this.enableProfiling) {
            const nodeType = node.getNodeDefinition().type;
            const redos = node.getAndResetRedoCount(); // Get and reset redo count
            profileData.push({ nodeId, nodeType, duration, redos });
            
            // Log slow nodes (>16ms = >1 frame at 60fps)
            if (duration > 16) {
              console.warn(`[Pipeline] Slow node: ${nodeId} (${nodeType}) took ${duration.toFixed(2)}ms`);
            }
          }
        }
      }

      // Log total execution time if profiling and significant
      if (this.enableProfiling && profileData.length > 0) {
        const totalTime = profileData.reduce((sum, p) => sum + p.duration, 0);
        if (totalTime > 16) {
          console.log(`[Pipeline] Execution: ${totalTime.toFixed(2)}ms (${profileData.length} nodes)`);
        }
        
        // Store profile data for UI with timestamp
        this.recentProfiles = profileData;
        this.profileHistory.push({
          profiles: profileData,
          timestamp: performance.now()
        });
        if (this.profileHistory.length > this.maxHistorySize) {
          this.profileHistory.shift();
        }
      }
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Get recent execution profiles for UI display
   */
  getRecentProfiles(): ExecutionProfile[] {
    return [...this.recentProfiles];
  }

  /**
   * Get execution count and timing info for FPS calculation
   */
  getExecutionStats(): { count: number; lastTime: number } {
    return {
      count: this.executionCount,
      lastTime: this.lastExecutionTime
    };
  }

  /**
   * Get aggregated node metrics from recent history
   * Returns redos per second (actual recalculations), not total calls
   */
  getNodeMetrics(): Map<string, { avgDuration: number; maxDuration: number; redosPerSecond: number }> {
    const now = performance.now();
    const oneSecondAgo = now - 1000;
    
    const metrics = new Map<string, { durations: number[]; redos: number[] }>();
    
    // Aggregate profiles from the last second only
    for (const historyEntry of this.profileHistory) {
      // Only count executions from the last second
      if (historyEntry.timestamp < oneSecondAgo) continue;
      
      for (const entry of historyEntry.profiles) {
        if (!metrics.has(entry.nodeId)) {
          metrics.set(entry.nodeId, { durations: [], redos: [] });
        }
        const metric = metrics.get(entry.nodeId)!;
        metric.durations.push(entry.duration);
        // Sum up redos from this execution
        for (let i = 0; i < entry.redos; i++) {
          metric.redos.push(historyEntry.timestamp);
        }
      }
    }
    
    // Calculate averages, maxes, and redos per second
    const result = new Map<string, { avgDuration: number; maxDuration: number; redosPerSecond: number }>();
    for (const [nodeId, metric] of metrics.entries()) {
      const avgDuration = metric.durations.length > 0
        ? metric.durations.reduce((sum, d) => sum + d, 0) / metric.durations.length
        : 0;
      const maxDuration = metric.durations.length > 0
        ? Math.max(...metric.durations)
        : 0;
      
      // Calculate redos per second from redo timestamps in the last second
      const redosPerSecond = metric.redos.length; // Already filtered to last second
      
      result.set(nodeId, { avgDuration, maxDuration, redosPerSecond });
    }
    
    return result;
  }

  private getExecutionOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string) => {
      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected involving node ${nodeId}`);
      }
      if (visited.has(nodeId)) return;

      visiting.add(nodeId);

      // Visit all nodes that this node depends on
      const dependencies = this.connections
        .filter(conn => conn.to === nodeId)
        .map(conn => conn.from);

      for (const dep of dependencies) {
        visit(dep);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    // Visit all nodes
    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  private transferData(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Find all connections that feed into this node
    const inputConnections = this.connections.filter(conn => conn.to === nodeId);

    for (const conn of inputConnections) {
      const sourceNode = this.nodes.get(conn.from);
      if (sourceNode) {
        const outputData = sourceNode.getOutput(conn.fromOutput);
        node.setInput(conn.toInput, outputData);
      }
    }
  }

  getNode(nodeId: string): BaseNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): BaseNode[] {
    return Array.from(this.nodes.values());
  }

  getConnections(): Connection[] {
    return [...this.connections];
  }

  clear() {
    // Cleanup all nodes before clearing (stops camera, closes MediaPipe, etc.)
    this.nodes.forEach(node => {
      node.cleanup();
    });
    
    this.nodes.clear();
    this.connections = [];
  }
}
