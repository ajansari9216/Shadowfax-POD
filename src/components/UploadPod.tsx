import React, { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  UploadCloud,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  ScanSearch,
  Loader2,
  Copy
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { detectAwbsInImage, extractWordsFromImage, OcrWord } from "../lib/ocr";

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
  
  const [activeAwbIndex, setActiveAwbIndex] = useState(0);

  // OCR specific states
  const [isFindingAwbs, setIsFindingAwbs] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [detectedAwbs, setDetectedAwbs] = useState<string[]>([]);
  const [hasSearchedAwbs, setHasSearchedAwbs] = useState(false);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);

  // On-image OCR states
  const [imageWords, setImageWords] = useState<OcrWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<OcrWord | null>(null);
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

  const handleCopyAwb = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAwb(text);
      setTimeout(() => setCopiedAwb(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const awbInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setStatus("");
      setSubStatus("");
      setErrorMessage(null);
      setActiveAwbIndex(0);
      
      // Reset OCR state
      setDetectedAwbs([]);
      setHasSearchedAwbs(false);
      setIsFindingAwbs(false);
      setImageWords([]);
      setSelectedWord(null);
      
      // Background OCR for on-image tap selection
      extractWordsFromImage(selectedFile).then((words) => {
        // Filter out tiny words that aren't AWB candidates to avoid too many hit boxes
        const isAwbLike = (text: string) => {
          const clean = text.replace(/[^A-Z0-9]/gi, "").toUpperCase();
          return clean.length >= 8 && clean.length <= 25 && /[0-9]/.test(clean);
        };
        setImageWords(words.filter(w => isAwbLike(w.text)));
      }).catch(err => console.error("Background OCR failed:", err));
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
    setDetectedAwbs([]);
    setHasSearchedAwbs(false);
    setIsFindingAwbs(false);
    setImageWords([]);
    setSelectedWord(null);
  };

  const addAwbField = () => {
    if (awbs.length < 20) {
      setAwbs([...awbs, ""]);
      setTimeout(() => {
        const index = awbs.length; // Length is the new index
        if (awbInputRefs.current[index]) {
          awbInputRefs.current[index]?.focus();
        }
      }, 50);
    }
  };

  const removeAwbField = (indexToRemove: number) => {
    const newAwbs = awbs.filter((_, index) => index !== indexToRemove);
    setAwbs(newAwbs.length > 0 ? newAwbs : [""]);
  };

  const updateAwbField = (index: number, value: string) => {
    const newAwbs = [...awbs];
    newAwbs[index] = value;
    setAwbs(newAwbs);
  };

  const findAwbs = async () => {
    if (!file) return;
    setIsFindingAwbs(true);
    setHasSearchedAwbs(true);
    setOcrProgress(0);
    
    try {
      const found = await detectAwbsInImage(file, (p) => setOcrProgress(p));
      setDetectedAwbs(found);
    } catch (err) {
      console.error("OCR detection failed:", err);
      // Fail silently for user, show the not found state
      setDetectedAwbs([]);
    } finally {
      setIsFindingAwbs(false);
    }
  };

  const handleAddDetectedAwb = (awb: string) => {
    const currentCleaned = awbs.map(a => a.trim());
    if (currentCleaned.includes(awb)) {
      // Already added, just remove from suggestions
      setDetectedAwbs(prev => prev.filter(a => a !== awb));
      return;
    }

    const newAwbs = [...awbs];
    const emptyIndex = newAwbs.findIndex(a => a.trim() === "");

    if (emptyIndex !== -1) {
      newAwbs[emptyIndex] = awb;
    } else if (newAwbs.length < 20) {
      newAwbs.push(awb);
    } else {
      setErrorMessage("Maximum 20 AWB numbers allowed.");
      return;
    }

    setAwbs(newAwbs);
    // Remove from suggestions list for checklist feel
    setDetectedAwbs(prev => prev.filter(a => a !== awb));
  };

  const handleUpload = async () => {
    if (!file || loading) return;
    
    setErrorMessage(null);
    
    // Clean and validate AWBs
    const cleanedAwbs = awbs.map(a => a.trim()).filter(a => a !== "");
    
    if (cleanedAwbs.length === 0) {
      setErrorMessage("Please enter at least one AWB number.");
      return;
    }

    if (new Set(cleanedAwbs).size !== cleanedAwbs.length) {
      setErrorMessage("Duplicate AWB number.");
      return;
    }

    setLoading(true);
    let isSuccess = false;
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("You must be logged in to upload PODs.");
      }

      setStatus("Uploading POD...");
      setSubStatus(`Saving ${cleanedAwbs.length} AWB numbers...`);
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

      const insertPayload = cleanedAwbs.map(awb => ({
        user_id: user.id,
        image_url: publicUrlData.publicUrl,
        ocr_text: "",
        tracking_numbers: [awb],
      }));

      const { error: dbError } = await supabase.from("pod_images").insert(insertPayload);

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      isSuccess = true;
      setStatus("POD uploaded successfully");
      setSubStatus(`${cleanedAwbs.length} AWB numbers saved`);
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1 tracking-tight">Upload POD</h2>
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
            onClick={() => cameraInputRef.current?.click()}
            className="w-full max-w-sm aspect-square glass border-2 border-dashed border-white/20 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-[#00FF66]/50 hover:bg-[#00FF66]/5 transition-all active:scale-[0.98]"
          >
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center border border-white/10">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <span className="font-medium text-lg">Take Photo</span>
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
            onClick={() => setSelectedWord(null)} // Click outside to clear selection
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
              {imgDims.w > 0 && imgDims.nw > 0 && imageWords.map((word, i) => {
                const scaleX = imgDims.w / imgDims.nw;
                const scaleY = imgDims.h / imgDims.nh;
                const left = word.bbox.x0 * scaleX;
                const top = word.bbox.y0 * scaleY;
                const width = (word.bbox.x1 - word.bbox.x0) * scaleX;
                const height = (word.bbox.y1 - word.bbox.y0) * scaleY;
                
                return (
                  <div
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setSelectedWord(word); }}
                    className={`absolute cursor-pointer rounded border ${selectedWord === word ? 'bg-[#00FF66]/20 border-[#00FF66]' : 'bg-transparent border-transparent'}`}
                    style={{ left, top, width, height }}
                  >
                    {selectedWord === word && (
                      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-[#111] border border-white/20 shadow-xl rounded-xl p-2 flex flex-col items-center gap-2 pointer-events-auto">
                        <span className="text-[#00FF66] font-mono text-sm px-2 tracking-wide whitespace-nowrap">
                          {word.text}
                        </span>
                        <div className="flex gap-2 w-full">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyAwb(word.text);
                            }}
                            className="flex-1 bg-white/10 hover:bg-[#00FF66]/20 text-white hover:text-[#00FF66] text-xs font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                          >
                            {copiedAwb === word.text ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copiedAwb === word.text ? "Copied" : "Copy AWB"}
                          </button>
                        </div>
                      </div>
                    )}
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
          </div>
          
          <div className="flex flex-col gap-3">
            {/* OCR Helper Section */}
            {!loading && (
              <div className="mb-2">
                {isFindingAwbs ? (
                  <div className="flex items-center justify-center p-4 gap-3 bg-white/5 rounded-xl border border-white/10">
                    <Loader2 className="w-5 h-5 animate-spin text-[#00FF66]" />
                    <span className="text-sm font-medium text-[#00FF66]">Finding AWB Numbers... {Math.round(ocrProgress * 100)}%</span>
                  </div>
                ) : detectedAwbs.length > 0 ? (
                  <div className="bg-[#111] border border-white/10 rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white/70">Detected AWB Numbers</h3>
                      <button onClick={() => setDetectedAwbs([])} className="text-xs text-white/40 hover:text-white">Clear</button>
                    </div>
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {detectedAwbs.map(awb => (
                        <div key={awb} className="flex justify-between items-center glass p-2 rounded-lg relative">
                          <span className="font-mono text-[#00FF66] text-sm tracking-wide">{awb}</span>
                          <div className="flex gap-2 items-center">
                            {copiedAwb === awb && (
                              <span className="text-[10px] text-[#00FF66] absolute right-32 animate-in fade-in slide-in-from-right-2">
                                AWB copied
                              </span>
                            )}
                            <button
                              onClick={() => handleCopyAwb(awb)}
                              className="bg-white/5 hover:bg-white/10 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </button>
                            <button
                              onClick={() => handleAddDetectedAwb(awb)}
                              className="bg-white/10 hover:bg-[#00FF66]/20 text-white hover:text-[#00FF66] text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-white/40 leading-tight">
                      Verify numbers before adding. OCR is an assistive helper only.
                    </p>
                  </div>
                ) : hasSearchedAwbs ? (
                   <div className="bg-[#111] border border-white/10 rounded-xl p-4 flex flex-col gap-2 items-center text-center">
                     <span className="text-sm text-yellow-400">AWB not detected. Enter it manually.</span>
                   </div>
                ) : (
                  <button
                    onClick={findAwbs}
                    className="w-full bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/30 text-[#00FF66] px-5 py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
                  >
                    <ScanSearch className="w-5 h-5" />
                    Find AWB Numbers
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-between items-center ml-1">
              <label className="text-sm font-medium text-white/70">AWB Numbers</label>
              <span className="text-xs font-mono text-white/50 bg-white/5 px-2 py-1 rounded-md">
                AWB: {awbs.length} / 20
              </span>
            </div>
            
            <div className="flex flex-col gap-2 max-h-[30vh] overflow-y-auto pr-1 custom-scrollbar">
              {awbs.map((awb, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    ref={(el) => (awbInputRefs.current[index] = el)}
                    value={awb}
                    onChange={(e) => updateAwbField(index, e.target.value)}
                    onFocus={() => setActiveAwbIndex(index)}
                    placeholder="Enter or paste AWB number"
                    className={`flex-1 bg-[#111] border rounded-xl py-3 px-4 text-white focus:outline-none transition-all placeholder:text-white/30 text-sm ${
                      activeAwbIndex === index 
                        ? "border-[#00FF66] ring-1 ring-[#00FF66]" 
                        : "border-[#333] focus:border-[#00FF66] focus:ring-1 focus:ring-[#00FF66]"
                    }`}
                    disabled={loading}
                  />
                  <button
                    onClick={() => removeAwbField(index)}
                    disabled={loading}
                    className="w-12 flex-shrink-0 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl flex items-center justify-center text-red-500 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {!loading && awbs.length >= 20 && (
              <p className="text-xs text-yellow-500 text-center py-2">
                Maximum 20 AWB numbers allowed.
              </p>
            )}

            {!loading && awbs.length < 20 && (
              <button
                onClick={addAwbField}
                className="w-full py-3 border border-dashed border-white/20 rounded-xl text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add AWB
              </button>
            )}
          </div>

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
