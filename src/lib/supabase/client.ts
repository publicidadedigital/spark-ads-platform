import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient> | null = null;

async function fetchConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error("Failed to load Supabase config");
  return (await res.json()) as { url: string; anonKey: string };
}

export function getSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = fetchConfig().then(({ url, anonKey }) =>
      createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      }),
    );
  }
  return clientPromise;
}
