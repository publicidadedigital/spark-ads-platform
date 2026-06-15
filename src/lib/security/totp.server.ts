import { authenticator } from "otplib";
import { getAdminClient } from "@/lib/supabase/admin.server";

export const ISSUER = "Viral Hub";

export async function requireUser(accessToken: string) {
  const admin = getAdminClient();
  const { data: userRes, error } = await admin.auth.getUser(accessToken);
  if (error || !userRes?.user) throw new Error("Sessao invalida");
  return userRes.user;
}

export async function isTwoFactorEnabled(authUserId: string) {
  const admin = getAdminClient();
  const { data } = await admin
    .from("two_factor_auth")
    .select("enabled")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return !!data?.enabled;
}

export async function verifyTwoFactorCode(authUserId: string, code: string) {
  const admin = getAdminClient();
  const { data } = await admin
    .from("two_factor_auth")
    .select("secret, enabled")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!data?.enabled) {
    throw new Error("Configure a autenticação em dois fatores (Google Authenticator) antes de confirmar saques.");
  }

  if (!code || !authenticator.verify({ token: code, secret: data.secret })) {
    throw new Error("Código de autenticação inválido.");
  }
}
