import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useLanguage } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTwoFactorStatus } from "@/lib/security/totp.functions";
import { TwoFactorReminderBanner } from "@/components/TwoFactorSetup";
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
  AlertTriangle,
  Award,
  Bell,
  BookOpen,
  CheckCircle2,
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
  X,
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
  cycle: { percentual: number; status: string; renewalGraceUntil: string | null } | null;
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
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [s, setS] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (accessToken) {
        getTwoFactorStatus({ data: { accessToken } })
          .then((status) => setTwoFactorEnabled(status.enabled))
          .catch(() => {});
      }

      const { data: profile } = await supabase
        .from("users_profile")
        .select("id, nome, status, pacote_ativo_id, packages:pacote_ativo_id(nome,valor)")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!profile) {
        const { data: advertiser } = await supabase
          .from("advertiser_profiles")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (advertiser) {
          navigate({ to: "/anunciante-painel" });
          return;
        }

        setLoading(false);
        return;
      }

      const profileId = profile.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [{ data: cycle }, { count: sharesHoje }, { data: bonuses }, { data: recentShares }, { data: pointEvents }] = await Promise.all([
        supabase
          .from("user_cycles")
          .select("percentual_atual, saldo_bonificacoes, status, renewal_grace_until")
          .in("status", ["ativo", "concluido"])
          .eq("user_id", profileId)
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
        supabase
          .from("point_events")
          .select("points")
          .eq("user_id", profileId)
          .eq("status", "valid"),
      ]);

      const releasedBonuses = (bonuses ?? []).filter((bonus: Bonus) => bonus.status === "liberado");
      const sumBy = (type: string) => releasedBonuses
        .filter((bonus: Bonus) => bonus.tipo === type)
        .reduce((total: number, bonus: Bonus) => total + moneyValue(bonus.valor), 0);
      const totalBonus = releasedBonuses.reduce((total: number, bonus: Bonus) => total + moneyValue(bonus.valor), 0);
      const saldo = Number(cycle?.saldo_bonificacoes ?? 0);

      setS({
        nome: profile.nome || user.email?.split("@")[0] || "Membro",
        saldo,
        pacote: profile.packages as any,
        cycle: cycle ? { percentual: Number(cycle.percentual_atual), status: cycle.status, renewalGraceUntil: cycle.renewal_grace_until ?? null } : null,
        status: profile.status,
        sharesHoje: sharesHoje ?? 0,
        metaDia: DAILY_GOAL,
        ganhosDiarios: sumBy("diario"),
        ganhosIndicacao: sumBy("indicacao"),
        ganhosEquipe: sumBy("equipe"),
        totalBonus,
        points: Math.round((pointEvents ?? []).reduce((total, row) => total + moneyValue(row.points), 0)),
        recentShares: (recentShares ?? []) as Share[],
        bonuses: releasedBonuses as Bonus[],
      });
      setLoading(false);
    })();
  }, [supabase, user]);

  if (loading) return <p className="text-muted-foreground">{t("dashboard.loading")}</p>;
  if (!s) return <EmptyState />;

  // Blocked: no active package
  if (!s.cycle) {
    return (
      <div className="space-y-4">
        <Card className="border-border/50 bg-card/60 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{t("dashboard.greeting")}, {firstName(s.nome)}!</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.welcome")}</p>
            </div>
            <StatusBadge status={s.status} />
          </div>
        </Card>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Card className="max-w-md w-full text-center bg-card/60 border-border/50 p-8 space-y-4">
            <div className="flex items-center justify-center rounded-full bg-primary/10 w-16 h-16 mx-auto">
              <Grid2X2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{t("dashboard.activatePackageTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.activatePackageDesc")}
            </p>
            <Link to="/app/pacotes">
              <Button className="w-full bg-primary text-primary-foreground">{t("dashboard.viewAvailablePackages")}</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const restantes = Math.max(0, s.metaDia - s.sharesHoje);
  const cyclePercent = Math.min(100, Math.round((s.cycle?.percentual ?? 0) / 2));
  const nextPrize = nextAchievement(s.points);
  const chartData = buildChartData(s.bonuses);

  return (
    <div className="dashboard-page space-y-4">
      {showHowItWorks && <HowItWorksModal onClose={() => setShowHowItWorks(false)} />}
      {!twoFactorEnabled && <TwoFactorReminderBanner to="/app/seguranca" />}
      <CycleWarningBanner cycle={s.cycle} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_290px]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-primary/15 bg-card/50 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-normal">{t("dashboard.greeting")}, {firstName(s.nome)}!</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("dashboard.motivational")}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={s.status} />
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                  onClick={() => setShowHowItWorks(true)}
                >
                  <BookOpen className="h-4 w-4" />
                  {t("dashboard.howItWorksBtn")}
                </Button>
                <button className="relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 bg-background/60 text-muted-foreground">
                  <Bell className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <TopMetric icon={Wallet} label={t("dashboard.cycleBalance")} value={formatMoney(s.saldo)} sub={t("dashboard.cycleBalanceSub")} tone="violet" />
              <TopMetric icon={Star} label={t("dashboard.accumulatedPoints")} value={formatNumber(s.points)} sub={t("dashboard.thisMonth")} tone="purple" />
              <TopMetric icon={Share2} label={t("dashboard.sharesToday")} value={`${s.sharesHoje} / ${s.metaDia}`} sub={restantes ? t("dashboard.remainingForBonus").replace("{n}", String(restantes)) : t("dashboard.goalCompleted")} tone="primary" />
              <TopMetric icon={Goal} label={t("dashboard.cycleUntil200")} value={`${cyclePercent}%`} sub={t("dashboard.currentProgress")} tone="ring" progress={cyclePercent} />
            </div>
          </Card>

          <JourneyCard points={s.points} nextPrize={nextPrize} />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <GainCard icon={TrendingUp} label={t("dashboard.dailyEarnings")} value={s.ganhosDiarios} tone="success" />
            <GainCard icon={Users} label={t("dashboard.referralEarnings")} value={s.ganhosIndicacao} tone="primary" />
            <GainCard icon={Crown} label={t("dashboard.teamEarnings")} value={s.ganhosEquipe} tone="warning" />
            <GainCard icon={Wallet} label={t("dashboard.cycleBonus")} value={s.saldo} change={t("dashboard.cycleCompletedPercent").replace("{n}", String(cyclePercent))} tone="success" />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.96fr)]">
            <EarningsChart data={chartData} total={s.totalBonus} />
            <ActivityCard shares={s.recentShares} />
          </div>

          <Card className="overflow-hidden border-violet-500/30 bg-[radial-gradient(circle_at_right,rgba(124,58,237,0.36),transparent_30%),linear-gradient(90deg,rgba(88,28,135,0.42),rgba(2,6,23,0.72))] p-5">
            <div className="flex items-center gap-4">
              <div className="rounded-xl border border-amber-300/35 bg-amber-500/15 p-3 text-amber-300">
                <Trophy className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-semibold">{t("dashboard.doingWell")}</h3>
                <p className="text-sm text-muted-foreground">
                  {s.points > 0
                    ? t("dashboard.pointsAccumulatedKeepGoing").replace("{n}", formatNumber(s.points))
                    : t("dashboard.completeDailyPostsForPoints")}
                </p>
              </div>
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
  const { t } = useLanguage();
  const PRIZES = [
    { title: t("dashboard.prizeIphone"), points: 10000, icon: Rocket },
    { title: t("dashboard.prizeTrip"), points: 30000, icon: Medal },
  ] as const;
  const maxPoints = PRIZES[PRIZES.length - 1].points;
  const percent = Math.min(100, (points / maxPoints) * 100);

  return (
    <Card className="overflow-hidden border-primary/20 bg-[radial-gradient(circle_at_40%_0%,rgba(124,58,237,0.28),transparent_30%),radial-gradient(circle_at_right,rgba(37,99,235,0.18),transparent_28%),linear-gradient(180deg,rgba(15,23,42,0.86),rgba(2,6,23,0.88))] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Crown className="mt-1 h-5 w-5 text-amber-300" />
          <div>
            <h2 className="font-semibold">{t("dashboard.journeyTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.journeySubtitle")}</p>
          </div>
        </div>
        <Badge variant="outline" className="border-violet-400/40 bg-violet-500/15 text-violet-200 shrink-0">
          {t("dashboard.nextAchievement").replace("{n}", formatNumber(nextPrize.target))}
        </Badge>
      </div>

      <div className="mt-7">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold">{formatNumber(points)}</p>
            <p className="text-sm text-muted-foreground">{t("dashboard.pointsAccumulated")}</p>
          </div>
        </div>
        <div className="relative h-3 rounded-full bg-primary/10">
          <div className="h-full rounded-full bg-[linear-gradient(90deg,#7c3aed,#2563eb)] shadow-[0_0_22px_rgba(124,58,237,0.55)]" style={{ width: `${percent}%` }} />
          <Gift className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 text-amber-300" />
        </div>
        <div className="mt-4 flex justify-between text-sm text-muted-foreground">
          <span>0</span>
          {PRIZES.map((prize) => (
            <span key={prize.title}>{formatNumber(prize.points)}</span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {PRIZES.map((prize) => {
          const unlocked = points >= prize.points;
          return (
            <div key={prize.title} className="flex items-center gap-3 rounded-lg border border-primary/15 bg-background/45 p-3">
              <div className={`grid h-14 w-16 place-items-center rounded-lg ${unlocked ? "bg-violet-500/15 text-violet-300" : "bg-amber-500/15 text-amber-300"}`}>
                <prize.icon className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium">{prize.title}</p>
                <p className="text-sm font-semibold">{formatNumber(prize.points)} {t("dashboard.points")}</p>
                <Badge className={unlocked ? "mt-1 bg-success/15 text-success hover:bg-success/15" : "mt-1 bg-muted text-muted-foreground hover:bg-muted"}>
                  {unlocked ? t("dashboard.available") : t("dashboard.locked")}
                </Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
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
          {change && <p className="text-xs text-success">{change}</p>}
        </div>
      </div>
    </Card>
  );
}

function EarningsChart({ data, total }: { data: any[]; total: number }) {
  const { t } = useLanguage();
  const values = data.map((item) => item.valor);
  const max = Math.max(...values, 0);
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t("dashboard.earningsEvolution")}</h3>
        <Button size="sm" variant="outline">{t("dashboard.last7Days")}</Button>
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
            <YAxis domain={[0, Math.max(100, max)]} tickLine={false} axisLine={false} tickFormatter={(value) => `$ ${value}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(value: any) => formatMoney(Number(value))}
            />
            <Area type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={3} fill="url(#dashboardEarnings)" dot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid gap-3 border-t border-border/50 pt-4 sm:grid-cols-3">
        <MiniStat icon={Wallet} label={t("dashboard.totalInPeriod")} value={formatMoney(total)} />
        <MiniStat icon={TrendingUp} label={t("dashboard.highestDailyEarning")} value={formatMoney(max)} />
        <MiniStat icon={Sparkles} label={t("dashboard.dailyAverage")} value={formatMoney(total / Math.max(1, data.filter((d: any) => d.valor > 0).length))} />
      </div>
    </Card>
  );
}

function ActivityCard({ shares }: { shares: Share[] }) {
  const { t } = useLanguage();
  const activity = shares.length ? shares : [];
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t("dashboard.recentActivity")}</h3>
        <Button size="sm" variant="outline">{t("dashboard.viewAll")}</Button>
      </div>
      {activity.length === 0 ? (
        <div className="rounded-lg border border-dashed border-primary/20 bg-background/40 p-6 text-center text-sm text-muted-foreground">
          {t("dashboard.noRecentActivity")} <Link to="/app/campanhas" className="text-primary hover:underline">{t("dashboard.viewCampaigns")}</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/35 bg-background/30 p-3">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.status === "aprovada" ? "bg-success/15 text-success" : "bg-amber-500/15 text-amber-300"}`}>
                <Star className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{activityTitle(item.status, t)}</p>
                <p className="truncate text-xs text-muted-foreground">{item.campaigns?.titulo ?? t("dashboard.campaign")}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{formatShortDate(item.created_at)}</p>
                <Badge variant="outline" className={item.status === "aprovada" ? "border-success/30 text-success" : "border-amber-400/30 text-amber-300"}>
                  {item.status === "aprovada" ? t("dashboard.pointsAbbrev") : t("dashboard.pending")}
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
  const { t } = useLanguage();
  const progress = Math.min(100, Math.round((shares / goal) * 100));
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">{t("dashboard.dailyGoal")}</h3>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{t("dashboard.completeDailyAdsAndEnsureBonus").replace("{n}", String(goal))}</p>
          <p className="mt-4 text-3xl font-bold">{shares}<span className="text-base text-muted-foreground"> / {goal}</span></p>
          <p className="text-xs text-muted-foreground">{t("dashboard.posts")}</p>
        </div>
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
          <Goal className="h-12 w-12" />
        </div>
      </div>
      <Progress value={progress} className="mt-4 h-2 bg-primary/10" />
      <Link to="/app/campanhas">
        <Button className="mt-4 w-full bg-primary text-primary-foreground">{t("dashboard.viewMyPosts")}</Button>
      </Link>
    </Card>
  );
}

function ScoreCard({ points }: { points: number }) {
  const { t } = useLanguage();
  return (
    <Card className="overflow-hidden border-violet-500/25 bg-[radial-gradient(circle_at_right,rgba(124,58,237,0.34),transparent_35%),linear-gradient(180deg,rgba(30,27,75,0.56),rgba(2,6,23,0.86))] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t("dashboard.yourScore")}</h3>
          <p className="mt-4 text-3xl font-bold">{formatNumber(points)}</p>
          <p className="text-sm text-muted-foreground">{t("dashboard.points")}</p>
        </div>
        <div className="grid h-20 w-20 place-items-center rounded-full border border-violet-400/40 bg-violet-500/15 text-amber-300">
          <Award className="h-10 w-10" />
        </div>
      </div>
      <div className="mt-5 space-y-3 border-t border-border/35 pt-4 text-sm">
        <ScoreRow label={t("dashboard.pointsAccumulated")} value={`${formatNumber(points)} pts`} positive={points > 0} />
      </div>
    </Card>
  );
}

function RankingCard({ points, name }: { points: number; name: string }) {
  const { t } = useLanguage();
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{t("dashboard.topSharers")}</h3>
        <Button size="sm" variant="outline">{t("dashboard.viewRanking")}</Button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 p-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">1</span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{t("dashboard.you")}</span>
          <span className="text-sm text-muted-foreground">{formatNumber(points)} pts</span>
        </div>
        <p className="text-xs text-muted-foreground">{t("dashboard.rankingPlaceholder")}</p>
      </div>
    </Card>
  );
}

function DoubleBonusCard({ shares }: { shares: number }) {
  const { t } = useLanguage();
  return (
    <Card className="border-primary/15 bg-[radial-gradient(circle_at_left,rgba(124,58,237,0.24),transparent_30%),rgba(15,23,42,0.5)] p-5">
      <div className="flex gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
          <Rocket className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold">{t("dashboard.doubleBonusTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.doubleBonusDesc")}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Progress value={(shares / 7) * 100} className="h-2 bg-primary/10" />
        <span className="shrink-0 text-xs text-muted-foreground">{Math.min(shares, 7)} / 7 {t("dashboard.daysAbbrev")}</span>
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
  const { t } = useLanguage();
  const map: any = {
    ativo: t("dashboard.statusAtivo"),
    pendente: t("dashboard.statusPendente"),
    bloqueado: t("dashboard.statusBloqueado"),
    aguardando_renovacao: t("dashboard.statusAguardandoRenovacao"),
  };
  return (
    <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15">
      <ShieldCheck className="mr-1 h-3 w-3" /> {map[status] ?? status}
    </Badge>
  );
}

function EmptyState() {
  const { t } = useLanguage();
  return (
    <Card className="border-border/50 bg-card/50 p-10 text-center">
      <h3 className="font-semibold">{t("dashboard.profileNotFound")}</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("dashboard.profileNotFoundDesc")}
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

function activityTitle(status: string, t: (key: string) => string) {
  if (status === "aprovada") return t("dashboard.activityApproved");
  if (status === "rejeitada") return t("dashboard.activityRejected");
  if (status === "pendente") return t("dashboard.activityPending");
  return t("dashboard.activityAwaitingValidation");
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "Alexandre";
}

function moneyValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
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

function CycleWarningBanner({ cycle }: { cycle: Stats["cycle"] }) {
  const { t } = useLanguage();
  if (!cycle) return null;

  const pct = cycle.percentual;

  // Ciclo concluído (200%) — prazo de renovação correndo
  if (cycle.status === "concluido" || pct >= 200) {
    const graceUntil = cycle.renewalGraceUntil ? new Date(cycle.renewalGraceUntil) : null;
    const daysLeft = graceUntil ? Math.max(0, Math.ceil((graceUntil.getTime() - Date.now()) / 86400000)) : null;
    const expired = daysLeft !== null && daysLeft === 0;

    return (
      <div className={`flex items-start gap-3 rounded-lg border p-4 ${
        expired
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-amber-400/50 bg-amber-500/10 text-amber-300"
      }`}>
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {expired
              ? t("dashboard.cycleExpiredTitle")
              : t("dashboard.cycleReachedRenew").replace("{n}", String(daysLeft))}
          </p>
          <p className="text-xs mt-0.5 opacity-80">
            {expired
              ? t("dashboard.cycleExpiredDesc")
              : t("dashboard.cycleRenewDaysLeft").replace("{n}", String(daysLeft ?? t("dashboard.fewDays")))}
          </p>
        </div>
        <Link to="/app/renovacao">
          <Button size="sm" variant={expired ? "destructive" : "outline"} className={expired ? "" : "border-amber-400/50 text-amber-300 hover:bg-amber-500/10"}>
            {expired ? t("dashboard.viewPackages") : t("dashboard.renewNow")}
          </Button>
        </Link>
      </div>
    );
  }

  // Alerta preventivo a partir de 150%
  if (pct >= 150) {
    const pctDisplay = Math.round(pct);
    const remaining = Math.round(200 - pct);
    return (
      <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 text-warning p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {t("dashboard.cycleApproaching200").replace("{pct}", String(pctDisplay)).replace("{remaining}", String(remaining))}
          </p>
          <p className="text-xs mt-0.5 opacity-80">
            {t("dashboard.cycleApproaching200Desc")}
          </p>
        </div>
        <Link to="/app/renovacao">
          <Button size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 shrink-0">
            {t("dashboard.viewRenewal")}
          </Button>
        </Link>
      </div>
    );
  }

  return null;
}

function HowItWorksModal({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();

  const steps = [
    {
      num: 1,
      title: t("howItWorks.step1Title"),
      desc: t("howItWorks.step1Desc"),
      color: "bg-primary/15 text-primary border-primary/30",
    },
    {
      num: 2,
      title: t("howItWorks.step2Title"),
      desc: t("howItWorks.step2Desc"),
      color: "bg-violet-500/15 text-violet-300 border-violet-400/30",
    },
    {
      num: 3,
      title: t("howItWorks.step3Title"),
      desc: t("howItWorks.step3Desc"),
      color: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    },
    {
      num: 4,
      title: t("howItWorks.step4Title"),
      desc: t("howItWorks.step4Desc"),
      color: "bg-blue-500/15 text-blue-300 border-blue-400/30",
    },
    {
      num: 5,
      title: t("howItWorks.step5Title"),
      desc: t("howItWorks.step5Desc"),
      color: "bg-green-500/15 text-green-300 border-green-400/30",
    },
  ];

  const rules = [
    t("howItWorks.rule1"),
    t("howItWorks.rule2"),
    t("howItWorks.rule3"),
    t("howItWorks.rule4"),
    t("howItWorks.rule5"),
    t("howItWorks.rule6"),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-border/60 bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background px-6 py-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">{t("howItWorks.title")}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-foreground transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-muted-foreground">{t("howItWorks.intro")}</p>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("howItWorks.stepsTitle")}</h3>
            {steps.map((step) => (
              <div key={step.num} className={`flex gap-4 rounded-lg border p-4 ${step.color}`}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-current/10 font-bold text-sm">
                  {step.num}
                </div>
                <div>
                  <p className="font-semibold text-sm">{step.title}</p>
                  <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("howItWorks.rulesTitle")}</h3>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              {rules.map((rule, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 text-sm text-center text-muted-foreground">
            {t("howItWorks.footer")}
          </div>
        </div>
      </div>
    </div>
  );
}
