import { useState } from "react";
import { PodImage } from "../types";
import { supabase } from "../lib/supabase";
import {
  ArrowLeft,
  Share2,
  Download,
  Trash2,
  Calendar,
  Package,
} from "lucide-react";
import { format } from "date-fns";

export default function ResultScreen({
  pod,
  onBack,
}: {
  pod: PodImage;
  onBack: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this POD?")) return;
    setIsDeleting(true);

    try {
      const urlParts = pod.image_url.split("/pod-images/");
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from("pod-images").remove([filePath]);
      }

      await supabase.from("pod_images").delete().eq("id", pod.id);
      onBack();
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "POD Image",
          text: `Tracking Numbers: ${pod.tracking_numbers.join(", ")}`,
          url: pod.image_url,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      navigator.clipboard.writeText(pod.image_url);
      alert("Link copied to clipboard");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      <div className="flex items-center justify-between p-4 glass sticky top-0 z-10 border-t-0 border-x-0 rounded-b-3xl">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="status-dot"></div>
          <h2 className="text-lg font-medium">POD Analysis</h2>
        </div>
        <div className="w-10"></div>
      </div>

      <div className="p-4 space-y-6 pb-8">
        <div className="relative rounded-3xl overflow-hidden bg-black border border-white/5 shadow-2xl flex items-center justify-center">
          <img
            src={pod.image_url}
            alt="POD Large"
            className="w-full object-contain max-h-[60vh] opacity-80"
          />
          <div className="absolute top-4 left-4 z-10 text-[10px] bg-black/60 px-2 py-1 rounded border border-white/10 font-mono">
            POD_IMG_{pod.id.substring(0, 6).toUpperCase()}
          </div>
        </div>

        <div className="glass-card rounded-3xl p-6 space-y-6">
          <section>
            <h3 className="text-[10px] uppercase text-white/30 tracking-widest mb-3">
              Extracted Numbers
            </h3>
            <div className="space-y-2">
              {pod.tracking_numbers.length > 0 ? (
                pod.tracking_numbers.map((num) => (
                  <div key={num} className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50">
                      {num.startsWith("SF")
                        ? "SF Number"
                        : num.startsWith("RT")
                          ? "Return ID"
                          : "R Number"}
                    </span>
                    <span className="text-xs font-mono text-[#00FF66]">
                      {num}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/40">
                  No tracking numbers detected.
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] uppercase text-white/30 tracking-widest mb-3">
              Storage Meta
            </h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-white/40">Uploaded</span>
                <span className="text-white/80">
                  {format(new Date(pod.created_at), "HH:mm a")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Date</span>
                <span className="text-white/80">
                  {format(new Date(pod.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleShare}
            className="flex-1 glass hover:bg-white/10 text-white rounded-2xl py-4 flex items-center justify-center gap-2 transition-all font-medium text-sm"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>

          <a
            href={pod.image_url}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="flex-1 bg-[#00FF66] hover:bg-[#00e65c] text-black rounded-2xl py-4 flex items-center justify-center gap-2 transition-all font-bold text-sm"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>

        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="w-full bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 text-red-400 rounded-2xl py-4 flex items-center justify-center gap-2 transition-colors font-medium mt-4 text-sm"
        >
          <Trash2 className="w-4 h-4" />
          {isDeleting ? "Deleting..." : "Delete Record"}
        </button>
      </div>
    </div>
  );
}
