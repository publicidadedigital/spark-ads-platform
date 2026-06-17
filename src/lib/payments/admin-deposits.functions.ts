import { createHmac } from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { recordSystemErrorLog } from "@/lib/business/audit.server";
import { getAdminClient } from "@/lib/supabase/admin.server";

async function requireAdmin(accessToken: string) {
  const admin = getAdminClient();
  const { data: userRes, error: userErr } = await admin.auth.getUser(accessToken);
  if (userErr || !userRes?.user) throw new Error("Sessao invalida");

  const [{ data: legacyRole, error: legacyErr }, { data: modernRole, error: modernErr }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle(),
    admin.from("admin_roles").select("status").eq("auth_user_id", userRes.user.id).eq("status", "ativo").maybeSingle(),
  ]);

  if (legacyErr) throw new Error(legacyErr.message);
  if (modernErr) throw new Error(modernErr.message);
  if (!legacyRole && !modernRole) throw new Error("Acesso administrativo necessario");

  return userRes.user.id;
}

/**
 * Ativa manualmente um deposito (payment_orders) que ficou pendente sem
 * confirmacao automatica do gateway, ativando o ciclo correspondente.
 */
export const activateDepositManually = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        accessToken: z.string().min(10),
        paymentOrderId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminUserId = await requireAdmin(data.accessToken);
    const admin = getAdminClient();

    const { data: order, error: orderErr } = await admin
      .from("payment_orders")
      .select("id,user_id,cycle_id,amount_usd,status,provider_payment_id,external_id")
      .eq("id", data.paymentOrderId)
      .maybeSingle();

    if (orderErr) throw new Error(orderErr.message);
    if (!order) throw new Error("Deposito nao encontrado");
    if (order.status === "approved") return { ok: true, idempotent: true };

    await admin
      .from("payment_orders")
      .update({ status: "approved", paid_at: new Date().toISOString() })
      .eq("id", order.id);

    const webhookSecret = process.env.PAYMENTS_WEBHOOK_SECRET;
    const payload = {
      cycle_id: order.cycle_id,
      payment_id: order.provider_payment_id ?? order.external_id ?? undefined,
      status: "approved" as const,
      amount: Number(order.amount_usd),
    };

    if (webhookSecret && (process.env.APP_URL ?? process.env.APP_PUBLIC_URL)) {
      const rawPayload = JSON.stringify(payload);
      const signature = createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");
      const response = await fetch(`${process.env.APP_URL ?? process.env.APP_PUBLIC_URL}/api/public/payments-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-signature": signature },
        body: rawPayload,
      });

      if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        await recordSystemErrorLog(admin, {
          userId: order.user_id,
          module: "admin-deposits",
          errorType: "manual_activation_failed",
          description: "Ativacao manual de deposito iniciada pelo admin, mas o webhook interno de ativacao falhou.",
          probableReason: responseText || `HTTP ${response.status}`,
          recommendedAction: "Conferir PAYMENTS_WEBHOOK_SECRET, APP_URL e o ciclo do usuario.",
          severity: "critico",
          metadata: { adminUserId, paymentOrderId: order.id, cycleId: order.cycle_id, status: response.status },
        });
        throw new Error("Falha ao ativar o ciclo. Verifique os logs de erro do sistema.");
      }
    } else {
      await admin.from("user_cycles").update({ status: "ativo", started_at: new Date().toISOString() }).eq("id", order.cycle_id);
      await admin.from("users_profile").update({ status: "ativo" }).eq("id", order.user_id);
    }

    return { ok: true };
  });
