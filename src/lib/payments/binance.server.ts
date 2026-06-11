const BINANCE_USDT_BRL_URL = "https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL";

export type UsdtBrlQuote = {
  rate: number;
  source: "binance" | "fallback";
};

export async function getUsdtBrlQuote(): Promise<UsdtBrlQuote> {
  const fallback = Number(process.env.USD_BRL_FALLBACK_RATE ?? 5.5);

  try {
    const response = await fetch(BINANCE_USDT_BRL_URL, { method: "GET" });
    if (!response.ok) throw new Error(`Binance respondeu ${response.status}`);
    const data = await response.json();
    const rate = Number(data?.price);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("Cotacao USDTBRL invalida");
    return { rate, source: "binance" };
  } catch (error) {
    console.error("[binance] usando cotacao fallback", error);
    return { rate: fallback, source: "fallback" };
  }
}

export function convertUsdToBrl(amountUsd: number, quote: UsdtBrlQuote) {
  return Math.round((amountUsd * quote.rate + Number.EPSILON) * 100) / 100;
}
