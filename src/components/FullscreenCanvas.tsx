import { useEffect, useRef, useState } from 'react';

export default function FullscreenCanvas() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [connectionState, setConnectionState] = useState<string>('connecting');
  const [statusMessage, setStatusMessage] = useState<string>('Connecting...');
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalingChannelRef = useRef<BroadcastChannel | null>(null);
  const channelIdRef = useRef<string>('');
  const isNegotiatingRef = useRef<boolean>(false);

  useEffect(() => {
    // Get channel ID from URL params or generate one
    const urlParams = new URLSearchParams(window.location.search);
    channelIdRef.current = urlParams.get('channelId') || `default-${Date.now()}`;

    // Create signaling channel
    const signalingChannel = new BroadcastChannel(`vnge-webrtc-signaling-${channelIdRef.current}`);
    signalingChannelRef.current = signalingChannel;

    // Create peer connection
    const peerConnection = new RTCPeerConnection({
      iceServers: [] // No STUN/TURN needed for same-origin
    });
    peerConnectionRef.current = peerConnection;

    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      console.log('[Receiver] Received track:', event.track.kind, 'streams:', event.streams.length);
      if (videoRef.current && event.streams[0]) {
        console.log('[Receiver] Setting video srcObject');
        videoRef.current.srcObject = event.streams[0];
        
        // Explicitly play the video
        videoRef.current.play()
          .then(() => {
            console.log('[Receiver] Video playing successfully');
            setStatusMessage('Connected - Streaming');
          })
          .catch(error => {
            console.error('[Receiver] Error playing video:', error);
            setStatusMessage('Connected - Play Error');
          });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      setConnectionState(state);
      
      switch (state) {
        case 'connected':
          setStatusMessage('Connected');
          isNegotiatingRef.current = false;
          break;
        case 'connecting':
          setStatusMessage('Connecting...');
          break;
        case 'disconnected':
          setStatusMessage('Disconnected');
          isNegotiatingRef.current = false;
          break;
        case 'failed':
          setStatusMessage('Connection failed');
          isNegotiatingRef.current = false;
          break;
        case 'closed':
          setStatusMessage('Connection closed');
          isNegotiatingRef.current = false;
          break;
        default:
          setStatusMessage(state);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && signalingChannel) {
        // Serialize the candidate - BroadcastChannel can't clone RTCIceCandidate objects
        signalingChannel.postMessage({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
          source: 'receiver'
        });
      }
    };

    // Listen for offer and ICE candidates from sender
    signalingChannel.onmessage = async event => {
        const msg = event.data;
      
        if (msg.type === "offer" && msg.source === "sender") {
          // Ignore duplicate offers if already negotiating
          if (isNegotiatingRef.current) {
            console.log('[Receiver] Already negotiating, ignoring duplicate offer');
            return;
          }

          console.log('[Receiver] Received offer from sender');
          try {
            isNegotiatingRef.current = true;
            await peerConnection.setRemoteDescription(msg.offer);
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
        
            console.log('[Receiver] Sending answer to sender');
            signalingChannel.postMessage({
              type: "answer",
              source: "receiver",
              answer
            });
            // Keep negotiating flag true until connection is established
          } catch (error) {
            console.error('[Receiver] Error handling offer:', error);
            isNegotiatingRef.current = false;
          }
        }
      
        if (msg.type === "ice-candidate" && msg.source === "sender") {
          console.log('[Receiver] Received ICE candidate from sender');
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch (error) {
            console.error('[Receiver] Error adding ICE candidate:', error);
          }
        }
      };

    // Notify that receiver is ready (after a short delay to ensure setup is complete)
    const readyTimeout = setTimeout(() => {
      console.log('[Receiver] Sending ready signal');
      signalingChannel.postMessage({
        type: 'ready',
        source: 'receiver'
      });
    }, 100);

    // Cleanup on unmount
    return () => {
      clearTimeout(readyTimeout);
      if (peerConnection) {
        peerConnection.close();
      }
      if (signalingChannel) {
        signalingChannel.close();
      }
    };
  }, []);

  // Handle window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (signalingChannelRef.current) {
        signalingChannelRef.current.close();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
      <div
        id="status"
        className={connectionState}
        style={{
          position: 'fixed',
          top: 20,
          left: 20,
          fontFamily: 'monospace',
          fontSize: 14,
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.7)',
          padding: 10,
          borderRadius: 4,
          color: connectionState === 'connected' ? '#4caf50' : connectionState === 'connecting' ? '#ff9800' : '#f44336'
        }}
      >
        {statusMessage}
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          background: '#000'
        }}
      />
    </div>
  );
}

