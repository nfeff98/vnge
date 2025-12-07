import { Handle, Position } from '@xyflow/react';
import { BaseNode } from '../../core/BaseNode';
import { useState, useEffect, useRef } from 'react';
import { Settings, Loader2, Power, ChevronUp, ChevronDown, Upload, AlertCircle } from 'lucide-react';
import ColorPicker from '../ColorPicker';
import { ImageNode } from '../../nodes/ImageNode';
import WarpEditor from '../WarpEditor';
import { WarpNode } from '../../nodes/WarpNode';

interface NodeComponentProps {
  data: {
    node: BaseNode | null;
    inputConnections?: number;
    outputConnections?: number;
    onStartCalibration?: (warpNode: WarpNode) => void;
  };
}


interface NodeComponentProps {
  data: {
    node: BaseNode | null;
    inputConnections?: number;
    outputConnections?: number;
    onStartCalibration?: (warpNode: WarpNode) => void;
  };
}

export default function NodeComponent({ data }: NodeComponentProps) {
  const { node, inputConnections = 0, outputConnections = 0, onStartCalibration } = data;
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const parameterValuesRef = useRef<Record<string, any>>({});
  const [isEnabled, setIsEnabled] = useState(true);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const settingsOpenRef = useRef(settingsOpen);
  const nodeRef = useRef(node);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previousValuesRef = useRef<Record<string, any>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [warpEditorOpen, setWarpEditorOpen] = useState(false);

  const handleToggleSettings = () => {
    setSettingsOpen(!settingsOpen);
  };

  // Keep refs in sync
  useEffect(() => {
    settingsOpenRef.current = settingsOpen;
  }, [settingsOpen]);

  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  // Initialize parameters and enabled state when node changes
  useEffect(() => {
    if (node) {
      const initialParams: Record<string, any> = {};
      Object.entries(node.getNodeDefinition().parameters).forEach(([key, param]) => {
        initialParams[key] = param.value;
        parameterValuesRef.current[key] = param.value;
      });
      setParameterValues(initialParams);
      setIsEnabled(node.isEnabled());
    }
  }, [node?.id]); // Only when node ID changes

  // Sync with node's actual state
  useEffect(() => {
    if (node) {
      const nodeParams = node.getAllParameters();
      const hasChanged = Object.keys(nodeParams).some(
        key => nodeParams[key] !== parameterValuesRef.current[key]
      );
      
      if (hasChanged) {
        setParameterValues(nodeParams);
        parameterValuesRef.current = nodeParams;
      }
    }
  }, [node]);

  // Continuously update display values when settings are open (throttled)
  useEffect(() => {
    if (!settingsOpen) {
      // Stop loop when settings are closed
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    let lastUpdateTime = 0;
    const updateInterval = 100; // Update at most 10 times per second (10 FPS)

    const updateDisplayValues = (currentTime: number) => {
      // Throttle updates
      if (currentTime - lastUpdateTime < updateInterval) {
        animationFrameRef.current = requestAnimationFrame(updateDisplayValues);
        return;
      }

      if (settingsOpenRef.current && nodeRef.current) {
        const currentNode = nodeRef.current;
        
        // Check if input values actually changed
        let hasChanges = false;
        const nodeDefinition = currentNode.getNodeDefinition();
        
        for (const input of nodeDefinition.inputs) {
          const currentValue = currentNode.getInput(input.id);
          const previousValue = previousValuesRef.current[input.id];
          
          if (currentValue !== previousValue) {
            hasChanges = true;
            previousValuesRef.current[input.id] = currentValue;
          }
        }

        // Only trigger re-render if values changed
        if (hasChanges) {
          setUpdateTrigger(prev => prev + 1);
        }
      }
      
      lastUpdateTime = currentTime;
      animationFrameRef.current = requestAnimationFrame(updateDisplayValues);
    };

    // Start the loop
    animationFrameRef.current = requestAnimationFrame(updateDisplayValues);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [settingsOpen]); // Re-run when settings open/close

  const handleParameterChange = (key: string, value: any) => {
    setParameterValues(prev => ({ ...prev, [key]: value }));
    parameterValuesRef.current[key] = value;
    node?.setParameter(key, value);
  };

  // Handle file upload for ImageNode
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !(node instanceof ImageNode)) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setIsUploading(true);
    try {
      await node.setImageFile(file);
      // Trigger update to refresh display
      setUpdateTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to load image:', error);
      alert('Failed to load image. Please try again.');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Helper to get display value - prioritize input over parameter
  const getDisplayValue = (key: string, parameter: any) => {
    // Reference updateTrigger to ensure re-render when it changes
    void updateTrigger;
    const inputValue = node?.getInput(key);
    if (inputValue !== null && inputValue !== undefined) {
      return inputValue;
    }
    return parameterValues[key] ?? parameter.value;
  };

  // Handle null node (loading state)
  if (!node) {
    return (
      <div className="bg-gray-900 border-2 border-gray-600 rounded-lg p-2.5 text-white">
        <div className="mb-2.5 font-bold flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  const { visualConfig } = node;
  const nodeDefinition = node.getNodeDefinition();

  const hideDisableToggle = nodeDefinition.type === 'output';

  const showIOLimits = false;

  // Categorize inputs based on whether they have matching parameters
  const visibleParameterKeys = Object.keys(nodeDefinition.parameters);
  const inputsWithMatchingParams = nodeDefinition.inputs.filter(input => 
    visibleParameterKeys.includes(input.id)
  );
  const inputsWithoutMatchingParams = nodeDefinition.inputs.filter(input => 
    !visibleParameterKeys.includes(input.id)
  );
  return (
    <div 
      className="rounded-lg p-2.5 text-white border-2"
      style={{
        background: visualConfig.backgroundColor,
        borderColor: visualConfig.borderColor,
      }}
    >
      <div className="mb-2.5 font-bold flex gap-2 text-white w-1/2 text-left">
        <visualConfig.icon size={16} className="text-white min-w-4 min-h-4" />
        <span className="text-white text-xs font-medium">{visualConfig.name}</span>
      </div>
      
      {/* Show input/output limits */}
      {showIOLimits && <div className={`text-xs mb-1 ${
        inputConnections < nodeDefinition.maxInputs && outputConnections < nodeDefinition.maxOutputs 
          ? 'text-gray-500' 
          : 'text-red-500'
      }`}>
        I/O: {inputConnections}/{nodeDefinition.maxInputs} → {outputConnections}/{nodeDefinition.maxOutputs}
        {(inputConnections >= nodeDefinition.maxInputs || outputConnections >= nodeDefinition.maxOutputs) && ' (FULL)'}
      </div>}
      
      {/* Input handles - when settings CLOSED, stack all at same position */}
      {!settingsOpen && nodeDefinition.inputs.map((input) => (
        <Handle
          key={`input-${input.id}`}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{ 
            background: visualConfig.color,
            top: 30
          }}
        />
      ))}
      
      {/* Input handles for params - rendered inline with parameter fields */}
      {/* (These are handled within the parameter rendering loop below) */}
      
      {/* Output handles - when settings CLOSED, stack all at same position */}
      {!settingsOpen && nodeDefinition.outputs.map((output) => (
        <Handle
          key={`output-${output.id}`}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{ 
            background: visualConfig.color,
            top: 30
          }}
        />
      ))}

<div className="absolute top-3 right-3 flex gap-2">
      {/* Expand/Settings button - always show to display I/O labels */}
      <button 
        onClick={handleToggleSettings} 
        className="text-gray-500 hover:text-gray-300 focus:outline-none focus:ring-0 transition-colors p-0"
        title={settingsOpen ? 'Collapse' : 'Expand'}
      >
        <Settings size={16} />
      </button>
      
      {/* Enable/Disable toggle */}
      {!hideDisableToggle && (
        <button 
        onClick={() => {
          const newEnabled = !isEnabled;
          setIsEnabled(newEnabled);
          node?.setEnabled(newEnabled);
        }}
        className={`transition-colors p-0 focus:outline-none focus:ring-0 ${
          isEnabled 
            ? 'text-green-500 hover:text-green-400' 
            : 'text-red-500 hover:text-red-400'
        }`}
        title={isEnabled ? 'Disable node' : 'Enable node'}
      >
        <Power size={16} />
      </button>
      )}
      </div>

      {/* Labeled inputs and outputs - side by side when settings open */}
      {settingsOpen && (inputsWithoutMatchingParams.length > 0 || nodeDefinition.outputs.length > 0) && (
        <div className="flex justify-between mb-3">
          {/* Labeled inputs (without matching parameters) */}
          <div className="flex-1">
            {inputsWithoutMatchingParams.map((input) => {
              const inputValue = node?.getInput(input.id);
              const isColorInput = input.type === 'color';
              
              return (
                <div key={input.id} className="text-xs text-gray-400 relative text-left mb-1">
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={input.id}
                    style={{ 
                      background: visualConfig.color,
                      top: '50%',
                      transform: 'translate(-15px, -50%)'
                    }}
                  />
                  {isColorInput && inputValue ? (
                    <div className="flex items-center gap-2">
                      <span>{input.id}</span>
                      <div 
                        className="w-6 h-6 rounded border-2 border-gray-600"
                        style={{ 
                          backgroundColor: `rgba(${(inputValue as any).r}, ${(inputValue as any).g}, ${(inputValue as any).b}, ${(inputValue as any).a})` 
                        }}
                        title="Color from input"
                      />
                    </div>
                  ) : (
                    input.id
                  )}
                </div>
              );
            })}
          </div>

          {/* Labeled outputs */}
          <div className="flex-1">
            {nodeDefinition.outputs.map((output) => (
              <div key={output.id} className="text-xs text-gray-400 relative text-right mb-1">
                <Handle
                  type="source"
                  position={Position.Right}
                  id={output.id}
                  style={{ 
                    background: visualConfig.color,
                    top: '50%',
                    transform: 'translate(15px, -50%)'
                  }}
                />
                {output.id}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Image upload UI for ImageNode */}
      {settingsOpen && node instanceof ImageNode && (
        <div className="mb-3 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {node.needsImageReupload() && (
            <div className="flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-600 rounded text-xs text-yellow-200">
              <AlertCircle size={14} />
              <span>
                Source media needs to be re-uploaded after loading project
                {node.getSavedFileName() && (
                  <span className="block mt-1 font-mono text-yellow-300">
                    ({node.getSavedFileName()})
                  </span>
                )}
              </span>
            </div>
          )}

          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 rounded text-sm text-white transition-colors"
          >
            {isUploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>{node.getImageFile() ? 'Change Image' : 'Upload Image'}</span>
              </>
            )}
          </button>

          {node.getImageFile() && (
            <div className="text-xs text-gray-400">
              <div>File: {node.getImageFile()!.name}</div>
              <div>Size: {(node.getImageFile()!.size / 1024).toFixed(2)} KB</div>
            </div>
          )}
        </div>
      )}

      {settingsOpen && nodeDefinition.type === 'warp' && (
        <div className="mt-2 mb-3 space-y-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onStartCalibration && node instanceof WarpNode) {
                onStartCalibration(node);
              }
            }}
            className="w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm font-medium transition-colors nodrag"
          >
            Quick Calibrate
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setWarpEditorOpen(true);
            }}
            className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors nodrag"
          >
            Edit Warp
          </button>
        </div>
      )}

      {settingsOpen && (() => {
        // For ImageNode, don't show parameters section at all (only file picker)
        if (node instanceof ImageNode) {
          return false;
        }
        // For other nodes, check if there are any parameters
        return Object.keys(nodeDefinition.parameters).length > 0;
      })() && (
            <div className="space-y-3 mt-1">
              {Object.entries(nodeDefinition.parameters).map(([key, parameter]) => {
                // Skip internal metadata parameters for ImageNode (shouldn't reach here for ImageNode, but keep for safety)
                if (node instanceof ImageNode && key.startsWith('_')) {
                  return null;
                }
                
                const hasMatchingInput = inputsWithMatchingParams.some(input => input.id === key);
                return (
                <div key={key} className="flex flex-col relative">
                  {/* Inline input handle for this parameter */}
                  {hasMatchingInput && (
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={key}
                      style={{ 
                        background: visualConfig.color,
                        top: '50%',
                        transform: 'translate(-16px, 8px)'
                      }}
                    />
                  )}
                  <label htmlFor={key} className="text-sm text-left font-book text-gray-400 mb-1">
                    {key}
                  </label>
                  {parameter.type === 'number' ? (
                    <div className="flex gap-1 max-w-full">
                      <input 
                        type="text"
                        id={key}
                        value={getDisplayValue(key, parameter)}
                        onChange={(e) => handleParameterChange(key, parseFloat(e.target.value) || 0)}
                        className="w-[calc(100%-1rem)] px-2 py-1 h-7 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => {
                            const currentValue = getDisplayValue(key, parameter);
                            const step = parameter.step || 0.1;
                            const newValue = Math.min((parameter.max ?? Infinity), currentValue + step);
                            handleParameterChange(key, parseFloat(newValue.toFixed(10)));
                          }}
                          className="px-1 py-0 border border-gray-300 rounded-b text-xs hover:border-[#666] focus:outline-none"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const currentValue = getDisplayValue(key, parameter);
                            const step = parameter.step || 0.1;
                            const newValue = Math.max((parameter.min ?? -Infinity), currentValue - step);
                            handleParameterChange(key, parseFloat(newValue.toFixed(10)));
                          }}
                          className="px-1 py-0 border border-gray-300 rounded-t text-xs hover:border-[#666] focus:outline-none"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </div>
                  ) : parameter.type === 'boolean' ? (
                    <input 
                      type="checkbox"
                      id={key}
                      checked={getDisplayValue(key, parameter)}
                      onChange={(e) => handleParameterChange(key, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  ) : parameter.type === 'enum' ? (
                    <select 
                      id={key}
                      value={getDisplayValue(key, parameter)}
                      onChange={(e) => handleParameterChange(key, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {parameter.options?.map((option: string) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : parameter.type === 'color' ? (
                    <ColorPicker
                      color={getDisplayValue(key, parameter)}
                      onChange={(color) => handleParameterChange(key, color)}
                      disabled={hasMatchingInput && node?.getInput(key) !== null}
                    />
                  ) : parameter.type === 'array' ? (
                    <input 
                      type="text"
                      id={key}
                      value={getDisplayValue(key, parameter)}
                      onChange={(e) => handleParameterChange(key, JSON.parse(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <input 
                      type="text"
                      id={key}
                      value={getDisplayValue(key, parameter)}
                      onChange={(e) => handleParameterChange(key, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
                );
              })}
            </div>
      )}

      {/* Warp Editor Modal */}
      {warpEditorOpen && nodeDefinition.type === 'warp' && node instanceof WarpNode && (
        <WarpEditor
          warpNode={node as WarpNode}
          onClose={() => setWarpEditorOpen(false)}
          onUpdate={() => {
            // Trigger parameter update to refresh display
            setUpdateTrigger(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
}
