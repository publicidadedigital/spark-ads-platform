import { authenticator } from "otplib";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { getAdminClient } from "@/lib/supabase/admin.server";

export const ISSUER = "Viral Hub";

function getEncryptionKey(): Buffer | null {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    if (hex !== undefined) {
      console.warn("TOTP_ENCRYPTION_KEY must be a 64-character hex string. Falling back to plaintext storage.");
    } else {
      console.warn("TOTP_ENCRYPTION_KEY is not set. Falling back to plaintext storage.");
    }
    return null;
  }
  return Buffer.from(hex, "hex");
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(ciphertext: string): string {
  if (!ciphertext.startsWith("v1:")) return ciphertext;

  const key = getEncryptionKey();
  if (!key) return ciphertext;

  const parts = ciphertext.split(":");
  if (parts.length !== 4) return ciphertext;

  const [, ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

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

  if (!code || !authenticator.verify({ token: code, secret: decryptSecret(data.secret) })) {
    throw new Error("Código de autenticação inválido.");
  }
}
