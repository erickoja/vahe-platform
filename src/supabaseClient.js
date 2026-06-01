import { createClient } from "@supabase/supabase-js";

// Reads credentials from environment variables (Vite exposes VITE_* to the client).
// In local dev these come from .env.local; in production from your host's env settings.
const URL = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// If credentials aren't configured, the app falls back to local-only storage
// so it still runs (e.g. during development before Supabase is wired up).
export const supabaseEnabled = Boolean(URL && ANON);

export const supabase = supabaseEnabled
  ? createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

// Name of the shared key/value table that holds the whole studio's data.
export const STATE_TABLE = "studio_state";
