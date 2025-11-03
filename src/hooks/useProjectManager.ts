import { useState, useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { PipelineEngine } from '../core/PipelineEngine';
import {
  serializePipeline,
  deserializePipeline,
  validateProjectData,
  type ProjectData,
} from '../utils/projectSerializer';
import { saveProject, openProject } from '../utils/fileOperations';

export interface ProjectState {
  fileName: string | null;
  fileHandle: FileSystemFileHandle | null;
  isDirty: boolean;
}

export interface UseProjectManagerProps {
  pipeline: PipelineEngine;
  nodes: Node[];
  edges: Edge[];
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onProjectLoaded: (nodes: Node[], edges: Edge[], pipelineNodes: any[]) => void;
}

export function useProjectManager({
  pipeline,
  nodes,
  edges,
  canvasRef,
  onProjectLoaded,
}: UseProjectManagerProps) {
  const [projectState, setProjectState] = useState<ProjectState>({
    fileName: null,
    fileHandle: null,
    isDirty: false,
  });

  // Track last saved state to detect changes
  const lastSavedState = useRef<string | null>(null);

  /**
   * Mark project as dirty (has unsaved changes)
   */
  const markDirty = useCallback(() => {
    setProjectState(prev => ({ ...prev, isDirty: true }));
  }, []);

  /**
   * Mark project as clean (saved)
   */
  const markClean = useCallback(() => {
    setProjectState(prev => ({ ...prev, isDirty: false }));
    // Store simplified version for dirty checking (just IDs and positions)
    lastSavedState.current = JSON.stringify({
      nodes: nodes.map(n => ({ id: n.id, position: n.position })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target }))
    });
  }, [nodes, edges]);

  /**
   * Save project (uses existing file if available, otherwise prompts for location)
   */
  const save = useCallback(async (): Promise<boolean> => {
    try {
      const projectData = serializePipeline(
        nodes,
        edges,
        pipeline,
        projectState.fileName || 'Untitled Project'
      );

      const fileHandle = await saveProject(
        projectData,
        projectState.fileHandle || undefined,
        projectState.fileName || undefined
      );

      // Update state with file info
      if (fileHandle) {
        setProjectState(prev => ({
          ...prev,
          fileHandle,
          fileName: fileHandle.name,
          isDirty: false,
        }));
      } else {
        // Fallback method used, just mark as clean
        markClean();
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled
        return false;
      }
      console.error('Failed to save project:', error);
      throw error;
    }
  }, [nodes, edges, pipeline, projectState, markClean]);

  /**
   * Save As (always prompts for new location)
   */
  const saveAs = useCallback(async (): Promise<boolean> => {
    try {
      const projectData = serializePipeline(
        nodes,
        edges,
        pipeline,
        projectState.fileName || 'Untitled Project'
      );

      // Pass undefined for fileHandle to force "Save As" dialog
      const fileHandle = await saveProject(projectData, undefined);

      // Update state with file info
      if (fileHandle) {
        setProjectState(prev => ({
          ...prev,
          fileHandle,
          fileName: fileHandle.name,
          projectName: fileHandle.name.replace('.vnge', ''),
          isDirty: false,
        }));
      } else {
        // Fallback method used, just mark as clean
        markClean();
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled
        return false;
      }
      console.error('Failed to save project:', error);
      throw error;
    }
  }, [nodes, edges, pipeline, projectState.fileName, markClean]);

  /**
   * Open project from file
   */
  const open = useCallback(async (): Promise<boolean> => {
    // Check for unsaved changes
    if (projectState.isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Do you want to continue without saving?'
      );
      if (!confirmed) {
        return false;
      }
    }

    try {
      const { projectData, fileHandle, fileName } = await openProject();

      // Validate project data
      if (!validateProjectData(projectData)) {
        throw new Error('Invalid project file format');
      }

      // Deserialize and load project
      const { nodes: newNodes, edges: newEdges, pipelineNodes } = deserializePipeline(
        projectData,
        canvasRef.current
      );

      // Notify parent component to update state
      onProjectLoaded(newNodes, newEdges, pipelineNodes);

      // Update project state
      setProjectState({
        fileHandle,
        fileName: fileName,
        isDirty: false,
      });

      // Store simplified version for dirty checking (just IDs and positions)
      lastSavedState.current = JSON.stringify({
        nodes: newNodes.map(n => ({ id: n.id, position: n.position })),
        edges: newEdges.map(e => ({ id: e.id, source: e.source, target: e.target }))
      });

      return true;
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('cancelled'))) {
        // User cancelled
        return false;
      }
      
      // Extract just the error message to avoid circular reference issues
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to open project:', errorMessage);
      alert('Failed to open project: ' + errorMessage);
      return false;
    }
  }, [projectState.isDirty, canvasRef, onProjectLoaded]);

  /**
   * Create new project
   */
  const newProject = useCallback((): boolean => {
    // Check for unsaved changes
    if (projectState.isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Do you want to continue without saving?'
      );
      if (!confirmed) {
        return false;
      }
    }

    // Reset project state
    setProjectState({
      fileName: null,
      fileHandle: null,
      isDirty: false,
    });

    lastSavedState.current = null;

    // Notify parent to reset the pipeline
    onProjectLoaded([], [], []);

    return true;
  }, [projectState.isDirty, onProjectLoaded]);


  /**
   * Check if project needs to be saved
   */
  const needsSave = useCallback((): boolean => {
    if (!projectState.fileHandle && !projectState.fileName) {
      // Never saved before, trigger "Save As"
      return true;
    }
    return false;
  }, [projectState]);

  return {
    projectState,
    save,
    saveAs,
    open,
    newProject,
    markDirty,
    markClean,
    needsSave,
  };
}

