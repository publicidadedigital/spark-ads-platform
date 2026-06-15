import { createHmac } from "crypto";
import { createFileRoute } from "@tanstack/react-router";
import { recordSystemErrorLog } from "@/lib/business/audit.server";
import { buildPackageAccounting } from "@/lib/business/rules";
import { parseCaktoWebhook, verifyCaktoWebhook, type CaktoWebhookEvent } from "@/lib/payments/cakto.server";
import { getAdminClient } from "@/lib/supabase/admin.server";

async function activateCycle(
  admin: ReturnType<typeof getAdminClient>,
  input: { cycleId: string; userId: string; amountUsd: number; paymentId: string | null },
) {
  const webhookSecret = process.env.PAYMENTS_WEBHOOK_SECRET;
  const payload = {
    cycle_id: input.cycleId,
    payment_id: input.paymentId ?? undefined,
    status: "approved" as const,
    amount: input.amountUsd,
  };

  if (webhookSecret && (process.env.APP_URL ?? process.env.APP_PUBLIC_URL)) {
    const rawPayload = JSON.stringify(payload);
    const signature = createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");
    const response = await fetch(`${process.env.APP_URL ?? process.env.APP_PUBLIC_URL}/api/public/payments-webhook`, {
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
        userId: input.userId,
        module: "cakto-webhook",
        errorType: "internal_payment_webhook_failed",
        description: "Pagamento foi aprovado na Cakto, mas o webhook interno de ativacao falhou.",
        probableReason: responseText || `HTTP ${response.status}`,
        recommendedAction: "Conferir PAYMENTS_WEBHOOK_SECRET, APP_URL e reconciliar ativacao do ciclo.",
        severity: "critico",
        metadata: { cycleId: input.cycleId, paymentId: input.paymentId, status: response.status },
      });
    }
  } else {
    await admin.from("user_cycles").update({ status: "ativo", started_at: new Date().toISOString() }).eq("id", input.cycleId);
    await admin.from("users_profile").update({ status: "ativo" }).eq("id", input.userId);
  }
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Compras feitas pelos links estaticos do Cakto (escritorio virtual) nao tem
 * payment_orders associado. Reconciliamos pelo e-mail do comprador + nome do
 * produto, criando o ciclo e delegando a ativacao ao payments-webhook.
 */
async function reconcileStaticPurchase(admin: ReturnType<typeof getAdminClient>, event: CaktoWebhookEvent, body: unknown) {
  if (!event.customerEmail || !event.productName) {
    await recordSystemErrorLog(admin, {
      module: "cakto-webhook",
      errorType: "static_purchase_missing_data",
      description: "Webhook Cakto aprovado sem external_id e sem dados suficientes para reconciliacao (email/produto).",
      probableReason: "Payload da Cakto nao trouxe customer.email ou product.name.",
      recommendedAction: "Ativar o ciclo manualmente para o comprador identificado no payload.",
      severity: "alto",
      metadata: { body },
    });
    return json({ ok: true, ignored: true, reason: "missing_customer_or_product" });
  }

  if (event.providerPaymentId) {
    const { data: existing } = await admin
      .from("payment_orders")
      .select("id")
      .eq("provider_payment_id", event.providerPaymentId)
      .maybeSingle();
    if (existing) return json({ ok: true, idempotent: true });
  }

  const { data: packages } = await admin
    .from("packages")
    .select("id,nome,valor")
    .eq("status", "ativo")
    .not("cakto_checkout_url", "is", null);

  const productName = normalizeName(event.productName);
  const pkg = (packages ?? []).find((p) => {
    const nome = normalizeName(String(p.nome ?? ""));
    return nome && (productName.includes(nome) || nome.includes(productName));
  });

  const { data: profile } = await admin
    .from("users_profile")
    .select("id")
    .ilike("email", event.customerEmail)
    .maybeSingle();

  if (!pkg || !profile) {
    await recordSystemErrorLog(admin, {
      userId: profile?.id ?? null,
      module: "cakto-webhook",
      errorType: "static_purchase_not_matched",
      description: "Compra via link estatico da Cakto aprovada, mas nao foi possivel identificar o usuario e/ou pacote.",
      probableReason: !profile ? `Nenhum usuario com e-mail ${event.customerEmail}.` : `Nenhum pacote ativo correspondente a "${event.productName}".`,
      recommendedAction: "Ativar o ciclo manualmente para esse usuario/pacote.",
      severity: "critico",
      metadata: { body, customerEmail: event.customerEmail, productName: event.productName },
    });
    return json({ ok: true, ignored: true, reason: "user_or_package_not_found" });
  }

  const accounting = buildPackageAccounting(Number(pkg.valor));

  const { data: cycle, error: cycleError } = await admin
    .from("user_cycles")
    .insert({
      user_id: profile.id,
      package_id: pkg.id,
      valor_pacote: accounting.bonusable_amount,
      status: "aguardando_renovacao",
      package_value: accounting.package_value,
      course_fee: accounting.course_fee,
      total_paid: accounting.total_paid,
      bonusable_amount: accounting.bonusable_amount,
      cycle_limit_200: accounting.cycle_limit_200,
      amount_counted_for_rewards: accounting.amount_counted_for_rewards,
      status_normalized: "renewal_pending",
    })
    .select("id")
    .single();

  if (cycleError || !cycle) {
    await recordSystemErrorLog(admin, {
      userId: profile.id,
      module: "cakto-webhook",
      errorType: "static_purchase_cycle_creation_failed",
      description: "Falha ao criar ciclo para compra via link estatico da Cakto.",
      probableReason: cycleError?.message,
      recommendedAction: "Criar o ciclo manualmente e ativar o pagamento.",
      severity: "critico",
      metadata: { body, userId: profile.id, packageId: pkg.id },
    });
    return json({ ok: true, ignored: true, reason: "cycle_creation_failed" });
  }

  await admin.from("payment_orders").insert({
    user_id: profile.id,
    cycle_id: cycle.id,
    provider: "cakto",
    method: "cakto_static_link",
    status: "approved",
    external_id: event.providerPaymentId ?? `cakto_static_${cycle.id}`,
    provider_payment_id: event.providerPaymentId,
    amount_usd: accounting.total_paid,
    paid_at: new Date().toISOString(),
    raw_response: { webhook: body, parsed: event },
  });

  await activateCycle(admin, { cycleId: cycle.id, userId: profile.id, amountUsd: accounting.total_paid, paymentId: event.providerPaymentId ?? event.externalId });

  return json({ ok: true, status: "approved", reconciled: true });
}

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
          if (event.status === "approved") return reconcileStaticPurchase(admin, event, body);
          return json({ ok: true, ignored: true, reason: "missing_external_id" });
        }

        const { data: order, error: orderError } = await admin
          .from("payment_orders")
          .select("id,user_id,cycle_id,amount_usd,status,external_id")
          .eq("external_id", event.externalId)
          .maybeSingle();

        if (orderError || !order) {
          if (event.status === "approved") return reconcileStaticPurchase(admin, event, body);
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

        await activateCycle(admin, {
          cycleId: order.cycle_id,
          userId: order.user_id,
          amountUsd: Number(order.amount_usd),
          paymentId: event.providerPaymentId ?? event.externalId,
        });

        return json({ ok: true, status: "approved" });
      },
    },
  },
});
