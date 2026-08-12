import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Search, Loader2, Package } from "lucide-react";
import { PodImage } from "../types";

export default function DashboardHome({
  onViewPod,
}: {
  onViewPod: (pod: PodImage) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PodImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<PodImage[]>([]);

  useEffect(() => {
    fetchRecent();
  }, []);

  const fetchRecent = async () => {
    const { data } = await supabase
      .from("pod_images")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);
    if (data) setRecent(data);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    // Remove spaces and uppercase
    const cleanQuery = query.replace(/\s+/g, "").toUpperCase();

    try {
      // using Supabase array contains operator @> format for text[]
      // We pass it as array format '{value}'
      const { data, error } = await supabase
        .from("pod_images")
        .select("*")
        .contains("tracking_numbers", [cleanQuery]);

      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error(err);
      alert("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const displayList = query ? results : recent;

  return (
    <div className="p-4 space-y-6">
      <div className="pt-8 pb-4">
        <h2 className="text-2xl font-bold mb-1 tracking-tight">Smart Search</h2>
        <p className="text-sm text-white/50">
          Find any POD by SF, RT, or R number.
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-white/30" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter tracking number..."
          className="w-full bg-[#111] border border-[#333] rounded-full py-4 pl-12 pr-4 text-white focus:outline-none focus:border-[#00FF66] transition-all text-sm"
        />
        <button type="submit" className="hidden" />
      </form>

      <div className="space-y-3">
        <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest ml-1 mb-4 mt-2">
          {query
            ? loading
              ? "Searching..."
              : `Results (${results.length})`
            : "Recent Activity"}
        </h3>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#00FF66]" />
          </div>
        ) : displayList.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {displayList.map((pod) => (
              <div
                key={pod.id}
                onClick={() => onViewPod(pod)}
                className="glass-card hover:border-[#00FF66]/50 rounded-2xl p-4 flex gap-4 items-center cursor-pointer active:scale-[0.98] transition-all border-l-2 border-l-[#00FF66]"
              >
                <div className="w-16 h-16 rounded-xl bg-black overflow-hidden flex-shrink-0 border border-white/10">
                  <img
                    src={pod.image_url}
                    alt="POD"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] text-white/40">
                      {new Date(pod.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
          <div className="text-center py-12 glass rounded-3xl border border-white/5 border-dashed">
            <Search className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/40">No PODs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
