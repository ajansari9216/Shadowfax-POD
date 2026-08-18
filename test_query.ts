import { supabase } from './src/lib/supabase';

// Quick check of syntax
console.log(supabase.from("pod_images").select("tracking_numbers").overlaps("tracking_numbers", ["123"]));
