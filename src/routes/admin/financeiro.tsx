import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/supabase/auth";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCcw, TrendingUp, TrendingDown, Users, Receipt, PiggyBank } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/financeiro")({ component: AdminFinanceiro });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type Settings = {
  profit_percent: number;
  tax_percent: number;
  min_margin_percent: number;
  closing_day: number;
};

function AdminFinanceiro() {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entrada, setEntrada] = useState(0);
  const [saida, setSaida] = useState(0);
  const [afiliados, setAfiliados] = useState(0);
  const [custos, setCustos] = useState(0);
  const [settings, setSettings] = useState<Settings | null>(null);

  async function load() {
    if (!supabase) return;
    setLoading(true);

    const [orders, withdrawals, bonuses, expenses, accSettings] = await Promise.all([
      supabase.from("package_orders").select("valor").eq("status", "pago"),
      supabase.from("withdrawal_requests").select("amount_usd").eq("status", "pago"),
      supabase.from("bonuses").select("valor").eq("status", "liberado"),
      supabase.from("accounting_expenses").select("amount").eq("status", "pago"),
      supabase.from("accounting_settings").select("profit_percent,tax_percent,min_margin_percent,closing_day").maybeSingle(),
    ]);

    const sum = (rows: any[] | null | undefined, key: string) =>
      (rows ?? []).reduce((acc, row) => acc + Number(row[key] ?? 0), 0);

    setEntrada(sum(orders.data, "valor"));
    setSaida(sum(withdrawals.data, "amount_usd"));
    setAfiliados(sum(bonuses.data, "valor"));
    setCustos(sum(expenses.data, "amount"));
    setSettings((accSettings.data as Settings) ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  const lucroLiquido = entrada - saida - afiliados - custos;
  const margemAtual = entrada > 0 ? (lucroLiquido / entrada) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Financeiro</p>
          <h1 className="text-3xl font-bold">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Resumo de entradas, saídas, comissões e lucro líquido da plataforma.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCcw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{usd.format(entrada)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Saídas (saques pagos)</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{usd.format(saida)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Pagamentos de afiliados</CardTitle>
            <Users className="h-4 w-4 text-gold" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{usd.format(afiliados)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Custos operacionais</CardTitle>
            <Receipt className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent className="text-2xl font-bold">{usd.format(custos)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm text-muted-foreground">Lucro líquido</CardTitle>
            <PiggyBank className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className={`text-2xl font-bold ${lucroLiquido >= 0 ? "" : "text-red-400"}`}>{usd.format(lucroLiquido)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Percentuais configurados</CardTitle>
        </CardHeader>
        <CardContent>
          {settings ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="rounded-lg border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Meta de lucro</p>
                <p className="text-2xl font-bold mt-1">{pct.format(Number(settings.profit_percent))}%</p>
              </div>
              <div className="rounded-lg border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Impostos</p>
                <p className="text-2xl font-bold mt-1">{pct.format(Number(settings.tax_percent))}%</p>
              </div>
              <div className="rounded-lg border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Margem mínima</p>
                <p className="text-2xl font-bold mt-1">{pct.format(Number(settings.min_margin_percent))}%</p>
              </div>
              <div className="rounded-lg border border-border/60 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Margem atual</p>
                <p className={`text-2xl font-bold mt-1 ${margemAtual < Number(settings.min_margin_percent) ? "text-red-400" : "text-emerald-400"}`}>
                  {pct.format(margemAtual)}%
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma configuração contábil encontrada.</p>
          )}
          {settings && margemAtual < Number(settings.min_margin_percent) && (
            <div className="mt-4 rounded-lg border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-200">
              A margem atual ({pct.format(margemAtual)}%) está abaixo da margem mínima configurada ({pct.format(Number(settings.min_margin_percent))}%).
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
