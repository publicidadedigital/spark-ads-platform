import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildPackageAccounting } from "@/lib/business/rules";
import { getAdminClient } from "@/lib/supabase/admin.server";

/**
 * Cria um pedido de checkout (intencao de pagamento).
 * - Valida o usuario via access token enviado pelo cliente.
 * - Carrega o pacote do servidor (nao confia no preco enviado pelo cliente).
 * - Separa valor bonificavel do pacote e taxa fixa de curso US$10.
 * - Insere user_cycles com o valor bonificavel em valor_pacote; o total pago
 *   fica separado para checkout/gateway e relatorios.
 *
 * Retorna o cycle_id que deve ser enviado ao gateway no metadata, para o
 * webhook conseguir localizar o pedido no callback.
 */
export const createCheckoutOrder = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        packageId: z.string().uuid(),
        accessToken: z.string().min(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const admin = getAdminClient();
    const { data: userRes, error: userErr } = await admin.auth.getUser(data.accessToken);
    if (userErr || !userRes?.user) throw new Error("Sessao invalida");
    const authUserId = userRes.user.id;

    const { data: profile, error: profileErr } = await admin
      .from("users_profile")
      .select("id, status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile) throw new Error("Perfil nao encontrado");

    const { data: pkg, error: pkgErr } = await admin
      .from("packages")
      .select("id, valor, status")
      .eq("id", data.packageId)
      .maybeSingle();
    if (pkgErr) throw new Error(pkgErr.message);
    if (!pkg) throw new Error("Pacote nao encontrado");
    if (pkg.status !== "ativo") throw new Error("Pacote indisponivel");

    const accounting = buildPackageAccounting(Number(pkg.valor));
    const fullCyclePayload = {
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
    };

    let cycleResult = await admin.from("user_cycles").insert(fullCyclePayload).select("id").single();

    if (cycleResult.error && /column|schema|cache/i.test(cycleResult.error.message)) {
      cycleResult = await admin
        .from("user_cycles")
        .insert({
          user_id: profile.id,
          package_id: pkg.id,
          valor_pacote: accounting.bonusable_amount,
          status: "aguardando_renovacao",
        })
        .select("id")
        .single();
    }

    if (cycleResult.error) throw new Error(cycleResult.error.message);

    return {
      cycleId: cycleResult.data.id,
      valor: accounting.total_paid,
      packageValue: accounting.package_value,
      courseFee: accounting.course_fee,
      totalPaid: accounting.total_paid,
      bonusableAmount: accounting.bonusable_amount,
      cycleLimit200: accounting.cycle_limit_200,
      dailyBonus: accounting.daily_bonus,
    };
  });
