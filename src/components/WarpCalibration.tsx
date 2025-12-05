import { useState, useEffect, useRef } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { WarpNode } from '../nodes/WarpNode';
import { type Point2D } from '../utils/homography';

interface WarpCalibrationProps {
  warpNode: WarpNode;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onComplete: () => void;
  onCancel: () => void;
}

export default function WarpCalibration({ 
  warpNode, 
  canvasRef, 
  onComplete, 
  onCancel 
}: WarpCalibrationProps) {
  const [clickedPoints, setClickedPoints] = useState<Point2D[]>([]);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get mouse position relative to canvas
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to canvas internal coordinates (accounting for display scale)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = x * scaleX;
    const canvasY = y * scaleY;
    
    // Update mouse position for crosshair
    setMousePosition({ x: canvasX, y: canvasY });
  };

  // Draw crosshair on output canvas continuously
  useEffect(() => {
    if (!canvasRef.current || clickedPoints.length >= 4 || !mousePosition) {
      // Clean up if we have 4 points or no mouse position
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawCrosshair = () => {
      if (!mousePosition || clickedPoints.length >= 4) {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      // Draw crosshair on top of whatever is on the canvas
      ctx.save();

      // Draw crosshair
      ctx.strokeStyle = '#9C27B0';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(156, 39, 176, 0.8)';
      ctx.shadowBlur = 4;

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, mousePosition.y);
      ctx.lineTo(canvas.width, mousePosition.y);
      ctx.stroke();

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(mousePosition.x, 0);
      ctx.lineTo(mousePosition.x, canvas.height);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = '#9C27B0';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(mousePosition.x, mousePosition.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      // Schedule next frame to redraw (in case pipeline redraws)
      animationFrameRef.current = requestAnimationFrame(drawCrosshair);
    };

    // Start drawing loop
    animationFrameRef.current = requestAnimationFrame(drawCrosshair);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [mousePosition, clickedPoints.length, canvasRef]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    if (clickedPoints.length >= 4) return; // Already have 4 points

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get click position relative to canvas
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to normalized coordinates (0-1) relative to canvas display size
    const displayWidth = rect.width;
    const displayHeight = rect.height;
    
    // Normalize by display size
    const normalizedPoint: Point2D = { 
      x: x / displayWidth, 
      y: y / displayHeight 
    };
    
    const updated = [...clickedPoints, normalizedPoint];
    setClickedPoints(updated);
    
    // If we have 4 points, apply the calibration
    if (updated.length === 4) {
      applyCalibration(updated);
    }
  };

  const applyCalibration = (points: Point2D[]) => {
    // The clicked points are in normalized output canvas coordinates (0-1)
    // These represent where we want the input image corners to appear
    // 
    // Input corners (in input UV space): (0,0), (1,0), (1,1), (0,1)
    // Output positions (where we clicked): points[0], points[1], points[2], points[3]
    //
    // The warp node parameters define where input corners map TO in output space
    // So we can directly use the clicked points as the warp corner parameters
    //
    // Order: topLeft, topRight, bottomRight, bottomLeft
    warpNode.setCorners(points);
    
    // Trigger update
    setTimeout(() => {
      onComplete();
    }, 50);
  };

  const handleReset = () => {
    setClickedPoints([]);
  };

  const getPointLabel = (index: number) => {
    const labels = ['Top-Left', 'Top-Right', 'Bottom-Right', 'Bottom-Left'];
    return labels[index];
  };

  const getPointPosition = (point: Point2D) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Convert normalized coordinates (0-1) to display pixel coordinates
    const displayX = point.x * rect.width;
    const displayY = point.y * rect.height;
    
    return { x: displayX, y: displayY };
  };

  if (!canvasRef.current) return null;

  const canvas = canvasRef.current;
  const rect = canvas.getBoundingClientRect();

  return (
    <div
      ref={overlayRef}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMousePosition(null)}
      style={{
        position: 'fixed',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        zIndex: 2000,
        cursor: clickedPoints.length < 4 ? 'none' : 'default',
        backgroundColor: 'rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Instructions */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.9)',
          padding: '12px 20px',
          borderRadius: 8,
          border: '2px solid #9C27B0',
          color: '#fff',
          fontSize: 14,
          zIndex: 2001,
          textAlign: 'center'
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
          Warp Calibration Mode
        </div>
        <div style={{ fontSize: 12, color: '#ccc' }}>
          {clickedPoints.length < 4 ? (
            <>
              Click point {clickedPoints.length + 1}/4: <strong>{getPointLabel(clickedPoints.length)}</strong>
            </>
          ) : (
            <>Calibration complete! Click "Done" to finish.</>
          )}
        </div>
      </div>

      {/* Clicked points visualization */}
      {clickedPoints.map((point, index) => {
        const pos = getPointPosition(point);
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              width: 20,
              height: 20,
              marginLeft: -10,
              marginTop: -10,
              borderRadius: '50%',
              backgroundColor: '#9C27B0',
              border: '3px solid #FFD700',
              boxShadow: '0 0 10px rgba(255, 215, 0, 0.8)',
              zIndex: 2002,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 10,
              fontWeight: 'bold'
            }}
          >
            {index + 1}
          </div>
        );
      })}

      {/* Control buttons */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 10,
          zIndex: 2001
        }}
      >
        {clickedPoints.length > 0 && (
          <button
            onClick={handleReset}
            style={{
              background: 'rgba(0, 0, 0, 0.9)',
              border: '2px solid #666',
              borderRadius: 6,
              padding: '8px 16px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12
            }}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        )}
        <button
          onClick={onCancel}
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            border: '2px solid #666',
            borderRadius: 6,
            padding: '8px 16px',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12
          }}
        >
          <X size={14} />
          Cancel
        </button>
        {clickedPoints.length === 4 && (
          <button
            onClick={onComplete}
            style={{
              background: 'rgba(156, 39, 176, 0.9)',
              border: '2px solid #9C27B0',
              borderRadius: 6,
              padding: '8px 16px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 'bold'
            }}
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

