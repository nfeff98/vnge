import { Handle, Position } from '@xyflow/react';
import { BaseNode } from '../../core/BaseNode';
import { useState, useEffect, useRef } from 'react';
import { Settings, Loader2, Power } from 'lucide-react';


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

  const handleToggleSettings = () => {
    setSettingsOpen(!settingsOpen);
  };

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

  const handleParameterChange = (key: string, value: any) => {
    setParameterValues(prev => ({ ...prev, [key]: value }));
    parameterValuesRef.current[key] = value;
    node?.setParameter(key, value);
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

  const hideDisableToggle = nodeDefinition.type === 'output' || nodeDefinition.type === 'camera';

  const showIOLimits = false;
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
      
      {/* Input handles */}
      {nodeDefinition.inputs.map((inputId, index) => (
        <Handle
          key={`input-${inputId}`}
          type="target"
          position={Position.Left}
          id={inputId}
          style={{ 
            background: visualConfig.color,
            top: 30 + (index * 20)
          }}
        />
      ))}
      
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

      {/* Settings button */}
      {Object.keys(nodeDefinition.parameters).length > 0 && (
        <button 
          onClick={handleToggleSettings} 
          className="text-gray-500 hover:text-gray-300 absolute top-3 right-3 focus:outline-none focus:ring-0 transition-colors p-0"
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
        className={`absolute top-3 right-8 transition-colors p-0 focus:outline-none focus:ring-0 ${
          isEnabled 
            ? 'text-green-500 hover:text-green-400' 
            : 'text-red-500 hover:text-red-400'
        }`}
        title={isEnabled ? 'Disable node' : 'Enable node'}
      >
        <Power size={16} />
      </button>
      )}
      {settingsOpen && (

            <div className="space-y-3">
              {Object.entries(nodeDefinition.parameters).map(([key, parameter]) => (
                <div key={key} className="flex flex-col">
                  <label htmlFor={key} className="text-sm text-left font-book text-gray-400 mb-1">
                    {key}
                  </label>
                  {parameter.type === 'number' ? (
                    <input 
                      type="number"
                      id={key}
                      value={parameterValues[key] ?? parameter.value}
                      onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      step={parameter.step || 0.1}
                      min={parameter.min}
                      max={parameter.max}
                    />
                  ) : parameter.type === 'boolean' ? (
                    <input 
                      type="checkbox"
                      id={key}
                      checked={parameterValues[key] ?? parameter.value}
                      onChange={(e) => handleParameterChange(key, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  ) : parameter.type === 'enum' ? (
                    <select 
                      id={key}
                      value={parameterValues[key] ?? parameter.value}
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
                      value={parameterValues[key] ?? parameter.value}
                      onChange={(e) => handleParameterChange(key, JSON.parse(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <input 
                      type="text"
                      id={key}
                      value={parameterValues[key] ?? parameter.value}
                      onChange={(e) => handleParameterChange(key, e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
      )}
    </div>
  );
}
