import { createHash } from "crypto";
import { readFileSync } from "fs";
import https from "https";

export type EfiPixChargeInput = {
  txid: string;
  amountBrl: number;
  debtorName: string;
  debtorCpf?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
};

export type EfiPixChargeResult = {
  txid: string;
  locId?: number | string | null;
  status: string;
  pixCopyPaste?: string | null;
  qrCodeImage?: string | null;
  raw: unknown;
};

const EFI_PROD_BASE_URL = "https://pix.api.efipay.com.br";
const EFI_SANDBOX_BASE_URL = "https://pix-h.api.efipay.com.br";

type EfiRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

function getBaseUrl() {
  return process.env.EFI_ENV === "production" ? EFI_PROD_BASE_URL : EFI_SANDBOX_BASE_URL;
}

function getHttpsAgent() {
  const certPath = process.env.EFI_CERT_PATH;
  const certBase64 = process.env.EFI_CERT_BASE64;
  const passphrase = process.env.EFI_CERT_PASSPHRASE;

  if (!certPath && !certBase64) {
    throw new Error("Configure EFI_CERT_PATH ou EFI_CERT_BASE64 para usar Pix Efí.");
  }

  const pfx = certBase64 ? Buffer.from(certBase64, "base64") : readFileSync(certPath!);
  return new https.Agent({ pfx, passphrase });
}

async function efiRequest(path: string, init: EfiRequestInit = {}) {
  const url = new URL(`${getBaseUrl()}${path}`);
  const body = init.body ?? "";

  return new Promise<any>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: init.method ?? "GET",
        agent: getHttpsAgent(),
        headers: {
          "Content-Type": "application/json",
          ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
          ...(init.headers ?? {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const parsed = text ? JSON.parse(text) : null;
          const status = response.statusCode ?? 500;

          if (status < 200 || status >= 300) {
            reject(new Error(`Efí respondeu ${status}: ${text}`));
            return;
          }

          resolve(parsed);
        });
      },
    );

    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function getEfiAccessToken() {
  const clientId = process.env.EFI_CLIENT_ID;
  const clientSecret = process.env.EFI_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Configure EFI_CLIENT_ID e EFI_CLIENT_SECRET.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const body = await efiRequest("/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });

  if (!body?.access_token) {
    throw new Error("Efí nao retornou access_token.");
  }

  return body.access_token as string;
}

export function createPixTxId(seed: string) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}

export async function createEfiPixCharge(input: EfiPixChargeInput): Promise<EfiPixChargeResult> {
  const token = await getEfiAccessToken();
  const pixKey = process.env.EFI_PIX_KEY;

  if (!pixKey) {
    throw new Error("Configure EFI_PIX_KEY.");
  }

  const charge = await efiRequest(`/v2/cob/${input.txid}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      calendario: { expiracao: Number(process.env.EFI_PIX_EXPIRATION_SECONDS ?? 3600) },
      devedor: input.debtorCpf
        ? { cpf: input.debtorCpf.replace(/\D/g, ""), nome: input.debtorName.slice(0, 200) }
        : { nome: input.debtorName.slice(0, 200) },
      valor: { original: input.amountBrl.toFixed(2) },
      chave: pixKey,
      solicitacaoPagador: input.description.slice(0, 140),
      infoAdicionais: Object.entries(input.metadata ?? {}).map(([nome, valor]) => ({
        nome: nome.slice(0, 50),
        valor: String(valor).slice(0, 200),
      })),
    }),
  });

  let qr: any = null;
  const locId = charge?.loc?.id;
  if (locId) {
    qr = await efiRequest(`/v2/loc/${locId}/qrcode`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return {
    txid: input.txid,
    locId,
    status: charge?.status ?? "ATIVA",
    pixCopyPaste: qr?.qrcode ?? null,
    qrCodeImage: qr?.imagemQrcode ?? null,
    raw: { charge, qr },
  };
}

export async function getEfiPixCharge(txid: string) {
  const token = await getEfiAccessToken();
  return efiRequest(`/v2/cob/${txid}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
}
