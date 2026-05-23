import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Award,
  Bell,
  Crown,
  Gift,
  Goal,
  Grid2X2,
  Medal,
  Rocket,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/app/")({ component: Dashboard });

type Bonus = {
  valor: number | string;
  tipo: string;
  status: string;
  created_at: string;
};

type Share = {
  id: string;
  status: string;
  created_at: string;
  motivo_rejeicao: string | null;
  campaigns?: { titulo: string } | null;
};

type Stats = {
  nome: string;
  saldo: number;
  pacote: { nome: string; valor: number } | null;
  cycle: { percentual: number; status: string } | null;
  status: string;
  sharesHoje: number;
  metaDia: number;
  ganhosDiarios: number;
  ganhosIndicacao: number;
  ganhosEquipe: number;
  totalBonus: number;
  points: number;
  recentShares: Share[];
  bonuses: Bonus[];
};

const DAILY_GOAL = 5;

function Dashboard() {
  const { supabase, user } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("users_profile")
        .select("id, nome, status, pacote_ativo_id, packages:pacote_ativo_id(nome,valor)")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!profile) {
        setLoading(false);
        return;
      }

      const profileId = profile.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [{ data: cycle }, { count: sharesHoje }, { data: bonuses }, { data: recentShares }] = await Promise.all([
        supabase
          .from("user_cycles")
          .select("percentual_atual, saldo_bonificacoes, status")
          .eq("user_id", profileId)
          .eq("status", "ativo")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("campaign_shares")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profileId)
          .gte("created_at", today.toISOString()),
        supabase
          .from("bonuses")
          .select("valor,tipo,status,created_at")
          .eq("user_id", profileId),
        supabase
          .from("campaign_shares")
          .select("id,status,motivo_rejeicao,created_at,campaigns:campaign_id(titulo)")
          .eq("user_id", profileId)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const releasedBonuses = (bonuses ?? []).filter((bonus: Bonus) => bonus.status === "liberado");
      const sumBy = (type: string) => releasedBonuses
        .filter((bonus: Bonus) => bonus.tipo === type)
        .reduce((total: number, bonus: Bonus) => total + moneyValue(bonus.valor), 0);
      const totalBonus = releasedBonuses.reduce((total: number, bonus: Bonus) => total + moneyValue(bonus.valor), 0);
      const saldo = Number(cycle?.saldo_bonificacoes ?? 0);

      setS({
        nome: profile.nome || user.email?.split("@")[0] || "Alexandre",
        saldo,
        pacote: profile.packages as any,
        cycle: cycle ? { percentual: Number(cycle.percentual_atual), status: cycle.status } : null,
        status: profile.status,
        sharesHoje: sharesHoje ?? 0,
        metaDia: DAILY_GOAL,
        ganhosDiarios: sumBy("diario"),
        ganhosIndicacao: sumBy("indicacao"),
        ganhosEquipe: sumBy("equipe"),
        totalBonus,
        points: Math.round((totalBonus + saldo) * 10 + (sharesHoje ?? 0) * 25),
        recentShares: (recentShares ?? []) as Share[],
        bonuses: releasedBonuses as Bonus[],
      });
      setLoading(false);
    })();
  }, [supabase, user]);

  if (loading) return <p className="text-muted-foreground">Carregando dashboard...</p>;
  if (!s) return <EmptyState />;

  const restantes = Math.max(0, s.metaDia - s.sharesHoje);
  const cyclePercent = Math.min(100, Math.round((s.cycle?.percentual ?? 0) / 2));
  const nextPrize = nextAchievement(s.points);
  const chartData = buildChartData(s.bonuses);

  return (
    <div className="dashboard-page space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-primary/15 bg-card/50 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-normal">Olá, {firstName(s.nome)}!</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cada ação te aproxima de grandes conquistas. Continue assim!
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={s.status} />
                <button className="relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-background/60 text-muted-foreground">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">3</span>
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <TopMetric icon={Wallet} label="Saldo do ciclo" value={formatMoney(s.saldo)} sub="Disponível para saque" tone="violet" />
              <TopMetric icon={Star} label="Pontos acumulados" value={formatNumber(s.points)} sub="Este mês" tone="purple" />
              <TopMetric icon={Share2} label="Compartilhamentos hoje" value={`${s.sharesHoje} / ${s.metaDia}`} sub={restantes ? `Faltam ${restantes} para o bônus` : "Meta concluída"} tone="primary" />
              <TopMetric icon={Goal} label="Ciclo (até 200%)" value={`${cyclePercent}%`} sub="Progresso atual" tone="ring" progress={cyclePercent} />
            </div>
          </Card>

          <JourneyCard points={s.points} nextPrize={nextPrize} />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <GainCard icon={TrendingUp} label="Ganhos diários" value={s.ganhosDiarios} change="+12% vs ontem" tone="success" />
            <GainCard icon={Users} label="Ganhos por indicação" value={s.ganhosIndicacao} change="+8% vs ontem" tone="primary" />
            <GainCard icon={Crown} label="Ganhos de equipe" value={s.ganhosEquipe} change="+15% vs ontem" tone="warning" />
            <GainCard icon={Wallet} label="Bônus do ciclo" value={s.saldo} change={`${cyclePercent}% do ciclo concluído`} tone="success" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.96fr)]">
            <EarningsChart data={chartData} total={s.totalBonus} />
            <ActivityCard shares={s.recentShares} />
          </div>

          <Card className="overflow-hidden border-violet-500/30 bg-[radial-gradient(circle_at_right,rgba(124,58,237,0.36),transparent_30%),linear-gradient(90deg,rgba(88,28,135,0.42),rgba(2,6,23,0.72))] p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-xl border border-amber-300/35 bg-amber-500/15 p-3 text-amber-300">
                  <Trophy className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-semibold">Você está mandando muito bem!</h3>
                  <p className="text-sm text-muted-foreground">
                    Faltam {formatNumber(nextPrize.remaining)} pontos para desbloquear sua próxima conquista.
                  </p>
                </div>
              </div>
              <Button variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Ver catálogo de prêmios
              </Button>
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <DailyGoalCard shares={s.sharesHoje} goal={s.metaDia} />
          <ScoreCard points={s.points} />
          <RankingCard points={s.points} name={firstName(s.nome)} />
          <DoubleBonusCard shares={s.sharesHoje} />
        </aside>
      </div>
    </div>
  );
}

function TopMetric({ icon: Icon, label, value, sub, tone, progress }: any) {
  const tones: Record<string, string> = {
    violet: "bg-violet-500/15 text-violet-300",
    purple: "bg-purple-500/15 text-purple-300",
    primary: "bg-primary/15 text-primary",
    ring: "bg-primary/10 text-primary",
  };

  return (
    <Card className="border-primary/15 bg-background/45 p-4">
      <div className="flex min-h-[76px] items-center gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          {progress === undefined ? <Icon className="h-6 w-6" /> : <Ring value={progress} />}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </Card>
  );
}

function JourneyCard({ points, nextPrize }: { points: number; nextPrize: ReturnType<typeof nextAchievement> }) {
  const percent = Math.min(100, (points / 30000) * 100);
  return (
    <Card className="overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_40%_0%,rgba(124,58,237,0.28),transparent_30%),radial-gradient(circle_at_right,rgba(37,99,235,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.88))] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Crown className="mt-1 h-5 w-5 text-amber-300" />
          <div>
            <h2 className="font-semibold">Sua jornada de conquistas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Acumule pontos e troque por prêmios incríveis!</p>
          </div>
        </div>
        <Button variant="outline" className="border-primary/30 bg-primary/10 text-primary">Ver catálogo completo</Button>
      </div>

      <div className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold">{formatNumber(points)}</p>
            <p className="text-sm text-muted-foreground">pontos acumulados</p>
          </div>
          <Badge variant="outline" className="border-violet-400/40 bg-violet-500/15 text-violet-200">
            Próxima conquista: {formatNumber(nextPrize.target)} pontos
          </Badge>
        </div>
        <div className="relative h-3 rounded-full bg-primary/10">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed,#2563eb)] shadow-[0_0_22px_rgba(124,58,237,0.55)]" style={{ width: `${percent}%` }} />
          <div className="absolute left-1/3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-primary/60 bg-primary/20 text-primary shadow-gold">
            <Star className="h-4 w-4" />
          </div>
          <Gift className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-amber-300" />
        </div>
        <div className="mt-4 grid grid-cols-3 text-sm text-muted-foreground">
          <span>0</span>
          <span className="text-center">10.000</span>
          <span className="text-right">30.000</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <PrizeCard title="iPhone 15" points="10.000 pontos" available />
        <PrizeCard title="Viagem dos sonhos" points="30.000 pontos" />
      </div>
    </Card>
  );
}

function PrizeCard({ title, points, available }: { title: string; points: string; available?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/15 bg-background/45 p-3">
      <div className={`grid h-14 w-16 place-items-center rounded-lg ${available ? "bg-violet-500/15 text-violet-300" : "bg-amber-500/15 text-amber-300"}`}>
        {available ? <Rocket className="h-7 w-7" /> : <Medal className="h-7 w-7" />}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm font-semibold">{points}</p>
        <Badge className={available ? "mt-1 bg-success/15 text-success hover:bg-success/15" : "mt-1 bg-muted text-muted-foreground hover:bg-muted"}>
          {available ? "Disponível" : "Bloqueado"}
        </Badge>
      </div>
    </div>
  );
}

function GainCard({ icon: Icon, label, value, change, tone }: any) {
  const tones: Record<string, string> = {
    success: "bg-success/15 text-success",
    primary: "bg-primary/15 text-primary",
    warning: "bg-amber-500/15 text-amber-300",
  };
  return (
    <Card className="border-primary/15 bg-card/50 p-4">
      <div className="flex items-center gap-4">
        <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{formatMoney(value)}</p>
          <p className="text-xs text-success">{change}</p>
        </div>
      </div>
    </Card>
  );
}

function EarningsChart({ data, total }: { data: any[]; total: number }) {
  const values = data.map((item) => item.valor);
  const max = Math.max(...values, 0);
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Evolução dos ganhos</h3>
        <Button size="sm" variant="outline">Últimos 7 dias</Button>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: -20, right: 8, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="dashboardEarnings" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.42} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} opacity={0.45} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis domain={[0, Math.max(100, max)]} tickLine={false} axisLine={false} tickFormatter={(value) => `R$ ${value}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(value: any) => formatMoney(Number(value))}
            />
            <Area type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={3} fill="url(#dashboardEarnings)" dot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid gap-3 border-t border-border/50 pt-4 sm:grid-cols-3">
        <MiniStat icon={Wallet} label="Total no período" value={formatMoney(total)} />
        <MiniStat icon={TrendingUp} label="Maior ganho diário" value={formatMoney(max)} />
        <MiniStat icon={Sparkles} label="Média diária" value={formatMoney(total / 7)} />
      </div>
    </Card>
  );
}

function ActivityCard({ shares }: { shares: Share[] }) {
  const activity = shares.length ? shares : [];
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Atividades recentes</h3>
        <Button size="sm" variant="outline">Ver todas</Button>
      </div>
      {activity.length === 0 ? (
        <div className="rounded-lg border border-dashed border-primary/20 bg-background/40 p-6 text-center text-sm text-muted-foreground">
          Nenhuma atividade recente. <Link to="/app/campanhas" className="text-primary hover:underline">Ver campanhas</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/35 bg-background/30 p-3">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.status === "aprovada" ? "bg-success/15 text-success" : "bg-amber-500/15 text-amber-300"}`}>
                <Star className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{activityTitle(item.status)}</p>
                <p className="truncate text-xs text-muted-foreground">{item.campaigns?.titulo ?? "Campanha"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{formatShortDate(item.created_at)}</p>
                <Badge variant="outline" className={item.status === "aprovada" ? "border-success/30 text-success" : "border-amber-400/30 text-amber-300"}>
                  {item.status === "aprovada" ? "+10 pts" : "Pendente"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DailyGoalCard({ shares, goal }: { shares: number; goal: number }) {
  const progress = Math.min(100, Math.round((shares / goal) * 100));
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">Meta diária</h3>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Complete suas {goal} publicidades diárias e garanta seu bônus!</p>
          <p className="mt-4 text-3xl font-bold">{shares}<span className="text-base text-muted-foreground"> / {goal}</span></p>
          <p className="text-xs text-muted-foreground">publicações</p>
        </div>
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Goal className="h-12 w-12" />
        </div>
      </div>
      <Progress value={progress} className="mt-4 h-2 bg-primary/10" />
      <Link to="/app/campanhas">
        <Button className="mt-4 w-full bg-primary text-primary-foreground">Ver minhas publicações</Button>
      </Link>
    </Card>
  );
}

function ScoreCard({ points }: { points: number }) {
  return (
    <Card className="overflow-hidden border-violet-500/25 bg-[radial-gradient(circle_at_right,rgba(124,58,237,0.34),transparent_35%),linear-gradient(180deg,rgba(30,27,75,0.56),rgba(2,6,23,0.86))] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Sua pontuação</h3>
          <p className="mt-4 text-3xl font-bold">{formatNumber(points)}</p>
          <p className="text-sm text-muted-foreground">pontos</p>
        </div>
        <div className="grid h-20 w-20 place-items-center rounded-full border border-violet-400/40 bg-violet-500/15 text-amber-300">
          <Award className="h-10 w-10" />
        </div>
      </div>
      <div className="mt-5 space-y-3 border-t border-border/35 pt-4 text-sm">
        <ScoreRow label="Ranking geral" value="Top 18%" positive />
        <ScoreRow label="Posição no mês" value="124º" />
        <ScoreRow label="Pontos este mês" value={`${formatNumber(points)} +24%`} positive />
      </div>
    </Card>
  );
}

function RankingCard({ points, name }: { points: number; name: string }) {
  const ranking = [
    { name: "João Silva", points: 28450 },
    { name: "Maria Souza", points: 21300 },
    { name: "Pedro Alves", points: 18760 },
    { name, points, current: true },
    { name: "Lucas Lima", points: 11230 },
  ];
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Top compartilhadores</h3>
        <Button size="sm" variant="outline">Ver ranking</Button>
      </div>
      <div className="space-y-2">
        {ranking.map((item, index) => (
          <div key={`${item.name}-${index}`} className={`flex items-center gap-3 rounded-lg p-2 ${item.current ? "border border-primary/40 bg-primary/10" : ""}`}>
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${index < 3 ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground"}`}>
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.current ? "Você" : item.name}</span>
            <span className="text-sm text-muted-foreground">{formatNumber(item.points)} pts</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DoubleBonusCard({ shares }: { shares: number }) {
  return (
    <Card className="border-primary/15 bg-[radial-gradient(circle_at_left,rgba(124,58,237,0.24),transparent_30%),rgba(15,23,42,0.5)] p-5">
      <div className="flex gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
          <Rocket className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold">Bônus em dobro!</h3>
          <p className="mt-1 text-sm text-muted-foreground">Complete suas 5 publicações diárias durante 7 dias seguidos e ganhe bônus em dobro!</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Progress value={(shares / 7) * 100} className="h-2 bg-primary/10" />
        <span className="shrink-0 text-xs text-muted-foreground">{Math.min(shares, 7)} / 7 dias</span>
      </div>
    </Card>
  );
}

function Ring({ value }: { value: number }) {
  return (
    <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: `conic-gradient(#2563eb ${value * 3.6}deg, rgba(37,99,235,0.18) 0deg)` }}>
      <div className="h-6 w-6 rounded-full bg-card" />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-primary/15 p-2 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function ScoreRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={positive ? "text-success" : "text-foreground"}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    ativo: "Ativo",
    pendente: "Pendente",
    bloqueado: "Bloqueado",
    aguardando_renovacao: "Aguardando renovação",
  };
  return (
    <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15">
      <ShieldCheck className="mr-1 h-3 w-3" /> {map[status] ?? status}
    </Badge>
  );
}

function EmptyState() {
  return (
    <Card className="border-border/50 bg-card/50 p-10 text-center">
      <h3 className="font-semibold">Perfil não encontrado</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Seu perfil ainda não foi criado. Verifique o e-mail de confirmação ou contate o suporte.
      </p>
    </Card>
  );
}

function buildChartData(bonuses: Bonus[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);
    return date;
  });

  return days.map((date) => {
    const key = date.toISOString().slice(0, 10);
    const value = bonuses
      .filter((bonus) => bonus.created_at.slice(0, 10) === key)
      .reduce((total, bonus) => total + moneyValue(bonus.valor), 0);
    return {
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      valor: value,
    };
  });
}

function nextAchievement(points: number) {
  const targets = [10000, 17550, 30000, 50000];
  const target = targets.find((item) => points < item) ?? targets[targets.length - 1];
  return { target, remaining: Math.max(0, target - points) };
}

function activityTitle(status: string) {
  if (status === "aprovada") return "Compartilhamento validado";
  if (status === "rejeitada") return "Publicação rejeitada";
  if (status === "pendente") return "Publicação em análise";
  return "Aguardando validação";
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "Alexandre";
}

function moneyValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("pt-BR");
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
