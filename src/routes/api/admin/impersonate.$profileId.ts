import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient } from "@/lib/supabase/admin.server";
import { checkAdmin } from "@/lib/supabase/auth";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/admin/impersonate/$profileId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.replace("Bearer ", "").trim();
          if (!token) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
          }

          const url = process.env.APP_SUPABASE_URL!;
          const anonKey = process.env.APP_SUPABASE_ANON_KEY!;
          const userClient = createClient(url, anonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data: { user } } = await userClient.auth.getUser();
          if (!user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } });
          }
          const isAdmin = await checkAdmin(userClient, user.id);
          if (!isAdmin) {
            return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { "content-type": "application/json" } });
          }

          const admin = getAdminClient();
          const { data: profile } = await admin
            .from("users_profile")
            .select("auth_user_id,email")
            .eq("id", params.profileId)
            .maybeSingle();

          if (!profile?.email) {
            return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: { "content-type": "application/json" } });
          }

          const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
            type: "magiclink",
            email: profile.email,
          });

          if (linkErr || !linkData?.properties?.action_link) {
            return new Response(
              JSON.stringify({ error: linkErr?.message ?? "Failed to generate link" }),
              { status: 500, headers: { "content-type": "application/json" } },
            );
          }

          return new Response(JSON.stringify({ link: linkData.properties.action_link }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
