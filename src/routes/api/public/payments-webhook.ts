/**
 * Webhook de confirmação de pagamento.
 *
 * Endpoint público chamado pelo gateway (Mercado Pago, Stripe, Asaas...) após
 * a tentativa de pagamento. Atualiza o ciclo correspondente no Supabase.
 *
 * Segurança:
 *  - Verifica HMAC SHA-256 do corpo bruto contra o header `x-webhook-signature`,
 *    usando a env `PAYMENTS_WEBHOOK_SECRET`. Em modo dev (secret ausente)
 *    a verificação é pulada — NÃO faça isso em produção.
 *
 * Payload esperado (JSON):
 *  {
 *    "cycle_id": "<uuid do user_cycles criado no checkout>",
 *    "payment_id": "<id do gateway, opcional para log>",
 *    "status": "approved" | "failed" | "pending",
 *    "amount": <number, opcional>
 *  }
 *
 * Comportamento:
 *  - approved → cycle.status = 'ativo', started_at atualizado, registra
 *    transação em wallet_transactions (tipo 'credito').
 *  - failed   → cycle.status = 'bloqueado'.
 *  - pending  → no-op (idempotente).
 */

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
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
  // Em dev, sem secret configurado, aceitamos para facilitar testes.
  if (!secret) return true;
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

export const Route = createFileRoute("/api/public/payments-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature = request.headers.get("x-webhook-signature");

        if (!verifySignature(rawBody, signature)) {
          return json({ error: "Invalid signature" }, 401);
        }

        let parsed: z.infer<typeof PayloadSchema>;
        try {
          parsed = PayloadSchema.parse(JSON.parse(rawBody));
        } catch (e: any) {
          return json({ error: "Invalid payload", details: e?.message }, 400);
        }

        // Busca o ciclo
        const { data: cycle, error: cycleErr } = await getAdminClient()
          .from("user_cycles")
          .select("id, user_id, package_id, valor_pacote, status")
          .eq("id", parsed.cycle_id)
          .maybeSingle();

        if (cycleErr) return json({ error: cycleErr.message }, 500);
        if (!cycle) return json({ error: "Cycle not found" }, 404);

        // Idempotência: se já está ativo, não reprocessa
        if (parsed.status === "approved" && cycle.status === "ativo") {
          return json({ ok: true, idempotent: true });
        }

        if (parsed.status === "pending") {
          return json({ ok: true, status: "pending" });
        }

        if (parsed.status === "failed") {
          const { error } = await getAdminClient()
            .from("user_cycles")
            .update({ status: "bloqueado" })
            .eq("id", cycle.id);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true, status: "failed" });
        }

        // approved
        const now = new Date().toISOString();
        const { error: updErr } = await getAdminClient()
          .from("user_cycles")
          .update({
            status: "ativo",
            started_at: now,
            percentual_atual: 0,
            saldo_bonificacoes: 0,
          })
          .eq("id", cycle.id);
        if (updErr) return json({ error: updErr.message }, 500);

        // Ativa o pacote no perfil
        await getAdminClient()
          .from("users_profile")
          .update({ pacote_ativo_id: cycle.package_id, status: "ativo" })
          .eq("id", cycle.user_id);

        // Registra transação de crédito (entrada do pagamento)
        await getAdminClient().from("wallet_transactions").insert({
          user_id: cycle.user_id,
          cycle_id: cycle.id,
          tipo: "credito",
          valor: parsed.amount ?? Number(cycle.valor_pacote),
          descricao: `Pagamento aprovado${parsed.payment_id ? ` (${parsed.payment_id})` : ""}`,
        });

        return json({ ok: true, status: "approved" });
      },
    },
  },
});
