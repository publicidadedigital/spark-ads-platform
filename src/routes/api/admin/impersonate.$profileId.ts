import { createAPIFileRoute } from "@tanstack/react-start/api";
import { getAdminClient } from "@/lib/supabase/admin.server";
import { checkAdmin } from "@/lib/supabase/auth";
import { createClient } from "@supabase/supabase-js";

export const APIRoute = createAPIFileRoute("/api/admin/impersonate/$profileId")({
  GET: async ({ request, params }) => {
    try {
      const authHeader = request.headers.get("authorization") ?? "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

      // Verify requester is admin using their JWT
      const url = process.env.APP_SUPABASE_URL!;
      const anonKey = process.env.APP_SUPABASE_ANON_KEY!;
      const userClient = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      const isAdmin = await checkAdmin(userClient, user.id);
      if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

      // Get auth_user_id from profileId
      const admin = getAdminClient();
      const { data: profile } = await admin
        .from("users_profile")
        .select("auth_user_id,email")
        .eq("id", params.profileId)
        .maybeSingle();

      if (!profile?.auth_user_id) {
        return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
      }

      // Generate magic link for the target user
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: profile.email,
      });

      if (linkErr || !linkData?.properties?.action_link) {
        return new Response(JSON.stringify({ error: linkErr?.message ?? "Failed to generate link" }), { status: 500 });
      }

      return new Response(JSON.stringify({ link: linkData.properties.action_link }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500 });
    }
  },
});
