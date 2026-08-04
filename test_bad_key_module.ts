import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://tsujtrxfubduxlbsvhsv.supabase.co", "VITE_SUPABASE_ANON_KEY (Settings → API Keys → Publishable key se jo key copy ki hai, wahi yahan paste karo.)");
console.log("Success");
