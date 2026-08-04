const envVar = "VITE_SUPABASE_ANON_KEY (Settings → API Keys → Publishable key se jo key copy ki hai, wahi yahan paste karo.)";

let supabaseKey = envVar || "";
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
console.log("Key:", supabaseKey);
