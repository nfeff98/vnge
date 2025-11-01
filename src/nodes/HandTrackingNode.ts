import { BaseNode, NodeParameterType } from '../core/BaseNode';
import { Hands, HAND_CONNECTIONS, type Results } from '@mediapipe/hands';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { Hand } from 'lucide-react';

export class HandTrackingNode extends BaseNode {
  private hands: Hands | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;
  private isInitialized: boolean = false;
  private isProcessing: boolean = false;

  constructor(id: string) {
    super(id, {
      name: 'Hand Tracking',
      isInput: false,
      icon: Hand,
      color: '#FF9800',
      backgroundColor: '#1a1a1a',
      borderColor: '#FF9800'
    });
  }

  async initialize() {
    if (this.isInitialized) return;

    this.hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    // Use parameter values instead of hardcoded values
    this.hands.setOptions({
      maxNumHands: this.getParameter('maxNumHands') || 2,
      modelComplexity: 1,
      minDetectionConfidence: this.getParameter('minDetectionConfidence') || 0.7,
      minTrackingConfidence: this.getParameter('minTrackingConfidence') || 0.7,
    });

    this.isInitialized = true;
  }

  protected onParameterChanged(key: string, value: any) {
    if (this.hands) {
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
    }
  }

  private isValidInput(inputElement: HTMLCanvasElement | HTMLVideoElement | null | number | string | boolean): boolean {
    if (!inputElement) return false;
    
    if (inputElement instanceof HTMLVideoElement) {
      // Check if video element has valid dimensions and is not ended
      return inputElement.videoWidth > 0 && 
             inputElement.videoHeight > 0 && 
             !inputElement.ended &&
             inputElement.readyState >= HTMLMediaElement.HAVE_METADATA;
    } else {
      if (typeof(inputElement) !== 'object') return false;
      // For canvas elements, just check dimensions
      return inputElement.width > 0 && inputElement.height > 0;
    }
  }

  getNodeDefinition() {
    return {
      type: 'handTracking',
      inputs: ['video'],
      outputs: ['result'],
      parameters: {
        maxNumHands: { 
          type: NodeParameterType.NUMBER, 
          value: 2,
          min: 1,
          max: 10,
          step: 1
        },
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
        transparentBackground: {
          type: NodeParameterType.BOOLEAN,
          value: true,
        }
      },
      maxInputs: 1,
      maxOutputs: 1
    };
  }

  async executeInternal(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const inputElement = this.getInput('video');
    
    // Validate input and stop processing if invalid
    if (!this.isValidInput(inputElement) || !this.hands) {
      this.isProcessing = false;
      // Clear output when input becomes invalid
      if (this.outputCanvas) {
        const ctx = this.outputCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
        }
        this.setOutput('result', this.outputCanvas);
      }
      return;
    }

    // Handle both HTMLVideoElement and HTMLCanvasElement inputs
    let inputWidth: number, inputHeight: number;
    if (inputElement instanceof HTMLVideoElement) {
      inputWidth = inputElement.videoWidth;
      inputHeight = inputElement.videoHeight;
    } else if (inputElement instanceof HTMLCanvasElement) {
      inputWidth = inputElement.width;
      inputHeight = inputElement.height;
    } else {
      // This shouldn't happen due to validation above, but TypeScript needs it
      return;
    }

    if (!this.outputCanvas) {
      this.outputCanvas = this.createCanvas(inputWidth, inputHeight);
    }

    // Clear the output canvas
    const ctx = this.outputCanvas.getContext('2d');
    if (!ctx) return;

    // Handle transparent background parameter
    const transparentBackground = this.getParameter('transparentBackground') || false;
    
    if (transparentBackground && inputElement) {
      // Draw the input image as background
      ctx.drawImage(inputElement, 0, 0, this.outputCanvas.width, this.outputCanvas.height);
    } else {
      // Clear to black background
      ctx.clearRect(0, 0, this.outputCanvas.width, this.outputCanvas.height);
    }

    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    try {
      this.isProcessing = true;
      
      // Double-check input is still valid before processing
      if (!this.isValidInput(inputElement)) {
        this.isProcessing = false;
        return;
      }

      // Create a promise that resolves when we get results or times out
      const resultsPromise = new Promise<Results>((resolve, reject) => {
        let resolved = false;
        
        const resultsHandler = (results: Results) => {
          if (!resolved) {
            resolved = true;
            resolve(results);
          }
        };
        
        // Set up timeout
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error('Hand tracking timeout'));
          }
        }, 1000); // 1 second timeout
        
        this.hands!.onResults(resultsHandler);
        
        // Clean up timeout when resolved
        const originalResolve = resolve;
        resolve = (value) => {
          clearTimeout(timeout);
          originalResolve(value);
        };
      });

      // Send the image to MediaPipe
      await this.hands.send({ image: inputElement! });
      
      // Wait for results
      const results = await resultsPromise;
      
      // Process the results
      this.processResults(results, ctx);

    } catch (error) {
      console.error('Hand tracking error:', error);
      // Reset processing flag on error
      this.isProcessing = false;
    } finally {
      this.isProcessing = false;
    }

    // Output is set by BaseNode.execute() - either pass-through or processed result
  }

  protected setProcessedOutput() {
    // Set the processed output when enabled
    if (this.outputCanvas) {
      this.setOutput('result', this.outputCanvas);
    }
  }

  private processResults(results: Results, ctx: CanvasRenderingContext2D) {
    if (results.multiHandLandmarks) {
      for (let handIndex = 0; handIndex < results.multiHandLandmarks.length; handIndex++) {
        const landmarks = results.multiHandLandmarks[handIndex];
        const handedness = results.multiHandedness?.[handIndex];

        // Different colors for different hands
        const handColor = handIndex === 0 ? '#00FF00' : '#FF00FF';
        const landmarkColor = handIndex === 0 ? '#FF0000' : '#00FFFF';


        // Draw hand connections
        drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
          color: handColor,
          lineWidth: 3,
        });
        
        // Draw landmarks
        drawLandmarks(ctx, landmarks, {
          color: landmarkColor,
          lineWidth: 2,
          radius: 4,
        });
        
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

  cleanup() {
    this.isProcessing = false;
    if (this.hands) {
      this.hands.close();
      this.hands = null;
    }
    this.isInitialized = false;
  }
}
