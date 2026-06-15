import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { getAdminClient } from "@/lib/supabase/admin.server";
import { ISSUER, requireUser } from "@/lib/security/totp.server";

export const getTwoFactorStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const admin = getAdminClient();
    const { data: row } = await admin
      .from("two_factor_auth")
      .select("enabled, confirmed_at")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    return { enabled: !!row?.enabled, confirmedAt: row?.confirmed_at ?? null };
  });

export const setupTwoFactor = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accessToken: z.string().min(10) }).parse(input))
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const admin = getAdminClient();

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email ?? user.id, ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    const { error } = await admin
      .from("two_factor_auth")
      .upsert({ auth_user_id: user.id, secret, enabled: false, confirmed_at: null }, { onConflict: "auth_user_id" });

    if (error) throw new Error(error.message);

    return { secret, otpauth, qrCodeDataUrl };
  });

export const confirmTwoFactor = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: z.string().min(10), code: z.string().min(6).max(6) }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const admin = getAdminClient();

    const { data: row, error } = await admin
      .from("two_factor_auth")
      .select("secret")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Gere o QR Code antes de confirmar.");

    if (!authenticator.verify({ token: data.code, secret: row.secret })) {
      throw new Error("Código inválido. Verifique o aplicativo autenticador e tente novamente.");
    }

    const { error: updateError } = await admin
      .from("two_factor_auth")
      .update({ enabled: true, confirmed_at: new Date().toISOString() })
      .eq("auth_user_id", user.id);

    if (updateError) throw new Error(updateError.message);

    return { ok: true };
  });

export const disableTwoFactor = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ accessToken: z.string().min(10), code: z.string().min(6).max(6) }).parse(input),
  )
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const admin = getAdminClient();

    const { data: row } = await admin
      .from("two_factor_auth")
      .select("secret, enabled")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!row?.enabled) {
      throw new Error("Configure a autenticação em dois fatores (Google Authenticator) antes de confirmar saques.");
    }

    if (!data.code || !authenticator.verify({ token: data.code, secret: row.secret })) {
      throw new Error("Código de autenticação inválido.");
    }

    const { error } = await admin.from("two_factor_auth").delete().eq("auth_user_id", user.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
