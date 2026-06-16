import { DollarSign } from "lucide-react";

const FIXED_RATE = 5.07;

export function ExchangeRateTicker() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground">
      <DollarSign className="h-3.5 w-3.5 text-gold" />
      <span>
        Dólar: <span className="font-semibold text-foreground">R$ {FIXED_RATE.toFixed(2)}</span>
      </span>
    </div>
  );
}
