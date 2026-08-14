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
import { detectAwbsInImage } from "../lib/ocr";

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
          <div className="relative rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl aspect-[3/4] sm:aspect-[4/3] flex-shrink-0">
            {/* Block native image copy/share menus completely */}
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain select-none"
              style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
            />
            
            {!loading && (
              <button
                onClick={clearSelection}
                className="absolute top-4 right-4 w-10 h-10 glass rounded-full flex items-center justify-center text-white hover:bg-red-500/80 transition-colors"
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
