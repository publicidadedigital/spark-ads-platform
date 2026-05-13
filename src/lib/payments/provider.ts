/**
 * Payment provider abstraction.
 *
 * Esta camada está pronta para ser integrada a um gateway real
 * (Mercado Pago, Stripe, Pagar.me, Asaas, etc.) sem alterar a UI.
 *
 * Para integrar:
 *  1. Implemente `createCheckout` chamando a API do gateway (server function).
 *  2. Configure o webhook do gateway em /api/public/payments-webhook
 *     para confirmar o pagamento e liberar o ciclo no banco.
 */

export type PaymentMethod = "pix" | "card" | "boleto";

export type CheckoutInput = {
  packageId: string;
  packageNome: string;
  valor: number;
  method: PaymentMethod;
  userId: string;
  userEmail: string;
};

export type CheckoutResult = {
  /** id da intenção de pagamento gerada pelo gateway */
  paymentId: string;
  /** url para redirecionar o usuário (checkout hospedado) — opcional */
  redirectUrl?: string;
  /** payload Pix (copia e cola) — opcional */
  pixCode?: string;
  /** QR code em base64 — opcional */
  pixQrBase64?: string;
  status: "pending" | "approved" | "failed";
};

/**
 * STUB — substituir pela chamada real ao gateway.
 * Hoje apenas devolve um id fake para não bloquear o desenvolvimento.
 */
export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  // TODO: integrar gateway real aqui.
  // Exemplo:
  // const res = await fetch("/api/payments/create", {
  //   method: "POST",
  //   body: JSON.stringify(input),
  // });
  // return res.json();
  await new Promise((r) => setTimeout(r, 600));
  return {
    paymentId: `stub_${crypto.randomUUID()}`,
    status: "pending",
  };
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; desc: string }[] = [
  { value: "pix", label: "Pix", desc: "Aprovação imediata" },
  { value: "card", label: "Cartão de crédito", desc: "Em até 12x" },
  { value: "boleto", label: "Boleto", desc: "Compensação em 1-2 dias úteis" },
];
