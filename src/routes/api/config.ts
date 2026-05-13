import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/config")({
  server: {
    handlers: {
      GET: async () => {
        const url = process.env.APP_SUPABASE_URL;
        const anonKey = process.env.APP_SUPABASE_ANON_KEY;
        if (!url || !anonKey) {
          return new Response(
            JSON.stringify({ error: "Supabase env vars not configured" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ url, anonKey }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
