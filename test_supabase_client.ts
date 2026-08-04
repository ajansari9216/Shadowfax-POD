import { createClient } from "@supabase/supabase-js";
try {
  createClient("https://tsujtrxfubduxlbsvhsv.supabase.co", "VITE_SUPABASE_ANON_KEY");
  console.log("createClient success");
} catch (e: any) {
  console.error("createClient error:", e.message);
}
