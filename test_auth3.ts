import { createClient } from "@supabase/supabase-js";
async function main() {
  const supabase = createClient("https://tsujtrxfubduxlbsvhsv.supabase.co", "missing-key");
  const { data, error } = await supabase.auth.signInWithPassword({ email: 'test@example.com', password: 'password' });
  console.log("signIn error:", error?.message);
}
main();
