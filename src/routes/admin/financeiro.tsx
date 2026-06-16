import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/supabase/auth";
import { createFileRoute } from "@tanstack/react-router";
import {
  RefreshCcw, TrendingUp, TrendingDown, Clock, XCircle, CheckCircle2,
  Users, Megaphone, PiggyBank, Receipt, Landmark, AlertTriangle,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/financeiro")({ component: AdminFinanceiro });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

type Period = "diario" | "mensal" | "anual";

function periodStart(period: Period) {
  const now = new Date();
  if (period === "diario") return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (period === "mensal") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  return new Date(now.getFullYear(), 0, 1).toISOString();
}

const periodLabels: Record<Period, string> = { diario: "Diário", mensal: "Mensal", anual: "Anual" };

type Data = {
  entradasConcluidas: number;
  entradasPendentes: number;
  entradasCanceladas: number;
  saquesConcluidos: number;
  saquesPendentes: number;
  redeConcluido: number;
  redePendente: number;
  comissaoConcluida: number;
  comissaoPendente: number;
};

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  sub,
}: {
  icon: any;
  label: string;
  value: string;
  tone?: "green" | "red" | "amber" | "blue" | "violet" | "neutral";
  sub?: string;
}) {
  const colors = {
    green: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
    blue: "text-sky-400",
    violet: "text-violet-400",
    neutral: "text-primary",
  };
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${colors[tone]}`} />
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${colors[tone]}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-3 mt-2">
      <h2 className="text-base font-semibold">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AdminFinanceiro() {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("mensal");
  const [data, setData] = useState<Data>({
    entradasConcluidas: 0,
    entradasPendentes: 0,
    entradasCanceladas: 0,
    saquesConcluidos: 0,
    saquesPendentes: 0,
    redeConcluido: 0,
    redePendente: 0,
    comissaoConcluida: 0,
    comissaoPendente: 0,
  });

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const since = periodStart(period);

    const sum = (rows: any[] | null | undefined, key: string) =>
      (rows ?? []).reduce((acc: number, row: any) => acc + Number(row[key] ?? 0), 0);

    const [
      entConcluidas,
      entPendentes,
      entCanceladas,
      saqConcluidos,
      saqPendentes,
      redeConcluido,
      redePendente,
      comConcluida,
      comPendente,
    ] = await Promise.all([
      supabase.from("payment_orders").select("amount_usd").eq("status", "approved").gte("created_at", since),
      supabase.from("payment_orders").select("amount_usd").eq("status", "pending").gte("created_at", since),
      supabase.from("payment_orders").select("amount_usd").eq("status", "failed").gte("created_at", since),
      supabase.from("withdrawal_requests").select("amount_usd").eq("status", "pago").gte("created_at", since),
      supabase.from("withdrawal_requests").select("amount_usd").in("status", ["solicitado", "em_analise", "aprovado"]).gte("created_at", since),
      supabase.from("bonuses").select("valor").eq("status", "liberado").gte("created_at", since),
      supabase.from("bonuses").select("valor").eq("status", "pendente").gte("created_at", since),
      supabase.from("advertiser_bonus_events").select("referrer_bonus").eq("status", "liberado").gte("created_at", since),
      supabase.from("advertiser_bonus_events").select("referrer_bonus").eq("status", "pendente").gte("created_at", since),
    ]);

    setData({
      entradasConcluidas: sum(entConcluidas.data, "amount_usd"),
      entradasPendentes: sum(entPendentes.data, "amount_usd"),
      entradasCanceladas: sum(entCanceladas.data, "amount_usd"),
      saquesConcluidos: sum(saqConcluidos.data, "amount_usd"),
      saquesPendentes: sum(saqPendentes.data, "amount_usd"),
      redeConcluido: sum(redeConcluido.data, "valor"),
      redePendente: sum(redePendente.data, "valor"),
      comissaoConcluida: sum(comConcluida.data, "referrer_bonus"),
      comissaoPendente: sum(comPendente.data, "referrer_bonus"),
    });
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase, period]);

  const lucroLiquido = data.entradasConcluidas * 0.30;
  const imposto = data.entradasConcluidas * 0.15;
  const custo = data.entradasConcluidas * 0.10;

  const periodDesc = period === "diario" ? "hoje" : period === "mensal" ? "mês atual" : "ano atual";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Financeiro</p>
          <h1 className="text-3xl font-bold">Visão geral</h1>
          <p className="text-sm text-muted-foreground">Resumo de entradas, saídas, comissões e lucro da plataforma.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border/60 p-1">
            {(["diario", "mensal", "anual"] as Period[]).map((p) => (
              <Button key={p} size="sm" variant={period === p ? "default" : "ghost"} onClick={() => setPeriod(p)} className="px-3">
                {periodLabels[p]}
              </Button>
            ))}
          </div>
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCcw className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando dados ({periodDesc})…</p>}

      {/* Entradas */}
      <div>
        <SectionTitle title="Entradas (pacotes de clientes)" sub={`Pagamentos de pacotes — ${periodDesc}`} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard icon={CheckCircle2} label="Entradas concluídas" value={usd.format(data.entradasConcluidas)} tone="green" sub="Pagamentos aprovados" />
          <MetricCard icon={Clock} label="Entradas pendentes" value={usd.format(data.entradasPendentes)} tone="amber" sub="Aguardando confirmação" />
          <MetricCard icon={XCircle} label="Entradas canceladas" value={usd.format(data.entradasCanceladas)} tone="red" sub="Falhou ou expirou" />
        </div>
      </div>

      {/* Saques */}
      <div>
        <SectionTitle title="Saques de clientes" sub={`Retiradas solicitadas — ${periodDesc}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard icon={TrendingDown} label="Saques concluídos" value={usd.format(data.saquesConcluidos)} tone="red" sub="Pagamentos realizados" />
          <MetricCard icon={Clock} label="Saques pendentes" value={usd.format(data.saquesPendentes)} tone="amber" sub="Solicitado / em análise / aprovado" />
        </div>
      </div>

      {/* Pagamentos de rede */}
      <div>
        <SectionTitle title="Pagamento de rede (bônus de afiliados)" sub={`Comissões por indicação e equipe — ${periodDesc}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard icon={Users} label="Pagamento de rede concluído" value={usd.format(data.redeConcluido)} tone="violet" sub="Bônus liberados" />
          <MetricCard icon={Clock} label="Pagamento de rede pendente" value={usd.format(data.redePendente)} tone="amber" sub="Bônus aguardando liberação" />
        </div>
      </div>

      {/* Comissão indicação anunciantes */}
      <div>
        <SectionTitle title="Comissão de indicação de anunciante (50%)" sub={`Comissões por anunciantes indicados — ${periodDesc}`} />
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard icon={Megaphone} label="Comissão concluída" value={usd.format(data.comissaoConcluida)} tone="blue" sub="Liberada após 7 dias" />
          <MetricCard icon={Clock} label="Comissão pendente" value={usd.format(data.comissaoPendente)} tone="amber" sub="Em quarentena (7 dias)" />
        </div>
      </div>

      {/* Resumo financeiro */}
      <div>
        <SectionTitle title="Resumo financeiro" sub="Calculado sobre entradas concluídas" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard icon={PiggyBank} label="Lucro líquido (30%)" value={usd.format(lucroLiquido)} tone="green" sub={`30% de ${usd.format(data.entradasConcluidas)}`} />
          <MetricCard icon={Landmark} label="Imposto estimado (15%)" value={usd.format(imposto)} tone="red" sub={`15% de ${usd.format(data.entradasConcluidas)}`} />
          <MetricCard icon={Receipt} label="Custo operacional (10%)" value={usd.format(custo)} tone="amber" sub={`10% de ${usd.format(data.entradasConcluidas)}`} />
        </div>
      </div>

      {/* Alerta margem */}
      {data.entradasConcluidas > 0 && lucroLiquido < 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Atenção: o lucro líquido está negativo. Revise os custos e saídas do período.</span>
        </div>
      )}

      {/* Totais rápidos */}
      <Card>
        <CardHeader><CardTitle className="text-base">Consolidado do período ({periodDesc})</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Row label="Total entradas concluídas" value={usd.format(data.entradasConcluidas)} positive />
            <Row label="Total saídas (saques pagos)" value={usd.format(data.saquesConcluidos)} />
            <Row label="Rede paga" value={usd.format(data.redeConcluido)} />
            <Row label="Comissão anunciante paga" value={usd.format(data.comissaoConcluida)} />
            <Row label="Imposto (15%)" value={usd.format(imposto)} />
            <Row label="Custo operacional (10%)" value={usd.format(custo)} />
            <Row label="Lucro líquido (30%)" value={usd.format(lucroLiquido)} positive={lucroLiquido >= 0} />
            <Row
              label="Obrigações pendentes"
              value={usd.format(data.saquesPendentes + data.redePendente + data.comissaoPendente)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : ""}`}>{value}</span>
    </div>
  );
}
