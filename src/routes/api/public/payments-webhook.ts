/**
 * Webhook de confirmacao de pagamento — compativel com Cakto e formato interno.
 *
 * A Cakto envia eventos com nomes proprios. Este handler normaliza para status internos:
 *
 *  Cakto event                        → status interno
 *  ─────────────────────────────────────────────────────
 *  PURCHASE_APPROVED / approved       → approved
 *  PURCHASE_REFUSED  / refused        → failed
 *  PURCHASE_REFUNDED / refund         → refunded
 *  PURCHASE_CHARGEBACK / chargeback   → chargeback
 *  PURCHASE_CANCELLED / subscription_canceled / canceled → cancelled
 *  (qualquer outro)                   → pending
 *
 * O cycle_id e extraido de (em ordem de prioridade):
 *   payload.cycle_id  (formato interno)
 *   payload.data.metadata.cycle_id
 *   payload.data.smart_checkout_data.cycle_id
 *   payload.data.tracker_id (fallback)
 *
 * Seguranca: HMAC SHA-256 via header x-webhook-signature (PAYMENTS_WEBHOOK_SECRET).
 */

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { recordSystemErrorLog } from "@/lib/business/audit.server";
import { awardPackagePoints } from "@/lib/business/points.server";
import { buildPackageAccounting } from "@/lib/business/rules";
import { getAdminClient } from "@/lib/supabase/admin.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-webhook-signature",
} as const;

type NormalizedStatus = "approved" | "failed" | "pending" | "cancelled" | "refunded" | "chargeback";

type NormalizedPayload = {
  cycle_id: string;
  payment_id?: string;
  status: NormalizedStatus;
  amount?: number;
};

// Converte evento/status da Cakto para status interno
function normalizeCaktoStatus(raw: string): NormalizedStatus {
  const s = (raw ?? "").toLowerCase().replace(/[^a-z_]/g, "");
  if (["purchase_approved","approved","compra_aprovada","sale_approved"].includes(s)) return "approved";
  if (["purchase_refused","refused","compra_recusada","sale_refused","failed","recusada"].includes(s)) return "failed";
  if (["purchase_refunded","refunded","refund","reembolso","estorno"].includes(s)) return "refunded";
  if (["purchase_chargeback","chargeback"].includes(s)) return "chargeback";
  if (["purchase_cancelled","cancelled","canceled","subscription_canceled","subscription_cancelled","assinatura_cancelada","venda_cancelada"].includes(s)) return "cancelled";
  return "pending";
}

// Extrai cycle_id de payloads Cakto ou interno
function extractCycleId(body: any): string | null {
  // Formato interno direto
  if (typeof body?.cycle_id === "string" && body.cycle_id.length === 36) return body.cycle_id;
  // Cakto: data.metadata.cycle_id
  if (typeof body?.data?.metadata?.cycle_id === "string") return body.data.metadata.cycle_id;
  // Cakto: data.smart_checkout_data.cycle_id
  if (typeof body?.data?.smart_checkout_data?.cycle_id === "string") return body.data.smart_checkout_data.cycle_id;
  // Cakto: data.tracker_id (último recurso)
  if (typeof body?.data?.tracker_id === "string" && body.data.tracker_id.length === 36) return body.data.tracker_id;
  return null;
}

// Normaliza qualquer payload (Cakto ou interno) para formato padrão
function normalizePayload(body: any): NormalizedPayload | null {
  const cycleId = extractCycleId(body);
  if (!cycleId) return null;

  // Evento Cakto: body.event (ex: "PURCHASE_APPROVED") ou body.data.status
  const rawEvent = body?.event ?? body?.data?.status ?? body?.status ?? "";
  const status = normalizeCaktoStatus(rawEvent);

  // Payment ID: Cakto usa body.data.id
  const paymentId = body?.payment_id ?? body?.data?.id ?? body?.data?.payment_id ?? undefined;

  // Valor: Cakto usa body.data.value (em centavos BRL) ou body.amount
  let amount: number | undefined;
  if (typeof body?.amount === "number") {
    amount = body.amount;
  } else if (typeof body?.data?.value === "number") {
    amount = body.data.value / 100; // Cakto envia em centavos
  } else if (typeof body?.data?.amount === "number") {
    amount = body.data.amount;
  }

  return { cycle_id: cycleId, payment_id: paymentId, status, amount };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
  // Fail-closed: if secret is not configured, reject ALL requests.
  // A missing secret means the environment is misconfigured — never allow through.
  if (!secret) return false;
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function logPaymentError(input: {
  cycleId?: string;
  userId?: string | null;
  errorType: string;
  description: string;
  probableReason?: string;
  recommendedAction?: string;
  severity?: "baixo" | "medio" | "alto" | "critico";
  metadata?: Record<string, unknown>;
}) {
  await recordSystemErrorLog(getAdminClient(), {
    userId: input.userId ?? null,
    module: "payments-webhook",
    errorType: input.errorType,
    description: input.description,
    probableReason: input.probableReason,
    recommendedAction: input.recommendedAction,
    severity: input.severity ?? "alto",
    metadata: { cycleId: input.cycleId, ...(input.metadata ?? {}) },
  });
}

export const Route = createFileRoute("/api/public/payments-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature");

        if (!verifySignature(rawBody, signature)) {
          await logPaymentError({
            errorType: "invalid_signature",
            description: "Webhook de pagamento recebido com assinatura invalida.",
            probableReason: "PAYMENTS_WEBHOOK_SECRET divergente ou tentativa de chamada nao autorizada.",
            recommendedAction: "Verificar segredo do gateway e origem da requisicao.",
            severity: "critico",
          });
          return json({ error: "Invalid signature" }, 401);
        }

        let parsed: NormalizedPayload;
        try {
          const body = JSON.parse(rawBody);
          const normalized = normalizePayload(body);
          if (!normalized) throw new Error("cycle_id nao encontrado no payload");
          parsed = normalized;
        } catch (e: any) {
          await logPaymentError({
            errorType: "invalid_payload",
            description: "Webhook de pagamento recebido com payload invalido ou sem cycle_id.",
            probableReason: e?.message ?? "JSON fora do contrato esperado.",
            recommendedAction: "Verificar se o cycle_id esta sendo enviado no metadata do produto na Cakto.",
            severity: "alto",
            metadata: { rawBody: rawBody.slice(0, 500) },
          });
          return json({ error: "Invalid payload" }, 400);
        }

        const admin = getAdminClient();
        const { data: cycle, error: cycleErr } = await admin
          .from("user_cycles")
          .select("id, user_id, package_id, valor_pacote, status")
          .eq("id", parsed.cycle_id)
          .maybeSingle();

        if (cycleErr) {
          await logPaymentError({
            cycleId: parsed.cycle_id,
            errorType: "cycle_lookup_failed",
            description: "Falha ao localizar ciclo durante webhook de pagamento.",
            probableReason: cycleErr.message,
            recommendedAction: "Verificar integridade da tabela user_cycles e metadata enviado pelo checkout.",
            severity: "critico",
          });
          return json({ error: "Internal server error" }, 500);
        }

        if (!cycle) {
          await logPaymentError({
            cycleId: parsed.cycle_id,
            errorType: "cycle_not_found",
            description: "Webhook aprovado/recebido para ciclo inexistente.",
            probableReason: "cycle_id nao existe no banco ou foi removido.",
            recommendedAction: "Conferir metadata do gateway e pedido de checkout original.",
            severity: "critico",
          });
          return json({ error: "Cycle not found" }, 404);
        }

        if (parsed.status === "approved" && cycle.status === "ativo") {
          return json({ ok: true, idempotent: true });
        }

        // ── Cancelamento / estorno / chargeback ─────────────────────────────
        if (["cancelled", "refunded", "chargeback"].includes(parsed.status)) {
          // 1. Bloqueia o ciclo
          await admin.from("user_cycles")
            .update({ status: "bloqueado" })
            .eq("id", cycle.id);

          // 2. Invalida os pontos do usuário gerados por este ciclo
          await admin.from("point_events")
            .update({ status: "cancelled" })
            .eq("user_id", cycle.user_id)
            .eq("status", "valid");

          // 3. Cancela bônus pendentes (de rede que ainda não foram liberados)
          await admin.from("bonuses")
            .update({ status: "cancelado" })
            .eq("origem_id", cycle.id)
            .eq("status", "pendente");

          // 4. Remove retenções de saldo pendentes relacionadas ao ciclo
          const { data: cancelledBonuses } = await admin.from("bonuses")
            .select("id")
            .eq("origem_id", cycle.id)
            .eq("status", "cancelado");

          if (cancelledBonuses && cancelledBonuses.length > 0) {
            await admin.from("balance_holds")
              .delete()
              .in("bonus_id", cancelledBonuses.map((b) => b.id));
          }

          // 5. Bloqueia o perfil do usuário
          await admin.from("users_profile")
            .update({ status: "bloqueado" })
            .eq("id", cycle.user_id);

          await logPaymentError({
            cycleId: cycle.id,
            userId: cycle.user_id,
            errorType: `payment_${parsed.status}`,
            description: `Pagamento ${parsed.status} para ciclo ${cycle.id}. Ciclo bloqueado, pontos e bônus pendentes cancelados.`,
            probableReason: `Gateway retornou status "${parsed.status}"${parsed.payment_id ? ` para payment_id ${parsed.payment_id}` : ""}.`,
            recommendedAction: "Verificar junto ao gateway e ao usuário. Reativar manualmente se for engano.",
            severity: parsed.status === "chargeback" ? "critico" : "alto",
            metadata: { payment_id: parsed.payment_id ?? null, amount: parsed.amount ?? null },
          });

          return json({ ok: true, status: parsed.status });
        }
        // ────────────────────────────────────────────────────────────────────

        if (parsed.status === "pending") {
          return json({ ok: true, status: "pending" });
        }

        if (parsed.status === "failed") {
          const { error } = await admin.from("user_cycles").update({ status: "bloqueado" }).eq("id", cycle.id);
          if (error) {
            await logPaymentError({
              cycleId: cycle.id,
              userId: cycle.user_id,
              errorType: "failed_payment_update_error",
              description: "Falha ao marcar ciclo como bloqueado apos pagamento recusado.",
              probableReason: error.message,
              recommendedAction: "Verificar permissoes e schema da tabela user_cycles.",
              severity: "alto",
            });
            return json({ error: "Internal server error" }, 500);
          }
          return json({ ok: true, status: "failed" });
        }

        const accounting = buildPackageAccounting(Number(cycle.valor_pacote));
        const now = new Date().toISOString();
        let updateResult = await admin
          .from("user_cycles")
          .update({
            status: "ativo",
            started_at: now,
            percentual_atual: 0,
            saldo_bonificacoes: 0,
            package_value: accounting.package_value,
            course_fee: accounting.course_fee,
            total_paid: accounting.total_paid,
            bonusable_amount: accounting.bonusable_amount,
            cycle_limit_200: accounting.cycle_limit_200,
            amount_counted_for_rewards: accounting.amount_counted_for_rewards,
            status_normalized: "active",
            activation_source: "payment_webhook",
          })
          .eq("id", cycle.id);

        if (updateResult.error && /column|schema|cache/i.test(updateResult.error.message)) {
          updateResult = await admin
            .from("user_cycles")
            .update({
              status: "ativo",
              started_at: now,
              percentual_atual: 0,
              saldo_bonificacoes: 0,
            })
            .eq("id", cycle.id);
        }

        if (updateResult.error) {
          await logPaymentError({
            cycleId: cycle.id,
            userId: cycle.user_id,
            errorType: "cycle_activation_failed",
            description: "Falha ao ativar ciclo apos pagamento aprovado.",
            probableReason: updateResult.error.message,
            recommendedAction: "Verificar colunas de user_cycles e status permitido.",
            severity: "critico",
          });
          return json({ error: "Internal server error" }, 500);
        }

        const { error: profileError } = await admin
          .from("users_profile")
          .update({ pacote_ativo_id: cycle.package_id, status: "ativo" })
          .eq("id", cycle.user_id);

        if (profileError) {
          await logPaymentError({
            cycleId: cycle.id,
            userId: cycle.user_id,
            errorType: "profile_activation_failed",
            description: "Pagamento aprovado, mas nao foi possivel ativar o perfil do usuario.",
            probableReason: profileError.message,
            recommendedAction: "Conferir users_profile, RLS e chave service role.",
            severity: "critico",
          });
        }

        const totalPaid = parsed.amount ?? accounting.total_paid;
        const description = `Pagamento aprovado${parsed.payment_id ? ` (${parsed.payment_id})` : ""} - total US$ ${totalPaid.toFixed(2)}; pacote bonificavel US$ ${accounting.bonusable_amount.toFixed(2)}; curso US$ ${accounting.course_fee.toFixed(2)}`;

        const fullTransaction = {
          user_id: cycle.user_id,
          cycle_id: cycle.id,
          tipo: "credito",
          valor: totalPaid,
          descricao: description,
          bonusable_amount: accounting.bonusable_amount,
          course_fee: accounting.course_fee,
          source_type: "package_payment",
          metadata: {
            payment_id: parsed.payment_id ?? null,
            package_value: accounting.package_value,
            course_fee: accounting.course_fee,
            total_paid: totalPaid,
            amount_counted_for_rewards: accounting.amount_counted_for_rewards,
          },
        };

        let txResult = await admin.from("wallet_transactions").insert(fullTransaction);
        if (txResult.error && /column|schema|cache/i.test(txResult.error.message)) {
          txResult = await admin.from("wallet_transactions").insert({
            user_id: cycle.user_id,
            cycle_id: cycle.id,
            tipo: "credito",
            valor: totalPaid,
            descricao: description,
          });
        }

        if (txResult.error) {
          await logPaymentError({
            cycleId: cycle.id,
            userId: cycle.user_id,
            errorType: "wallet_transaction_failed",
            description: "Pagamento aprovado, mas a entrada financeira nao foi registrada.",
            probableReason: txResult.error.message,
            recommendedAction: "Verificar wallet_transactions e reconciliar manualmente o pagamento.",
            severity: "critico",
          });
          return json({ error: "Internal server error" }, 500);
        }

        await awardPackagePoints(admin, {
          userId: cycle.user_id,
          bonusableAmount: accounting.bonusable_amount,
          sourceEvent: cycle.status === "aguardando_renovacao" ? "renovacao_pacote" : "compra_pacote",
          metadata: { cycle_id: cycle.id, payment_id: parsed.payment_id ?? null },
        });

        return json({
          ok: true,
          status: "approved",
          accounting: {
            totalPaid,
            packageValue: accounting.package_value,
            courseFee: accounting.course_fee,
            bonusableAmount: accounting.bonusable_amount,
            cycleLimit200: accounting.cycle_limit_200,
          },
        });
      },
    },
  },
});
