import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tsujtrxfubduxlbsvhsv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdWp0cnhmdWJkdXhsYnN2aHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTQ4OTMsImV4cCI6MjEwMTQzMDg5M30.3BuBqHPsUReQlIHvTGwJMTIkLxRUS4bCRjS3io8_ccQ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const email = "testadmin" + Math.floor(Math.random() * 1000000) + "@example.com";
  const password = "password123";
  
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
  console.log("Sign up:", authError?.message || "success", authData?.user?.id);
  
  const { data: signData, error: signError } = await supabase.auth.signInWithPassword({ email, password });
  console.log("Sign in:", signError?.message || "success", signData?.user?.id);

  const { data: { user } } = await supabase.auth.getUser();
  console.log("User:", user?.id);

  console.log("Trying to upload to 'pods'...");
  const { error: err1 } = await supabase.storage.from('pods').upload(user?.id + '/test.txt', 'hello');
  console.log("pods upload error:", err1?.message || "success");

  console.log("Trying to upload to 'pod-images'...");
  const { error: err2 } = await supabase.storage.from('pod-images').upload(user?.id + '/test.txt', 'hello');
  console.log("pod-images upload error:", err2?.message || "success");
}
main();
