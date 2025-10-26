import { useCallback, useEffect, useRef, useState } from 'react';
import { CameraNode } from '../../nodes/CameraNode';
import { HandTrackingNode } from '../../nodes/HandTrackingNode';
import { OutputNode } from '../../nodes/OutputNode';
import { Video, Hand, Monitor, Trash2, FlipHorizontal } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onAddNode: (nodeType: string, position: { x: number; y: number }) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  nodeId?: string;
  edgeId?: string;
  hasOutputNode?: boolean;
  isOutputNode?: boolean;
}

const nodeTypes = [
  { type: 'camera', name: 'Camera', icon: Video },
  { type: 'handTracking', name: 'Hand Tracking', icon: Hand },
  { type: 'output', name: 'Output', icon: Monitor },
  { type: 'mirror', name: 'Mirror', icon: FlipHorizontal },
];

export default function ContextMenu({
  x,
  y,
  onClose,
  onAddNode,
  onDeleteNode,
  onDeleteEdge,
  nodeId,
  edgeId,
  hasOutputNode = false,
  isOutputNode = false,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleAddNode = (nodeType: string) => {
    onAddNode(nodeType, { x, y });
    onClose();
  };

  const handleDeleteNode = () => {
    if (nodeId && onDeleteNode) {
      onDeleteNode(nodeId);
      onClose();
    }
  };

  const handleDeleteEdge = () => {
    if (edgeId && onDeleteEdge) {
      onDeleteEdge(edgeId);
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        backgroundColor: '#2a2a2a',
        border: '1px solid #555',
        borderRadius: 8,
        padding: '8px 0',
        minWidth: 150,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
    >
      {nodeId && !isOutputNode && (
        <>
          <div
            style={{
              padding: '8px 16px',
              color: '#ff6b6b',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            onClick={handleDeleteNode}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3a3a3a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={14} className="inline mr-1" />
            Delete Node
          </div>
          <div
            style={{
              height: '1px',
              backgroundColor: '#555',
              margin: '4px 0',
            }}
          />
        </>
      )}

      {nodeId && isOutputNode && (
        <>
          <div
            style={{
              padding: '8px 16px',
              color: '#888',
              fontSize: '14px',
            }}
          >
            🔒 Output node cannot be deleted
          </div>
          <div
            style={{
              height: '1px',
              backgroundColor: '#555',
              margin: '4px 0',
            }}
          />
        </>
      )}

      {edgeId && (
        <>
          <div
            style={{
              padding: '8px 16px',
              color: '#ff6b6b',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            onClick={handleDeleteEdge}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#3a3a3a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Trash2 size={14} className="inline mr-1" />
            Delete Edge
          </div>
          <div
            style={{
              height: '1px',
              backgroundColor: '#555',
              margin: '4px 0',
            }}
          />
        </>
      )}

      <div
        style={{
          padding: '8px 16px',
          color: '#ccc',
          fontSize: '12px',
          fontWeight: 'bold',
        }}
      >
        Add Node:
      </div>

      {nodeTypes.map((nodeType) => {
        const isDisabled = nodeType.type === 'output' && hasOutputNode;
        if (nodeType.type === 'output') {
          return null;
        }
        return (
          <div
            key={nodeType.type}
            style={{
              padding: '8px 16px',
              color: isDisabled ? '#666' : 'white',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: isDisabled ? 0.5 : 1,
            }}
            onClick={isDisabled ? undefined : () => handleAddNode(nodeType.type)}
            onMouseEnter={(e) => {
              if (!isDisabled) {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <nodeType.icon size={16} />
            <span>{nodeType.name}</span>
            {isDisabled && <span style={{ fontSize: '12px', marginLeft: 'auto' }}>(Already exists)</span>}
          </div>
        );
      })}
    </div>
  );
}
