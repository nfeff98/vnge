/**
 * Manages canvas streaming to a new window using Canvas Capture Stream API and WebRTC
 */
export class CanvasStreamManager {
  private canvas: HTMLCanvasElement | null = null;
  private mediaStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private signalingChannel: BroadcastChannel | null = null;
  private channelId: string;
  private frameRate: number;
  private onConnectionStateChange?: (state: string) => void;
  private isNegotiating: boolean = false;

  constructor(channelId: string, frameRate: number = 15) {
    this.channelId = channelId;
    this.frameRate = frameRate;
  }

  /**
   * Set the canvas to stream
   */
  setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  /**
   * Set callback for connection state changes
   */
  setOnConnectionStateChange(callback: (state: string) => void) {
    this.onConnectionStateChange = callback;
  }

  /**
   * Start streaming the canvas
   */
  async start(): Promise<void> {
    if (!this.canvas) {
      throw new Error('Canvas not set. Call setCanvas() first.');
    }

    // Stop any existing connection first
    if (this.peerConnection) {
      console.log('[Sender] Cleaning up existing connection before starting new one');
      this.stop();
    }

    // Create signaling channel
    this.signalingChannel = new BroadcastChannel(`vnge-webrtc-signaling-${this.channelId}`);
    
    // Create MediaStream from canvas
    console.log('[Sender] Canvas dimensions:', this.canvas.width, 'x', this.canvas.height);
    this.mediaStream = this.canvas.captureStream(this.frameRate);
    console.log('[Sender] Created canvas stream with', this.mediaStream.getTracks().length, 'tracks at', this.frameRate, 'fps');
    
    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [] // No STUN/TURN needed for same-origin
    });
    
    console.log('[Sender] Created new peer connection');

    // Add tracks from canvas stream
    this.mediaStream.getTracks().forEach(track => {
      console.log('[Sender] Adding track:', track.kind, 'id:', track.id, 'enabled:', track.enabled, 'readyState:', track.readyState);
      this.peerConnection!.addTrack(track, this.mediaStream!);
    });
    
    console.log('[Sender] Added all tracks to peer connection');

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingChannel) {
        // Serialize the candidate - BroadcastChannel can't clone RTCIceCandidate objects
        this.signalingChannel.postMessage({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          source: 'sender'
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState || 'unknown';
      this.onConnectionStateChange?.(state);
    };

    // Listen for answer and ICE candidates from receiver
    this.signalingChannel.onmessage = async (event) => {
      const message = event.data;
      
      if (message.type === 'ready' && message.source === 'receiver') {
        // Receiver is ready, create and send offer (if not already negotiating)
        if (!this.isNegotiating) {
          console.log('[Sender] Receiver ready, creating offer');
          await this.createOffer();
        } else {
          console.log('[Sender] Already negotiating, ignoring ready message');
        }
      } else if (message.type === 'answer' && message.source === 'receiver') {
        // Set remote description
        console.log('[Sender] Received answer from receiver');
        if (this.peerConnection && message.answer) {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
          this.isNegotiating = false;
        }
      } else if (message.type === 'ice-candidate' && message.source === 'receiver') {
        // Add ICE candidate (reconstruct from JSON)
        if (this.peerConnection && message.candidate) {
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
          } catch (error) {
            console.error('[Sender] Error adding ICE candidate:', error);
          }
        }
      }
    };
  }

  /**
   * Create and send offer
   */
  private async createOffer(): Promise<void> {
    if (!this.peerConnection || !this.signalingChannel) return;

    try {
      this.isNegotiating = true;
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      console.log('[Sender] Sending offer to receiver');
      this.signalingChannel.postMessage({
        type: 'offer',
        offer: offer,
        source: 'sender'
      });
    } catch (error) {
      console.error('[Sender] Error creating offer:', error);
      this.isNegotiating = false;
      throw error;
    }
  }

  /**
   * Update frame rate
   */
  updateFrameRate(newFrameRate: number) {
    this.frameRate = newFrameRate;
    // If already streaming, we need to recreate the stream
    if (this.mediaStream && this.canvas) {
      // Stop old tracks
      this.mediaStream.getTracks().forEach(track => track.stop());
      
      // Create new stream with new frame rate
      this.mediaStream = this.canvas.captureStream(this.frameRate);
      
      // Replace tracks in peer connection
      if (this.peerConnection) {
        const sender = this.peerConnection.getSenders()[0];
        if (sender && this.mediaStream.getVideoTracks().length > 0) {
          sender.replaceTrack(this.mediaStream.getVideoTracks()[0]);
        }
      }
    }
  }

  /**
   * Stop streaming and clean up
   */
  stop(): void {
    console.log('[Sender] Stopping stream manager');
    
    // Reset negotiation flag
    this.isNegotiating = false;
    
    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Close signaling channel
    if (this.signalingChannel) {
      this.signalingChannel.close();
      this.signalingChannel = null;
    }
  }

  /**
   * Check if currently streaming
   */
  isStreaming(): boolean {
    return this.peerConnection !== null && this.peerConnection.connectionState !== 'closed';
  }
}

