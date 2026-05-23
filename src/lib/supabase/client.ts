import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let clientPromise: Promise<SupabaseClient> | null = null;

async function fetchConfig() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch("/api/config", {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("Failed to load Supabase config");
    return (await res.json()) as { url: string; anonKey: string };
  } finally {
    window.clearTimeout(timeout);
  }
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
