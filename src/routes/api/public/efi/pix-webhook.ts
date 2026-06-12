import { createFileRoute } from "@tanstack/react-router";
import { recordSystemErrorLog } from "@/lib/business/audit.server";
import { getEfiPixCharge } from "@/lib/payments/efi.server";
import { getAdminClient } from "@/lib/supabase/admin.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-efi-signature",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/efi/pix-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const admin = getAdminClient();
        let body: any;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Payload invalido" }, 400);
        }

        const pixItems = Array.isArray(body?.pix) ? body.pix : [];
        if (pixItems.length === 0) return json({ ok: true, ignored: true });

        for (const item of pixItems) {
          const txid = item?.txid;
          if (!txid) continue;

          const { data: order, error: orderError } = await admin
            .from("payment_orders")
            .select("id,user_id,cycle_id,amount_usd,status,external_id")
            .eq("external_id", txid)
            .maybeSingle();

          if (orderError || !order) {
            await recordSystemErrorLog(admin, {
              module: "efi-pix-webhook",
              errorType: "payment_order_not_found",
              description: "Efí notificou Pix, mas o pedido nao foi encontrado.",
              probableReason: orderError?.message ?? "txid inexistente em payment_orders.",
              recommendedAction: "Conferir webhook Efí, txid e registros de checkout.",
              severity: "alto",
              metadata: { txid, body },
            });
            continue;
          }

          if (order.status === "approved") continue;

          try {
            const charge = await getEfiPixCharge(txid);
            const status = String(charge?.status ?? "").toUpperCase();
            if (!['CONCLUIDA', 'CONCLUIDO'].includes(status)) continue;

            await admin
              .from("payment_orders")
              .update({ status: "approved", paid_at: new Date().toISOString(), raw_response: { webhook: body, charge } })
              .eq("id", order.id);

            const webhookSecret = process.env.PAYMENTS_WEBHOOK_SECRET;
            const payload = {
              cycle_id: order.cycle_id,
              payment_id: txid,
              status: "approved",
              amount: Number(order.amount_usd),
            };

            if (webhookSecret && process.env.APP_URL) {
              await fetch(`${process.env.APP_URL}/api/public/payments-webhook`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
            } else {
              await admin.from("user_cycles").update({ status: "ativo", started_at: new Date().toISOString() }).eq("id", order.cycle_id);
              await admin.from("users_profile").update({ status: "ativo" }).eq("id", order.user_id);
            }
          } catch (error: any) {
            await recordSystemErrorLog(admin, {
              userId: order.user_id,
              module: "efi-pix-webhook",
              errorType: "pix_confirmation_failed",
              description: "Falha ao confirmar Pix recebido pela Efí.",
              probableReason: error?.message ?? "Erro desconhecido.",
              recommendedAction: "Conferir cobranca na Efí e reconciliar pedido manualmente.",
              severity: "critico",
              metadata: { txid, orderId: order.id },
            });
          }
        }

        return json({ ok: true });
      },
    },
  },
});
