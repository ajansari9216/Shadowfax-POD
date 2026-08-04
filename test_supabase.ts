import { validateSupabaseUrl } from "./node_modules/@supabase/supabase-js/src/lib/helpers.ts"

let supabaseUrl = "VITE_SUPABASE_URL https://tsujtrxfubduxlbsvhsv.supabase.co";
if (typeof supabaseUrl === 'string') {
  supabaseUrl = supabaseUrl.replace(/['"]/g, "").trim();
  const match = supabaseUrl.match(/(https?:\/\/[^\s]+)/);
  if (match) {
    supabaseUrl = match[1];
  } else {
    supabaseUrl = "https://tsujtrxfubduxlbsvhsv.supabase.co";
  }
}

console.log("URL:", supabaseUrl);
try {
  validateSupabaseUrl(supabaseUrl);
  console.log("Valid");
} catch (e: any) {
  console.error("Invalid:", e.message);
}
