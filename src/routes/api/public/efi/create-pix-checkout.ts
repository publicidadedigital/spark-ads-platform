import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { recordSystemErrorLog } from "@/lib/business/audit.server";
import { buildPackageAccounting } from "@/lib/business/rules";
import { convertUsdToBrl, getUsdtBrlQuote } from "@/lib/payments/binance.server";
import { createEfiPixCharge, createPixTxId } from "@/lib/payments/efi.server";
import { getAdminClient } from "@/lib/supabase/admin.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
} as const;

const CheckoutSchema = z.object({
  packageId: z.string().uuid(),
  packageNome: z.string().min(1),
  valor: z.number().positive(),
  method: z.literal("pix"),
  userId: z.string().uuid(),
  userEmail: z.string().email().or(z.literal("")),
  cycleId: z.string().uuid(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/efi/create-pix-checkout")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const admin = getAdminClient();
        const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

        if (!token) return json({ error: "Sessao obrigatoria" }, 401);

        const { data: authUser, error: authError } = await admin.auth.getUser(token);
        if (authError || !authUser.user) return json({ error: "Sessao invalida" }, 401);

        let input: z.infer<typeof CheckoutSchema>;
        try {
          input = CheckoutSchema.parse(await request.json());
        } catch (error: any) {
          return json({ error: "Payload invalido", details: error?.message }, 400);
        }

        const { data: profile, error: profileError } = await admin
          .from("users_profile")
          .select("id, nome, cpf, auth_user_id, pais")
          .eq("id", input.userId)
          .maybeSingle();

        if (profileError || !profile || profile.auth_user_id !== authUser.user.id) {
          await recordSystemErrorLog(admin, {
            userId: input.userId,
            module: "efi-pix-checkout",
            errorType: "profile_mismatch",
            description: "Tentativa de gerar Pix para perfil divergente da sessao.",
            probableReason: profileError?.message ?? "ID de perfil nao pertence ao auth user.",
            recommendedAction: "Verificar possivel tentativa de fraude no checkout.",
            severity: "critico",
          });
          return json({ error: "Perfil invalido para checkout" }, 403);
        }

        if (String(profile.pais ?? "Brasil").toLowerCase() !== "brasil") {
          return json({ error: "Pix disponivel apenas para usuarios do Brasil. Use cripto." }, 400);
        }

        const { data: pkg, error: pkgError } = await admin
          .from("packages")
          .select("id, valor, nome, status")
          .eq("id", input.packageId)
          .maybeSingle();

        if (pkgError || !pkg || pkg.status !== "ativo") {
          return json({ error: pkgError?.message ?? "Pacote indisponivel" }, 400);
        }

        const accounting = buildPackageAccounting(Number(pkg.valor));
        const quote = await getUsdtBrlQuote();
        const amountBrl = convertUsdToBrl(accounting.total_paid, quote);
        const txid = createPixTxId(`${input.cycleId}:${input.userId}:${Date.now()}`);

        try {
          const charge = await createEfiPixCharge({
            txid,
            amountBrl,
            debtorName: profile.nome ?? "Cliente Viral Hub",
            debtorCpf: profile.cpf ?? null,
            description: `Viral Hub ${pkg.nome} - US$ ${accounting.total_paid.toFixed(2)}`,
            metadata: {
              cycle_id: input.cycleId,
              user_id: input.userId,
              package_id: input.packageId,
              total_paid_usd: accounting.total_paid,
              bonusable_usd: accounting.bonusable_amount,
              course_fee_usd: accounting.course_fee,
              quote_rate: quote.rate,
              quote_source: quote.source,
            },
          });

          const fullPayment = {
            user_id: input.userId,
            cycle_id: input.cycleId,
            provider: "efi",
            method: "pix",
            status: "pending",
            external_id: txid,
            amount_usd: accounting.total_paid,
            package_value_usd: accounting.package_value,
            course_fee_usd: accounting.course_fee,
            bonusable_amount_usd: accounting.bonusable_amount,
            amount_brl: amountBrl,
            exchange_rate: quote.rate,
            exchange_source: quote.source,
            pix_copy_paste: charge.pixCopyPaste,
            pix_qr_base64: charge.qrCodeImage,
            raw_response: charge.raw,
          };

          let paymentInsert = await admin.from("payment_orders").insert(fullPayment);
          if (paymentInsert.error && /relation|column|schema|cache/i.test(paymentInsert.error.message)) {
            paymentInsert = await admin.from("wallet_transactions").insert({
              user_id: input.userId,
              cycle_id: input.cycleId,
              tipo: "bloqueio",
              valor: accounting.total_paid,
              descricao: `Pedido Pix Efí pendente ${txid} - US$ ${accounting.total_paid.toFixed(2)} / BRL ${amountBrl.toFixed(2)}`,
            });
          }

          if (paymentInsert.error) throw paymentInsert.error;

          return json({
            paymentId: txid,
            status: "pending",
            pixCode: charge.pixCopyPaste,
            pixQrBase64: charge.qrCodeImage,
            amountUsd: accounting.total_paid,
            amountBrl,
            quoteRate: quote.rate,
            quoteSource: quote.source,
          });
        } catch (error: any) {
          await recordSystemErrorLog(admin, {
            userId: input.userId,
            module: "efi-pix-checkout",
            errorType: "efi_charge_failed",
            description: "Falha ao criar cobranca Pix na Efí.",
            probableReason: error?.message ?? "Erro desconhecido da Efí.",
            recommendedAction: "Conferir credenciais, certificado, chave Pix e ambiente Efí.",
            severity: "critico",
            metadata: { cycleId: input.cycleId, packageId: input.packageId },
          });
          return json({ error: error?.message ?? "Falha ao criar Pix" }, 500);
        }
      },
    },
  },
});
