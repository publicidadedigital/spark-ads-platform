import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;
let _user: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  const url = process.env.APP_SUPABASE_URL;
  const key = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("APP_SUPABASE_URL / SERVICE_ROLE_KEY not configured");
  if (!_admin) {
    _admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

export function getUserClient(accessToken: string): SupabaseClient {
  const url = process.env.APP_SUPABASE_URL;
  const key = process.env.APP_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("APP_SUPABASE_URL / ANON_KEY not configured");
  if (!_user) {
    _user = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  } else {
    // refresh token header
    (_user as any).rest.headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
