import React, { useState, useRef, useEffect } from "react";
import { X, Download, ExternalLink, File, Image, FileText } from "lucide-react";

export function FilePreviewer({ url, fileName, trigger, className = "", isOpen: externalIsOpen, onClose }) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const modalRef = useRef(null);

  // Use external isOpen if provided, otherwise use internal state
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen =
    externalIsOpen !== undefined
      ? value => {
          if (!value && onClose) onClose();
        }
      : setInternalIsOpen;

  // Handle click outside to close modal
  useEffect(() => {
    const handleClickOutside = event => {
      // Only handle if this modal is open and the click is outside our modal
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        // Stop propagation to prevent interfering with parent modals
        event.stopPropagation();
        event.preventDefault();
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use capture phase to handle the event before other listeners
      document.addEventListener("mousedown", handleClickOutside, { capture: true, passive: false });
      // Prevent background scroll only for this modal
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, { capture: true, passive: false });
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = event => {
      if (event.key === "Escape") {
        event.stopPropagation();
        event.preventDefault();
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape, { capture: true });
    }

    return () => {
      document.removeEventListener("keydown", handleEscape, { capture: true });
    };
  }, [isOpen]);

  // Get file extension and type
  const getFileInfo = (url, fileName) => {
    const urlExtension = url?.split(".").pop()?.toLowerCase();
    const nameExtension = fileName?.split(".").pop()?.toLowerCase();
    const extension = nameExtension || urlExtension || "";

    const imageTypes = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];
    const documentTypes = ["pdf"];
    const wordTypes = ["doc", "docx"];
    const textTypes = ["txt"];

    let type = "unknown";
    if (imageTypes.includes(extension)) type = "image";
    else if (documentTypes.includes(extension)) type = "pdf";
    else if (wordTypes.includes(extension)) type = "word";
    else if (textTypes.includes(extension)) type = "text";

    return { extension, type };
  };

  const { extension, type } = getFileInfo(url, fileName);
  const displayName = fileName || url?.split("/").pop() || "Unknown File";

  // Get appropriate icon
  const getFileIcon = () => {
    switch (type) {
      case "image":
        return <Image className="w-5 h-5" />;
      case "pdf":
        return <FileText className="w-5 h-5 text-red-500" />;
      case "word":
        return <FileText className="w-5 h-5 text-blue-500" />;
      default:
        return <File className="w-5 h-5" />;
    }
  };

  // Render file content
  const renderFileContent = () => {
    if (hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-[var(--secondary-foreground)]">
          <File className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">Unable to preview file</p>
          <p className="text-sm text-center mb-4">The file format may not be supported for preview or there was an error loading the file.</p>
          <button
            onClick={() => window.open(url, "_blank")}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary)]/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download File
          </button>
        </div>
      );
    }

    switch (type) {
      case "image":
        return <ImageViewer url={url} displayName={displayName} setIsLoading={setIsLoading} setHasError={setHasError} />;

      case "pdf":
        return (
          <div className="w-full h-[80vh] bg-[var(--surface)] rounded-lg overflow-hidden">
            <iframe
              src={`${url}#toolbar=1&navpanes=1&scrollbar=1`}
              className="w-full h-full border-0"
              title={displayName}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          </div>
        );

      case "word":
        return <WordDocumentViewer url={url} displayName={displayName} setIsLoading={setIsLoading} setHasError={setHasError} hasError={hasError} />;


      default:
        return (
          <div className="flex flex-col items-center justify-center h-96 text-[var(--secondary-foreground)]">
            {getFileIcon()}
            <p className="text-lg font-medium mt-4 mb-2">{displayName}</p>
            <p className="text-sm text-center mb-4">Preview not available for .{extension} files</p>
            <div className="flex gap-3">
              <button
                onClick={() => window.open(url, "_blank")}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary)]/90 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </button>
              <button
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = displayName;
                  link.click();
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--secondary)] text-[var(--secondary-foreground)] rounded-lg hover:bg-[var(--secondary)]/80 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
          </div>
        );
    }
  };

  // Default trigger button
  const defaultTrigger = (
    <button className={`flex items-center gap-2 px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--secondary)] transition-colors ${className}`}>
      {getFileIcon()}
      <span className="text-sm truncate max-w-32">{displayName}</span>
    </button>
  );

  return (
    <>
      {/* Trigger */}
      {trigger !== null && (
        <div onClick={() => setIsOpen(true)} className="cursor-pointer">
          {trigger || defaultTrigger}
        </div>
      )}

      {/* Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[9999]"
          data-file-previewer-modal
          onClick={(e) => {
            // Only close if clicking the backdrop, not the modal content
            if (e.target === e.currentTarget) {
              e.stopPropagation();
              e.preventDefault();
              setIsOpen(false);
            }
          }}
        >
          <div 
            ref={modalRef} 
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl max-w-6xl w-full max-h-[95vh] overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                {getFileIcon()}
                <div>
                  <h3 className="font-medium text-[var(--foreground)] truncate max-w-96">{displayName}</h3>
                  <p className="text-sm text-[var(--secondary-foreground)]">{extension.toUpperCase()} File</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Download button */}
                <button
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = displayName;
                    link.click();
                  }}
                  className="p-2 hover:bg-[var(--secondary)] rounded-lg transition-colors"
                  title="Download file"
                >
                  <Download className="w-5 h-5" />
                </button>

                {/* Open in new tab */}
                <button onClick={() => window.open(url, "_blank")} className="p-2 hover:bg-[var(--secondary)] rounded-lg transition-colors" title="Open in new tab">
                  <ExternalLink className="w-5 h-5" />
                </button>

                {/* Close button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsOpen(false);
                  }} 
                  className="p-2 hover:bg-[var(--secondary)] rounded-lg transition-colors" 
                  title="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 relative">
              {/* Loading spinner */}
              {isLoading && !hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]/50 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-[var(--primary)]"></div>
                    <p className="text-[var(--secondary-foreground)]">Loading preview...</p>
                  </div>
                </div>
              )}

              {/* File content */}
              {renderFileContent()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Enhanced Image Viewer Component with zoom and centering
const ImageViewer = ({ url, displayName, setIsLoading, setHasError }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [fitToScreen, setFitToScreen] = useState(true);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  // Reset zoom and position when URL changes
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setImageLoaded(false);
    setFitToScreen(true);
  }, [url]);

  const handleImageLoad = (e) => {
    setIsLoading(false);
    setImageLoaded(true);
    
    const img = e.target;
    const container = containerRef.current;
    
    if (img && container) {
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;
      const containerWidth = container.clientWidth - 40; // Account for padding
      const containerHeight = container.clientHeight - 40;
      
      setImageDimensions({ width: imgWidth, height: imgHeight });
      
      // Calculate initial zoom to fit image in container
      const scaleX = containerWidth / imgWidth;
      const scaleY = containerHeight / imgHeight;
      const initialZoom = Math.min(scaleX, scaleY, 1); // Don't zoom beyond 100% initially
      
      setZoom(initialZoom);
      setFitToScreen(true);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 5));
    setFitToScreen(false);
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.1));
    setFitToScreen(false);
  };

  const handleFitToScreen = () => {
    if (imageRef.current && containerRef.current) {
      const img = imageRef.current;
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 40;
      const containerHeight = container.clientHeight - 40;
      
      const scaleX = containerWidth / imageDimensions.width;
      const scaleY = containerHeight / imageDimensions.height;
      const fitZoom = Math.min(scaleX, scaleY, 1);
      
      setZoom(fitZoom);
      setPosition({ x: 0, y: 0 });
      setFitToScreen(true);
    }
  };

  const handleActualSize = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setFitToScreen(false);
  };

  const handleMouseDown = (e) => {
    // Allow dragging at any zoom level
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add mouse move listener to document
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5));
    setFitToScreen(false);
  };

  return (
    <div className="w-full h-[80vh] bg-[var(--surface)] rounded-lg overflow-hidden relative">
      {/* Zoom Controls */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-[var(--secondary)] rounded transition-colors"
              title="Zoom Out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <span className="text-sm font-mono min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-[var(--secondary)] rounded transition-colors"
              title="Zoom In"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg">
          <button
            onClick={handleFitToScreen}
            className={`px-3 py-2 text-sm rounded-l transition-colors ${
              fitToScreen 
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' 
                : 'hover:bg-[var(--secondary)]'
            }`}
            title="Fit to Screen"
          >
            Fit
          </button>
          <button
            onClick={handleActualSize}
            className={`px-3 py-2 text-sm rounded-r border-l border-[var(--border)] transition-colors ${
              !fitToScreen && zoom === 1
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' 
                : 'hover:bg-[var(--secondary)]'
            }`}
            title="Actual Size (100%)"
          >
            100%
          </button>
        </div>
      </div>

      {/* Image Dimensions Info */}
      {imageLoaded && (
        <div className="absolute top-4 right-4 z-10 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-lg">
          <div className="text-sm text-[var(--secondary-foreground)]">
            {imageDimensions.width} × {imageDimensions.height}
          </div>
        </div>
      )}

      {/* Image Container */}
      <div 
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ 
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <img
          ref={imageRef}
          src={url}
          alt={displayName}
          className="transition-transform duration-200 ease-out select-none"
          style={{
            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            maxWidth: 'none',
            maxHeight: 'none'
          }}
          onLoad={handleImageLoad}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          draggable={false}
        />
      </div>

      {/* Instructions */}
      {imageLoaded && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-lg">
          <div className="text-xs text-[var(--secondary-foreground)] text-center">
            Drag to pan • Scroll to zoom • Click buttons to control view
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced Word Document Viewer with multiple fallback methods and better UX
const WordDocumentViewer = ({ url, displayName, setIsLoading, setHasError, hasError }) => {
  const [currentViewer, setCurrentViewer] = useState(0);
  const [loadAttempts, setLoadAttempts] = useState(0);
  const [viewerStatus, setViewerStatus] = useState('loading'); // loading, success, failed, retrying
  const [retryCount, setRetryCount] = useState(0);
  const iframeRef = useRef(null);

  // Available viewers in order of preference
  const viewers = [
    {
      name: "Microsoft Office Online",
      url: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`,
      description: "Using Microsoft Office Online viewer",
      icon: "🏢"
    },
    {
      name: "Google Docs Viewer",
      url: `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`,
      description: "Using Google Docs viewer",
      icon: "📄"
    },
    {
      name: "Alternative Google Viewer",
      url: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`,
      description: "Using alternative Google viewer",
      icon: "🔄"
    }
  ];

  const currentViewerData = viewers[currentViewer];

  // Reset when URL changes
  useEffect(() => {
    setCurrentViewer(0);
    setLoadAttempts(0);
    setViewerStatus('loading');
    setRetryCount(0);
    setIsLoading(true);
    setHasError(false);
  }, [url]);

  const handleLoadSuccess = () => {
    setIsLoading(false);
    setViewerStatus('success');
    console.log(`✅ Document loaded successfully with ${currentViewerData.name}`);
  };

  const handleLoadError = () => {
    console.warn(`❌ ${currentViewerData.name} failed to load document`);
    
    if (currentViewer < viewers.length - 1) {
      // Try next viewer
      setCurrentViewer(prev => prev + 1);
      setViewerStatus('retrying');
      setLoadAttempts(prev => prev + 1);
      
      // Small delay before trying next method
      setTimeout(() => {
        setViewerStatus('loading');
      }, 1000);
    } else {
      // All viewers failed
      setIsLoading(false);
      setHasError(true);
      setViewerStatus('failed');
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setCurrentViewer(0);
    setLoadAttempts(0);
    setViewerStatus('loading');
    setIsLoading(true);
    setHasError(false);
  };

  const handleIframeLoad = () => {
    // Check if iframe actually loaded content or failed
    const iframe = iframeRef.current;
    if (iframe) {
      try {
        // Add a delay to ensure content is actually loaded
        setTimeout(() => {
          // Try to check if iframe has content, if it's blocked it will throw error
          if (iframe.contentWindow) {
            handleLoadSuccess();
          } else {
            handleLoadError();
          }
        }, 2000);
      } catch (e) {
        // Cross-origin restrictions, assume it loaded if no immediate error
        setTimeout(handleLoadSuccess, 2000);
      }
    }
  };

  if (hasError || viewerStatus === 'failed') {
    return (
      <div className="w-full h-[80vh] bg-[var(--surface)] rounded-lg overflow-hidden relative flex items-center justify-center">
        <div className="text-center p-8 max-w-lg text-[var(--secondary-foreground)]">
          <div className="mb-6">
            <FileText className="w-20 h-20 mx-auto opacity-30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Document Preview Unavailable</h3>
            <p className="text-sm leading-relaxed mb-1">
              Unable to preview this Word document using available online viewers.
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">
              Attempted {loadAttempts + 1} different preview methods • Retry #{retryCount}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center mb-6">
            <button
              onClick={() => window.open(url, "_blank")}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:bg-[var(--primary)]/90 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Browser
            </button>
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = url;
                link.download = displayName;
                link.click();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--secondary)] text-[var(--secondary-foreground)] rounded-lg hover:bg-[var(--secondary)]/80 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Download className="w-4 h-4" />
              Download File
            </button>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--muted)] text-[var(--muted-foreground)] rounded-lg hover:bg-[var(--muted)]/80 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry Preview
            </button>
          </div>

          {/* Help Information */}
          <div className="bg-[var(--muted)]/20 rounded-lg p-4 text-left">
            <h4 className="text-sm font-medium mb-2 text-[var(--foreground)]">💡 Why might this happen?</h4>
            <ul className="text-xs text-[var(--muted-foreground)] space-y-1 list-disc list-inside">
              <li>Document requires authentication or permissions</li>
              <li>File may be corrupted or in an unsupported format</li>
              <li>Online viewers may be temporarily unavailable</li>
              <li>Network connectivity issues</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted-foreground)]">
                <strong>Recommendation:</strong> Download the file and open with Microsoft Word for best compatibility.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[80vh] bg-[var(--surface)] rounded-lg overflow-hidden relative">
      {/* Status Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-4 py-2 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{currentViewerData.icon}</span>
              <div>
                <div className="text-sm font-medium text-[var(--foreground)]">
                  {currentViewerData.name}
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {viewerStatus === 'loading' && 'Loading document...'}
                  {viewerStatus === 'retrying' && 'Switching to backup viewer...'}
                  {viewerStatus === 'success' && 'Document loaded successfully'}
                </div>
              </div>
            </div>
            
            {(viewerStatus === 'loading' || viewerStatus === 'retrying') && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--primary)]"></div>
            )}
          </div>
        </div>

        {/* Viewer Selection */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span>Method:</span>
            <span className="font-mono">{currentViewer + 1}/{viewers.length}</span>
            {loadAttempts > 0 && (
              <span className="text-[var(--warning)]">• {loadAttempts} attempts</span>
            )}
          </div>
        </div>
      </div>

      {/* Document Viewer */}
      <iframe
        ref={iframeRef}
        key={`${currentViewer}-${retryCount}`} // Force re-render when viewer changes
        src={currentViewerData.url}
        className="w-full h-full border-0"
        title={`${displayName} - ${currentViewerData.name}`}
        onLoad={handleIframeLoad}
        onError={handleLoadError}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        loading="eager"
      />

      {/* Retrying Overlay */}
      {viewerStatus === 'retrying' && (
        <div className="absolute inset-0 bg-[var(--surface)]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
            <p className="text-[var(--foreground)] font-medium">Switching to backup viewer...</p>
            <p className="text-[var(--muted-foreground)] text-sm mt-1">
              Trying {viewers[currentViewer + 1]?.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
