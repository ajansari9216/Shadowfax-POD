import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, Package, Calendar } from "lucide-react";
import SignedImage from "./SignedImage";
import { PodImage, FilterType } from "../types";
import { format, subDays, startOfDay } from "date-fns";

export default function History({
  onViewPod,
}: {
  onViewPod: (pod: PodImage) => void;
}) {
  const [history, setHistory] = useState<PodImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    fetchHistory();
  }, [filter]);

  const fetchHistory = async () => {
    setLoading(true);
    let query = supabase
      .from("pod_images")
      .select("*")
      .order("created_at", { ascending: false });

    const today = new Date();
    if (filter === "today") {
      query = query.gte("created_at", startOfDay(today).toISOString());
    } else if (filter === "yesterday") {
      query = query
        .gte("created_at", startOfDay(subDays(today, 1)).toISOString())
        .lt("created_at", startOfDay(today).toISOString());
    } else if (filter === "7days") {
      query = query.gte(
        "created_at",
        startOfDay(subDays(today, 7)).toISOString(),
      );
    } else if (filter === "30days") {
      query = query.gte(
        "created_at",
        startOfDay(subDays(today, 30)).toISOString(),
      );
    }

    const { data } = await query;
    if (data) setHistory(data);
    setLoading(false);
  };

  return (
    <div className="p-4 pt-8 h-full flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold mb-1 tracking-tight">
            OCR History
          </h2>
          <p className="text-sm text-white/50">View past uploads.</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
        {(["all", "today", "yesterday", "7days", "30days"] as FilterType[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-medium transition-colors border ${
                filter === f
                  ? "bg-[#00FF66]/10 text-[#00FF66] border-[#00FF66]"
                  : "glass text-white/40 border-white/10 hover:border-white/20 hover:text-white"
              }`}
            >
              {f === "all"
                ? "All Time"
                : f === "7days"
                  ? "Last 7 Days"
                  : f === "30days"
                    ? "Last 30 Days"
                    : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ),
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#00FF66]" />
          </div>
        ) : history.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 pb-8">
            {history.map((pod) => (
              <div
                key={pod.id}
                onClick={() => onViewPod(pod)}
                className="glass-card hover:border-[#00FF66]/50 rounded-2xl p-4 flex gap-4 items-center cursor-pointer active:scale-[0.98] transition-all border-l-2 border-l-[#00FF66]"
              >
                <div className="w-16 h-16 rounded-xl bg-black overflow-hidden flex-shrink-0 border border-white/10">
                  <SignedImage src={pod.image_url} alt="POD" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] text-white/40">
                      {format(new Date(pod.created_at), "MMM d • h:mm a")}
                    </span>
                    <span className="text-[9px] text-[#00FF66] font-mono bg-[#00FF66]/10 px-1.5 py-0.5 rounded border border-[#00FF66]/20">
                      PROCESSED
                    </span>
                  </div>
                  <p className="text-sm font-mono text-white truncate mt-1">
                    {pod.tracking_numbers[0] || "NO_TRACKING"}
                  </p>
                  {pod.tracking_numbers.length > 1 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {pod.tracking_numbers.slice(1, 3).map((num) => (
                        <span
                          key={num}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 font-mono"
                        >
                          {num}
                        </span>
                      ))}
                      {pod.tracking_numbers.length > 3 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                          +{pod.tracking_numbers.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 glass rounded-3xl border border-white/5 border-dashed mt-4">
            <Calendar className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/40">
              No uploads found for this period
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
