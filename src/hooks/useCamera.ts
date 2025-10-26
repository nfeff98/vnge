import { useEffect, useRef, useState } from 'react';

export interface CameraState {
  stream: MediaStream | null;
  video: HTMLVideoElement | null;
  isInitialized: boolean;
  error: string | null;
}

export function useCamera() {
  const [state, setState] = useState<CameraState>({
    stream: null,
    video: null,
    isInitialized: false,
    error: null
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const initializeCamera = async () => {
    try {
      setState(prev => ({ ...prev, error: null }));

      // Check for HTTPS
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        throw new Error('Camera access requires HTTPS or localhost');
      }

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        } 
      });

      streamRef.current = stream;

      // Create video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        const onLoadedMetadata = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          resolve(void 0);
        };
        
        const onError = (e: Event) => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata);
          video.removeEventListener('error', onError);
          reject(e);
        };
        
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('error', onError);
        
        video.play().catch(reject);
      });

      videoRef.current = video;

      setState({
        stream,
        video,
        isInitialized: true,
        error: null
      });

    } catch (error) {
      console.error('Camera initialization error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown camera error',
        isInitialized: false
      }));
    }
  };

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    setState({
      stream: null,
      video: null,
      isInitialized: false,
      error: null
    });
  };

  useEffect(() => {
    initializeCamera();
    return cleanup;
  }, []);

  return {
    ...state,
    initializeCamera,
    cleanup
  };
}
