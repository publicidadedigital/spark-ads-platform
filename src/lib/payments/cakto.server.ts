import { createHash, createHmac, timingSafeEqual } from "crypto";

export type CaktoCheckoutInput = {
  externalId: string;
  amountUsd: number;
  amountBrl?: number | null;
  currency: "USD" | "BRL";
  customer: {
    id: string;
    name: string;
    email?: string | null;
    document?: string | null;
  };
  package: {
    id: string;
    name: string;
    packageValueUsd: number;
    courseFeeUsd: number;
    totalPaidUsd: number;
    bonusableAmountUsd: number;
  };
  metadata?: Record<string, unknown>;
};

export type CaktoCheckoutResult = {
  externalId: string;
  providerPaymentId?: string | null;
  checkoutUrl?: string | null;
  pixCopyPaste?: string | null;
  pixQrBase64?: string | null;
  status: "pending" | "approved" | "failed";
  raw: unknown;
};

export type CaktoWebhookEvent = {
  externalId: string | null;
  providerPaymentId: string | null;
  status: "approved" | "failed" | "pending" | "expired" | "cancelled";
  amount?: number | null;
  customerEmail: string | null;
  customerDocument: string | null;
  productName: string | null;
  productId: string | null;
  raw: unknown;
};

export function createCaktoOrderId(seed: string) {
  return `vh_${createHash("sha256").update(seed).digest("hex").slice(0, 28)}`;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Configure ${name}.`);
  return value;
}

function appendParams(baseUrl: string, params: Record<string, string | number | null | undefined>) {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = value.replace(/[^0-9.,-]/g, "").replace(",", ".");
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeStatus(value: unknown): CaktoWebhookEvent["status"] {
  const status = String(value ?? "").toLowerCase();
  if (["paid", "pago", "approved", "aprovado", "completed", "complete", "confirmed", "confirmado", "authorized"].includes(status)) {
    return "approved";
  }
  if (["failed", "recused", "refused", "rejected", "cancelled", "canceled", "cancelado", "chargeback", "refunded"].includes(status)) {
    return status === "cancelled" || status === "canceled" || status === "cancelado" ? "cancelled" : "failed";
  }
  if (["expired", "expirado"].includes(status)) return "expired";
  return "pending";
}

export async function createCaktoCheckout(input: CaktoCheckoutInput): Promise<CaktoCheckoutResult> {
  const endpoint = process.env.CAKTO_CREATE_CHECKOUT_ENDPOINT;
  const apiToken = process.env.CAKTO_API_TOKEN;

  const payload = {
    external_id: input.externalId,
    amount: input.amountUsd,
    amount_usd: input.amountUsd,
    amount_brl: input.amountBrl ?? null,
    currency: input.currency,
    payment_method: "pix",
    customer: input.customer,
    product: {
      id: input.package.id,
      name: input.package.name,
      value_usd: input.package.packageValueUsd,
      course_fee_usd: input.package.courseFeeUsd,
      total_paid_usd: input.package.totalPaidUsd,
    },
    metadata: {
      ...(input.metadata ?? {}),
      external_id: input.externalId,
      package_value_usd: input.package.packageValueUsd,
      course_fee_usd: input.package.courseFeeUsd,
      bonusable_amount_usd: input.package.bonusableAmountUsd,
    },
    success_url: process.env.CAKTO_SUCCESS_URL ?? `${process.env.APP_URL ?? process.env.APP_PUBLIC_URL ?? ""}/app`,
    cancel_url: process.env.CAKTO_CANCEL_URL ?? `${process.env.APP_URL ?? process.env.APP_PUBLIC_URL ?? ""}/app/checkout`,
    webhook_url: process.env.CAKTO_WEBHOOK_URL ?? `${process.env.APP_URL ?? process.env.APP_PUBLIC_URL ?? ""}/api/public/cakto/webhook`,
  };

  if (endpoint && apiToken) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(`Cakto respondeu ${response.status}: ${text}`);

    return {
      externalId: input.externalId,
      providerPaymentId: pickString(data.id, data.payment_id, data.order_id, data.data?.id, data.data?.payment_id),
      checkoutUrl: pickString(data.checkout_url, data.checkoutUrl, data.url, data.payment_url, data.data?.checkout_url, data.data?.url),
      pixCopyPaste: pickString(data.pix_code, data.pixCode, data.copy_paste, data.pix?.copy_paste, data.data?.pix_code),
      pixQrBase64: pickString(data.pix_qr_base64, data.qr_code_base64, data.pix?.qr_code_base64, data.data?.pix_qr_base64),
      status: normalizeStatus(data.status) === "approved" ? "approved" : "pending",
      raw: data,
    };
  }

  const checkoutBaseUrl = getRequiredEnv("CAKTO_CHECKOUT_URL");
  const checkoutUrl = appendParams(checkoutBaseUrl, {
    external_id: input.externalId,
    amount_usd: input.amountUsd.toFixed(2),
    amount_brl: input.amountBrl?.toFixed(2),
    currency: input.currency,
    payment_method: "pix",
    customer_id: input.customer.id,
    customer_name: input.customer.name,
    customer_email: input.customer.email ?? undefined,
    package_id: input.package.id,
    package_name: input.package.name,
    success_url: payload.success_url,
    cancel_url: payload.cancel_url,
  });

  return {
    externalId: input.externalId,
    providerPaymentId: input.externalId,
    checkoutUrl,
    status: "pending",
    raw: { mode: "redirect", checkoutUrl, payload },
  };
}

export function verifyCaktoWebhook(rawBody: string, headers: Headers) {
  const token = process.env.CAKTO_WEBHOOK_TOKEN;
  if (token) {
    const receivedToken = headers.get("x-cakto-token") ?? headers.get("x-webhook-token") ?? headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (receivedToken !== token) return false;
  }

  const secret = process.env.CAKTO_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = headers.get("x-cakto-signature") ?? headers.get("x-webhook-signature") ?? headers.get("x-signature");
  if (signature) {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const normalized = signature.replace(/^sha256=/i, "");
    const a = Buffer.from(normalized);
    const b = Buffer.from(expected);
    if (a.length === b.length) {
      try {
        if (timingSafeEqual(a, b)) return true;
      } catch {
        // fall through to body secret check
      }
    }
  }

  // Cakto sends the configured webhook secret inside the JSON body (`secret` field)
  // instead of a request header, so fall back to comparing it directly.
  try {
    const body = JSON.parse(rawBody);
    const receivedSecret = body?.secret ?? body?.data?.secret;
    if (typeof receivedSecret !== "string") return false;
    const a = Buffer.from(receivedSecret);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseCaktoWebhook(body: any): CaktoWebhookEvent {
  const data = body?.data ?? body?.event ?? body?.order ?? body?.payment ?? body;
  const metadata = data?.metadata ?? body?.metadata ?? body?.data?.metadata ?? {};
  const customer = data?.customer ?? body?.customer ?? {};
  const product = data?.product ?? data?.offer ?? body?.product ?? {};

  return {
    externalId: pickString(
      metadata.external_id,
      metadata.externalId,
      data?.external_id,
      data?.externalId,
      data?.reference,
      data?.reference_id,
      data?.order_ref,
      body?.external_id,
      body?.reference,
    ),
    providerPaymentId: pickString(data?.id, data?.payment_id, data?.transaction_id, data?.order_id, body?.id, body?.payment_id),
    status: normalizeStatus(data?.status ?? body?.status ?? body?.event_type ?? body?.type),
    amount: pickNumber(data?.amount, data?.amount_usd, data?.value, data?.total, body?.amount),
    customerEmail: pickString(customer?.email, data?.customer_email, data?.email, body?.customer_email),
    customerDocument: pickString(customer?.docNumber, customer?.document, customer?.cpf, data?.customer_document, data?.document, data?.cpf),
    productName: pickString(product?.name, product?.title, data?.product_name, body?.product_name),
    productId: pickString(product?.id, product?.short_id, product?.product_id, data?.product_id, body?.product_id),
    raw: body,
  };
}
