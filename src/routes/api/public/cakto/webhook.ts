import { createHmac } from "crypto";
import { createFileRoute } from "@tanstack/react-router";
import { recordSystemErrorLog } from "@/lib/business/audit.server";
import { parseCaktoWebhook, verifyCaktoWebhook } from "@/lib/payments/cakto.server";
import { getAdminClient } from "@/lib/supabase/admin.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-cakto-signature, x-cakto-token, x-webhook-signature, x-webhook-token, Authorization",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/cakto/webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const admin = getAdminClient();
        const rawBody = await request.text();

        if (!verifyCaktoWebhook(rawBody, request.headers)) {
          await recordSystemErrorLog(admin, {
            module: "cakto-webhook",
            errorType: "invalid_signature",
            description: "Webhook Cakto recebido com autenticacao invalida.",
            probableReason: "CAKTO_WEBHOOK_SECRET/CAKTO_WEBHOOK_TOKEN divergente ou chamada nao autorizada.",
            recommendedAction: "Conferir segredo configurado na Cakto e na Vercel.",
            severity: "critico",
          });
          return json({ error: "Invalid webhook signature" }, 401);
        }

        let body: any;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return json({ error: "Payload invalido" }, 400);
        }

        const event = parseCaktoWebhook(body);
        if (!event.externalId) {
          await recordSystemErrorLog(admin, {
            module: "cakto-webhook",
            errorType: "missing_external_id",
            description: "Webhook Cakto recebido sem identificador externo do pedido.",
            probableReason: "A Cakto nao enviou external_id/reference no payload.",
            recommendedAction: "Ajustar metadata do checkout ou mapeamento em parseCaktoWebhook.",
            severity: "alto",
            metadata: { body },
          });
          return json({ ok: true, ignored: true, reason: "missing_external_id" });
        }

        const { data: order, error: orderError } = await admin
          .from("payment_orders")
          .select("id,user_id,cycle_id,amount_usd,status,external_id")
          .eq("external_id", event.externalId)
          .maybeSingle();

        if (orderError || !order) {
          await recordSystemErrorLog(admin, {
            module: "cakto-webhook",
            errorType: "payment_order_not_found",
            description: "Cakto notificou pagamento, mas o pedido nao foi encontrado.",
            probableReason: orderError?.message ?? "external_id inexistente em payment_orders.",
            recommendedAction: "Conferir metadata/reference enviado no checkout Cakto.",
            severity: "alto",
            metadata: { externalId: event.externalId, body },
          });
          return json({ ok: true, ignored: true, reason: "order_not_found" });
        }

        if (order.status === "approved") return json({ ok: true, idempotent: true });

        const mappedStatus = event.status === "approved" ? "approved" : event.status === "failed" || event.status === "cancelled" || event.status === "expired" ? "failed" : "pending";

        await admin
          .from("payment_orders")
          .update({
            status: mappedStatus,
            paid_at: mappedStatus === "approved" ? new Date().toISOString() : null,
            raw_response: { webhook: body, parsed: event },
          })
          .eq("id", order.id);

        if (mappedStatus !== "approved") return json({ ok: true, status: mappedStatus });

        const webhookSecret = process.env.PAYMENTS_WEBHOOK_SECRET;
        const payload = {
          cycle_id: order.cycle_id,
          payment_id: event.providerPaymentId ?? event.externalId,
          status: "approved",
          amount: Number(order.amount_usd),
        };

        if (webhookSecret && process.env.APP_URL) {
          const rawPayload = JSON.stringify(payload);
          const signature = createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");
          const response = await fetch(`${process.env.APP_URL}/api/public/payments-webhook`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-signature": signature,
            },
            body: rawPayload,
          });

          if (!response.ok) {
            const responseText = await response.text().catch(() => "");
            await recordSystemErrorLog(admin, {
              userId: order.user_id,
              module: "cakto-webhook",
              errorType: "internal_payment_webhook_failed",
              description: "Pagamento foi aprovado na Cakto, mas o webhook interno de ativacao falhou.",
              probableReason: responseText || `HTTP ${response.status}`,
              recommendedAction: "Conferir PAYMENTS_WEBHOOK_SECRET, APP_URL e reconciliar ativacao do ciclo.",
              severity: "critico",
              metadata: { externalId: event.externalId, orderId: order.id, status: response.status },
            });
          }
        } else {
          await admin.from("user_cycles").update({ status: "ativo", started_at: new Date().toISOString() }).eq("id", order.cycle_id);
          await admin.from("users_profile").update({ status: "ativo" }).eq("id", order.user_id);
        }

        return json({ ok: true, status: "approved" });
      },
    },
  },
});
