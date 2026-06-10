import { createHash, randomBytes } from "node:crypto";

export type ConfirmationEmailPayload = {
  to: string;
  name?: string | null;
  confirmationUrl: string;
};

export type ResendDeliveryResult = {
  configured: boolean;
  provider: "resend";
  id?: string;
  skippedReason?: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

export function createEmailConfirmationToken() {
  const rawToken = randomBytes(32).toString("base64url");
  return {
    rawToken,
    tokenHash: hashEmailConfirmationToken(rawToken),
  };
}

export function hashEmailConfirmationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getPublicBaseUrl(request: Request) {
  const configured = process.env.APP_PUBLIC_URL || process.env.VITE_APP_PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function buildConfirmationUrl(request: Request, token: string) {
  const baseUrl = getPublicBaseUrl(request);
  return `${baseUrl}/api/public/email-confirmation/confirm?token=${encodeURIComponent(token)}`;
}

export async function sendConfirmationEmail(payload: ConfirmationEmailPayload): Promise<ResendDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      configured: false,
      provider: "resend",
      skippedReason: "RESEND_API_KEY e RESEND_FROM_EMAIL ainda nao configurados.",
    };
  }

  const subject = "Confirme seu e-mail na Viral Hub";
  const html = renderConfirmationEmail(payload);
  const text = renderConfirmationText(payload);

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: payload.to,
      subject,
      html,
      text,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Falha ao enviar e-mail pelo Resend.");
  }

  return {
    configured: true,
    provider: "resend",
    id: data?.id,
  };
}

function renderConfirmationEmail({ name, confirmationUrl }: ConfirmationEmailPayload) {
  const displayName = name?.trim() || "novo usuario";
  return `
  <!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Confirme seu e-mail</title>
    </head>
    <body style="margin:0;background:#020617;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:32px;">
              <tr>
                <td>
                  <p style="margin:0 0 12px;color:#38bdf8;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Viral Hub</p>
                  <h1 style="margin:0 0 16px;color:#ffffff;font-size:28px;line-height:1.2;">Confirme seu e-mail</h1>
                  <p style="margin:0 0 18px;color:#cbd5e1;font-size:16px;line-height:1.55;">Ola, ${escapeHtml(displayName)}. Seu cadastro foi criado com sucesso. Clique no botao abaixo para confirmar seu e-mail e continuar o fluxo de ativacao da conta.</p>
                  <p style="margin:28px 0;">
                    <a href="${confirmationUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 22px;font-weight:700;">Confirmar e-mail</a>
                  </p>
                  <p style="margin:0 0 10px;color:#94a3b8;font-size:13px;line-height:1.5;">Este link expira em 24 horas. Se voce nao solicitou este cadastro, ignore esta mensagem.</p>
                  <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.5;word-break:break-all;">Link alternativo: ${confirmationUrl}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}

function renderConfirmationText({ name, confirmationUrl }: ConfirmationEmailPayload) {
  const displayName = name?.trim() || "novo usuario";
  return [
    `Ola, ${displayName}.`,
    "Seu cadastro na Viral Hub foi criado com sucesso.",
    "Confirme seu e-mail pelo link abaixo:",
    confirmationUrl,
    "Este link expira em 24 horas.",
  ].join("\n\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
