import React, { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";
import { Camera, X, CheckCircle2 } from "lucide-react";

interface LiveCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export const LiveCamera: React.FC<LiveCameraProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Tesseract.Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAligned, setIsAligned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        if (!active) return;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        const worker = await Tesseract.createWorker("eng", 1, {
          logger: () => {} // silence logging for live feed
        });
        if (!active) {
          await worker.terminate();
          return;
        }
        workerRef.current = worker;
        setIsReady(true);
        startScanning(worker);

      } catch (err) {
        console.error(err);
        setError("Camera access denied or unavailable. Please use normal photo upload.");
      }
    };

    init();

    return () => {
      active = false;
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const startScanning = (worker: Tesseract.Worker) => {
    scanIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || !workerRef.current) return;
      
      const canvas = document.createElement("canvas");
      // Downscale aggressively for fast processing (we only need to read "AWB" or big numbers)
      const w = 480;
      const h = (videoRef.current.videoHeight / videoRef.current.videoWidth) * w || 640;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      
      ctx.drawImage(videoRef.current, 0, 0, w, h);
      
      try {
        const { data } = await worker.recognize(canvas);
        const text = data.text.toUpperCase();
        
        // ML Heuristic: Check if 'AWB', 'REF' or any R123... number is visible
        const hasHeader = text.includes("AWB") || text.includes("REF") || text.includes("SR");
        const hasAwbNumber = /R[A-Z0-9]{8,15}/.test(text);
        
        if (hasHeader || hasAwbNumber) {
          setIsAligned(true);
        } else {
          setIsAligned(false);
        }
      } catch (err) {
        // ignore errors during fast scan
      }
      
    }, 800);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    
    // Capture at full video resolution
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        onCapture(file);
      }
    }, "image/jpeg", 0.95);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-white font-medium">Smart Focus Mode</div>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white backdrop-blur-md">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Video Feed */}
      <div className="relative flex-1 bg-[#111] overflow-hidden flex items-center justify-center">
        {error ? (
          <div className="text-white/50 px-8 text-center bg-[#222] p-6 rounded-2xl">
            <p className="mb-4">{error}</p>
            <button onClick={onClose} className="px-4 py-2 bg-white/10 rounded-lg text-white">Go Back</button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            {/* Guide Frame Overlay */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
              <div className={`text-white font-medium text-sm text-center mb-8 px-4 py-2 backdrop-blur-md rounded-full shadow-lg transition-colors ${isAligned ? 'bg-[#00FF66] text-black' : 'bg-black/60'}`}>
                {isReady ? (isAligned ? "AWB Detected! Ready to capture." : "Align the AWB Ref No column inside the frame") : "Initializing ML Engine..."}
              </div>
              
              <div className={`w-full max-w-xs aspect-[1/2] relative transition-colors duration-500 ${isAligned ? 'text-[#00FF66]' : 'text-white/50'}`}>
                {/* Frame shading/corners */}
                <div className="absolute -inset-1 border-2 border-current opacity-20 rounded-xl" />
                <div className="absolute -top-2 -left-2 w-10 h-10 border-t-4 border-l-4 border-current rounded-tl-xl"></div>
                <div className="absolute -top-2 -right-2 w-10 h-10 border-t-4 border-r-4 border-current rounded-tr-xl"></div>
                <div className="absolute -bottom-2 -left-2 w-10 h-10 border-b-4 border-l-4 border-current rounded-bl-xl"></div>
                <div className="absolute -bottom-2 -right-2 w-10 h-10 border-b-4 border-r-4 border-current rounded-br-xl"></div>
                
                {/* Center Reticle */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-1 bg-current opacity-20 rounded-full" />
                  <div className="absolute w-1 h-16 bg-current opacity-20 rounded-full" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="p-8 pb-12 bg-black flex justify-center items-center z-20">
        <button 
          onClick={handleCapture}
          disabled={!isReady || !!error}
          className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all ${isAligned ? 'border-[#00FF66] scale-105 shadow-[0_0_20px_rgba(0,255,102,0.4)]' : 'border-white'} ${(!isReady || !!error) ? 'opacity-50' : 'active:scale-95'}`}
        >
          <div className={`w-16 h-16 rounded-full transition-colors ${isAligned ? 'bg-[#00FF66]' : 'bg-white'}`}></div>
        </button>
      </div>
    </div>
  );
};
