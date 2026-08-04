import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "https://tsujtrxfubduxlbsvhsv.supabase.co").trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const supabase = createClient(supabaseUrl, supabaseKey);
