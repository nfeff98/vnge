import { Handle, Position } from '@xyflow/react';
import { BaseNode } from '../../core/BaseNode';
import { useState, useEffect, useRef } from 'react';
import { Settings, Loader2, Power, ChevronUp, ChevronDown } from 'lucide-react';


interface NodeComponentProps {
  data: {
    node: BaseNode | null;
    inputConnections?: number;
    outputConnections?: number;
  };
}

export default function NodeComponent({ data }: NodeComponentProps) {
  const { node, inputConnections = 0, outputConnections = 0 } = data;
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const parameterValuesRef = useRef<Record<string, any>>({});
  const [isEnabled, setIsEnabled] = useState(true);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const settingsOpenRef = useRef(settingsOpen);
  const nodeRef = useRef(node);

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

  // Continuously update display values when settings are open
  useEffect(() => {
    const updateDisplayValues = () => {
      if (settingsOpenRef.current && nodeRef.current) {
        // Force re-render to update input values in display
        setUpdateTrigger(prev => prev + 1);
      }
      // Keep looping regardless
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
  }, []); // Empty deps - only run once on mount

  const handleParameterChange = (key: string, value: any) => {
    setParameterValues(prev => ({ ...prev, [key]: value }));
    parameterValuesRef.current[key] = value;
    node?.setParameter(key, value);
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
  const inputsWithMatchingParams = nodeDefinition.inputs.filter(inputId => 
    visibleParameterKeys.includes(inputId)
  );
  const inputsWithoutMatchingParams = nodeDefinition.inputs.filter(inputId => 
    !visibleParameterKeys.includes(inputId)
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
      {!settingsOpen && nodeDefinition.inputs.map((inputId) => (
        <Handle
          key={`input-${inputId}`}
          type="target"
          position={Position.Left}
          id={inputId}
          style={{ 
            background: visualConfig.color,
            top: 30
          }}
        />
      ))}
      
      {/* Input handles for params - rendered inline with parameter fields */}
      {/* (These are handled within the parameter rendering loop below) */}
      
      {/* Output handles */}
      {nodeDefinition.outputs.map((outputId, index) => (
        <Handle
          key={`output-${outputId}`}
          type="source"
          position={Position.Right}
          id={outputId}
          style={{ 
            background: visualConfig.color,
            top: 30 + (index * 20)
          }}
        />
      ))}

<div className="absolute top-3 right-3 flex gap-2">
      {/* Settings button */}
      {Object.keys(nodeDefinition.parameters).length > 0 && (
        <button 
          onClick={handleToggleSettings} 
          className="text-gray-500 hover:text-gray-300 focus:outline-none focus:ring-0 transition-colors p-0"
        >
          <Settings size={16} />
        </button>
      )}
      
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

      {/* Labeled inputs (without matching parameters) - only when settings open */}
      {settingsOpen && inputsWithoutMatchingParams.length > 0 && (
        <div className="">
          {inputsWithoutMatchingParams.map((inputId) => (
            <div key={inputId} className="text-xs text-gray-400 relative text-left ">
              <Handle
                type="target"
                position={Position.Left}
                id={inputId}
                style={{ 
                  background: visualConfig.color,
                  top: '50%',
                  transform: 'translate(-15px, -50%)'
                }}
              />
              {inputId}
            </div>
          ))}
        </div>
      )}

      {settingsOpen && (

            <div className="space-y-3 mt-1">
              {Object.entries(nodeDefinition.parameters).map(([key, parameter]) => {
                const hasMatchingInput = inputsWithMatchingParams.includes(key);
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
    </div>
  );
}
