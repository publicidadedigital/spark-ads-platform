import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_WITHDRAWAL_USD, MIN_WITHDRAWAL_USD, isWithdrawalAmountAllowed, isWithdrawalProcessingDay } from "@/lib/business/rules";
import { getAdminClient } from "@/lib/supabase/admin.server";
import { verifyTwoFactorCode } from "@/lib/security/totp.server";

const MethodSchema = z.enum(["pix", "crypto"]);

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

async function requireProfile(accessToken: string) {
  const admin = getAdminClient();
  const { data: userRes, error: userErr } = await admin.auth.getUser(accessToken);
  if (userErr || !userRes?.user) throw new Error("Sessao invalida");

  const { data: profile, error } = await admin
    .from("users_profile")
    .select("id, auth_user_id, cpf")
    .eq("auth_user_id", userRes.user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Perfil nao encontrado");

  return { authUserId: userRes.user.id, profileId: profile.id, document: profile.cpf as string | null };
}

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

async function getAvailableBalance(userId: string) {
  const admin = getAdminClient();
  const { data } = await admin
    .from("wallet_transactions")
    .select("tipo,valor")
    .eq("user_id", userId);

  return (data ?? []).reduce((sum, row: any) => {
    const value = Number(row.valor ?? 0);
    if (row.tipo === "credito") return sum + value;
    if (row.tipo === "debito" || row.tipo === "saque") return sum - value;
    return sum;
  }, 0);
}

export const requestWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      accessToken: z.string().min(10),
      amountUsd: z.number().positive(),
      method: MethodSchema,
      destinationKey: z.string().min(3),
      destinationHolder: z.string().optional(),
      destinationDocument: z.string().min(3),
      totpCode: z.string().min(6).max(6),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const admin = getAdminClient();
    const { authUserId, profileId, document } = await requireProfile(data.accessToken);

    await verifyTwoFactorCode(authUserId, data.totpCode);

    if (!document || onlyDigits(document) !== onlyDigits(data.destinationDocument)) {
      throw new Error("O saque só pode ser realizado para o CPF cadastrado na sua conta.");
    }

    if (!isWithdrawalAmountAllowed(data.amountUsd)) {
      throw new Error(`Saque permitido somente entre US$ ${MIN_WITHDRAWAL_USD} e US$ ${MAX_WITHDRAWAL_USD}.`);
    }

    const available = await getAvailableBalance(profileId);
    if (available < data.amountUsd) {
      throw new Error("Saldo disponivel insuficiente para solicitar saque.");
    }

    const now = new Date();
    const requestedProcessingDay = now.getDate() <= 15 ? 15 : 30;

    const { data: withdrawal, error } = await admin
      .from("withdrawal_requests")
      .insert({
        user_id: profileId,
        amount_usd: data.amountUsd,
        method: data.method,
        destination_key: data.destinationKey,
        destination_holder: data.destinationHolder ?? null,
        destination_document: data.destinationDocument,
        status: "solicitado",
        requested_processing_day: requestedProcessingDay,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await admin.from("wallet_transactions").insert({
      user_id: profileId,
      withdrawal_request_id: withdrawal.id,
      tipo: "bloqueio",
      valor: data.amountUsd,
      descricao: `Solicitacao de saque aguardando analise administrativa - US$ ${data.amountUsd.toFixed(2)}`,
    });

    return { withdrawalId: withdrawal.id, status: "solicitado" };
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      accessToken: z.string().min(10),
      withdrawalId: z.string().uuid(),
      action: z.enum(["approve", "reject"]),
      notes: z.string().optional(),
      totpCode: z.string().min(6).max(6),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const admin = getAdminClient();
    const adminUserId = await requireAdmin(data.accessToken);
    await verifyTwoFactorCode(adminUserId, data.totpCode);
    const status = data.action === "approve" ? "aprovado" : "recusado";

    const { error } = await admin
      .from("withdrawal_requests")
      .update({
        status,
        admin_notes: data.notes ?? null,
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.withdrawalId)
      .in("status", ["solicitado", "em_analise"]);

    if (error) throw new Error(error.message);
    return { ok: true, status };
  });

export const markWithdrawalPaid = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      accessToken: z.string().min(10),
      withdrawalId: z.string().uuid(),
      providerReference: z.string().optional(),
      notes: z.string().optional(),
      forceOutsideProcessingDay: z.boolean().optional(),
      totpCode: z.string().min(6).max(6),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const admin = getAdminClient();
    const adminUserId = await requireAdmin(data.accessToken);
    await verifyTwoFactorCode(adminUserId, data.totpCode);

    if (!data.forceOutsideProcessingDay && !isWithdrawalProcessingDay()) {
      throw new Error("Saques so podem ser disparados nos dias 15 e 30, salvo liberacao administrativa forçada.");
    }

    const { data: withdrawal, error: loadError } = await admin
      .from("withdrawal_requests")
      .select("id,user_id,amount_usd,status")
      .eq("id", data.withdrawalId)
      .maybeSingle();

    if (loadError) throw new Error(loadError.message);
    if (!withdrawal) throw new Error("Saque nao encontrado");
    if (!["aprovado", "em_processamento"].includes(withdrawal.status)) throw new Error("Saque precisa estar aprovado para pagamento.");

    const { error } = await admin
      .from("withdrawal_requests")
      .update({
        status: "pago",
        paid_by: adminUserId,
        paid_at: new Date().toISOString(),
        provider: "manual",
        provider_reference: data.providerReference ?? null,
        admin_notes: data.notes ?? null,
      })
      .eq("id", data.withdrawalId);

    if (error) throw new Error(error.message);

    await admin.from("wallet_transactions").insert({
      user_id: withdrawal.user_id,
      withdrawal_request_id: withdrawal.id,
      tipo: "debito",
      valor: Number(withdrawal.amount_usd),
      descricao: `Saque pago manualmente pelo admin - US$ ${Number(withdrawal.amount_usd).toFixed(2)}`,
    });

    return { ok: true, status: "pago" };
  });

export const markApprovedWithdrawalsPaidBatch = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      accessToken: z.string().min(10),
      forceOutsideProcessingDay: z.boolean().optional(),
      notes: z.string().optional(),
      totpCode: z.string().min(6).max(6),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const admin = getAdminClient();
    const adminUserId = await requireAdmin(data.accessToken);
    await verifyTwoFactorCode(adminUserId, data.totpCode);

    if (!data.forceOutsideProcessingDay && !isWithdrawalProcessingDay()) {
      throw new Error("Disparo em massa permitido somente nos dias 15 e 30, salvo liberacao administrativa forçada.");
    }

    const { data: withdrawals, error: loadError } = await admin
      .from("withdrawal_requests")
      .select("id,user_id,amount_usd")
      .eq("status", "aprovado");

    if (loadError) throw new Error(loadError.message);
    const rows = withdrawals ?? [];
    if (rows.length === 0) return { ok: true, paid: 0 };

    const total = rows.reduce((sum: number, row: any) => sum + Number(row.amount_usd ?? 0), 0);
    const { data: batch, error: batchError } = await admin
      .from("withdrawal_batches")
      .insert({
        created_by: adminUserId,
        status: "completed",
        total_amount_usd: total,
        total_requests: rows.length,
        notes: data.notes ?? "Disparo em massa manual",
      })
      .select("id")
      .single();

    if (batchError) throw new Error(batchError.message);

    for (const row of rows as any[]) {
      await admin
        .from("withdrawal_requests")
        .update({
          status: "pago",
          paid_by: adminUserId,
          paid_at: new Date().toISOString(),
          batch_id: batch.id,
          provider: "manual_batch",
          provider_reference: `batch:${batch.id}`,
        })
        .eq("id", row.id);

      await admin.from("wallet_transactions").insert({
        user_id: row.user_id,
        withdrawal_request_id: row.id,
        tipo: "debito",
        valor: Number(row.amount_usd),
        descricao: `Saque pago em lote manual - US$ ${Number(row.amount_usd).toFixed(2)}`,
      });
    }

    return { ok: true, paid: rows.length, batchId: batch.id, totalAmountUsd: total };
  });
