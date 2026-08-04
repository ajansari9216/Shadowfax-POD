import { createClient } from "@supabase/supabase-js";

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://tsujtrxfubduxlbsvhsv.supabase.co";
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

let supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
if (typeof supabaseKey === 'string') {
  supabaseKey = supabaseKey.replace(/['"]/g, "").trim();
  const match = supabaseKey.match(/(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+|sb_publishable_[a-zA-Z0-9_-]+)/);
  if (match) {
    supabaseKey = match[1];
  } else {
    const parts = supabaseKey.split(/[\s:='"]+/);
    supabaseKey = parts.reduce((a, b) => a.length > b.length ? a : b, "");
  }
}

if (!supabaseKey) {
  supabaseKey = "missing-key";
}

export const supabase = createClient(supabaseUrl, supabaseKey);
