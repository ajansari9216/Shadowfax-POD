import { createClient } from "@supabase/supabase-js";

let supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "https://tsujtrxfubduxlbsvhsv.supabase.co";
if (typeof supabaseUrl === 'string') {
  supabaseUrl = supabaseUrl.replace(/['"]/g, "").trim();
  const match = supabaseUrl.match(/(https?:\/\/[^\s]+)/);
  if (match) {
    supabaseUrl = match[1];
  } else {
    supabaseUrl = "https://tsujtrxfubduxlbsvhsv.supabase.co";
  }
} else {
  supabaseUrl = "https://tsujtrxfubduxlbsvhsv.supabase.co";
}

let supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";
if (typeof supabaseKey === 'string') {
  supabaseKey = supabaseKey.replace(/['"]/g, "").trim();
  const match = supabaseKey.match(/(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|sb_publishable_[a-zA-Z0-9_-]+)/);
  if (match) {
    supabaseKey = match[1];
  } else {
    supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdWp0cnhmdWJkdXhsYnN2aHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTQ4OTMsImV4cCI6MjEwMTQzMDg5M30.3BuBqHPsUReQlIHvTGwJMTIkLxRUS4bCRjS3io8_ccQ";
  }
}

if (!supabaseKey || supabaseKey === "missing-key") {
  supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdWp0cnhmdWJkdXhsYnN2aHN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTQ4OTMsImV4cCI6MjEwMTQzMDg5M30.3BuBqHPsUReQlIHvTGwJMTIkLxRUS4bCRjS3io8_ccQ";
}

export const supabase = createClient(supabaseUrl, supabaseKey);
