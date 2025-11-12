# MediaPipe Node Output Specification

## Overview

The `MediaPipeNode` now outputs **three standardized data formats** through separate output ports, allowing downstream nodes to choose the level of processing they need.

## Output Ports

### 1. `result` (Canvas)
- **Type**: `NodeDataType.CANVAS`
- **Description**: Visualization canvas with landmarks and connections drawn
- **Use Case**: For display/preview nodes

### 2. `raw` (MediaPipeLandmarkData)
- **Type**: `NodeDataType.ANY`
- **Description**: Raw landmark data directly from MediaPipe
- **Use Case**: Advanced users who want direct MediaPipe output

```typescript
interface MediaPipeLandmarkData {
  mode: 'hands' | 'face';
  landmarks: any[][];        // Raw MediaPipe landmarks
  metadata?: {
    handedness?: any[];      // Only in hands mode
    headPose?: HeadPose;     // Only in face mode
  };
  timestamp: number;
}
```

### 3. `processed` (ProcessedMediaPipeData)
- **Type**: `NodeDataType.ANY`
- **Description**: Structured, mode-specific processed data
- **Use Case**: Most common - clean, typed data for downstream logic

```typescript
interface ProcessedMediaPipeData {
  mode: 'hands' | 'face';
  timestamp: number;
  hands?: HandData[];        // Only present in hands mode
  faces?: FaceData[];        // Only present in face mode
}
```

#### HandData Structure
```typescript
interface HandData {
  handIndex: number;                  // 0, 1, 2... for multiple hands
  handedness: 'Left' | 'Right';       // Which hand
  confidence: number;                 // 0-1 detection confidence
  center: Vector3D;                   // Palm center position
  landmarks: Vector3D[];              // All 21 hand landmarks
  fingerTips: Vector3D[];             // 5 fingertip positions [thumb→pinky]
  palmNormal: Vector3D;               // Normal vector of palm plane
  wristPosition: Vector3D;            // Wrist position
}
```

**Hand Landmark Indices Reference:**
- 0: Wrist
- 1-4: Thumb (base → tip)
- 5-8: Index finger (base → tip)
- 9-12: Middle finger (base → tip)
- 13-16: Ring finger (base → tip)
- 17-20: Pinky (base → tip)

#### FaceData Structure
```typescript
interface FaceData {
  faceIndex: number;                  // 0, 1, 2... for multiple faces
  headPose: HeadPose;                 // Head orientation
  center: Vector3D;                   // Face center (nose tip)
  landmarks: Vector3D[];              // All 468 face mesh landmarks
  keyPoints: {
    noseTip: Vector3D;
    leftEye: Vector3D;
    rightEye: Vector3D;
    leftMouth: Vector3D;
    rightMouth: Vector3D;
    chin: Vector3D;
  };
  boundingBox: {
    min: Vector3D;
    max: Vector3D;
    width: number;
    height: number;
  };
}

interface HeadPose {
  rotation: Vector3D;        // Pitch, Yaw, Roll in degrees
  translation: Vector3D;     // Normalized position offset from center
  confidence: number;        // 0-1 estimation confidence
}
```

### 4. `metrics` (MediaPipeMetrics)
- **Type**: `NodeDataType.ANY`
- **Description**: Simple, unified metrics across all modes
- **Use Case**: Quick access to common values without mode-specific logic

```typescript
interface MediaPipeMetrics {
  detectionCount: number;          // Number of hands/faces detected
  centers: Vector3D[];             // Centers of all detected entities
  orientations?: Vector3D[];       // Head rotations OR palm normals
  confidence: number;              // Average confidence across all detections
  timestamp: number;
}
```

## Common Types

```typescript
interface Vector3D {
  x: number;  // Normalized [0-1] in screen space
  y: number;  // Normalized [0-1] in screen space
  z: number;  // Depth (relative, not absolute distance)
}
```

## Usage Examples

### Example 1: Simple Detection Count
```typescript
// In a downstream node
const metrics = this.getInput('metrics') as MediaPipeMetrics;
console.log(`Detected ${metrics.detectionCount} entities`);
```

### Example 2: Get All Hand Centers
```typescript
const processed = this.getInput('processed') as ProcessedMediaPipeData;
if (processed.hands) {
  const handCenters = processed.hands.map(h => h.center);
  // Use hand centers for interaction logic
}
```

### Example 3: Track Head Orientation
```typescript
const processed = this.getInput('processed') as ProcessedMediaPipeData;
if (processed.faces && processed.faces.length > 0) {
  const headPose = processed.faces[0].headPose;
  console.log(`Pitch: ${headPose.rotation.x}°`);
  console.log(`Yaw: ${headPose.rotation.y}°`);
  console.log(`Roll: ${headPose.rotation.z}°`);
}
```

### Example 4: Finger Pinch Detection
```typescript
const processed = this.getInput('processed') as ProcessedMediaPipeData;
if (processed.hands && processed.hands.length > 0) {
  const hand = processed.hands[0];
  const thumbTip = hand.fingerTips[0];
  const indexTip = hand.fingerTips[1];
  
  const distance = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) +
    Math.pow(thumbTip.y - indexTip.y, 2) +
    Math.pow(thumbTip.z - indexTip.z, 2)
  );
  
  const isPinching = distance < 0.05; // Threshold
}
```

## Benefits of This Structure

✅ **No Redundant Calculations** - Processing happens once in MediaPipeNode  
✅ **Type Safety** - Well-defined interfaces for all data  
✅ **Flexibility** - Choose raw, processed, or simple metrics based on needs  
✅ **Consistency** - Same pattern across hands, face, and future modes  
✅ **Performance** - Downstream nodes don't recompute derived values  
✅ **Gesture-Ready** - Structured format perfect for future gesture recognition  

## Future Extensions

When adding new MediaPipe modes (pose, holistic), follow this pattern:

1. Add mode to `MediaPipeMode` enum
2. Create mode-specific processed data interface (e.g., `PoseData`)
3. Add to `ProcessedMediaPipeData` union type
4. Implement processing method (e.g., `processPoseData()`)
5. Ensure `metrics` output works consistently

This ensures all modes have:
- Raw landmarks for advanced use
- Structured processed data for common use
- Unified metrics for simple use

