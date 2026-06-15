import { createFileRoute } from "@tanstack/react-router";

const AWESOME_API_URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";

export const Route = createFileRoute("/api/public/exchange-rate")({
  server: {
    handlers: {
      GET: async () => {
        const fallback = Number(process.env.USD_BRL_FALLBACK_RATE ?? 5.5);

        try {
          const response = await fetch(AWESOME_API_URL, { method: "GET" });
          if (!response.ok) throw new Error(`AwesomeAPI respondeu ${response.status}`);
          const data = await response.json();
          const quote = data?.USDBRL;
          const bid = Number(quote?.bid);
          const ask = Number(quote?.ask);
          if (!Number.isFinite(bid) || bid <= 0) throw new Error("Cotacao USD-BRL invalida");

          return new Response(
            JSON.stringify({
              rate: bid,
              bid,
              ask: Number.isFinite(ask) ? ask : bid,
              source: "awesomeapi",
              updatedAt: quote?.create_date ?? new Date().toISOString(),
            }),
            { status: 200, headers: { "content-type": "application/json", "cache-control": "public, max-age=30" } },
          );
        } catch (error) {
          console.error("[exchange-rate] usando cotacao fallback", error);
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
        }
      },
    },
  },
});
