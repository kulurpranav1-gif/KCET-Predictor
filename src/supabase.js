import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env. Restart the dev server after adding them."
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Turn network / config failures into actionable messages for the UI. */
export function formatSupabaseError(error) {
  const message = String(error?.message ?? error ?? "Unknown error");
  if (/failed to fetch|fetch failed|networkerror|enotfound/i.test(message)) {
    const host = (() => {
      try {
        return new URL(supabaseUrl).hostname;
      } catch {
        return supabaseUrl;
      }
    })();
    return `Cannot reach Supabase (${host}). In the Supabase dashboard open Project Settings → API, copy the Project URL and anon public key into .env as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server. The project may be paused, deleted, or the URL may be wrong.`;
  }
  return message;
}

export { supabaseUrl };

export default supabase;