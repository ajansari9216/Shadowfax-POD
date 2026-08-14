import React, { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  UploadCloud,
  Camera,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function UploadPod({
  onUploadComplete,
}: {
  onUploadComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [manualAwb, setManualAwb] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setStatus("");
      setErrorMessage(null);
    }
  };

  const clearSelection = () => {
    setFile(null);
    setPreview(null);
    setManualAwb("");
    setStatus("");
    setErrorMessage(null);
  };

  const handleUpload = async () => {
    if (!file || loading) return;
    
    setErrorMessage(null);
    
    const awb = manualAwb.trim();
    if (!awb) {
      setErrorMessage("AWB number is required");
      return;
    }

    setLoading(true);
    let isSuccess = false;
    
    try {
      // Check authentication early before uploading
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("You must be logged in to upload PODs.");
      }

      // 1. Upload ORIGINAL image to Supabase Storage
      setStatus("Uploading POD...");
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

      // 2. Save to Database
      setStatus("Saving record to database...");
      setProgress(80);

      const { error: dbError } = await supabase.from("pod_images").insert({
        user_id: user.id,
        image_url: publicUrlData.publicUrl,
        ocr_text: "",
        tracking_numbers: [awb],
      });

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      isSuccess = true;
      setStatus("POD uploaded successfully");
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
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain"
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
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-white/70 ml-1">AWB Number</label>
            <input
              type="text"
              value={manualAwb}
              onChange={(e) => setManualAwb(e.target.value)}
              placeholder="Enter or paste AWB number"
              className="w-full bg-[#111] border border-[#333] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#00FF66] focus:ring-1 focus:ring-[#00FF66] transition-all placeholder:text-white/30 text-sm"
              disabled={loading}
            />
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
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-[#00FF66]">
                    {status}
                  </span>
                  <span className="text-sm text-white/50 font-mono">
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
