export type PaymentMethod = "pix" | "cartao" | "internal_balance";

export type CheckoutInput = {
  packageId: string;
  packageNome: string;
  valor: number;
  method: PaymentMethod;
  userId: string;
  userEmail: string;
  cycleId: string;
  accessToken?: string;
};

export type CheckoutResult = {
  paymentId: string;
  redirectUrl?: string;
  pixCode?: string;
  pixQrBase64?: string;
  amountUsd?: number;
  amountBrl?: number;
  quoteRate?: number;
  quoteSource?: string;
  status: "pending" | "approved" | "failed";
};

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (input.method !== "pix") {
    return {
      paymentId: `pending_${crypto.randomUUID()}`,
      status: "pending",
    };
  }

  const response = await fetch("/api/public/cakto/create-checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(input.accessToken ? { Authorization: `Bearer ${input.accessToken}` } : {}),
    },
    body: JSON.stringify(input),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? "Erro ao criar checkout Pix Cakto");
  }

  return data;
}

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; desc: string }[] = [
  { value: "pix", label: "Pix", desc: "Checkout Pix via Cakto" },
  { value: "cartao", label: "Cartão", desc: "Cartão de crédito ou débito via Cakto" },
  { value: "internal_balance", label: "Saldo interno", desc: "Somente saldo disponivel, sem limite" },
];
