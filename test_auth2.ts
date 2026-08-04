import { createClient } from "@supabase/supabase-js";
async function main() {
  try {
    const supabase = createClient("https://tsujtrxfubduxlbsvhsv.supabase.co", "VITE_SUPABASE_ANON_KEY");
    const { data, error } = await supabase.auth.signInWithPassword({ email: 'test@example.com', password: 'password' });
    if (error) {
      console.error("signIn error:", error.message);
    } else {
      console.log("signIn success:", data);
    }
  } catch (e: any) {
    console.error("main error:", e.message);
  }
}
main();
