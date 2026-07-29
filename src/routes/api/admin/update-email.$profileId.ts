import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient } from "@/lib/supabase/admin.server";
import { checkAdmin } from "@/lib/supabase/auth";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/admin/update-email/$profileId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
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

          const body = await request.json();
          const newEmail = (body?.email ?? "").trim().toLowerCase();
          if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            return new Response(JSON.stringify({ error: "E-mail inválido" }), { status: 400, headers: { "content-type": "application/json" } });
          }

          const admin = getAdminClient();

          // Get auth_user_id from profile
          const { data: profile } = await admin
            .from("users_profile")
            .select("auth_user_id")
            .eq("id", params.profileId)
            .maybeSingle();

          if (!profile?.auth_user_id) {
            return new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404, headers: { "content-type": "application/json" } });
          }

          // Update auth.users email
          const { error: authErr } = await admin.auth.admin.updateUserById(profile.auth_user_id, { email: newEmail });
          if (authErr) {
            return new Response(JSON.stringify({ error: authErr.message }), { status: 500, headers: { "content-type": "application/json" } });
          }

          // Update users_profile email
          const { error: profileErr } = await admin
            .from("users_profile")
            .update({ email: newEmail })
            .eq("id", params.profileId);

          if (profileErr) {
            return new Response(JSON.stringify({ error: profileErr.message }), { status: 500, headers: { "content-type": "application/json" } });
          }

          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
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
