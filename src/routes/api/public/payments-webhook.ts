/**
 * Webhook de confirmacao de pagamento.
 *
 * Endpoint publico chamado pelo gateway (Mercado Pago, Stripe, Asaas...) apos
 * a tentativa de pagamento. Atualiza o ciclo correspondente no Supabase.
 *
 * Seguranca:
 *  - Verifica HMAC SHA-256 do corpo bruto contra o header `x-webhook-signature`,
 *    usando a env `PAYMENTS_WEBHOOK_SECRET`.
 *    OBRIGATÓRIO: se PAYMENTS_WEBHOOK_SECRET nao estiver configurada, TODAS as
 *    requisicoes sao rejeitadas (fail-closed). Configure a env em producao.
 *
 * Payload esperado (JSON):
 *  {
 *    "cycle_id": "<uuid do user_cycles criado no checkout>",
 *    "payment_id": "<id do gateway, opcional para log>",
 *    "status": "approved" | "failed" | "pending",
 *    "amount": <number, opcional>
 *  }
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

const PayloadSchema = z.object({
  cycle_id: z.string().uuid(),
  payment_id: z.string().min(1).max(255).optional(),
  status: z.enum(["approved", "failed", "pending"]),
  amount: z.number().nonnegative().optional(),
});

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

        let parsed: z.infer<typeof PayloadSchema>;
        try {
          parsed = PayloadSchema.parse(JSON.parse(rawBody));
        } catch (e: any) {
          await logPaymentError({
            errorType: "invalid_payload",
            description: "Webhook de pagamento recebido com payload invalido.",
            probableReason: e?.message ?? "JSON fora do contrato esperado.",
            recommendedAction: "Conferir o mapeamento do gateway para cycle_id, status e amount.",
            severity: "alto",
            metadata: { rawBody },
          });
          return json({ error: "Invalid payload", details: e?.message }, 400);
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
          return json({ error: cycleErr.message }, 500);
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
            return json({ error: error.message }, 500);
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
          return json({ error: updateResult.error.message }, 500);
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
          return json({ error: txResult.error.message }, 500);
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
