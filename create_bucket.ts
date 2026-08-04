import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tsujtrxfubduxlbsvhsv.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdWp0cnhmdWJkdXhsYnN2aHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTQ4OTMsImV4cCI6MjEwMTQzMDg5M30.3BuBqHPsUReQlIHvTGwJMTIkLxRUS4bCRjS3io8_ccQ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.storage.createBucket('pod-images', {
    public: true,
  });
  if (error) {
    console.error("Error creating bucket:", error);
  } else {
    console.log("Bucket created:", data);
  }
}
main();
