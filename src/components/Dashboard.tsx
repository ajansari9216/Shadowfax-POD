import { useState } from "react";
import { Session } from "@supabase/supabase-js";
import { Home, Upload, Clock, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";
import DashboardHome from "./DashboardHome";
import UploadPod from "./UploadPod";
import History from "./History";
import ResultScreen from "./ResultScreen";
import { PodImage } from "../types";

export default function Dashboard({ session }: { session: Session }) {
  const [currentView, setCurrentView] = useState<
    "home" | "upload" | "history" | "result"
  >("home");
  const [selectedPod, setSelectedPod] = useState<PodImage | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const viewPod = (pod: PodImage) => {
    setSelectedPod(pod);
    setCurrentView("result");
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#050505] relative text-white">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {currentView === "home" && <DashboardHome onViewPod={viewPod} />}
        {currentView === "upload" && (
          <UploadPod onUploadComplete={() => setCurrentView("history")} />
        )}
        {currentView === "history" && <History onViewPod={viewPod} />}
        {currentView === "result" && selectedPod && (
          <ResultScreen
            pod={selectedPod}
            onBack={() => setCurrentView("history")}
          />
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full glass z-50 rounded-t-3xl border-b-0 border-x-0">
        <div className="flex justify-around items-center p-4">
          <button
            onClick={() => setCurrentView("home")}
            className={`flex flex-col items-center gap-1 transition-all ${currentView === "home" ? "text-[#00FF66] scale-110" : "text-white/40 hover:text-white"}`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              Search
            </span>
          </button>
          <button
            onClick={() => setCurrentView("upload")}
            className={`flex flex-col items-center gap-1 transition-all ${currentView === "upload" ? "text-[#00FF66] scale-110" : "text-white/40 hover:text-white"}`}
          >
            <Upload className="w-5 h-5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              Upload
            </span>
          </button>
          <button
            onClick={() => setCurrentView("history")}
            className={`flex flex-col items-center gap-1 transition-all ${currentView === "history" ? "text-[#00FF66] scale-110" : "text-white/40 hover:text-white"}`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              History
            </span>
          </button>
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-1 transition-all text-white/40 hover:text-red-400"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">
              Logout
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
