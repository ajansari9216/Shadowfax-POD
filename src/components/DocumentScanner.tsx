import React, { useState, useRef, useEffect } from "react";
import { Check, X, Maximize, Crop } from "lucide-react";
import { detectCorners, applyPerspectiveTransform, Point } from "../lib/scanner";

interface DocumentScannerProps {
  imageFile: File;
  onCancel: () => void;
  onConfirm: (processedImageSrc: string, originalImageFile: File) => void;
}

export default function DocumentScanner({ imageFile, onCancel, onConfirm }: DocumentScannerProps) {
  const [imgSrc, setImgSrc] = useState<string>("");
  const [corners, setCorners] = useState<Point[]>([
    { x: 50, y: 50 },
    { x: 250, y: 50 },
    { x: 250, y: 350 },
    { x: 50, y: 350 },
  ]);
  const [imgSize, setImgSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const src = URL.createObjectURL(imageFile);
    setImgSrc(src);
    
    const img = new Image();
    img.onload = async () => {
      setImgSize({ width: img.width, height: img.height });
      
      // Auto detect
      try {
        const detected = await detectCorners(src);
        setCorners(detected);
      } catch (e) {
        // use default box
      }
      setLoading(false);
    };
    img.src = src;
    
    return () => URL.revokeObjectURL(src);
  }, [imageFile]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && imgSize.width > 0) {
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        
        // Calculate fit
        const scaleX = rect.width / imgSize.width;
        const scaleY = rect.height / imgSize.height;
        const scale = Math.min(scaleX, scaleY);
        
        setDisplaySize({
          width: imgSize.width * scale,
          height: imgSize.height * scale,
        });
      }
    };
    
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [imgSize]);

  const scalePointToDisplay = (pt: Point) => {
    if (imgSize.width === 0) return { x: 0, y: 0 };
    return {
      x: (pt.x / imgSize.width) * displaySize.width,
      y: (pt.y / imgSize.height) * displaySize.height,
    };
  };

  const scalePointToImage = (x: number, y: number) => {
    if (displaySize.width === 0) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(imgSize.width, (x / displaySize.width) * imgSize.width)),
      y: Math.max(0, Math.min(imgSize.height, (y / displaySize.height) * imgSize.height)),
    };
  };

  const handlePointerDown = (idx: number, e: React.PointerEvent) => {
    setDraggingIdx(idx);
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate position relative to the centered image
    const imgLeft = (rect.width - displaySize.width) / 2;
    const imgTop = (rect.height - displaySize.height) / 2;
    
    const x = e.clientX - rect.left - imgLeft;
    const y = e.clientY - rect.top - imgTop;
    
    const newImgPt = scalePointToImage(x, y);
    
    const newCorners = [...corners];
    newCorners[draggingIdx] = newImgPt;
    setCorners(newCorners);
  };

  const handlePointerUp = () => {
    setDraggingIdx(null);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const transformedSrc = await applyPerspectiveTransform(imgSrc, corners);
      onConfirm(transformedSrc, imageFile);
    } catch (e) {
      console.error(e);
      // Fallback
      onConfirm(imgSrc, imageFile);
    }
  };

  if (loading) {
    return (
      <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#00FF66] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black z-50 flex flex-col">
      <div className="p-4 flex items-center justify-between glass border-b border-white/10 z-10">
        <button onClick={onCancel} className="p-2 text-white/70 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Crop className="w-5 h-5 text-[#00FF66]" />
          Adjust Corners
        </h3>
        <button onClick={handleConfirm} className="p-2 text-[#00FF66] hover:text-[#00e65c]">
          <Check className="w-6 h-6" />
        </button>
      </div>

      <div 
        className="flex-1 relative overflow-hidden flex items-center justify-center"
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {imgSrc && (
          <div 
            className="relative" 
            style={{ width: displaySize.width, height: displaySize.height }}
          >
            <img 
              src={imgSrc} 
              alt="Scan" 
              className="w-full h-full object-contain pointer-events-none" 
            />
            
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10">
              <polygon
                points={corners.map(c => {
                  const pt = scalePointToDisplay(c);
                  return `${pt.x},${pt.y}`;
                }).join(" ")}
                fill="rgba(0, 255, 102, 0.1)"
                stroke="#00FF66"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            </svg>
            
            {corners.map((c, i) => {
              const pt = scalePointToDisplay(c);
              return (
                <div
                  key={i}
                  className="absolute w-12 h-12 -ml-6 -mt-6 flex items-center justify-center cursor-move touch-none z-20"
                  style={{ left: pt.x, top: pt.y }}
                  onPointerDown={(e) => handlePointerDown(i, e)}
                >
                  <div className="w-4 h-4 bg-white border-2 border-[#00FF66] rounded-full shadow-lg pointer-events-none" />
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <div className="p-6 text-center text-white/50 text-sm glass border-t border-white/10 z-10">
        Drag the corners to fit the document edges.
      </div>
    </div>
  );
}
