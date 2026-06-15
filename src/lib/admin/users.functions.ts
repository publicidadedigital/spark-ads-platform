import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase/admin.server";

async function requireAdmin(accessToken: string) {
  const admin = getAdminClient();
  const { data: userRes, error: userErr } = await admin.auth.getUser(accessToken);
  if (userErr || !userRes?.user) throw new Error("Sessao invalida");

  const [{ data: legacyRole, error: legacyErr }, { data: modernRole, error: modernErr }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", userRes.user.id).in("role", ["admin", "super_admin"]).maybeSingle(),
    admin.from("admin_roles").select("status").eq("auth_user_id", userRes.user.id).eq("status", "ativo").maybeSingle(),
  ]);

  if (legacyErr) throw new Error(legacyErr.message);
  if (modernErr) throw new Error(modernErr.message);
  if (!legacyRole && !modernRole) throw new Error("Acesso administrativo necessario");
}

export const getUsersLastLogin = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);

    const admin = getAdminClient();
    const lastLogins: Record<string, string | null> = {};

    let page = 1;
    while (page <= 10) {
      const { data: result, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);

      for (const u of result.users) {
        lastLogins[u.id] = u.last_sign_in_at ?? null;
      }

      if (result.users.length < 1000) break;
      page += 1;
    }

    return { lastLogins };
  });
