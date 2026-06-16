import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  Clock,
  Crown,
  DollarSign,
  Download,
  Filter,
  Search,
  Share2,
  ShieldCheck,
  XCircle,
  TrendingUp,
  Trophy,
  Upload,
  User,
  Users,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/app/extrato")({ component: ExtratoPage });

type Transaction = {
  id: string;
  tipo: "credito" | "debito" | "bloqueio" | "renovacao" | string;
  descricao: string;
  valor: number | string;
  saldo_antes: number | string;
  saldo_depois: number | string;
  created_at: string;
};

type Bonus = {
  id: string;
  tipo: string;
  valor: number | string;
  status: string;
  nivel: number | null;
  created_at: string;
  release_at?: string | null;
  origem_id?: string | null;
};

type NetworkBonus = Bonus & {
  indicadoNome: string | null;
  cycleStatus: string | null;
};

type Category = {
  key: string;
  label: string;
  total: number;
  color: string;
  icon: any;
};

const categoryMeta: Record<string, Omit<Category, "key" | "total">> = {
  residual: { label: "Residual", color: "#00d17d", icon: DollarSign },
  indicacao_direta: { label: "Indicacao direta", color: "#1677ff", icon: User },
  indicacao_indireta: { label: "Indicacao indireta", color: "#8b5cf6", icon: Users },
  royalties: { label: "Royalties", color: "#f5b51b", icon: Crown },
  compartilhamento: { label: "Compartilhamento", color: "#06b6d4", icon: Share2 },
};

const tabs = [
  { key: "todas", label: "Todas" },
  { key: "residual", label: "Residual" },
  { key: "indicacao_direta", label: "Indicacao direta" },
  { key: "indicacao_indireta", label: "Indicacao indireta" },
  { key: "royalties", label: "Royalties" },
  { key: "compartilhamento", label: "Compartilhamento" },
  { key: "saque", label: "Saque" },
  { key: "ajustes", label: "Ajustes" },
  { key: "estornos", label: "Estornos" },
];

function ExtratoPage() {
  const { supabase, user } = useAuth();
  const [tx, setTx] = useState<Transaction[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [networkBonuses, setNetworkBonuses] = useState<NetworkBonus[]>([]);
  const [saldoDisponivel, setSaldoDisponivel] = useState(0);
  const [saldoAguardando, setSaldoAguardando] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("users_profile")
        .select("id,cpf")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!prof) {
        setLoading(false);
        return;
      }

      const [{ data: walletRows }, { data: bonusRows }, { data: wallet }] = await Promise.all([
        supabase
          .from("wallet_transactions")
          .select("*")
          .eq("user_id", prof.id)
          .order("created_at", { ascending: false })
          .limit(160),
        supabase
          .from("bonuses")
          .select("id,tipo,valor,status,nivel,created_at,origem_id,balance_holds(release_at)")
          .eq("user_id", prof.id)
          .order("created_at", { ascending: false })
          .limit(160),
        supabase
          .from("wallet_balances")
          .select("saldo_disponivel,saldo_a_liberar")
          .eq("user_id", prof.id)
          .maybeSingle(),
      ]);

      setTx((walletRows ?? []) as Transaction[]);
      setSaldoDisponivel(Number(wallet?.saldo_disponivel ?? 0));
      setSaldoAguardando(Number(wallet?.saldo_a_liberar ?? 0));

      const bonusesWithRelease = (bonusRows ?? []).map((b: any) => ({
        ...b,
        release_at: b.balance_holds?.[0]?.release_at ?? null,
      }));
      setBonuses(bonusesWithRelease as Bonus[]);

      // Fetch network bonus origin user names
      const networkRows = bonusesWithRelease.filter((b: any) => ["adesao", "renovacao", "residual"].includes(b.tipo) && b.origem_id);
      const origemIds = [...new Set(networkRows.map((b: any) => b.origem_id as string))];
      if (origemIds.length > 0) {
        const { data: cycles } = await supabase
          .from("user_cycles")
          .select("id,user_id,status")
          .in("id", origemIds);
        const cycleMap = new Map((cycles ?? []).map((c: any) => [c.id, c]));
        const userIds = [...new Set((cycles ?? []).map((c: any) => c.user_id as string))];
        const { data: profiles } = userIds.length
          ? await supabase.from("users_profile").select("id,nome").in("id", userIds)
          : { data: [] };
        const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.nome]));
        setNetworkBonuses(networkRows.map((b: any) => {
          const cycle = cycleMap.get(b.origem_id);
          return { ...b, indicadoNome: cycle ? (profileMap.get(cycle.user_id) ?? null) : null, cycleStatus: cycle?.status ?? null };
        }));
      } else {
        setNetworkBonuses(networkRows.map((b: any) => ({ ...b, indicadoNome: null, cycleStatus: null })));
      }
      setLoading(false);
    })();
  }, [supabase, user]);

  const stats = useMemo(() => buildStats(tx, bonuses, saldoDisponivel), [tx, bonuses, saldoDisponivel]);
  const chartData = useMemo(() => buildChart(tx), [tx]);
  const period = useMemo(() => formatPeriod(tx), [tx]);

  const exportCsv = () => {
    const networkMap = new Map(networkBonuses.map((nb) => [nb.id, nb]));
    const rows = [
      ["Data", "Tipo", "Nivel", "Indicado", "Valor", "Status"],
      ...bonuses.map((b) => {
        const nb = networkMap.get(b.id);
        return [
          formatDateTime(b.created_at),
          TIPO_LABEL[b.tipo] ?? b.tipo,
          b.nivel != null ? `Nv ${b.nivel}` : "",
          nb?.indicadoNome ?? "",
          moneyValue(b.valor).toFixed(2),
          b.status,
        ];
      }),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "extrato-viral-hub.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-muted-foreground">Carregando extrato...</p>;

  return (
    <div className="space-y-4">
      <Card className="border-primary/15 bg-card/50 p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-normal">Extrato</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhe todo o historico de movimentacoes da sua conta.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Upload className="mr-2 h-4 w-4" /> Exportar
            </Button>
            <Button variant="outline">
              <CalendarDays className="mr-2 h-4 w-4" /> {period}
            </Button>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" /> Filtros
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {stats.categories.map((category) => (
            <SummaryCard key={category.key} category={category} />
          ))}
          <SummaryCard
            category={{ key: "saldo", label: "Saldo liberado", total: stats.balance, color: "#00d17d", icon: Wallet }}
            sub="Disponivel para saque"
          />
          <SummaryCard
            category={{ key: "aguardando", label: "Aguardando (7d)", total: saldoAguardando, color: "#f5b51b", icon: Clock }}
            sub="Em periodo de retencao"
          />
          <SummaryCard
            category={{ key: "cancelado", label: "Cancelados", total: bonuses.filter((b) => b.status === "cancelado").reduce((s, b) => s + moneyValue(b.valor), 0), color: "#ff453a", icon: XCircle }}
            sub="Bonus cancelados"
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <Card className="border-primary/15 bg-card/50 p-5">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">Resumo de movimentacoes</h2>
                <p className="text-xs text-muted-foreground">Entradas, saidas e liquido do periodo</p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <LegendDot color="#00d17d" label="Entradas" />
                <LegendDot color="#ff453a" label="Saidas" />
                <LegendDot color="#1677ff" label="Liquido" />
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="entries" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#00d17d" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#00d17d" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="net" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#1677ff" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#1677ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} opacity={0.45} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `$ ${Number(value) / 1000}k`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(value: any) => formatMoney(Number(value))}
                  />
                  <Area type="monotone" dataKey="entradas" stroke="#00d17d" strokeWidth={2.5} fill="url(#entries)" dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="liquido" stroke="#1677ff" strokeWidth={2.5} fill="url(#net)" dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="saidas" stroke="#ff453a" strokeWidth={2.5} fill="transparent" dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-5 grid gap-3 border-t border-border/50 pt-4 sm:grid-cols-2 xl:grid-cols-4">
              <MiniTotal color="#00d17d" label="Entradas" value={stats.entries} />
              <MiniTotal color="#ff453a" label="Saidas" value={stats.exits} />
              <MiniTotal color="#1677ff" label="Liquido" value={stats.net} />
              <MiniTotal color="#8b5cf6" label="Transacoes" value={tx.length} plain />
            </div>
          </Card>

          <Card className="border-primary/15 bg-card/50 p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">Historico de movimentacoes</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Bonus, saques e ajustes — pendentes e liberados</p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar..."
                    className="w-full pl-9 md:w-56"
                  />
                </div>
                <Button variant="outline" onClick={exportCsv}>
                  <Download className="mr-2 h-4 w-4" /> Baixar
                </Button>
              </div>
            </div>

            <UnifiedHistory
              bonuses={bonuses}
              networkBonuses={networkBonuses}
              withdrawals={tx.filter((t) => /saque|pix|withdraw/i.test(`${t.tipo} ${t.descricao}`))}
              search={search}
            />
          </Card>
        </div>

        <aside className="space-y-4">
          <DistributionCard categories={stats.categories} total={stats.categoryTotal} />
          <BestDayCard tx={tx} />
          <InsightsCard stats={stats} tx={tx} />
          <NextReleaseCard pending={stats.pending} bonuses={bonuses} />
        </aside>
      </div>
    </div>
  );
}

function buildStats(tx: Transaction[], bonuses: Bonus[], saldoDisponivel: number) {
  const entries = tx.filter((item) => item.tipo === "credito").reduce((sum, item) => sum + moneyValue(item.valor), 0);
  const exits = tx.filter((item) => item.tipo !== "credito").reduce((sum, item) => sum + moneyValue(item.valor), 0);
  const balance = saldoDisponivel;
  const categoryTotals = {
    residual: 0,
    indicacao_direta: 0,
    indicacao_indireta: 0,
    royalties: 0,
    compartilhamento: 0,
  };

  bonuses.forEach((bonus) => {
    if (bonus.status === "cancelado") return;
    const value = moneyValue(bonus.valor);
    if (bonus.tipo === "diario" || bonus.tipo === "residual") categoryTotals.residual += value;
    else if (bonus.tipo === "adesao" && Number(bonus.nivel ?? 1) <= 1) categoryTotals.indicacao_direta += value;
    else if (bonus.tipo === "adesao" || bonus.tipo === "renovacao") categoryTotals.indicacao_indireta += value;
    else if (bonus.tipo === "mensalidade") categoryTotals.royalties += value;
  });

  tx.forEach((item) => {
    if (item.tipo === "credito" && /compartilh/i.test(item.descricao)) {
      categoryTotals.compartilhamento += moneyValue(item.valor);
    }
  });

  const categories = Object.entries(categoryTotals).map(([key, total]) => ({
    key,
    total,
    ...categoryMeta[key],
  }));

  return {
    entries,
    exits,
    net: entries - exits,
    balance,
    categories,
    categoryTotal: categories.reduce((sum, item) => sum + item.total, 0),
    pending: bonuses.filter((bonus) => bonus.status === "pendente").reduce((sum, bonus) => sum + moneyValue(bonus.valor), 0),
  };
}

function buildChart(tx: Transaction[]) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });

  return days.map((date) => {
    const key = date.toISOString().slice(0, 10);
    const dayTx = tx.filter((item) => item.created_at.slice(0, 10) === key);
    const entradas = dayTx.filter((item) => item.tipo === "credito").reduce((sum, item) => sum + moneyValue(item.valor), 0);
    const saidas = dayTx.filter((item) => item.tipo !== "credito").reduce((sum, item) => sum + moneyValue(item.valor), 0);
    return {
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      entradas,
      saidas,
      liquido: entradas - saidas,
    };
  });
}

function filterTransactions(tx: Transaction[], activeTab: string, search: string) {
  const term = search.trim().toLowerCase();
  return tx.filter((item) => {
    const category = transactionCategory(item);
    const matchesTab = activeTab === "todas" || category === activeTab;
    const matchesSearch = !term || item.descricao.toLowerCase().includes(term) || item.tipo.toLowerCase().includes(term);
    return matchesTab && matchesSearch;
  });
}

function transactionCategory(item: Transaction) {
  const text = `${item.tipo} ${item.descricao}`.toLowerCase();
  if (/saque|pix|withdraw/.test(text)) return "saque";
  if (/ajuste/.test(text)) return "ajustes";
  if (/estorno|reembolso/.test(text)) return "estornos";
  if (/royalt|mensalidade/.test(text)) return "royalties";
  if (/compartilh/.test(text)) return "compartilhamento";
  if (/indica.*indiret|equipe|nivel [2-9]/.test(text)) return "indicacao_indireta";
  if (/indica/.test(text)) return "indicacao_direta";
  return "residual";
}

function SummaryCard({ category, sub = "Total acumulado" }: { category: Category; sub?: string }) {
  const Icon = category.icon;
  return (
    <Card className="border-primary/15 bg-background/45 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg p-2" style={{ background: `${category.color}18`, color: category.color }}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{category.label}</p>
          <p className="text-lg font-bold" style={{ color: category.color }}>{formatMoney(category.total)}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </Card>
  );
}

function DistributionCard({ categories, total }: { categories: Category[]; total: number }) {
  const gradient = buildConicGradient(categories, total);
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">Distribuicao dos ganhos</h3>
      <div className="mt-5 grid gap-5 sm:grid-cols-[140px_1fr] xl:grid-cols-1">
        <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full" style={{ background: gradient }}>
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card text-center">
            <span className="text-lg font-bold">{formatMoney(total)}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
        </div>
        <div className="space-y-3">
          {categories.map((item) => (
            <div key={item.key} className="flex items-start justify-between gap-3 text-sm">
              <div className="flex gap-2">
                <span className="mt-1 h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                <div>
                  <p>{item.label}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(item.total)}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{total ? Math.round((item.total / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

const TIPO_LABEL: Record<string, string> = {
  diario: "Bonus diario",
  adesao: "Bonus de adesao",
  renovacao: "Bonus de renovacao",
  residual: "Bonus residual",
  mensalidade: "Royalties",
  ajuste: "Ajuste",
  publicidade: "Publicidade",
};

function UnifiedHistory({
  bonuses,
  networkBonuses,
  withdrawals,
  search,
}: {
  bonuses: Bonus[];
  networkBonuses: NetworkBonus[];
  withdrawals: Transaction[];
  search: string;
}) {
  const networkMap = new Map(networkBonuses.map((nb) => [nb.id, nb]));

  type Row = {
    id: string;
    date: string;
    descricao: string;
    nivel: number | null;
    indicado: string | null;
    valor: number;
    isCredit: boolean;
    status: string;
    release_at: string | null;
    cycleStatus: string | null;
  };

  const rows: Row[] = [
    ...bonuses.map((b) => {
      const nb = networkMap.get(b.id);
      return {
        id: b.id,
        date: b.created_at,
        descricao: TIPO_LABEL[b.tipo] ?? b.tipo,
        nivel: b.nivel,
        indicado: nb?.indicadoNome ?? null,
        valor: moneyValue(b.valor),
        isCredit: true,
        status: b.status,
        release_at: b.release_at ?? null,
        cycleStatus: nb?.cycleStatus ?? null,
      };
    }),
    ...withdrawals.map((t) => ({
      id: t.id,
      date: t.created_at,
      descricao: t.descricao,
      nivel: null,
      indicado: null,
      valor: moneyValue(t.valor),
      isCredit: false,
      status: "concluido",
      release_at: null,
      cycleStatus: null,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter((r) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return r.descricao.toLowerCase().includes(term) || (r.indicado ?? "").toLowerCase().includes(term);
    });

  if (rows.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">Sem movimentacoes encontradas.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border/50">
          <tr>
            <th className="px-3 py-3 text-left font-medium">Data</th>
            <th className="px-3 py-3 text-left font-medium">Tipo</th>
            <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Nível</th>
            <th className="px-3 py-3 text-left font-medium">Indicado</th>
            <th className="px-3 py-3 text-left font-medium">Valor</th>
            <th className="px-3 py-3 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row) => {
            const days = row.release_at
              ? Math.max(0, Math.ceil((new Date(row.release_at).getTime() - Date.now()) / 86400000))
              : null;
            const isVencido = row.status === "liberado" && row.cycleStatus === "completado";
            return (
              <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/5 transition-colors">
                <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDateTime(row.date)}</td>
                <td className="px-3 py-2.5 font-medium">{row.descricao}</td>
                <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                  {row.nivel != null ? `Nv ${row.nivel}` : "—"}
                </td>
                <td className="px-3 py-2.5">{row.indicado ?? <span className="text-muted-foreground">—</span>}</td>
                <td className={`px-3 py-2.5 font-semibold ${row.isCredit ? "text-success" : "text-destructive"}`}>
                  {row.isCredit ? "+" : "-"} {formatMoney(row.valor)}
                </td>
                <td className="px-3 py-2.5">
                  {row.status === "cancelado" ? (
                    <Badge className="border-destructive/30 bg-destructive/15 text-destructive">Cancelado</Badge>
                  ) : isVencido ? (
                    <Badge className="border-border/50 bg-muted/20 text-muted-foreground">Vencido</Badge>
                  ) : row.status === "pendente" ? (
                    <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300">
                      <Clock className="h-3 w-3 mr-1" />{days != null && days > 0 ? `${days}d` : "Liberando"}
                    </Badge>
                  ) : (
                    <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      {row.status === "concluido" ? "Concluido" : "Liberado"}
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BestDayCard({ tx }: { tx: Transaction[] }) {
  const best = useMemo(() => {
    const byDay = new Map<string, number>();
    tx.filter((item) => item.tipo === "credito").forEach((item) => {
      const key = item.created_at.slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + moneyValue(item.valor));
    });
    const [date, total] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? [new Date().toISOString().slice(0, 10), 0];
    return { date: new Date(`${date}T12:00:00`), total };
  }, [tx]);

  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">Melhor dia da semana</h3>
      <div className="mt-5 flex items-center gap-4">
        <div className="rounded-lg bg-primary/15 p-4 text-primary shadow-gold">
          <CalendarDays className="h-8 w-8" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{best.date.toLocaleDateString("pt-BR", { weekday: "long" })}</p>
          <p className="text-2xl font-bold">{formatMoney(best.total)}</p>
          <p className="text-xs text-muted-foreground">Maior volume de ganhos</p>
        </div>
      </div>
    </Card>
  );
}

function InsightsCard({ stats, tx }: { stats: ReturnType<typeof buildStats>; tx: Transaction[] }) {
  const average = stats.entries && tx.length ? stats.entries / tx.filter((item) => item.tipo === "credito").length : 0;
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">Insights do periodo</h3>
      <div className="mt-4 space-y-4 text-sm">
        <Insight icon={TrendingUp} text={`Voce teve ${stats.net >= 0 ? "saldo positivo" : "mais saidas"} no periodo`} value={stats.net >= 0 ? "+ positivo" : "- atencao"} />
        <Insight icon={DollarSign} text={`Seu ticket medio de ganhos foi de ${formatMoney(average || 0)}`} />
        <Insight icon={Users} text={`${tx.length} movimentacoes registradas no extrato`} />
      </div>
    </Card>
  );
}

function NextReleaseCard({ pending, bonuses }: { pending: number; bonuses: Bonus[] }) {
  const value = pending || 0;
  const nextBonus = bonuses
    .filter((b) => b.status === "pendente" && b.release_at)
    .sort((a, b) => new Date(a.release_at!).getTime() - new Date(b.release_at!).getTime())[0];
  const nextDate = nextBonus?.release_at ? new Date(nextBonus.release_at) : null;
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">Proxima liberacao</h3>
      <div className="mt-5 flex items-center gap-4">
        <div className="rounded-lg bg-amber-500/15 p-3 text-amber-300">
          <Trophy className="h-8 w-8" />
        </div>
        <div>
          <p className="text-2xl font-bold">{formatMoney(value)}</p>
          <p className="text-xs text-muted-foreground">Valor aguardando retencao de 7 dias</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {nextDate
          ? `Proxima liberacao: ${nextDate.toLocaleDateString("pt-BR")} (${Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / 86400000))}d)`
          : value > 0 ? "Aguardando processamento" : "Nenhum valor pendente"}
      </p>
    </Card>
  );
}

function Insight({ icon: Icon, text, value }: { icon: any; text: string; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary/15 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-muted-foreground">{text}</span>
      </div>
      {value && <span className="text-xs text-success">{value}</span>}
    </div>
  );
}

function MiniTotal({ color, label, value, plain }: { color: string; label: string; value: number; plain?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <p className="text-xl font-semibold">{plain ? value : formatMoney(value)}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function buildConicGradient(categories: Category[], total: number) {
  if (!total) return "conic-gradient(#1f2937 0deg 360deg)";
  let angle = 0;
  const parts = categories.map((item) => {
    const next = angle + (item.total / total) * 360;
    const part = `${item.color} ${angle}deg ${next}deg`;
    angle = next;
    return part;
  });
  return `conic-gradient(${parts.join(", ")})`;
}

function moneyValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPeriod(tx: Transaction[]) {
  const dates = tx.map((item) => new Date(item.created_at)).sort((a, b) => a.getTime() - b.getTime());
  const start = dates[0] ?? new Date();
  const end = dates[dates.length - 1] ?? new Date();
  const format = (date: Date) => date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${format(start)} - ${format(end)}`;
}
