import { useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  UploadCloud,
  Camera,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import { performOCR } from "../lib/ocr";
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
  const [extractedNumbers, setExtractedNumbers] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setExtractedNumbers([]);
      setStatus("");
    }
  };

  const clearSelection = () => {
    setFile(null);
    setPreview(null);
    setExtractedNumbers([]);
    setStatus("");
  };

  const processAndUpload = async () => {
    if (!file) return;

    setLoading(true);
    try {
      // 1. Compress Image
      setStatus("Compressing image...");
      setProgress(10);
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      // 2. OCR Extraction
      setStatus("Extracting text (OCR)...");
      setProgress(30);
      const { text, numbers } = await performOCR(compressedFile, (p) => {
        setProgress(30 + p * 40);
      });
      setExtractedNumbers(numbers);

      if (numbers.length === 0) {
        if (
          !confirm("No tracking numbers (SF/RT/R) detected. Upload anyway?")
        ) {
          setLoading(false);
          setStatus("");
          return;
        }
      }

      // 3. Upload to Supabase Storage
      setStatus("Uploading to storage...");
      setProgress(80);
      const fileExt = compressedFile.name.split(".").pop();
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      const filePath = `${user.id}/${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("pod-images")
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("pod-images")
        .getPublicUrl(filePath);

      // 4. Save to Database
      setStatus("Saving record...");
      setProgress(95);

      const { error: dbError } = await supabase.from("pod_images").insert({
        user_id: user.id,
        image_url: publicUrlData.publicUrl,
        ocr_text: text,
        tracking_numbers: numbers,
      });

      if (dbError) throw dbError;

      setStatus("Upload complete!");
      setProgress(100);

      setTimeout(() => {
        onUploadComplete();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("Bucket not found")) {
        alert("Upload failed: Storage bucket 'pod-images' not found. Please create a public storage bucket named 'pod-images' in your Supabase dashboard.");
      } else {
        alert("Upload failed: " + err.message);
      }
      setStatus("Failed");
    } finally {
      if (status !== "Upload complete!") {
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
                {extractedNumbers.length > 0 && (
                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">
                      Found Numbers
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {extractedNumbers.map((n) => (
                        <span
                          key={n}
                          className="text-[10px] font-mono bg-[#00FF66]/10 text-[#00FF66] px-2 py-1 rounded border border-[#00FF66]/20"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!loading && (
            <button
              onClick={processAndUpload}
              className="w-full bg-[#00FF66] hover:bg-[#00e65c] text-black font-bold rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-[0.98] transition-all mt-auto text-sm"
            >
              <UploadCloud className="w-5 h-5" />
              Process & Upload
            </button>
          )}
        </div>
      )}
    </div>
  );
}
