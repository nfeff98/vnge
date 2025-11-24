import React, { useState, useRef, useEffect } from 'react';
import { segmentImage } from './segmentation';
import { generateAnaglyph } from './anaglyph';
import { RealtimeAnaglyphCompositor } from './realtimeCompositor';
import './SegmentationTool.css';

interface SegmentationParams {
  method: 'kmeans' | 'auto';
  clusters: number;
  labThreshold?: number;
  hueThreshold?: number;
  stereoIntensity: number;
  separationAngle: number;
  edgeWeight?: number;
  baseOpacity: number;
  edgeOpacity: number;
  sobelIntensity: number;
}

const SegmentationTool: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [segmentationMask, setSegmentationMask] = useState<string | null>(null);
  const [sobelEdges, setSobelEdges] = useState<string | null>(null);
  const [anaglyphImage, setAnaglyphImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<{ 
    src: string; 
    title: string;
    isLiveCompositor?: boolean;
  } | null>(null);
  const [fullscreenShowOriginal, setFullscreenShowOriginal] = useState(false);
  const [layerIntensities, setLayerIntensities] = useState<Map<number, number>>(new Map());
  
  // Real-time compositor for instant anaglyph updates
  const [compositor, setCompositor] = useState<RealtimeAnaglyphCompositor | null>(null);
  const [originalImageElement, setOriginalImageElement] = useState<HTMLImageElement | null>(null);
  const anaglyphContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenAnaglyphRef = useRef<HTMLDivElement>(null);
  
  const [params, setParams] = useState<SegmentationParams>({
    method: 'kmeans',
    clusters: 5,
    labThreshold: 50,
    hueThreshold: 30,
    stereoIntensity: 2.5,
    separationAngle: 0,
    edgeWeight: 50,
    baseOpacity: 0.3,
    edgeOpacity: 0.5,
    sobelIntensity: 1.0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Use a ref to track params so we don't cause re-renders
  const paramsRef = useRef(params);
  paramsRef.current = params;

  // Direct update function for instant slider response (no React re-render)
  const handleStereoParamChange = (newIntensity?: number, newAngle?: number, newOpacity?: number, newEdgeOpacity?: number) => {
    if (compositor) {
      const intensity = newIntensity ?? paramsRef.current.stereoIntensity;
      const angle = newAngle ?? paramsRef.current.separationAngle;
      compositor.updateAnaglyph(intensity, angle);
      
      if (newOpacity !== undefined) {
        compositor.setBaseOpacity(newOpacity);
      }
      if (newEdgeOpacity !== undefined) {
        compositor.setEdgeOpacity(newEdgeOpacity);
      }
    }
  };

  // Mount compositor container to DOM when compositor is created
  useEffect(() => {
    if (compositor && anaglyphContainerRef.current) {
      anaglyphContainerRef.current.innerHTML = '';
      anaglyphContainerRef.current.appendChild(compositor.getContainer());
    }
  }, [compositor]);

  // Mount compositor to fullscreen when opened
  useEffect(() => {
    if (fullscreenImage?.isLiveCompositor && compositor && fullscreenAnaglyphRef.current) {
      fullscreenAnaglyphRef.current.innerHTML = '';
      fullscreenAnaglyphRef.current.appendChild(compositor.getContainer());
    }
    
    // Cleanup: move compositor back to main view when closing fullscreen
    return () => {
      if (fullscreenImage?.isLiveCompositor && compositor && anaglyphContainerRef.current) {
        anaglyphContainerRef.current.innerHTML = '';
        anaglyphContainerRef.current.appendChild(compositor.getContainer());
      }
    };
  }, [fullscreenImage, compositor]);

  // Initialize layer intensities when compositor is created
  useEffect(() => {
    if (compositor && layerIntensities.size === 0) {
      const layers = compositor.getLayers();
      const initialIntensities = new Map<number, number>();
      layers.forEach(layer => {
        initialIntensities.set(layer.index, 1.0);
      });
      setLayerIntensities(initialIntensities);
    }
  }, [compositor, layerIntensities.size]);

  // Update layer intensities when they change
  useEffect(() => {
    if (compositor && layerIntensities.size > 0) {
      layerIntensities.forEach((intensity, layerIndex) => {
        compositor.setLayerIntensity(layerIndex, intensity);
      });
      // Trigger update to apply new intensities
      compositor.updateAnaglyph(params.stereoIntensity, params.separationAngle);
    }
  }, [layerIntensities, compositor, params.stereoIntensity, params.separationAngle]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
        // Reset outputs when new image is uploaded
        setSegmentationMask(null);
        setSobelEdges(null);
        setAnaglyphImage(null);
        setCompositor(null);
        setOriginalImageElement(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage || !imageRef.current) return;

    setIsProcessing(true);

    try {
      // Create an image element to load the uploaded image
      const img = new Image();
      img.src = uploadedImage;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      setOriginalImageElement(img);

      // Step 1: Generate segmentation mask (expensive operation)
      const { maskDataUrl, depthMap, edgeMap, sobelDataUrl } = await segmentImage(img, params);
      setSegmentationMask(maskDataUrl);
      setSobelEdges(sobelDataUrl);

      // Step 2: Load mask as image for compositor
      const maskImg = new Image();
      maskImg.src = maskDataUrl;
      await new Promise((resolve, reject) => {
        maskImg.onload = resolve;
        maskImg.onerror = reject;
      });

      // Step 3: Create real-time compositor with depth map, segmentation mask, AND edge map
      const newCompositor = new RealtimeAnaglyphCompositor(img, depthMap, maskImg, edgeMap);
      
      // Step 4: Apply initial anaglyph transform
      newCompositor.updateAnaglyph(
        params.stereoIntensity,
        params.separationAngle
      );
      
      // Step 5: Set compositor state (useEffect will mount it to DOM)
      setCompositor(newCompositor);
      
      // Set data URL for initial download
      setAnaglyphImage(newCompositor.toDataURL());

    } catch (error) {
      console.error('Error during processing:', error);
      alert('An error occurred during processing. Check console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  };
  
  const handleDownloadAnaglyph = () => {
    if (compositor) {
      const dataUrl = compositor.toDataURL();
      handleDownload(dataUrl, 'anaglyph.png');
    }
  };

  const openFullscreen = (src: string, title: string, isLiveCompositor: boolean = false) => {
    setFullscreenImage({ src, title, isLiveCompositor });
  };

  const closeFullscreen = () => {
    setFullscreenImage(null);
    setFullscreenShowOriginal(false);
  };

  // Initialize layer intensities when compositor is created
  useEffect(() => {
    if (compositor && layerIntensities.size === 0) {
      const layers = compositor.getLayers();
      const initialIntensities = new Map<number, number>();
      layers.forEach(layer => {
        initialIntensities.set(layer.index, 1.0);
      });
      setLayerIntensities(initialIntensities);
    }
  }, [compositor]);

  return (
    <div className="segmentation-tool">
      <header className="tool-header">
        <h1>Image Segmentation & Anaglyph Generator</h1>
        <p>Upload an image, configure segmentation parameters, and generate an anaglyph effect</p>
      </header>

      <div className="tool-container">
        {/* Upload Section */}
        <section className="upload-section">
          <h2>1. Upload Image</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="file-input"
          />
          {uploadedImage && (
            <div className="preview-box">
              <img 
                ref={imageRef}
                src={uploadedImage} 
                alt="Uploaded" 
                className="preview-image"
              />
            </div>
          )}
        </section>

        {/* Parameters Section */}
        <section className="params-section">
          <h2>2. Configure Segmentation</h2>
          
          <div className="param-group">
            <label>
              Method:
              <select 
                value={params.method} 
                onChange={(e) => setParams({ ...params, method: e.target.value as 'kmeans' | 'auto' })}
                className="param-input"
              >
                <option value="kmeans">K-Means Clustering</option>
                <option value="auto">Auto-Segment</option>
              </select>
            </label>
          </div>

          {params.method === 'kmeans' && (
            <>
              <div className="param-group">
                <label>
                  Number of Clusters: {params.clusters}
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={params.clusters}
                    onChange={(e) => setParams({ ...params, clusters: parseInt(e.target.value) })}
                    className="param-slider"
                  />
                </label>
              </div>

              <div className="param-group">
                <label>
                  Lab Threshold: {params.labThreshold}
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={params.labThreshold || 50}
                    onChange={(e) => setParams({ ...params, labThreshold: parseInt(e.target.value) })}
                    className="param-slider"
                  />
                </label>
              </div>

              <div className="param-group">
                <label>
                  Hue Threshold: {params.hueThreshold}
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={params.hueThreshold || 30}
                    onChange={(e) => setParams({ ...params, hueThreshold: parseInt(e.target.value) })}
                    className="param-slider"
                  />
                </label>
              </div>

              <div className="param-group">
                <label>
                  Edge Detection Weight: {params.edgeWeight}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={params.edgeWeight || 50}
                    onChange={(e) => setParams({ ...params, edgeWeight: parseInt(e.target.value) })}
                    className="param-slider"
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
                    How much edges influence segmentation (higher = sharper boundaries)
                  </small>
                </label>
              </div>

              <div className="param-group">
                <label>
                  Sobel Intensity: {params.sobelIntensity.toFixed(1)}
                  <input
                    type="range"
                    min="10"
                    max="50"
                    step="1"
                    value={params.sobelIntensity * 10}
                    onChange={(e) => setParams({ ...params, sobelIntensity: parseInt(e.target.value) / 10 })}
                    className="param-slider"
                  />
                  <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
                    Edge detection strength (higher = harder lines, 1.0-5.0)
                  </small>
                </label>
              </div>
            </>
          )}

          <div className="param-group">
            <label>
              Stereo Intensity: {params.stereoIntensity.toFixed(1)}
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={params.stereoIntensity * 10}
                onChange={(e) => {
                  const val = parseInt(e.target.value) / 10;
                  setParams({ ...params, stereoIntensity: val });
                  handleStereoParamChange(val, undefined);
                }}
                className="param-slider"
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
                Controls the 3D depth effect strength (0-10, higher = more dramatic)
                {compositor && <span style={{ color: '#667eea', fontWeight: 600 }}> • Real-time</span>}
              </small>
            </label>
          </div>

           <div className="param-group">
            <label>
              Separation Angle: {params.separationAngle}°
              <input
                type="range"
                min="0"
                max="360"
                value={params.separationAngle}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setParams({ ...params, separationAngle: val });
                  handleStereoParamChange(undefined, val);
                }}
                className="param-slider"
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
                Rotation of the parallax vector (0° = horizontal, 90° = vertical)
                {compositor && <span style={{ color: '#667eea', fontWeight: 600 }}> • Real-time</span>}
              </small>
            </label>
          </div>

          <div className="param-group">
            <label>
              Base Fill Opacity: {Math.round(params.baseOpacity * 100)}%
              <input
                type="range"
                min="0"
                max="100"
                value={params.baseOpacity * 100}
                onChange={(e) => {
                  const val = parseInt(e.target.value) / 100;
                  setParams({ ...params, baseOpacity: val });
                  handleStereoParamChange(undefined, undefined, val);
                }}
                className="param-slider"
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
                Original image underneath to fill gaps (higher = fewer holes)
                {compositor && <span style={{ color: '#667eea', fontWeight: 600 }}> • Real-time</span>}
              </small>
            </label>
          </div>

          <div className="param-group">
            <label>
              Edge Sharpness: {Math.round(params.edgeOpacity * 100)}%
              <input
                type="range"
                min="0"
                max="100"
                value={params.edgeOpacity * 100}
                onChange={(e) => {
                  const val = parseInt(e.target.value) / 100;
                  setParams({ ...params, edgeOpacity: val });
                  handleStereoParamChange(undefined, undefined, undefined, val);
                }}
                className="param-slider"
              />
              <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
                Sobel edge overlay to restore hard lines (higher = sharper)
                {compositor && <span style={{ color: '#667eea', fontWeight: 600 }}> • Real-time</span>}
              </small>
            </label>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!uploadedImage || isProcessing}
            className="generate-button"
          >
            {isProcessing ? 'Processing...' : '3. Generate Segmentation & Anaglyph'}
          </button>

          {compositor && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              background: '#e8f4ff', 
              borderRadius: '6px',
              fontSize: '0.9rem',
              color: '#333'
            }}>
              ✨ <strong>Real-time mode active!</strong> Adjust Stereo Intensity and Separation Angle 
              to see instant updates without recomputing segmentation.
            </div>
          )}
        </section>

        {/* Results Section */}
        {(segmentationMask || anaglyphImage) && (
          <section className="results-section">
            <h2>4. Results</h2>
            
            <div className="results-grid">
              {/* Original */}
              <div className="result-item">
                <h3>Original Image</h3>
                <img 
                  src={uploadedImage!} 
                  alt="Original" 
                  className="result-image clickable" 
                  onClick={() => openFullscreen(uploadedImage!, 'Original Image')}
                  title="Click to view fullscreen"
                />
                <button 
                  onClick={() => handleDownload(uploadedImage!, 'original.png')}
                  className="download-button"
                >
                  Download Original
                </button>
              </div>

              {/* Segmentation Mask */}
              {segmentationMask && (
                <div className="result-item">
                  <h3>Segmentation Mask</h3>
                  <img 
                    src={segmentationMask} 
                    alt="Segmentation Mask" 
                    className="result-image clickable"
                    onClick={() => openFullscreen(segmentationMask, 'Segmentation Mask')}
                    title="Click to view fullscreen"
                  />
                  <button 
                    onClick={() => handleDownload(segmentationMask, 'segmentation-mask.png')}
                    className="download-button"
                  >
                    Download Mask
                  </button>
                </div>
              )}

              {/* Sobel Edges */}
              {sobelEdges && (
                <div className="result-item">
                  <h3>Sobel Edge Detection</h3>
                  <img 
                    src={sobelEdges} 
                    alt="Sobel Edges" 
                    className="result-image clickable"
                    onClick={() => openFullscreen(sobelEdges, 'Sobel Edge Detection')}
                    title="Click to view fullscreen"
                  />
                  <button 
                    onClick={() => handleDownload(sobelEdges, 'sobel-edges.png')}
                    className="download-button"
                  >
                    Download Edges
                  </button>
                </div>
              )}

               {/* Anaglyph */}
              {compositor && (
                <div className="result-item">
                  <h3>Anaglyph Output</h3>
                  <div 
                    ref={anaglyphContainerRef}
                    className="result-anaglyph-container"
                    onClick={() => openFullscreen('', 'Anaglyph Output', true)}
                    title="Click to view fullscreen"
                  />
                  <button 
                    onClick={handleDownloadAnaglyph}
                    className="download-button"
                  >
                    Download Anaglyph
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Fullscreen Modal */}
      {fullscreenImage && (
        <div className="fullscreen-modal" onClick={closeFullscreen}>
          <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closeFullscreen}>
              ✕
            </button>
            <h2 className="fullscreen-title">{fullscreenImage.title}</h2>
            
            {fullscreenImage.isLiveCompositor ? (
              <div className="fullscreen-anaglyph-wrapper">
                {/* Toggle Button */}
                <button 
                  className="fullscreen-toggle-button"
                  onClick={() => setFullscreenShowOriginal(!fullscreenShowOriginal)}
                >
                  {fullscreenShowOriginal ? '🎨 Show Anaglyph' : '🖼️ Show Original'}
                </button>
                
                {/* Anaglyph Container */}
                <div 
                  ref={fullscreenAnaglyphRef}
                  className="fullscreen-anaglyph-container"
                  style={{ display: fullscreenShowOriginal ? 'none' : 'flex' }}
                />
                
                {/* Original Image (EXACT same size/position as anaglyph) */}
                {fullscreenShowOriginal && uploadedImage && compositor && (
                  <div 
                    className="fullscreen-anaglyph-container"
                  >
                    <img 
                      src={uploadedImage} 
                      alt="Original"
                      style={{ 
                        width: compositor.getContainerDimensions().width,
                        height: compositor.getContainerDimensions().height,
                        objectFit: 'contain',
                        display: 'block'
                      }}
                    />
                  </div>
                )}
                
                <div className="fullscreen-controls-row">
                  <div className="fullscreen-controls">
                    <label>
                      Intensity: {params.stereoIntensity.toFixed(1)}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={params.stereoIntensity * 10}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) / 10;
                          setParams({ ...params, stereoIntensity: val });
                          handleStereoParamChange(val, undefined);
                        }}
                        className="fullscreen-slider"
                      />
                    </label>
                    <label>
                      Angle: {params.separationAngle}°
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={params.separationAngle}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          setParams({ ...params, separationAngle: val });
                          handleStereoParamChange(undefined, val);
                        }}
                        className="fullscreen-slider"
                      />
                    </label>
                    <label>
                      Fill: {Math.round(params.baseOpacity * 100)}%
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={params.baseOpacity * 100}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) / 100;
                          setParams({ ...params, baseOpacity: val });
                          handleStereoParamChange(undefined, undefined, val);
                        }}
                        className="fullscreen-slider"
                      />
                    </label>
                    <label>
                      Edges: {Math.round(params.edgeOpacity * 100)}%
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={params.edgeOpacity * 100}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) / 100;
                          setParams({ ...params, edgeOpacity: val });
                          handleStereoParamChange(undefined, undefined, undefined, val);
                        }}
                        className="fullscreen-slider"
                      />
                    </label>
                  </div>
                  
                  {/* Per-Layer Intensity Controls */}
                  {compositor && layerIntensities.size > 0 && (
                    <div className="fullscreen-layer-controls">
                      <div className="layer-controls-horizontal">
                        {compositor.getLayers().map((layer) => (
                          <div key={layer.index} className="layer-input-group">
                            <label className="layer-input-label">
                              L{layer.index + 1}
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="2"
                              step="0.1"
                              value={layerIntensities.get(layer.index) || 1.0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const clamped = Math.max(0, Math.min(2, val));
                                const newIntensities = new Map(layerIntensities);
                                newIntensities.set(layer.index, clamped);
                                setLayerIntensities(newIntensities);
                              }}
                              className="layer-intensity-input"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="layer-control-buttons">
                        <button
                          className="layer-control-button"
                          onClick={() => {
                            const layers = compositor.getLayers();
                            const resetIntensities = new Map<number, number>();
                            layers.forEach(layer => {
                              resetIntensities.set(layer.index, 1.0);
                            });
                            setLayerIntensities(resetIntensities);
                          }}
                          title="Reset all layers to 1.0"
                        >
                          Reset
                        </button>
                        <button
                          className="layer-control-button"
                          onClick={() => {
                            const layers = compositor.getLayers();
                            const randomIntensities = new Map<number, number>();
                            layers.forEach(layer => {
                              // Random value between 0 and 2
                              randomIntensities.set(layer.index, Math.random() * 2);
                            });
                            setLayerIntensities(randomIntensities);
                          }}
                          title="Randomize all layer intensities"
                        >
                          Random
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <img 
                src={fullscreenImage.src} 
                alt={fullscreenImage.title} 
                className="fullscreen-image"
              />
            )}
            
            <div className="fullscreen-hint">
              {fullscreenImage.isLiveCompositor 
                ? 'Use sliders to adjust in real-time • Click outside to close'
                : 'Click outside or press the X to close'
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SegmentationTool;

