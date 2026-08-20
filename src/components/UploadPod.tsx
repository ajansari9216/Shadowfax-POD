import React, { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  UploadCloud,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Plus,
  ScanSearch,
  Loader2,
  Copy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { detectAwbBoxesInImage, OcrWord } from "../lib/ocr";
import { LiveCamera } from "./LiveCamera";

export default function UploadPod({
  onUploadComplete,
}: {
  onUploadComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [subStatus, setSubStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [awbs, setAwbs] = useState<string[]>([""]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [debugClicks, setDebugClicks] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  
  const handleTitleClick = () => {
    setDebugClicks(prev => {
      if (prev + 1 >= 5) {
        setShowDebug(s => !s);
        return 0;
      }
      return prev + 1;
    });
  };
  

  // On-image OCR states
  const [isFindingAwbs, setIsFindingAwbs] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imageWords, setImageWords] = useState<OcrWord[]>([]);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0, nw: 0, nh: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateDimensions = () => {
    if (imgRef.current && containerRef.current) {
      const { naturalWidth: nw, naturalHeight: nh } = imgRef.current;
      const { clientWidth: cw, clientHeight: ch } = containerRef.current;
      if (!nw || !nh || !cw || !ch) return;
      
      const containerRatio = cw / ch;
      const imgRatio = nw / nh;
      let w, h;
      if (imgRatio > containerRatio) {
        w = cw;
        h = cw / imgRatio;
      } else {
        h = ch;
        w = ch * imgRatio;
      }
      setImgDims({ w, h, nw, nh });
    }
  };

  React.useEffect(() => {
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

    const handleCopyAwb = async (rawText: string) => {
    const text = rawText.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    
    const fallbackCopyTextToClipboard = (text: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.prepend(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
      } catch (error) {
        console.error(error);
      } finally {
        textArea.remove();
      }
    };

    try {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(text);
        } catch (err) {
          console.error("Clipboard API failed, trying fallback:", err);
          fallbackCopyTextToClipboard(text);
        }
      } else {
        fallbackCopyTextToClipboard(text);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
    
    // Always execute the UI update regardless of clipboard success
    setCopiedAwb(text);
    setTimeout(() => setCopiedAwb(null), 2000);
    
    // Auto-add to empty field
    setAwbs(currentAwbs => {
      const newAwbs = [...currentAwbs];
      const currentCleaned = newAwbs.map(a => a.trim());
      
      if (currentCleaned.includes(text)) {
        return currentAwbs; // already exists
      }
      
      const emptyIndex = newAwbs.findIndex(a => a.trim() === "");
      if (emptyIndex !== -1) {
        newAwbs[emptyIndex] = text;
      } else if (newAwbs.length < 20) {
        newAwbs.push(text);
      } else {
        setErrorMessage("Maximum 20 AWB numbers allowed.");
      }
      return newAwbs;
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleLiveCapture = (capturedFile: File) => {
    setShowLiveCamera(false);
    setFile(capturedFile);
    setPreview(URL.createObjectURL(capturedFile));
    setStatus("");
    setSubStatus("");
    setErrorMessage(null);
    setImageWords([]);
    
    // Auto-start scanning
    setTimeout(() => {
      setIsFindingAwbs(true);
      setOcrProgress(0);
      detectAwbBoxesInImage(capturedFile, (p) => setOcrProgress(p))
        .then(words => {
          setImageWords(words);
          if (words.length > 0) {
            const uniqueDetected = Array.from(new Set(words.map(w => w.text.replace(/[^A-Z0-9]/gi, "").toUpperCase())));
            setAwbs(uniqueDetected.slice(0, 20));
          }
        })
        .catch(err => {
          console.error("OCR detection failed:", err);
        })
        .finally(() => setIsFindingAwbs(false));
    }, 500);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setStatus("");
      setSubStatus("");
      setErrorMessage(null);
      
      // Reset OCR state
      setImageWords([]);
      setIsFindingAwbs(true);
      setOcrProgress(0);

      detectAwbBoxesInImage(selectedFile, (p) => setOcrProgress(p))
        .then(words => {
          setImageWords(words);
          if (words.length > 0) {
            const uniqueDetected = Array.from(new Set(words.map(w => w.text.replace(/[^A-Z0-9]/gi, "").toUpperCase())));
            setAwbs(uniqueDetected.slice(0, 20));
          }
        })
        .catch(err => {
          console.error("OCR detection failed:", err);
        })
        .finally(() => {
          setIsFindingAwbs(false);
        });
    }
  };

  const clearSelection = () => {
    setFile(null);
    setPreview(null);
    setAwbs([""]);
    setStatus("");
    setSubStatus("");
    setErrorMessage(null);
    
    // Reset OCR state
    setImageWords([]);
    setIsFindingAwbs(false);
  };


  

  const handleUpload = async () => {
    if (!file || loading) return;
    
    setErrorMessage(null);
    
    // Clean and validate AWBs
    const cleanedAwbs = awbs.map(a => a.trim()).filter(a => a !== "");
    
    if (cleanedAwbs.length === 0) {
      setErrorMessage(imageWords.length > 0 ? "Please select at least one AWB." : "Please enter at least one AWB number.");
      return;
    }

    // De-duplicate in the same payload
    const uniqueAwbs = Array.from(new Set<string>(cleanedAwbs));

    setLoading(true);
    let isSuccess = false;
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("You must be logged in to upload PODs.");
      }

      setStatus("Checking for duplicates...");
      setProgress(10);

      // Fetch existing tracking numbers that match our uniqueAwbs
      const { data: existingRecords, error: checkError } = await supabase
        .from("pod_images")
        .select("tracking_numbers")
        .overlaps("tracking_numbers", uniqueAwbs);

      if (checkError) {
        throw new Error(`Database error: ${checkError.message}`);
      }

      const existingAwbs = new Set<string>();
      if (existingRecords) {
        existingRecords.forEach(record => {
          if (record.tracking_numbers) {
            record.tracking_numbers.forEach((awb: string) => existingAwbs.add(awb));
          }
        });
      }

      const newAwbsToSave = uniqueAwbs.filter(awb => !existingAwbs.has(awb));

      if (newAwbsToSave.length === 0) {
        setErrorMessage("All selected AWBs have already been uploaded.");
        setLoading(false);
        return;
      }

      setStatus("Uploading POD...");
      setSubStatus(`Saving ${newAwbsToSave.length} new AWB number(s)...`);
      setProgress(30);

      const fileExt = file.name ? file.name.split(".").pop() : "jpg";
      const filePath = `${user.id}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("pod-images")
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Storage error: ${uploadError.message}`);
      }

      setProgress(60);

      const { data: publicUrlData } = supabase.storage
        .from("pod-images")
        .getPublicUrl(filePath);

      setProgress(80);

      const insertPayload = newAwbsToSave.map(awb => ({
        user_id: user.id,
        image_url: filePath,
        ocr_text: "",
        tracking_numbers: [awb],
      }));

      const { error: dbError } = await supabase.from("pod_images").insert(insertPayload);

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      isSuccess = true;
      setStatus("POD uploaded successfully");
      setSubStatus(`${newAwbsToSave.length} AWB number(s) saved`);
      setProgress(100);

      setTimeout(() => {
        onUploadComplete();
      }, 1500);
    } catch (err: any) {
      console.error("Upload process failed:", err);
      if (err.message && err.message.includes("Bucket not found")) {
        setErrorMessage("Upload failed: Storage bucket 'pod-images' not found.");
      } else {
        setErrorMessage(err.message || "Unknown error occurred");
      }
      setStatus("Failed");
      setSubStatus("");
    } finally {
      if (!isSuccess) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="p-4 pt-8 h-full flex flex-col">
      {showLiveCamera && (
        <LiveCamera 
          onCapture={handleLiveCapture} 
          onClose={() => setShowLiveCamera(false)} 
        />
      )}
      <div className="mb-6">
        <h2 
          className="text-2xl font-bold mb-1 tracking-tight select-none cursor-pointer" 
          onClick={handleTitleClick}
        >
          Upload POD {showDebug && <span className="text-xs text-red-500 font-mono align-middle ml-2 border border-red-500 px-1 rounded">DEBUG</span>}
        </h2>
        <p className="text-sm text-white/50">
          Capture or select a proof of delivery photo.
        </p>
      </div>

      {!preview ? (
        <div className="flex-1 flex flex-col gap-4 justify-center items-center">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={cameraInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />
          
          <button
            onClick={() => setShowLiveCamera(true)}
            className="w-full max-w-sm aspect-square glass border-2 border-dashed border-white/20 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-[#00FF66]/50 hover:bg-[#00FF66]/5 transition-all active:scale-[0.98]"
          >
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center border border-white/10 relative overflow-hidden">
              <Camera className="w-10 h-10 text-white relative z-10" />
              <div className="absolute inset-0 border-4 border-[#00FF66] rounded-full scale-110 opacity-20"></div>
            </div>
            <div className="flex flex-col items-center">
              <span className="font-medium text-lg">Smart Camera</span>
              <span className="text-xs text-[#00FF66] font-medium mt-1">Focus Mode</span>
            </div>
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-sm glass border border-white/10 rounded-2xl p-4 flex items-center justify-center gap-3 hover:bg-white/5 transition-colors active:scale-[0.98]"
          >
            <ImageIcon className="w-5 h-5 text-white/50" />
            <span className="font-medium text-sm">Choose from Gallery</span>
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4">
          <div 
            ref={containerRef}
            className="relative rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl aspect-[3/4] sm:aspect-[4/3] flex-shrink-0 flex items-center justify-center"
          >
            {/* Inner wrapper perfectly sized to the image to map OCR absolute coordinates */}
            <div className="relative" style={{ width: imgDims.w || '100%', height: imgDims.h || '100%' }}>
              <img
                ref={imgRef}
                src={preview}
                alt="Preview"
                onLoad={updateDimensions}
                className="w-full h-full object-contain select-none pointer-events-none"
                style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
              
              {/* Tappable OCR Overlays */}
                                          {imgDims.w > 0 && imgDims.nw > 0 && [...imageWords].sort((a, b) => {
                const centerYA = (a.bbox.y0 + a.bbox.y1) / 2;
                const centerYB = (b.bbox.y0 + b.bbox.y1) / 2;
                if (Math.abs(centerYA - centerYB) > 20) {
                  return centerYA - centerYB;
                }
                return (a.bbox.x0 + a.bbox.x1) / 2 - (b.bbox.x0 + b.bbox.x1) / 2;
              }).map((word, i) => {
                const scaleX = imgDims.w / imgDims.nw;
                const scaleY = imgDims.h / imgDims.nh;
                
                // Keep the exact bounds
                const left = word.bbox.x0 * scaleX;
                const top = word.bbox.y0 * scaleY;
                const width = (word.bbox.x1 - word.bbox.x0) * scaleX;
                const height = (word.bbox.y1 - word.bbox.y0) * scaleY;
                
                // Expand hit area slightly for mobile tap targets but keep it transparent
                const padding = 12;
                
                return (
                                                      <div
                    key={i}
                    className="absolute z-10 flex items-center"
                    style={{
                      left: left,
                      top: top,
                      width: width,
                      height: height,
                    }}
                  >
                    {/* Outline the detected text slightly */}
                    <div className="absolute -inset-1 border border-[#00FF66]/50 rounded-sm pointer-events-none bg-[#00FF66]/10" />
                    
                    {/* Visible COPY button next to the AWB */}
                    <button
                      onPointerDown={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        handleCopyAwb(word.text); 
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="absolute left-full ml-3 px-3 py-1.5 bg-[#00FF66] text-black text-xs font-bold rounded shadow-xl active:scale-95 transition-all cursor-pointer touch-none whitespace-nowrap z-20 flex items-center gap-1"
                    >
                      {copiedAwb === word.text ? "COPIED ✓" : "COPY"}
                    </button>
                  </div>
                );
              })}
            </div>
            
            {!loading && (
              <button
                onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                className="absolute top-4 right-4 w-10 h-10 glass rounded-full flex items-center justify-center text-white hover:bg-red-500/80 transition-colors z-50"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {isFindingAwbs && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center px-4 py-2 gap-2 bg-black/80 backdrop-blur-md rounded-full border border-white/10 z-50 shadow-xl">
                <Loader2 className="w-4 h-4 animate-spin text-[#00FF66]" />
                <span className="text-xs font-medium text-[#00FF66]">Scanning AWBs... {Math.round(ocrProgress * 100)}%</span>
              </div>
            )}
          </div>
          

          
          {/* Newly added Detected AWBs list */}
          {imageWords.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <h3 className="text-sm font-medium text-white/70 ml-1">Detected AWBs ({imageWords.length})</h3>
              <div className="flex flex-col gap-2 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                {imageWords.map((word, i) => (
                  <div key={i} className="flex justify-between items-center bg-[#111] border border-white/5 rounded-xl px-4 py-3">
                    <span className="font-mono text-[#00FF66] font-medium tracking-wider">{word.text}</span>
                                        <motion.button 
                      whileHover={{ scale: 1.05, boxShadow: "0px 0px 8px rgba(0,255,102,0.4)" }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleCopyAwb(word.text)}
                      animate={{
                        backgroundColor: copiedAwb === word.text ? "#00FF66" : "rgba(0, 255, 102, 0.1)",
                        color: copiedAwb === word.text ? "#000000" : "#00FF66",
                        borderColor: copiedAwb === word.text ? "#00FF66" : "rgba(0, 255, 102, 0.2)",
                      }}
                      transition={{ duration: 0.2 }}
                      className="text-xs px-3 py-1.5 rounded-lg border font-bold min-w-[80px] text-center"
                    >
                      {copiedAwb === word.text ? "COPIED ✓" : "COPY"}
                    </motion.button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {imageWords.length === 0 && (
            <div className="flex flex-col gap-3 mt-2">
              {/* The AWB lists and manual input remain untouched below */}

              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-medium text-white/70">AWB Numbers</label>
                <span className="text-xs font-mono text-white/50 bg-white/5 px-2 py-1 rounded-md">
                  AWB: {awbs.length} / 20
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
                {awbs.filter(a => a.trim() !== "").map((awb, index) => (
                  <span key={index} className="bg-[#111] border border-[#333] text-[#00FF66] font-mono px-3 py-2 rounded-lg text-sm">
                    {awb}
                  </span>
                ))}
                {awbs.filter(a => a.trim() !== "").length === 0 && (
                  <p className="text-sm text-white/40 italic py-2">No AWBs detected yet.</p>
                )}
              </div>
            </div>
          )}

          {errorMessage && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="glass-card border border-red-500/30 bg-red-500/10 rounded-2xl p-4"
            >
              <p className="text-sm text-red-400 font-medium text-center">{errorMessage}</p>
            </motion.div>
          )}

          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card border border-white/10 rounded-2xl p-5 space-y-4"
              >
                <div className="flex flex-col mb-2 relative">
                  <span className="text-sm font-medium text-[#00FF66] mb-1">
                    {status}
                  </span>
                  {subStatus && (
                    <span className="text-xs font-medium text-white/70">
                      {subStatus}
                    </span>
                  )}
                  <span className="absolute right-0 top-0 text-sm text-white/50 font-mono">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/5">
                  <motion.div
                    className="h-full bg-[#00FF66] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "linear", duration: 0.2 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!loading && (
            <button
              onClick={handleUpload}
              className="w-full bg-[#00FF66] hover:bg-[#00e65c] text-black font-bold rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-all mt-auto text-sm"
            >
              <UploadCloud className="w-5 h-5" />
              Upload POD
            </button>
          )}
        </div>
      )}
    </div>
  );
}
