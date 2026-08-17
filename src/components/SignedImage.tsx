import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, AlertCircle } from "lucide-react";

export default function SignedImage({
  src,
  alt,
  className,
  fallbackText = "Failed to load image",
}: {
  src: string;
  alt: string;
  className?: string;
  fallbackText?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUrl() {
      if (!src) {
        setError("No image path provided");
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        let path = src;
        // If it's a full URL, try to extract the path if it's from our storage
        if (src.startsWith("http")) {
          const parts = src.split("/pod-images/");
          if (parts.length > 1) {
            path = parts[1];
          } else {
            // It's a full URL but not matching our structure, just use it directly
            setUrl(src);
            setLoading(false);
            return;
          }
        }
        
        const { data, error: signedError } = await supabase.storage
          .from("pod-images")
          .createSignedUrl(path, 60 * 60 * 24); // 24 hours
          
        if (signedError) {
          throw new Error(signedError.message);
        }
        
        if (data?.signedUrl) {
          setUrl(data.signedUrl);
        } else {
          throw new Error("Could not generate signed URL");
        }
      } catch (err: any) {
        console.error("Error loading signed image:", err);
        setError(err.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    
    fetchUrl();
  }, [src]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-black/20 ${className}`}>
        <Loader2 className="w-5 h-5 text-white/50 animate-spin" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={`flex flex-col items-center justify-center bg-black/40 text-red-400 p-2 text-center border border-red-500/20 ${className}`}>
        <AlertCircle className="w-5 h-5 mb-1 opacity-50" />
        <span className="text-[9px] break-words line-clamp-3">{error || fallbackText}</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setError("Image failed to render")}
    />
  );
}
