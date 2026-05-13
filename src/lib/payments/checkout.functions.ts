import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin.server";

/**
 * Cria um pedido de checkout (intenção de pagamento).
 * - Valida o usuário via access token enviado pelo cliente.
 * - Carrega o pacote do servidor (não confia no preço enviado pelo cliente).
 * - Insere user_cycles com status `aguardando_renovacao` usando service role
 *   (a RLS hoje só permite admin inserir; por isso a operação acontece no server).
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
    if (userErr || !userRes?.user) throw new Error("Sessão inválida");
    const authUserId = userRes.user.id;

    // Resolve o profile_id a partir do auth user
    const { data: profile, error: profileErr } = await admin
      .from("users_profile")
      .select("id, status")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    if (!profile) throw new Error("Perfil não encontrado");

    // Carrega o pacote do banco (preço autoritativo)
    const { data: pkg, error: pkgErr } = await admin
      .from("packages")
      .select("id, valor, status")
      .eq("id", data.packageId)
      .maybeSingle();
    if (pkgErr) throw new Error(pkgErr.message);
    if (!pkg) throw new Error("Pacote não encontrado");
    if (pkg.status !== "ativo") throw new Error("Pacote indisponível");

    // Insere a intenção de ciclo (será ativada pelo webhook após pagamento)
    const { data: cycle, error: cycleErr } = await admin
      .from("user_cycles")
      .insert({
        user_id: profile.id,
        package_id: pkg.id,
        valor_pacote: pkg.valor,
        status: "aguardando_renovacao",
      })
      .select("id")
      .single();
    if (cycleErr) throw new Error(cycleErr.message);

    return { cycleId: cycle.id, valor: Number(pkg.valor) };
  });
