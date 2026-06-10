import { createFileRoute } from "@tanstack/react-router";
import { getAdminClient } from "@/lib/supabase/admin.server";
import { hashEmailConfirmationToken } from "@/lib/email/resend.server";

function redirectTo(request: Request, path: string) {
  const url = new URL(request.url);
  return Response.redirect(`${url.origin}${path}`, 302);
}

function requestInfo(request: Request) {
  return {
    request_ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    user_agent: request.headers.get("user-agent"),
  };
}

export const Route = createFileRoute("/api/public/email-confirmation/confirm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const admin = getAdminClient();
        const info = requestInfo(request);
        const url = new URL(request.url);
        const token = url.searchParams.get("token")?.trim();

        if (!token) {
          return redirectTo(request, "/login?email_confirmed=0&reason=missing_token");
        }

        const tokenHash = hashEmailConfirmationToken(token);
        const { data: tokenRow, error } = await admin
          .from("email_confirmation_tokens")
          .select("id,user_id,email,expires_at,consumed_at")
          .eq("token_hash", tokenHash)
          .maybeSingle();

        if (error) {
          return redirectTo(request, "/login?email_confirmed=0&reason=server_error");
        }

        if (!tokenRow) {
          return redirectTo(request, "/login?email_confirmed=0&reason=invalid_token");
        }

        if (tokenRow.consumed_at) {
          return redirectTo(request, "/login?email_confirmed=1&reason=already_confirmed");
        }

        if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
          await admin
            .from("email_confirmation_tokens")
            .update({ delivery_status: "expired" })
            .eq("id", tokenRow.id);

          await admin.from("system_audit_events").insert({
            user_id: tokenRow.user_id,
            event_type: "email_confirmation_expired",
            entity_type: "email_confirmation_token",
            entity_id: tokenRow.id,
            status: "expired",
            metadata: { email: tokenRow.email },
            observation: "Token de confirmacao expirado.",
            ...info,
          });

          return redirectTo(request, "/login?email_confirmed=0&reason=expired_token");
        }

        const now = new Date().toISOString();

        await admin.auth.admin.updateUserById(tokenRow.user_id, {
          email_confirm: true,
        });

        await admin
          .from("email_confirmation_tokens")
          .update({ consumed_at: now, delivery_status: "consumed" })
          .eq("id", tokenRow.id);

        await admin
          .from("users_profile")
          .update({
            email_confirmed_at: now,
            email_confirmation_required: false,
          })
          .eq("auth_user_id", tokenRow.user_id);

        await admin.from("system_audit_events").insert({
          user_id: tokenRow.user_id,
          event_type: "email_confirmed",
          entity_type: "email_confirmation_token",
          entity_id: tokenRow.id,
          status: "confirmed",
          metadata: { email: tokenRow.email, provider: "resend" },
          observation: "E-mail confirmado pelo link enviado.",
          ...info,
        });

        return redirectTo(request, "/login?email_confirmed=1");
      },
    },
  },
});
