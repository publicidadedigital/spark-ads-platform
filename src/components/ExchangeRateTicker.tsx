import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";

type ExchangeRate = {
  rate: number;
  updatedAt: string;
};

const REFRESH_MS = 60_000;

export function ExchangeRateTicker() {
  const [quote, setQuote] = useState<ExchangeRate | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch("/api/public/exchange-rate", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (mounted) setQuote({ rate: Number(data.rate), updatedAt: data.updatedAt });
      } catch {
        // mantem ultimo valor conhecido em caso de falha
      }
    }

    load();
    const interval = window.setInterval(load, REFRESH_MS);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!quote) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
      <DollarSign className="h-3.5 w-3.5 text-gold" />
      <span>
        Dólar comercial: <span className="font-semibold text-foreground">R$ {quote.rate.toFixed(4)}</span>
      </span>
    </div>
  );
}
