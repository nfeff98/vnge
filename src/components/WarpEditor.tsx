import { useState, useEffect, useRef, useCallback } from 'react';
import { X, RotateCcw, Grid, ZoomIn, ZoomOut, Maximize2, Hand } from 'lucide-react';
import { WarpNode } from '../nodes/WarpNode';
import { type Point2D } from '../utils/homography';

interface WarpEditorProps {
  warpNode: WarpNode;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function WarpEditor({ warpNode, onClose, onUpdate }: WarpEditorProps) {
  const [corners, setCorners] = useState<Point2D[]>(warpNode.getCorners());
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedHandle, setSelectedHandle] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inputImage, setInputImage] = useState<HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });

  // Get input image from warp node
  useEffect(() => {
    const updateInputImage = () => {
      const input = warpNode.getInput('image');
      if (input) {
        if (input instanceof HTMLCanvasElement || input instanceof HTMLVideoElement) {
          setInputImage(input);
          if (input instanceof HTMLCanvasElement) {
            setImageSize({ width: input.width, height: input.height });
          } else {
            setImageSize({ width: input.videoWidth || 640, height: input.videoHeight || 480 });
          }
        } else if ((input as any).__width) {
          // WebGLTexture - convert to canvas for display
          const texture = input as any;
          const gl = texture.__gl as WebGLRenderingContext;
          const width = texture.__width || 640;
          const height = texture.__height || 480;
          setImageSize({ width, height });
          
          // Convert texture to canvas (one-time conversion)
          try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(
              gl.FRAMEBUFFER,
              gl.COLOR_ATTACHMENT0,
              gl.TEXTURE_2D,
              input,
              0
            );
            
            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
              const pixels = new Uint8Array(width * height * 4);
              gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const imageData = ctx.createImageData(width, height);
                imageData.data.set(pixels);
                ctx.putImageData(imageData, 0, 0);
                setInputImage(canvas);
              }
            }
            
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(framebuffer);
          } catch (e) {
            console.warn('Failed to convert texture to canvas:', e);
            setInputImage(null);
          }
        }
      } else {
        setInputImage(null);
      }
    };

    updateInputImage();
    // Update periodically if it's a video (but not for textures)
    const input = warpNode.getInput('image');
    const isVideo = input instanceof HTMLVideoElement;
    const interval = isVideo ? setInterval(updateInputImage, 100) : null;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [warpNode]);

  // Sync corners with node
  useEffect(() => {
    setCorners(warpNode.getCorners());
  }, [warpNode]);

  // Reset panning state when pan mode is toggled off
  useEffect(() => {
    if (!panMode) {
      setIsPanning(false);
      setIsDragging(null);
    }
  }, [panMode]);

  // Handle arrow key movement for selected handle
  useEffect(() => {
    if (selectedHandle === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
      }

      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const step = e.shiftKey ? 0.1 : 0.01; // Larger steps with Shift
      const newCorners = [...corners];
      const corner = newCorners[selectedHandle];

      switch (e.key) {
        case 'ArrowUp':
          corner.y = Math.max(-2, corner.y - step);
          break;
        case 'ArrowDown':
          corner.y = Math.min(3, corner.y + step);
          break;
        case 'ArrowLeft':
          corner.x = Math.max(-2, corner.x - step);
          break;
        case 'ArrowRight':
          corner.x = Math.min(3, corner.x + step);
          break;
      }
      
      // Round to 4 decimal places for precision
      corner.x = Math.round(corner.x * 10000) / 10000;
      corner.y = Math.round(corner.y * 10000) / 10000;

      setCorners(newCorners);
      warpNode.setCorners(newCorners);
      if (onUpdate) onUpdate();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedHandle, corners, warpNode, onUpdate]);

  // Draw preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan transform
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw image bounds indicator (0-1 area)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.setLineDash([]);

    if (inputImage) {
      // Draw input image
      try {
        ctx.drawImage(inputImage, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        // If drawing fails (e.g., video not ready), just show background
        console.warn('Failed to draw input image:', e);
      }
    } else {
      // Show placeholder
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#666';
      ctx.font = `${16 / zoom}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('No input image', canvas.width / 2, canvas.height / 2);
    }

    // Draw grid if enabled
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1 / zoom;
      const gridSize = 20;
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Draw quad outline
    ctx.strokeStyle = '#9C27B0';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    const cornerPositions = corners.map(corner => ({
      x: corner.x * canvas.width,
      y: corner.y * canvas.height
    }));
    ctx.moveTo(cornerPositions[0].x, cornerPositions[0].y);
    ctx.lineTo(cornerPositions[1].x, cornerPositions[1].y);
    ctx.lineTo(cornerPositions[2].x, cornerPositions[2].y);
    ctx.lineTo(cornerPositions[3].x, cornerPositions[3].y);
    ctx.closePath();
    ctx.stroke();

    // Draw corner handles
    const handleRadius = 8 / zoom;
    cornerPositions.forEach((pos, index) => {
      // Check if corner is outside image bounds (0-1)
      const isOutside = corners[index].x < 0 || corners[index].x > 1 || 
                        corners[index].y < 0 || corners[index].y > 1;
      
      ctx.fillStyle = isDragging === index ? '#E91E63' : (isOutside ? '#FF9800' : '#9C27B0');
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, handleRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 / zoom;
      ctx.stroke();
      
      // Draw indicator line if outside bounds
      if (isOutside) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 1 / zoom;
        ctx.setLineDash([3 / zoom, 3 / zoom]);
        // Draw line from corner to nearest image boundary
        const nearestX = corners[index].x < 0 ? 0 : (corners[index].x > 1 ? canvas.width : pos.x);
        const nearestY = corners[index].y < 0 ? 0 : (corners[index].y > 1 ? canvas.height : pos.y);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(nearestX, nearestY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    ctx.restore();
  }, [corners, inputImage, showGrid, isDragging, canvasSize, zoom, pan]);

  // Convert screen coordinates to normalized UV coordinates
  // Account for zoom and pan
  const screenToUV = useCallback((screenX: number, screenY: number): Point2D => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const localX = screenX - rect.left;
    const localY = screenY - rect.top;
    
    // Convert screen coordinates to canvas coordinates accounting for zoom and pan
    // First subtract pan, then divide by zoom to get canvas coordinates
    const canvasX = (localX - pan.x) / zoom;
    const canvasY = (localY - pan.y) / zoom;
    
    // Convert canvas coordinates to UV (normalized 0-1)
    const uvX = canvasX / canvas.width;
    const uvY = canvasY / canvas.height;
    
    // No clamping - allow values outside 0-1 for projection mapping
    return { x: uvX, y: uvY };
  }, [zoom, pan]);

  // Handle mouse down on canvas
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    // If pan mode is enabled, start panning
    if (panMode) {
      setIsPanning(true);
      setPanStart({ x: localX - pan.x, y: localY - pan.y });
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Account for zoom and pan when checking handle positions
    // Increase handle radius and scale with zoom for easier grabbing
    const handleRadius = Math.max(15, 15 / zoom); // Minimum 15px, scales with zoom
    
    // Get current corners (might have been updated)
    const currentCorners = warpNode.getCorners();
    
    // Check handles in reverse order (so overlapping handles prioritize the one on top)
    for (let i = currentCorners.length - 1; i >= 0; i--) {
      // Convert corner UV to screen coordinates accounting for zoom/pan
      // Canvas position: corner.x * canvas.width, corner.y * canvas.height
      // Screen position after transform: (canvasX * zoom) + pan.x
      const canvasX = currentCorners[i].x * canvas.width;
      const canvasY = currentCorners[i].y * canvas.height;
      const cornerScreenX = canvasX * zoom + pan.x;
      const cornerScreenY = canvasY * zoom + pan.y;
      
      const dist = Math.sqrt(
        Math.pow(localX - cornerScreenX, 2) + Math.pow(localY - cornerScreenY, 2)
      );
      
      if (dist < handleRadius) {
        setIsDragging(i);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }, [zoom, pan, warpNode, panMode]);

  // Handle mouse move for dragging and panning
  useEffect(() => {
    if (isDragging === null && !isPanning) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // If pan mode was disabled while panning, stop
      if (isPanning && !panMode) {
        setIsPanning(false);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      if (isPanning && panMode) {
        // Pan the view
        setPan({
          x: localX - panStart.x,
          y: localY - panStart.y
        });
      } else if (isDragging !== null && !panMode) {
        // Drag corner handle (only if not in pan mode)
        const newUV = screenToUV(e.clientX, e.clientY);
        const newCorners = [...corners];
        newCorners[isDragging] = newUV;
        setCorners(newCorners);

        // Update node parameters
        warpNode.setCorners(newCorners);
        if (onUpdate) onUpdate();
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isPanning, corners, warpNode, screenToUV, onUpdate, panStart, panMode]);

  // Handle reset
  const handleReset = useCallback(() => {
    const defaultCorners: Point2D[] = [
      { x: 0, y: 0 },  // top-left
      { x: 1, y: 0 },  // top-right
      { x: 1, y: 1 },  // bottom-right
      { x: 0, y: 1 }   // bottom-left
    ];
    setCorners(defaultCorners);
    warpNode.setCorners(defaultCorners);
    if (onUpdate) onUpdate();
  }, [warpNode, onUpdate]);

  // Update canvas size when container resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setCanvasSize({ width: rect.width - 40, height: Math.min(400, rect.width * 0.6) });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Editor Window */}
      <div
        className="fixed z-50 bg-gray-900 border-2 border-purple-500 rounded-lg shadow-2xl"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          maxWidth: '800px',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Warp Editor</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border-r border-gray-700 pr-2">
              <button
                onClick={() => setZoom(Math.max(0.1, zoom - 0.25))}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Zoom Out"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-sm text-gray-400 min-w-[3rem] text-center">
                {(zoom * 100).toFixed(0)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(5.0, zoom + 0.25))}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Zoom In"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => {
                  setZoom(1.0);
                  setPan({ x: 0, y: 0 });
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Reset Zoom"
              >
                <Maximize2 size={18} />
              </button>
              <button
                onClick={() => setPanMode(!panMode)}
                className={`p-2 transition-colors ${
                  panMode 
                    ? 'text-purple-400 hover:text-purple-300 bg-purple-900/30' 
                    : 'text-gray-400 hover:text-white'
                }`}
                title={panMode ? "Disable Pan Mode" : "Enable Pan Mode"}
              >
                <Hand size={18} />
              </button>
            </div>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Toggle Grid"
            >
              <Grid size={20} />
            </button>
            <button
              onClick={handleReset}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Reset to Default"
            >
              <RotateCcw size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div
          ref={containerRef}
          className="p-5 flex flex-col items-center relative"
        >
          <div className="relative" style={{ display: 'inline-block' }}>
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onMouseDown={handleMouseDown}
              onContextMenu={(e) => e.preventDefault()}
              className="border border-gray-600 cursor-crosshair nodrag"
              style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
            />
            {/* Overlay handles as divs for better click detection */}
            {corners.map((corner, index) => {
              const canvasX = corner.x * canvasSize.width;
              const canvasY = corner.y * canvasSize.height;
              const screenX = canvasX * zoom + pan.x;
              const screenY = canvasY * zoom + pan.y;
              const isOutside = corner.x < 0 || corner.x > 1 || corner.y < 0 || corner.y > 1;
              
              return (
                <div
                  key={index}
                  onMouseDown={(e) => {
                    if (!panMode) {
                      setSelectedHandle(index);
                      setIsDragging(index);
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onClick={(e) => {
                    if (!panMode) {
                      setSelectedHandle(index);
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  className="absolute nodrag"
                  style={{
                    left: `${screenX}px`,
                    top: `${screenY}px`,
                    width: '20px',
                    height: '20px',
                    marginLeft: '-10px',
                    marginTop: '-10px',
                    borderRadius: '50%',
                    backgroundColor: isDragging === index 
                      ? '#E91E63' 
                      : (selectedHandle === index 
                        ? '#BA68C8' 
                        : (isOutside ? '#FF9800' : '#9C27B0')),
                    border: selectedHandle === index 
                      ? '3px solid #FFD700' 
                      : '2px solid white',
                    cursor: panMode ? 'default' : 'grab',
                    pointerEvents: panMode ? 'none' : 'auto',
                    zIndex: 10,
                    boxShadow: selectedHandle === index 
                      ? '0 0 8px rgba(255, 215, 0, 0.8)' 
                      : '0 2px 4px rgba(0,0,0,0.3)',
                    transition: 'all 0.1s ease'
                  }}
                  title={`Corner ${index + 1} - Click to select, use arrow keys to move${selectedHandle === index ? ' (Selected)' : ''}`}
                />
              );
            })}
          </div>
          <div className="mt-2 text-xs text-gray-500 text-center">
            {panMode ? (
              <span className="text-purple-400">Pan Mode: Drag to pan • Click hand icon to disable</span>
            ) : (
              <span>
                Drag handles to warp • Click to select handle • Arrow keys to move (Shift for larger steps)
                {selectedHandle !== null && ` • Handle ${selectedHandle + 1} selected`}
              </span>
            )}
          </div>

          {/* Corner Controls */}
          <div className="mt-4 w-full grid grid-cols-2 gap-4">
            {[
              { label: 'Top Left', index: 0 },
              { label: 'Top Right', index: 1 },
              { label: 'Bottom Right', index: 2 },
              { label: 'Bottom Left', index: 3 }
            ].map(({ label, index }) => (
              <div key={index} className="flex items-center gap-2">
                <label className="text-sm text-gray-400 w-24">{label}:</label>
                <input
                  type="number"
                  value={corners[index].x.toFixed(4)}
                  onChange={(e) => {
                    const newCorners = [...corners];
                    newCorners[index].x = parseFloat(e.target.value) || 0;
                    setCorners(newCorners);
                    warpNode.setCorners(newCorners);
                    if (onUpdate) onUpdate();
                  }}
                  step="0.0001"
                  min="-2"
                  max="3"
                  className="w-20 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-800 text-white"
                />
                <input
                  type="number"
                  value={corners[index].y.toFixed(4)}
                  onChange={(e) => {
                    const newCorners = [...corners];
                    newCorners[index].y = parseFloat(e.target.value) || 0;
                    setCorners(newCorners);
                    warpNode.setCorners(newCorners);
                    if (onUpdate) onUpdate();
                  }}
                  step="0.0001"
                  min="-2"
                  max="3"
                  className="w-20 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-800 text-white"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 text-xs text-gray-500 text-center">
            Drag the corner handles or adjust values above to warp the image
          </div>
        </div>
      </div>
    </>
  );
}

