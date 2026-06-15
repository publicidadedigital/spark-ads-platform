import { createFileRoute } from "@tanstack/react-router";
import { getUsdtBrlQuote } from "@/lib/payments/binance.server";

const AWESOME_API_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";
const OPEN_ER_API_URL = "https://open.er-api.com/v6/latest/USD";

type RateResult = { rate: number; bid: number; ask: number; source: string; updatedAt: string };

async function fetchAwesomeApi(): Promise<RateResult | null> {
  const response = await fetch(AWESOME_API_URL, { method: "GET" });
  if (!response.ok) throw new Error(`AwesomeAPI respondeu ${response.status}`);
  const data = await response.json();
  const quote = data?.USDBRL;
  const bid = Number(quote?.bid);
  const ask = Number(quote?.ask);
  if (!Number.isFinite(bid) || bid <= 0) throw new Error("Cotacao USD-BRL invalida");

  return {
    rate: bid,
    bid,
    ask: Number.isFinite(ask) ? ask : bid,
    source: "awesomeapi",
    updatedAt: quote?.create_date ?? new Date().toISOString(),
  };
}

async function fetchOpenErApi(): Promise<RateResult | null> {
  const response = await fetch(OPEN_ER_API_URL, { method: "GET" });
  if (!response.ok) throw new Error(`open.er-api respondeu ${response.status}`);
  const data = await response.json();
  const rate = Number(data?.rates?.BRL);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Cotacao USD-BRL invalida");

  return {
    rate,
    bid: rate,
    ask: rate,
    source: "open-er-api",
    updatedAt: data?.time_last_update_utc ?? new Date().toISOString(),
  };
}

async function fetchBinance(): Promise<RateResult | null> {
  const quote = await getUsdtBrlQuote();
  if (quote.source !== "binance") return null;

  return {
    rate: quote.rate,
    bid: quote.rate,
    ask: quote.rate,
    source: "binance",
    updatedAt: new Date().toISOString(),
  };
}

export const Route = createFileRoute("/api/public/exchange-rate")({
  server: {
    handlers: {
      GET: async () => {
        const fallback = Number(process.env.USD_BRL_FALLBACK_RATE ?? 5.5);
        const providers = [fetchAwesomeApi, fetchOpenErApi, fetchBinance];

        for (const provider of providers) {
          try {
            const result = await provider();
            if (result) {
              return new Response(JSON.stringify(result), {
                status: 200,
                headers: { "content-type": "application/json", "cache-control": "public, max-age=30" },
              });
            }
          } catch (error) {
            console.error(`[exchange-rate] falha no provedor ${provider.name}`, error);
          }
        }

        return new Response(
          JSON.stringify({
            rate: fallback,
            bid: fallback,
            ask: fallback,
            source: "fallback",
            updatedAt: new Date().toISOString(),
          }),
          { status: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=30" } },
        );
      },
    },
  },
});
