import type { ProjectData } from './projectSerializer';

// Type definitions for File System Access API
interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  types?: FilePickerAcceptType[];
  suggestedName?: string;
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[];
  multiple?: boolean;
}

declare global {
  interface Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  }
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * Save project using modern File System Access API
 */
export async function saveProjectModern(
  projectData: ProjectData,
  fileHandle?: FileSystemFileHandle
): Promise<FileSystemFileHandle> {
  const options: SaveFilePickerOptions = {
    types: [
      {
        description: 'Visual Node Graph Editor Project',
        accept: {
          'application/json': ['.vnge'],
        },
      },
    ],
    suggestedName: `${projectData.metadata.name}.vnge`,
  };

  // If we have a file handle, use it; otherwise show save picker
  const handle = fileHandle || await window.showSaveFilePicker(options);
  
  // Create a FileSystemWritableFileStream to write to
  const writable = await handle.createWritable();
  
  // Write the file
  const jsonString = JSON.stringify(projectData, null, 2);
  await writable.write(jsonString);
  
  // Close the file and write the contents to disk
  await writable.close();
  
  return handle;
}

/**
 * Save project using fallback download method
 */
export function saveProjectFallback(
  projectData: ProjectData,
  fileName?: string
): void {
  const jsonString = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `${projectData.metadata.name}.vnge`;
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Open project using modern File System Access API
 */
export async function openProjectModern(): Promise<{
  projectData: ProjectData;
  fileHandle: FileSystemFileHandle;
}> {
  const options: OpenFilePickerOptions = {
    types: [
      {
        description: 'Visual Node Graph Editor Project',
        accept: {
          'application/json': ['.vnge'],
        },
      },
    ],
    multiple: false,
  };

  const [fileHandle] = await window.showOpenFilePicker(options);
  const file = await fileHandle.getFile();
  const contents = await file.text();
  const projectData = JSON.parse(contents);

  return { projectData, fileHandle };
}

/**
 * Open project using fallback file input method
 */
export function openProjectFallback(): Promise<{
  projectData: ProjectData;
  fileName: string;
}> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.vnge';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const text = await file.text();
        const projectData = JSON.parse(text);
        resolve({ projectData, fileName: file.name });
      } catch (error) {
        reject(error);
      }
    };

    input.oncancel = () => {
      reject(new Error('File selection cancelled'));
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

/**
 * Unified save function that uses modern API with fallback
 */
export async function saveProject(
  projectData: ProjectData,
  fileHandle?: FileSystemFileHandle,
  fileName?: string
): Promise<FileSystemFileHandle | null> {
  try {
    if (isFileSystemAccessSupported() && !fileName) {
      // Use modern API (preferred)
      return await saveProjectModern(projectData, fileHandle);
    } else {
      // Use fallback download method
      saveProjectFallback(projectData, fileName);
      return null;
    }
  } catch (error) {
    // If user cancels, re-throw the error
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    
    // For other errors, fall back to download method
    console.warn('Failed to save with File System Access API, falling back to download', error);
    saveProjectFallback(projectData, fileName);
    return null;
  }
}

/**
 * Unified open function that uses modern API with fallback
 */
export async function openProject(): Promise<{
  projectData: ProjectData;
  fileHandle: FileSystemFileHandle | null;
  fileName: string;
}> {
  try {
    if (isFileSystemAccessSupported()) {
      // Use modern API (preferred)
      const result = await openProjectModern();
      return {
        projectData: result.projectData,
        fileHandle: result.fileHandle,
        fileName: result.fileHandle.name,
      };
    } else {
      // Use fallback file input method
      const result = await openProjectFallback();
      return {
        projectData: result.projectData,
        fileHandle: null,
        fileName: result.fileName,
      };
    }
  } catch (error) {
    // If user cancels, re-throw the error
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('cancelled'))) {
      throw error;
    }
    
    // For File System Access API errors, try fallback
    if (isFileSystemAccessSupported()) {
      console.warn('Failed to open with File System Access API, falling back to file input', error);
      const result = await openProjectFallback();
      return {
        projectData: result.projectData,
        fileHandle: null,
        fileName: result.fileName,
      };
    }
    
    throw error;
  }
}

