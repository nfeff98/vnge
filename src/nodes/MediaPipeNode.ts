import { BaseNode, NodeDataType, NodeParameterType } from '../core/BaseNode';
import { Hands, HAND_CONNECTIONS, type Results as HandResults } from '@mediapipe/hands';
import { FaceMesh, FACEMESH_TESSELATION, FACEMESH_RIGHT_EYE, FACEMESH_LEFT_EYE, FACEMESH_FACE_OVAL, type Results as FaceMeshResults } from '@mediapipe/face_mesh';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { ScanFace } from 'lucide-react';
import type { Color } from './ColorNode';

export enum MediaPipeMode {
  HANDS = 'hands',
  FACE = 'face',
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface HeadPose {
  rotation: Vector3D;    // Euler angles in degrees
  translation: Vector3D; // Normalized translation
  confidence: number;
}

// Raw landmark data (for advanced users who want direct MediaPipe output)
export interface MediaPipeLandmarkData {
  mode: MediaPipeMode;
  landmarks: any[][];  // Array of landmark arrays
  confidence?: number;
  metadata?: {
    handedness?: any[];
    headPose?: HeadPose;
  };
  timestamp: number;
}

// Processed hand data
export interface HandData {
  handIndex: number;
  handedness: 'Left' | 'Right';
  confidence: number;
  center: Vector3D;           // Palm center position
  landmarks: Vector3D[];      // 21 hand landmarks
  fingerTips: Vector3D[];     // 5 fingertip positions [thumb, index, middle, ring, pinky]
  palmNormal: Vector3D;       // Normal vector of palm plane
  wristPosition: Vector3D;    // Wrist position
}

// Processed face data
export interface FaceData {
  faceIndex: number;
  headPose: HeadPose;
  center: Vector3D;           // Face center (nose tip)
  landmarks: Vector3D[];      // All 468 landmarks
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

// Unified processed output structure
export interface ProcessedMediaPipeData {
  mode: MediaPipeMode;
  timestamp: number;
  hands?: HandData[];         // Only present in HANDS mode
  faces?: FaceData[];         // Only present in FACE mode
}

// Common metrics across all modes (for simple downstream use)
export interface MediaPipeMetrics {
  detectionCount: number;           // How many hands/faces detected
  centers: Vector3D[];              // Centers of all detected entities
  orientations?: Vector3D[];        // Orientations (head poses or hand normals)
  confidence: number;               // Average confidence
  timestamp: number;
}

export class MediaPipeNode extends BaseNode {
  private hands: Hands | null = null;
  private faceMesh: FaceMesh | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;
  private isInitialized: Map<MediaPipeMode, boolean> = new Map();
  private isProcessing: boolean = false;

  constructor(id: string) {
    super(id, {
      name: 'MediaPipe',
      isInput: false,
      icon: ScanFace,
      color: '#FF9800',
      backgroundColor: '#1a1a1a',
      borderColor: '#FF9800'
    });
  }

  async initialize(mode: MediaPipeMode) {
    if (this.isInitialized.get(mode)) return;

    switch (mode) {
      case MediaPipeMode.HANDS:
        await this.initializeHands();
        break;
      case MediaPipeMode.FACE:
        await this.initializeFaceMesh();
        break;
    }

    this.isInitialized.set(mode, true);
  }

  private async initializeHands() {
    if (this.hands) return;

    this.hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.hands.setOptions({
      maxNumHands: this.getParameter('maxNumHands') || 2,
      modelComplexity: 1,
      minDetectionConfidence: this.getParameter('minDetectionConfidence') || 0.7,
      minTrackingConfidence: this.getParameter('minTrackingConfidence') || 0.7,
    });
  }

  private async initializeFaceMesh() {
    if (this.faceMesh) return;

    this.faceMesh = new FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    this.faceMesh.setOptions({
      maxNumFaces: this.getParameter('maxNumFaces') || 1,
      refineLandmarks: this.getParameter('refineLandmarks') || true,
      minDetectionConfidence: this.getParameter('minDetectionConfidence') || 0.7,
      minTrackingConfidence: this.getParameter('minTrackingConfidence') || 0.7,
    });
  }

  protected onParameterChanged(key: string, value: any) {
    const mode = this.getParameter('mode') as MediaPipeMode;

    if (key === 'mode') {
      // Mode changed, will reinitialize on next execute
      return;
    }

    // Update solution-specific parameters
    if (mode === MediaPipeMode.HANDS && this.hands) {
      switch (key) {
        case 'maxNumHands':
          this.hands.setOptions({ maxNumHands: value });
          break;
        case 'minDetectionConfidence':
          this.hands.setOptions({ minDetectionConfidence: value });
          break;
        case 'minTrackingConfidence':
          this.hands.setOptions({ minTrackingConfidence: value });
          break;
      }
    } else if (mode === MediaPipeMode.FACE && this.faceMesh) {
      switch (key) {
        case 'maxNumFaces':
          this.faceMesh.setOptions({ maxNumFaces: value });
          break;
        case 'refineLandmarks':
          this.faceMesh.setOptions({ refineLandmarks: value });
          break;
        case 'minDetectionConfidence':
          this.faceMesh.setOptions({ minDetectionConfidence: value });
          break;
        case 'minTrackingConfidence':
          this.faceMesh.setOptions({ minTrackingConfidence: value });
          break;
      }
    }
  }

  private isValidInput(inputElement: HTMLCanvasElement | HTMLVideoElement | null | number | string | boolean | Color): boolean {
    if (!inputElement) return false;
    
    if (inputElement instanceof HTMLVideoElement) {
      return inputElement.videoWidth > 0 && 
             inputElement.videoHeight > 0 && 
             !inputElement.ended &&
             inputElement.readyState >= HTMLMediaElement.HAVE_METADATA;
    } else {
      if (!(inputElement instanceof HTMLCanvasElement || inputElement instanceof HTMLVideoElement)) return false;
      return inputElement.width > 0 && inputElement.height > 0;
    }
  }

  getNodeDefinition() {
    return {
      type: 'mediapipe',
      inputs: [{ id: 'video', type: NodeDataType.CANVAS, accepts: [NodeDataType.CANVAS, NodeDataType.VIDEO] }],
      outputs: [
        { id: 'result', type: NodeDataType.CANVAS },
        { id: 'raw', type: NodeDataType.ANY },        // Raw MediaPipe landmarks
        { id: 'processed', type: NodeDataType.ANY },  // Structured HandData[] or FaceData[]
        { id: 'metrics', type: NodeDataType.ANY }     // Simple metrics for common use
      ],
      parameters: {
        mode: {
          type: NodeParameterType.ENUM,
          value: MediaPipeMode.HANDS,
          options: [MediaPipeMode.HANDS, MediaPipeMode.FACE]
        },
        // Hands mode parameters
        maxNumHands: { 
          type: NodeParameterType.NUMBER, 
          value: 2,
          min: 1,
          max: 10,
          step: 1
        },
        // Face mode parameters
        maxNumFaces: {
          type: NodeParameterType.NUMBER,
          value: 1,
          min: 1,
          max: 4,
          step: 1
        },
        refineLandmarks: {
          type: NodeParameterType.BOOLEAN,
          value: true,
        },
        // Common parameters
        minDetectionConfidence: { 
          type: NodeParameterType.NUMBER, 
          value: 0.7,
          min: 0.1,
          max: 1.0,
          step: 0.1
        },
        minTrackingConfidence: { 
          type: NodeParameterType.NUMBER, 
          value: 0.7,
          min: 0.1,
          max: 1.0,
          step: 0.1
        },
        // Visualization options
        showLandmarks: {
          type: NodeParameterType.BOOLEAN,
          value: true,
        },
        showConnections: {
          type: NodeParameterType.BOOLEAN,
          value: true,
        },
        transparentBackground: {
          type: NodeParameterType.BOOLEAN,
          value: true,
        }
      },
      maxInputs: 1,
      maxOutputs: 10
    };
  }

  async executeInternal(): Promise<void> {
    const mode = this.getParameter('mode') as MediaPipeMode;

    if (!this.isInitialized.get(mode)) {
      await this.initialize(mode);
    }

    const inputElement = this.getInput('video');
    
    // MediaPipeNode doesn't support WebGLTexture - only Canvas/Video
    if (inputElement && (inputElement as any).__gl) {
      console.warn('MediaPipeNode: WebGLTexture input not supported. Use TextureToCanvasNode first.');
      return;
    }
    
    const validInputElement = inputElement as HTMLCanvasElement | HTMLVideoElement | null | number | string | boolean | Color;
    
    if (!this.isValidInput(validInputElement)) {
      this.isProcessing = false;
      if (this.outputCanvas) {
        const ctx = this.outputCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
        }
        this.setOutput('result', this.outputCanvas);
      }
      return;
    }

    // Get input dimensions
    let inputWidth: number, inputHeight: number;
    if (validInputElement instanceof HTMLVideoElement) {
      inputWidth = validInputElement.videoWidth;
      inputHeight = validInputElement.videoHeight;
    } else if (validInputElement instanceof HTMLCanvasElement) {
      inputWidth = validInputElement.width;
      inputHeight = validInputElement.height;
    } else {
      return;
    }

    if (!this.outputCanvas) {
      this.outputCanvas = this.createCanvas(inputWidth, inputHeight);
    }

    const ctx = this.outputCanvas.getContext('2d');
    if (!ctx) return;

    // Handle transparent background parameter
    const transparentBackground = this.getParameter('transparentBackground') || false;
    
    if (transparentBackground && validInputElement) {
      ctx.drawImage(validInputElement as any, 0, 0, this.outputCanvas.width, this.outputCanvas.height);
    } else {
      ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    }

    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    try {
      this.isProcessing = true;
      
      if (!this.isValidInput(validInputElement)) {
        this.isProcessing = false;
        return;
      }

      // Process based on mode
      if (mode === MediaPipeMode.HANDS) {
        await this.processHands(validInputElement, ctx);
      } else if (mode === MediaPipeMode.FACE) {
        await this.processFaceMesh(validInputElement, ctx);
      }

    } catch (error) {
      console.error('MediaPipe processing error:', error);
      this.isProcessing = false;
    } finally {
      this.isProcessing = false;
    }
  }

  private async processHands(inputElement: any, ctx: CanvasRenderingContext2D): Promise<void> {
    if (!this.hands) return;

    const resultsPromise = new Promise<HandResults>((resolve, reject) => {
      let resolved = false;
      
      const resultsHandler = (results: HandResults) => {
        if (!resolved) {
          resolved = true;
          resolve(results);
        }
      };
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Hand tracking timeout'));
        }
      }, 1000);
      
      this.hands!.onResults(resultsHandler);
      
      const originalResolve = resolve;
      resolve = (value) => {
        clearTimeout(timeout);
        originalResolve(value);
      };
    });

    await this.hands.send({ image: inputElement as any });
    const results = await resultsPromise;
    
    this.renderHandResults(results, ctx);
  }

  private async processFaceMesh(inputElement: any, ctx: CanvasRenderingContext2D): Promise<void> {
    if (!this.faceMesh) return;

    const resultsPromise = new Promise<FaceMeshResults>((resolve, reject) => {
      let resolved = false;
      
      const resultsHandler = (results: FaceMeshResults) => {
        if (!resolved) {
          resolved = true;
          resolve(results);
        }
      };
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error('Face mesh timeout'));
        }
      }, 1000);
      
      this.faceMesh!.onResults(resultsHandler);
      
      const originalResolve = resolve;
      resolve = (value) => {
        clearTimeout(timeout);
        originalResolve(value);
      };
    });

    await this.faceMesh.send({ image: inputElement as any });
    const results = await resultsPromise;
    
    this.renderFaceMeshResults(results, ctx);
  }

  protected setProcessedOutput() {
    if (this.outputCanvas) {
      this.setOutput('result', this.outputCanvas);
    }
  }

  private renderHandResults(results: HandResults, ctx: CanvasRenderingContext2D) {
    const showLandmarks = this.getParameter('showLandmarks') !== false;
    const showConnections = this.getParameter('showConnections') !== false;

    if (results.multiHandLandmarks) {
      // Output 1: Raw landmarks (for advanced users)
      const landmarkData: MediaPipeLandmarkData = {
        mode: MediaPipeMode.HANDS,
        landmarks: results.multiHandLandmarks,
        metadata: {
          handedness: results.multiHandedness
        },
        timestamp: Date.now()
      };
      this.setOutput('raw', landmarkData);

      // Output 2: Processed hand data
      const processedHands: HandData[] = [];
      const centers: Vector3D[] = [];
      const orientations: Vector3D[] = [];
      let totalConfidence = 0;

      for (let handIndex = 0; handIndex < results.multiHandLandmarks.length; handIndex++) {
        const landmarks = results.multiHandLandmarks[handIndex];
        const handedness = results.multiHandedness?.[handIndex];

        const handData = this.processHandData(landmarks, handedness, handIndex);
        processedHands.push(handData);
        centers.push(handData.center);
        orientations.push(handData.palmNormal);
        totalConfidence += handData.confidence;
      }

      const processedData: ProcessedMediaPipeData = {
        mode: MediaPipeMode.HANDS,
        timestamp: Date.now(),
        hands: processedHands
      };
      this.setOutput('processed', processedData);

      // Output 3: Simple metrics
      const metrics: MediaPipeMetrics = {
        detectionCount: processedHands.length,
        centers: centers,
        orientations: orientations,
        confidence: processedHands.length > 0 ? totalConfidence / processedHands.length : 0,
        timestamp: Date.now()
      };
      this.setOutput('metrics', metrics);

      // Render visualization
      for (let handIndex = 0; handIndex < results.multiHandLandmarks.length; handIndex++) {
        const landmarks = results.multiHandLandmarks[handIndex];
        const handedness = results.multiHandedness?.[handIndex];

        const handColor = handIndex === 0 ? '#00FF00' : '#FF00FF';
        const landmarkColor = handIndex === 0 ? '#FF0000' : '#00FFFF';

        if (showConnections) {
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
            color: handColor,
            lineWidth: 3,
          });
        }
        
        if (showLandmarks) {
          drawLandmarks(ctx, landmarks, {
            color: landmarkColor,
            lineWidth: 2,
            radius: 4,
          });
        }
        
        // Draw hand label
        if (handedness && handedness.label) {
          const label = handedness.label;
          const confidence = handedness.score;
          
          ctx.fillStyle = handColor;
          ctx.font = '16px Arial';
          ctx.fillText(`${label} (${(confidence * 100).toFixed(1)}%)`, 10, 30 + (handIndex * 25));
        }
      }
    }
  }

  private processHandData(landmarks: any[], handedness: any, handIndex: number): HandData {
    // Convert landmarks to Vector3D array
    const landmarkVectors: Vector3D[] = landmarks.map(lm => ({
      x: lm.x,
      y: lm.y,
      z: lm.z || 0
    }));

    // Calculate palm center (average of wrist and middle finger base)
    const wrist = landmarkVectors[0];
    const middleBase = landmarkVectors[9];
    const center: Vector3D = {
      x: (wrist.x + middleBase.x) / 2,
      y: (wrist.y + middleBase.y) / 2,
      z: (wrist.z + middleBase.z) / 2
    };

    // Extract finger tips (landmarks 4, 8, 12, 16, 20)
    const fingerTips: Vector3D[] = [
      landmarkVectors[4],   // Thumb
      landmarkVectors[8],   // Index
      landmarkVectors[12],  // Middle
      landmarkVectors[16],  // Ring
      landmarkVectors[20]   // Pinky
    ];

    // Calculate palm normal (cross product of two palm vectors)
    const palmV1 = {
      x: landmarkVectors[5].x - wrist.x,
      y: landmarkVectors[5].y - wrist.y,
      z: landmarkVectors[5].z - wrist.z
    };
    const palmV2 = {
      x: landmarkVectors[17].x - wrist.x,
      y: landmarkVectors[17].y - wrist.y,
      z: landmarkVectors[17].z - wrist.z
    };
    
    // Cross product
    const palmNormal: Vector3D = {
      x: palmV1.y * palmV2.z - palmV1.z * palmV2.y,
      y: palmV1.z * palmV2.x - palmV1.x * palmV2.z,
      z: palmV1.x * palmV2.y - palmV1.y * palmV2.x
    };
    
    // Normalize
    const normalLength = Math.sqrt(palmNormal.x ** 2 + palmNormal.y ** 2 + palmNormal.z ** 2);
    if (normalLength > 0) {
      palmNormal.x /= normalLength;
      palmNormal.y /= normalLength;
      palmNormal.z /= normalLength;
    }

    return {
      handIndex,
      handedness: (handedness?.label || 'Unknown') as 'Left' | 'Right',
      confidence: handedness?.score || 0,
      center,
      landmarks: landmarkVectors,
      fingerTips,
      palmNormal,
      wristPosition: wrist
    };
  }

  private renderFaceMeshResults(results: FaceMeshResults, ctx: CanvasRenderingContext2D) {
    const showLandmarks = this.getParameter('showLandmarks') !== false;
    const showConnections = this.getParameter('showConnections') !== false;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks;

      // Output 1: Raw landmarks
      const landmarkData: MediaPipeLandmarkData = {
        mode: MediaPipeMode.FACE,
        landmarks: landmarks,
        timestamp: Date.now()
      };
      this.setOutput('raw', landmarkData);

      // Output 2: Processed face data
      const processedFaces: FaceData[] = [];
      const centers: Vector3D[] = [];
      const orientations: Vector3D[] = [];
      let totalConfidence = 0;

      for (let faceIndex = 0; faceIndex < landmarks.length; faceIndex++) {
        const faceLandmarks = landmarks[faceIndex];
        const faceData = this.processFaceData(faceLandmarks, faceIndex);
        processedFaces.push(faceData);
        centers.push(faceData.center);
        orientations.push(faceData.headPose.rotation);
        totalConfidence += faceData.headPose.confidence;
      }

      const processedData: ProcessedMediaPipeData = {
        mode: MediaPipeMode.FACE,
        timestamp: Date.now(),
        faces: processedFaces
      };
      this.setOutput('processed', processedData);

      // Output 3: Simple metrics
      const metrics: MediaPipeMetrics = {
        detectionCount: processedFaces.length,
        centers: centers,
        orientations: orientations,
        confidence: processedFaces.length > 0 ? totalConfidence / processedFaces.length : 0,
        timestamp: Date.now()
      };
      this.setOutput('metrics', metrics);

      // Render visualization for each face
      for (const faceLandmarks of landmarks) {
        if (showConnections) {
          // Draw face mesh tesselation
          drawConnectors(ctx, faceLandmarks, FACEMESH_TESSELATION, {
            color: '#C0C0C070',
            lineWidth: 1,
          });
          
          // Draw eyes
          drawConnectors(ctx, faceLandmarks, FACEMESH_RIGHT_EYE, {
            color: '#FF3030',
            lineWidth: 2,
          });
          drawConnectors(ctx, faceLandmarks, FACEMESH_LEFT_EYE, {
            color: '#30FF30',
            lineWidth: 2,
          });
          
          // Draw face oval
          drawConnectors(ctx, faceLandmarks, FACEMESH_FACE_OVAL, {
            color: '#E0E0E0',
            lineWidth: 2,
          });
        }
        
        if (showLandmarks) {
          // Draw key landmarks (nose tip, eye centers, mouth corners)
          const keyLandmarkIndices = [1, 33, 263, 61, 291, 199];
          keyLandmarkIndices.forEach(idx => {
            const landmark = faceLandmarks[idx];
            if (landmark) {
              ctx.fillStyle = '#00FFFF';
              ctx.beginPath();
              ctx.arc(
                landmark.x * ctx.canvas.width,
                landmark.y * ctx.canvas.height,
                5,
                0,
                2 * Math.PI
              );
              ctx.fill();
            }
          });
        }
      }

      // Draw head pose info for first face
      if (processedFaces.length > 0) {
        const headPose = processedFaces[0].headPose;
        ctx.fillStyle = '#00FF00';
        ctx.font = '16px Arial';
        ctx.fillText(`Pitch: ${headPose.rotation.x.toFixed(1)}°`, 10, 30);
        ctx.fillText(`Yaw: ${headPose.rotation.y.toFixed(1)}°`, 10, 55);
        ctx.fillText(`Roll: ${headPose.rotation.z.toFixed(1)}°`, 10, 80);
      }
    }
  }

  private processFaceData(landmarks: any[], faceIndex: number): FaceData {
    // Convert landmarks to Vector3D array
    const landmarkVectors: Vector3D[] = landmarks.map(lm => ({
      x: lm.x,
      y: lm.y,
      z: lm.z || 0
    }));

    // Extract key points
    const keyPoints = {
      noseTip: landmarkVectors[1],
      leftEye: landmarkVectors[33],
      rightEye: landmarkVectors[263],
      leftMouth: landmarkVectors[61],
      rightMouth: landmarkVectors[291],
      chin: landmarkVectors[199]
    };

    // Calculate bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const lm of landmarkVectors) {
      minX = Math.min(minX, lm.x);
      minY = Math.min(minY, lm.y);
      minZ = Math.min(minZ, lm.z);
      maxX = Math.max(maxX, lm.x);
      maxY = Math.max(maxY, lm.y);
      maxZ = Math.max(maxZ, lm.z);
    }

    const boundingBox = {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      width: maxX - minX,
      height: maxY - minY
    };

    // Calculate head pose
    const headPose = this.calculateHeadPose(landmarks);

    return {
      faceIndex,
      headPose,
      center: keyPoints.noseTip,
      landmarks: landmarkVectors,
      keyPoints,
      boundingBox
    };
  }

  /**
   * Calculate head pose (rotation) from face landmarks
   * Uses a simplified approach based on key facial points
   */
  private calculateHeadPose(landmarks: any[]): HeadPose {
    // Key landmark indices for head pose estimation
    const noseTip = landmarks[1];           // Nose tip
    const leftEye = landmarks[33];          // Left eye inner corner
    const rightEye = landmarks[263];        // Right eye inner corner
    const leftMouth = landmarks[61];        // Left mouth corner
    const rightMouth = landmarks[291];      // Right mouth corner
    const chin = landmarks[199];            // Chin

    // Calculate yaw (left-right rotation)
    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const mouthMidX = (leftMouth.x + rightMouth.x) / 2;
    const faceWidthAtEyes = Math.abs(rightEye.x - leftEye.x);
    const faceWidthAtMouth = Math.abs(rightMouth.x - leftMouth.x);
    
    // Yaw based on horizontal shift of nose relative to eye/mouth midpoint
    const noseOffsetX = noseTip.x - eyeMidX;
    const yaw = (noseOffsetX / faceWidthAtEyes) * 60; // Scale to degrees

    // Calculate pitch (up-down rotation)
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const mouthMidY = (leftMouth.y + rightMouth.y) / 2;
    const noseToEyeDistance = Math.abs(noseTip.y - eyeMidY);
    const noseToMouthDistance = Math.abs(noseTip.y - mouthMidY);
    const faceHeight = Math.abs(chin.y - eyeMidY);
    
    // Pitch based on vertical position of nose
    const noseOffsetY = noseTip.y - eyeMidY;
    const pitch = (noseOffsetY / faceHeight) * 50; // Scale to degrees

    // Calculate roll (tilt rotation)
    const eyeAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);
    const roll = (eyeAngle * 180) / Math.PI; // Convert to degrees

    // Confidence based on landmark visibility and face size
    const faceSize = faceWidthAtEyes * faceHeight;
    const confidence = Math.min(1.0, faceSize * 10); // Simple heuristic

    return {
      rotation: {
        x: pitch,
        y: yaw,
        z: roll
      },
      translation: {
        x: noseTip.x - 0.5,  // Normalized to center
        y: noseTip.y - 0.5,
        z: noseTip.z || 0
      },
      confidence: confidence
    };
  }

  cleanup() {
    this.isProcessing = false;
    
    if (this.hands) {
      this.hands.close();
      this.hands = null;
    }
    
    if (this.faceMesh) {
      this.faceMesh.close();
      this.faceMesh = null;
    }
    
    this.isInitialized.clear();
  }
}

