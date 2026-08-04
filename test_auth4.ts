import { createClient } from "@supabase/supabase-js";
async function main() {
  const supabase = createClient("https://tsujtrxfubduxlbsvhsv.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdWp0cnhmdWJkdXhsYnN2aHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTQ4OTMsImV4cCI6MjEwMTQzMDg5M30.3BuBqHPsUReQlIHvTGwJMTIkLxRUS4bCRjS3io8_ccQ");
  const { data, error } = await supabase.auth.signInWithPassword({ email: 'test@example.com', password: 'password' });
  console.log("signIn result:", error?.message || "success");
}
main();
