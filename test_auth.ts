import { createClient } from "@supabase/supabase-js";
async function main() {
  try {
    const supabase = createClient("https://tsujtrxfubduxlbsvhsv.supabase.co", "VITE_SUPABASE_ANON_KEY");
    console.log("createClient success");
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("getSession error:", error.message);
    } else {
      console.log("getSession success:", data);
    }
  } catch (e: any) {
    console.error("main error:", e.message);
  }
}
main();
