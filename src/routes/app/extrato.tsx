import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/supabase/auth";
import { useLanguage } from "@/lib/i18n/context";
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
  motivo_cancelamento?: string | null;
  comprovante_url?: string | null;
  observacao?: string | null;
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

function getCategoryMeta(t: (key: string) => string): Record<string, Omit<Category, "key" | "total">> {
  return {
    residual: { label: t("statement.residual"), color: "#00d17d", icon: DollarSign },
    indicacao_direta: { label: t("statement.directReferral"), color: "#1677ff", icon: User },
    indicacao_indireta: { label: t("statement.indirectReferral"), color: "#8b5cf6", icon: Users },
    royalties: { label: t("statement.royalties"), color: "#f5b51b", icon: Crown },
    compartilhamento: { label: t("statement.sharing"), color: "#06b6d4", icon: Share2 },
  };
}

function ExtratoPage() {
  const { t } = useLanguage();
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
          .select("id,tipo,valor,status,nivel,created_at,origem_id,motivo_cancelamento,comprovante_url,observacao,balance_holds(release_at)")
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

  const stats = useMemo(() => buildStats(tx, bonuses, saldoDisponivel, t), [tx, bonuses, saldoDisponivel, t]);
  const chartData = useMemo(() => buildChart(tx), [tx]);
  const period = useMemo(() => formatPeriod(tx), [tx]);

  const exportCsv = () => {
    const networkMap = new Map(networkBonuses.map((nb) => [nb.id, nb]));
    const rows = [
      [t("statement.date"), t("statement.type"), t("statement.level"), t("statement.referred"), t("statement.value"), t("statement.status")],
      ...bonuses.map((b) => {
        const nb = networkMap.get(b.id);
        return [
          formatDateTime(b.created_at),
          getTipoLabel(t)[b.tipo] ?? b.tipo,
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

  if (loading) return <p className="text-muted-foreground">{t("statement.loading")}</p>;

  return (
    <div className="space-y-4">
      <Card className="border-primary/15 bg-card/50 p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-normal">{t("statement.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("statement.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv}>
              <Upload className="mr-2 h-4 w-4" /> {t("statement.export")}
            </Button>
            <Button variant="outline">
              <CalendarDays className="mr-2 h-4 w-4" /> {period}
            </Button>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" /> {t("statement.filters")}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {stats.categories.map((category) => (
            <SummaryCard key={category.key} category={category} />
          ))}
          <SummaryCard
            category={{ key: "saldo", label: t("statement.releasedBalance"), total: stats.balance, color: "#00d17d", icon: Wallet }}
            sub={t("statement.availableForWithdrawal")}
          />
          <SummaryCard
            category={{ key: "aguardando", label: t("statement.waiting7d"), total: saldoAguardando, color: "#f5b51b", icon: Clock }}
            sub={t("statement.retentionPeriod")}
          />
          <SummaryCard
            category={{ key: "cancelado", label: t("statement.canceled"), total: bonuses.filter((b) => b.status === "cancelado").reduce((s, b) => s + moneyValue(b.valor), 0), color: "#ff453a", icon: XCircle }}
            sub={t("statement.canceledBonuses")}
          />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <Card className="border-primary/15 bg-card/50 p-5">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">{t("statement.movementsSummary")}</h2>
                <p className="text-xs text-muted-foreground">{t("statement.movementsSummarySub")}</p>
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <LegendDot color="#00d17d" label={t("statement.entries")} />
                <LegendDot color="#ff453a" label={t("statement.exits")} />
                <LegendDot color="#1677ff" label={t("statement.net")} />
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
              <MiniTotal color="#00d17d" label={t("statement.entries")} value={stats.entries} />
              <MiniTotal color="#ff453a" label={t("statement.exits")} value={stats.exits} />
              <MiniTotal color="#1677ff" label={t("statement.net")} value={stats.net} />
              <MiniTotal color="#8b5cf6" label={t("statement.transactions")} value={tx.length} plain />
            </div>
          </Card>

          <Card className="border-primary/15 bg-card/50 p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold">{t("statement.history")}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{t("statement.historySub")}</p>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("statement.search")}
                    className="w-full pl-9 md:w-56"
                  />
                </div>
                <Button variant="outline" onClick={exportCsv}>
                  <Download className="mr-2 h-4 w-4" /> {t("statement.download")}
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

function buildStats(tx: Transaction[], bonuses: Bonus[], saldoDisponivel: number, t: (key: string) => string) {
  const categoryMeta = getCategoryMeta(t);
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

function SummaryCard({ category, sub }: { category: Category; sub?: string }) {
  const { t } = useLanguage();
  const Icon = category.icon;
  const subText = sub ?? t("statement.totalAccumulated");
  return (
    <Card className="border-primary/15 bg-background/45 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg p-2" style={{ background: `${category.color}18`, color: category.color }}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{category.label}</p>
          <p className="text-lg font-bold" style={{ color: category.color }}>{formatMoney(category.total)}</p>
          <p className="text-xs text-muted-foreground">{subText}</p>
        </div>
      </div>
    </Card>
  );
}

function DistributionCard({ categories, total }: { categories: Category[]; total: number }) {
  const { t } = useLanguage();
  const gradient = buildConicGradient(categories, total);
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">{t("statement.distribution")}</h3>
      <div className="mt-5 grid gap-5 sm:grid-cols-[140px_1fr] xl:grid-cols-1">
        <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full" style={{ background: gradient }}>
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-card text-center">
            <span className="text-lg font-bold">{formatMoney(total)}</span>
            <span className="text-xs text-muted-foreground">{t("statement.total")}</span>
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

const MOTIVO_LABELS_ASSOC: Record<string, string> = {
  pagamento_nao_confirmado: "Pagamento não confirmado",
  ativacao_manual_sem_pagamento: "Ativação manual sem pagamento efetuado",
  outro: "Outro motivo",
};

function CancelInfo({ bonusId, motivo, observacao, comprovanteUrl }: {
  bonusId: string;
  motivo: string;
  observacao: string | null;
  comprovanteUrl: string | null;
}) {
  const { supabase, user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(!!comprovanteUrl);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !supabase || !user) return;
    setUploading(true);
    try {
      const path = `${user.id}/${bonusId}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("bonus-proofs").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("bonuses").update({ comprovante_url: path }).eq("id", bonusId);
      if (dbErr) throw dbErr;
      setUploaded(true);
      toast.success("Comprovante enviado com sucesso!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar comprovante");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5 text-xs">
      <p className="text-destructive/80 font-medium">{MOTIVO_LABELS_ASSOC[motivo] ?? motivo}</p>
      {observacao && <p className="text-muted-foreground italic">"{observacao}"</p>}
      {motivo === "pagamento_nao_confirmado" && (
        uploaded ? (
          <p className="text-success flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Comprovante enviado — aguarde análise
          </p>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-primary/40 px-2 py-1 text-primary hover:bg-primary/10">
            <Upload className="h-3 w-3" />
            {uploading ? "Enviando..." : "Enviar comprovante de pagamento"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              disabled={uploading}
              onChange={handleUpload}
            />
          </label>
        )
      )}
    </div>
  );
}

function getTipoLabel(t: (key: string) => string): Record<string, string> {
  return {
    diario: t("statement.bonusDaily"),
    adesao: t("statement.bonusAdesao"),
    renovacao: t("statement.bonusRenovacao"),
    residual: t("statement.bonusResidual"),
    mensalidade: t("statement.royalties"),
    ajuste: t("statement.bonusAjuste"),
    publicidade: t("statement.bonusPublicidade"),
  };
}

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
  const { t } = useLanguage();
  const TIPO_LABEL = getTipoLabel(t);
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
    motivo_cancelamento: string | null;
    comprovante_url: string | null;
    observacao: string | null;
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
        motivo_cancelamento: b.motivo_cancelamento ?? null,
        comprovante_url: b.comprovante_url ?? null,
        observacao: b.observacao ?? null,
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
      motivo_cancelamento: null,
      comprovante_url: null,
      observacao: null,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .filter((r) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return r.descricao.toLowerCase().includes(term) || (r.indicado ?? "").toLowerCase().includes(term);
    });

  if (rows.length === 0) {
    return <p className="py-8 text-sm text-muted-foreground">{t("statement.noMovements")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead className="text-xs text-muted-foreground border-b border-border/50">
          <tr>
            <th className="px-3 py-3 text-left font-medium">{t("statement.date")}</th>
            <th className="px-3 py-3 text-left font-medium">{t("statement.type")}</th>
            <th className="px-3 py-3 text-left font-medium hidden md:table-cell">{t("statement.level")}</th>
            <th className="px-3 py-3 text-left font-medium">{t("statement.referred")}</th>
            <th className="px-3 py-3 text-left font-medium">{t("statement.value")}</th>
            <th className="px-3 py-3 text-left font-medium">{t("statement.status")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row) => {
            const days = row.release_at
              ? Math.max(0, Math.ceil((new Date(row.release_at).getTime() - Date.now()) / 86400000))
              : null;
            const isVencido = row.status === "liberado" && row.cycleStatus === "completado";
            return (
              <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/5 transition-colors align-top">
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
                    <div className="space-y-1.5">
                      <Badge className="border-destructive/30 bg-destructive/15 text-destructive">{t("statement.statusCanceled")}</Badge>
                      {row.motivo_cancelamento && (
                        <CancelInfo
                          bonusId={row.id}
                          motivo={row.motivo_cancelamento}
                          observacao={row.observacao}
                          comprovanteUrl={row.comprovante_url}
                        />
                      )}
                    </div>
                  ) : isVencido ? (
                    <Badge className="border-border/50 bg-muted/20 text-muted-foreground">{t("statement.statusOverdue")}</Badge>
                  ) : row.status === "pendente" ? (
                    <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300">
                      <Clock className="h-3 w-3 mr-1" />{days != null && days > 0 ? `${days}d` : t("statement.releasing")}
                    </Badge>
                  ) : (
                    <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15">
                      <ShieldCheck className="mr-1 h-3 w-3" />
                      {row.status === "concluido" ? t("statement.statusCompleted") : t("statement.statusReleased")}
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
  const { t } = useLanguage();
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
      <h3 className="font-semibold">{t("statement.bestDay")}</h3>
      <div className="mt-5 flex items-center gap-4">
        <div className="rounded-lg bg-primary/15 p-4 text-primary shadow-gold">
          <CalendarDays className="h-8 w-8" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{best.date.toLocaleDateString("pt-BR", { weekday: "long" })}</p>
          <p className="text-2xl font-bold">{formatMoney(best.total)}</p>
          <p className="text-xs text-muted-foreground">{t("statement.highestVolume")}</p>
        </div>
      </div>
    </Card>
  );
}

function InsightsCard({ stats, tx }: { stats: ReturnType<typeof buildStats>; tx: Transaction[] }) {
  const { t } = useLanguage();
  const average = stats.entries && tx.length ? stats.entries / tx.filter((item) => item.tipo === "credito").length : 0;
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">{t("statement.insights")}</h3>
      <div className="mt-4 space-y-4 text-sm">
        <Insight icon={TrendingUp} text={stats.net >= 0 ? t("statement.positiveBalance") : t("statement.moreExits")} value={stats.net >= 0 ? t("statement.positive") : t("statement.attention")} />
        <Insight icon={DollarSign} text={t("statement.averageTicket").replace("{value}", formatMoney(average || 0))} />
        <Insight icon={Users} text={t("statement.movementsRegistered").replace("{n}", String(tx.length))} />
      </div>
    </Card>
  );
}

function NextReleaseCard({ pending, bonuses }: { pending: number; bonuses: Bonus[] }) {
  const { t } = useLanguage();
  const value = pending || 0;
  const nextBonus = bonuses
    .filter((b) => b.status === "pendente" && b.release_at)
    .sort((a, b) => new Date(a.release_at!).getTime() - new Date(b.release_at!).getTime())[0];
  const nextDate = nextBonus?.release_at ? new Date(nextBonus.release_at) : null;
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">{t("statement.nextRelease")}</h3>
      <div className="mt-5 flex items-center gap-4">
        <div className="rounded-lg bg-amber-500/15 p-3 text-amber-300">
          <Trophy className="h-8 w-8" />
        </div>
        <div>
          <p className="text-2xl font-bold">{formatMoney(value)}</p>
          <p className="text-xs text-muted-foreground">{t("statement.waitingRetention")}</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {nextDate
          ? t("statement.nextReleaseDate").replace("{date}", nextDate.toLocaleDateString("pt-BR")).replace("{days}", String(Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / 86400000))))
          : value > 0 ? t("statement.waitingProcessing") : t("statement.noPendingValue")}
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
