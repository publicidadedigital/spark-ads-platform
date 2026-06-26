import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
}

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: z.string().min(10), authUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);

    const admin = getAdminClient();

    const { error: cleanupError } = await admin.rpc("admin_predelete_user_cleanup", { p_auth_user_id: data.authUserId });
    if (cleanupError) throw new Error(cleanupError.message);

    const { error: deleteError } = await admin.auth.admin.deleteUser(data.authUserId);
    if (deleteError) throw new Error(deleteError.message);

    return { success: true };
  });
