import { useEffect, useRef, useState } from 'react';
import { ControlledMenu, MenuItem, SubMenu } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/slide.css';
import './ContextMenu.css';
import { Video, Hand, Monitor, Trash2, FlipHorizontal, Grid3x3, Palette, Cloud, Layers, Droplet, Clock, Calculator, Droplets, ImageDown, Move, ScanFace, MapPin, Wand2, Image, Wrench, ChevronRight } from 'lucide-react';

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

const nodeCategories = [
  {
    name: 'Sources',
    icon: Image,
    nodes: [
      { type: 'camera', name: 'Camera', icon: Video },
      { type: 'image', name: 'Image', icon: Image },
      { type: 'color', name: 'Color', icon: Palette },
      { type: 'gradient', name: 'Gradient', icon: Droplets },
      { type: 'noise', name: 'Noise', icon: Cloud },
      { type: 'time', name: 'Time', icon: Clock },
    ]
  },
  {
    name: 'MediaPipe',
    icon: Hand,
    nodes: [
      { type: 'mediapipe', name: 'MediaPipe', icon: Hand },
      { type: 'handCenter', name: 'Hand Center', icon: Hand },
      { type: 'headPose', name: 'Head Pose', icon: ScanFace },
      { type: 'landmarkExtractor', name: 'Landmark Extractor', icon: MapPin },
    ]
  },
  {
    name: 'Effects',
    icon: Wand2,
    nodes: [
      { type: 'mirror', name: 'Mirror', icon: FlipHorizontal },
      { type: 'tileAndOffset', name: 'Tile & Offset', icon: Grid3x3 },
      { type: 'displacement', name: 'Displacement', icon: Move },
      { type: 'warp', name: 'Warp', icon: Grid3x3 },
      { type: 'trail', name: 'Trail', icon: Wand2 },
    ]
  },
  {
    name: 'Compositing',
    icon: Layers,
    nodes: [
      { type: 'composite', name: 'Composite', icon: Layers },
      { type: 'opacity', name: 'Opacity', icon: Droplet },
    ]
  },
  {
    name: 'Math & Data',
    icon: Calculator,
    nodes: [
      { type: 'math', name: 'Math', icon: Calculator },
      { type: 'arrayOperations', name: 'Array Operations', icon: Calculator },
      { type: 'vec3Split', name: 'Vec3 Split', icon: Calculator },
    ]
  },
  {
    name: 'Utilities',
    icon: Wrench,
    nodes: [
      { type: 'textureToCanvas', name: 'Texture to Canvas', icon: ImageDown },
      { type: 'vec3ToColor', name: 'Vec3 to Color', icon: Palette },
    ]
  },
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
  const [isOpen, setIsOpen] = useState(true);

  const handleAddNode = (nodeType: string) => {
    onAddNode(nodeType, { x, y });
    setIsOpen(false);
    onClose();
  };

  const handleDeleteNode = () => {
    if (nodeId && onDeleteNode) {
      onDeleteNode(nodeId);
      setIsOpen(false);
      onClose();
    }
  };

  const handleDeleteEdge = () => {
    if (edgeId && onDeleteEdge) {
      onDeleteEdge(edgeId);
      setIsOpen(false);
      onClose();
    }
  };

  return (
    <ControlledMenu
      state={isOpen ? 'open' : 'closed'}
      anchorPoint={{ x, y }}
      onClose={() => {
        setIsOpen(false);
        onClose();
      }}
      menuClassName="context-menu"
      menuStyle={{
        backgroundColor: '#2a2a2a',
        border: '1px solid #555',
        borderRadius: '8px',
        padding: '8px 0',
        minWidth: '180px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
      transition
    >
      {/* Delete Node/Edge Options */}
      {nodeId && !isOutputNode && (
        <>
          <MenuItem
            onClick={handleDeleteNode}
            style={{
              padding: '8px 16px',
              color: '#ff6b6b',
              fontSize: '14px',
            }}
          >
            <Trash2 size={14} style={{ marginRight: '8px', display: 'inline' }} />
            Delete Node
          </MenuItem>
          <div style={{ height: '1px', backgroundColor: '#555', margin: '4px 0' }} />
        </>
      )}

      {nodeId && isOutputNode && (
        <>
          <MenuItem
            disabled
            style={{
              padding: '8px 16px',
              color: '#888',
              fontSize: '14px',
            }}
          >
            🔒 Output node cannot be deleted
          </MenuItem>
          <div style={{ height: '1px', backgroundColor: '#555', margin: '4px 0' }} />
        </>
      )}

      {edgeId && (
        <>
          <MenuItem
            onClick={handleDeleteEdge}
            style={{
              padding: '8px 16px',
              color: '#ff6b6b',
              fontSize: '14px',
            }}
          >
            <Trash2 size={14} style={{ marginRight: '8px', display: 'inline' }} />
            Delete Edge
          </MenuItem>
          <div style={{ height: '1px', backgroundColor: '#555', margin: '4px 0' }} />
        </>
      )}

      {/* Add Node Categories */}
      <div style={{ padding: '8px 16px', color: '#ccc', fontSize: '12px', fontWeight: 'bold' }}>
        Add Node:
      </div>

      {nodeCategories.map((category) => (
        <SubMenu
          key={category.name}
          label={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <category.icon size={16} />
              <span>{category.name}</span>
            </div>
          }
          menuStyle={{
            backgroundColor: '#2a2a2a',
            border: '1px solid #555',
            borderRadius: '8px',
            padding: '4px 0',
            minWidth: '180px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          {category.nodes.map((node) => (
            <MenuItem
              key={node.type}
              onClick={() => handleAddNode(node.type)}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
              }}
            >
              <node.icon size={16} style={{ marginRight: '8px', display: 'inline' }} />
              {node.name}
            </MenuItem>
          ))}
        </SubMenu>
      ))}
    </ControlledMenu>
  );
}
