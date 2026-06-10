import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin.server";
import {
  buildConfirmationUrl,
  createEmailConfirmationToken,
  sendConfirmationEmail,
} from "@/lib/email/resend.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

const PayloadSchema = z.object({
  userId: z.string().uuid().optional(),
  email: z.string().trim().email().max(255),
  name: z.string().trim().max(120).optional().nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
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

async function resolveUserId(email: string, providedUserId?: string) {
  if (providedUserId) return providedUserId;

  const admin = getAdminClient();
  const normalizedEmail = email.toLowerCase();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match.id;
    if (data.users.length < 100) break;
    page += 1;
  }

  return null;
}

export const Route = createFileRoute("/api/public/email-confirmation/send")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        let parsed: z.infer<typeof PayloadSchema>;
        try {
          parsed = PayloadSchema.parse(await request.json());
        } catch (error: any) {
          return json({ error: "Dados invalidos", details: error?.message }, 400);
        }

        const admin = getAdminClient();
        const info = requestInfo(request);
        const userId = await resolveUserId(parsed.email, parsed.userId);

        if (!userId) {
          return json({ error: "Usuario nao encontrado para este e-mail." }, 404);
        }

        const { rawToken, tokenHash } = createEmailConfirmationToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const confirmationUrl = buildConfirmationUrl(request, rawToken);

        const { data: tokenRow, error: tokenError } = await admin
          .from("email_confirmation_tokens")
          .insert({
            user_id: userId,
            email: parsed.email.toLowerCase(),
            token_hash: tokenHash,
            expires_at: expiresAt,
            request_ip: info.request_ip,
            user_agent: info.user_agent,
          })
          .select("id")
          .single();

        if (tokenError) return json({ error: tokenError.message }, 500);

        let deliveryStatus: "sent" | "not_configured" | "failed" = "not_configured";
        let resendMessageId: string | undefined;

        try {
          const delivery = await sendConfirmationEmail({
            to: parsed.email,
            name: parsed.name,
            confirmationUrl,
          });
          deliveryStatus = delivery.configured ? "sent" : "not_configured";
          resendMessageId = delivery.id;
        } catch (error: any) {
          deliveryStatus = "failed";
          await admin.from("system_audit_events").insert({
            user_id: userId,
            event_type: "email_confirmation_send_failed",
            entity_type: "email_confirmation_token",
            entity_id: tokenRow.id,
            status: "failed",
            metadata: { email: parsed.email, error: error?.message },
            observation: "Falha ao enviar confirmacao de e-mail pelo Resend.",
            ...info,
          });
          return json({ error: error?.message || "Falha ao enviar e-mail." }, 502);
        }

        await admin
          .from("email_confirmation_tokens")
          .update({ delivery_status: deliveryStatus, resend_message_id: resendMessageId ?? null })
          .eq("id", tokenRow.id);

        await admin
          .from("users_profile")
          .update({ email_confirmation_sent_at: new Date().toISOString(), email_confirmation_required: true })
          .eq("auth_user_id", userId);

        await admin.from("system_audit_events").insert({
          user_id: userId,
          event_type: "email_confirmation_sent",
          entity_type: "email_confirmation_token",
          entity_id: tokenRow.id,
          status: deliveryStatus,
          metadata: {
            email: parsed.email,
            provider: "resend",
            resend_message_id: resendMessageId ?? null,
            configured: deliveryStatus === "sent",
          },
          observation:
            deliveryStatus === "sent"
              ? "Confirmacao de e-mail enviada pelo Resend."
              : "Token criado; Resend ainda nao configurado no ambiente.",
          ...info,
        });

        return json({
          ok: true,
          delivery_status: deliveryStatus,
          expires_at: expiresAt,
          resend_configured: deliveryStatus === "sent",
        });
      },
    },
  },
});
