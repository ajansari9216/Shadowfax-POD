import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tsujtrxfubduxlbsvhsv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdWp0cnhmdWJkdXhsYnN2aHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTQ4OTMsImV4cCI6MjEwMTQzMDg5M30.3BuBqHPsUReQlIHvTGwJMTIkLxRUS4bCRjS3io8_ccQ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("Error listing buckets:", error);
  } else {
    console.log("Buckets:", data.map(b => b.name));
  }
}
main();
