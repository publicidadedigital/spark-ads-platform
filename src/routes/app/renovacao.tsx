import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BarChart3,
  Check,
  Headphones,
  Layers3,
  Lock,
  RefreshCw,
  Rocket,
  Star,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/app/renovacao")({ component: RenovacaoPage });

type PackageRow = {
  id: string;
  nome: string;
  valor: number | string;
  descricao: string | null;
  status: string;
  daily_bonus: number | string | null;
  bonusable_amount: number | string | null;
};

type Profile = {
  id: string;
  nome: string | null;
  status: string;
  pacote_ativo_id: string | null;
};

type Cycle = {
  id: string;
  percentual_atual: number | string | null;
  saldo_bonificacoes: number | string | null;
  status: string;
  started_at: string | null;
  completed_at?: string | null;
  packages?: { id: string; nome: string; valor: number | string } | null;
};

function RenovacaoPage() {
  const { supabase, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [cycleGoalPercent, setCycleGoalPercent] = useState(200);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: rs } = await supabase
        .from("renewal_settings")
        .select("cycle_goal_percent")
        .maybeSingle();
      if (rs?.cycle_goal_percent) setCycleGoalPercent(Number(rs.cycle_goal_percent));

      const { data: prof } = await supabase
        .from("users_profile")
        .select("id,nome,status,pacote_ativo_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      setProfile(prof);

      if (prof) {
        const { data: cy } = await supabase
          .from("user_cycles")
          .select("id,percentual_atual,saldo_bonificacoes,status,started_at,completed_at,packages:package_id(id,nome,valor)")
          .eq("user_id", prof.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setCycle(cy as Cycle | null);
      }

      const { data: pks } = await supabase
        .from("packages")
        .select("id,nome,valor,descricao,status,daily_bonus,bonusable_amount")
        .eq("status", "ativo")
        .order("valor");
      setPackages(uniquePackages((pks ?? []) as PackageRow[]));
      setLoading(false);
    })();
  }, [supabase, user]);

  function escolher(pkg: PackageRow) {
    navigate({ to: "/app/checkout/$packageId", params: { packageId: pkg.id } });
  }

  const currentPackage = useMemo(() => {
    const fromCycle = cycle?.packages as PackageRow | null | undefined;
    if (fromCycle) return fromCycle;
    if (!packages.length || !profile?.pacote_ativo_id) return null;
    return packages.find((p) => p.id === profile.pacote_ativo_id) ?? null;
  }, [cycle, packages, profile?.pacote_ativo_id]);

  if (loading) return <p className="text-muted-foreground">Carregando renovação...</p>;

  const cyclePercentRaw = Number(cycle?.percentual_atual ?? 0);
  const cycleProgress = Math.min(100, Math.max(0, Math.round((cyclePercentRaw / cycleGoalPercent) * 100)));
  const currentValue = moneyValue(currentPackage?.valor);
  const bonusableAmount = moneyValue((currentPackage as any)?.bonusable_amount) || currentValue;
  const cycleGoal = bonusableAmount * (cycleGoalPercent / 100);
  const cycleTotal = Number(cycle?.saldo_bonificacoes ?? 0);
  const missingValue = Math.max(0, cycleGoal - cycleTotal);
  const startedAt = cycle?.started_at ? new Date(cycle.started_at) : null;
  const canRenew = !cycle || cyclePercentRaw >= cycleGoalPercent || cycle.status === "concluido";
  const upgradePackage = packages.find((pkg) => moneyValue(pkg.valor) > currentValue) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Renovação de pacote</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu ciclo é concluído ao atingir {cycleGoalPercent}% do valor do pacote contratado.
          </p>
        </div>
        {cycle && (
          <div className="rounded-lg border border-success/20 bg-card/60 px-4 py-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_18px_rgba(34,197,94,0.7)]" />
              Ciclo ativo
            </div>
            <p className="text-xs text-muted-foreground">{cyclePercentRaw.toFixed(1)}% de {cycleGoalPercent}%</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-4">
          <Card className="overflow-hidden border-primary/25 bg-[radial-gradient(circle_at_left,rgba(37,99,235,0.32),transparent_28%),linear-gradient(135deg,rgba(30,64,175,0.28),rgba(15,23,42,0.74))] p-5 md:p-6">
            <div className="grid gap-6 lg:grid-cols-[330px_minmax(0,1fr)_170px] lg:items-center">
              <div className="flex items-center gap-5">
                <PackageIcon tone="blue" size="large" />
                <div>
                  <p className="text-sm text-muted-foreground">Seu pacote atual</p>
                  <h2 className="text-3xl font-bold text-primary">{currentPackage?.nome ?? "Sem pacote ativo"}</h2>
                  {currentPackage && (
                    <p className="mt-1 text-lg font-semibold text-muted-foreground">{formatMoney(moneyValue(currentPackage.valor))}</p>
                  )}
                  {startedAt && (
                    <p className="mt-2 text-sm text-muted-foreground">Adquirido em {formatDate(startedAt)}</p>
                  )}
                </div>
              </div>

              <div className="border-primary/15 lg:border-l lg:px-8">
                <p className="text-sm text-muted-foreground">Progresso do ciclo</p>
                <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
                  <p className="text-5xl font-bold">{cycleProgress}%</p>
                  <p className="pb-2 text-sm text-muted-foreground">
                    {formatMoney(cycleTotal)} de {formatMoney(cycleGoal)}
                  </p>
                </div>
                <div className="relative mt-6">
                  <Progress value={cycleProgress} className="h-3 bg-primary/10" />
                  <div
                    className="absolute top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/50 bg-primary/25 text-amber-300 shadow-gold"
                    style={{ left: `${Math.max(8, Math.min(92, cycleProgress))}%` }}
                  >
                    <Star className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-4 flex justify-between text-sm">
                  <span>0%</span>
                  <span>{cycleGoalPercent}%</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Faltam</p>
                  <p className="text-2xl font-bold text-primary">{formatMoney(missingValue)}</p>
                  <p className="text-sm text-muted-foreground">para atingir {cycleGoalPercent}%</p>
                </div>
                <div className="rounded-lg border border-amber-300/25 bg-amber-500/10 p-3">
                  <p className="font-medium">Mantenha o ritmo!</p>
                  <p className="text-xs text-muted-foreground">Você está indo muito bem.</p>
                </div>
              </div>
            </div>
            <Button variant="outline" className="mt-5 border-primary/40 bg-primary/10 text-primary">
              Ver detalhes do pacote
            </Button>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <CycleMetric label="Ganho total do ciclo" value={formatMoney(cycleTotal)} sub={`${cycleProgress}% do objetivo`} />
            <CycleMetric label="Ganhos diários (média)" value={cycle ? formatMoney(cycleTotal / Math.max(1, daysSince(startedAt))) : "—"} sub="Média desde o início do ciclo" />
          </div>

          <Card className="border-primary/15 bg-card/50 p-5">
            <h2 className="text-xl font-semibold">O que você deseja fazer?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Escolha a melhor opção para continuar crescendo.</p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ActionCard
                title="Renovar pacote atual"
                description="Renove seu pacote e inicie um novo ciclo com os mesmos benefícios."
                price={currentValue}
                icon="renew"
                button="Renovar pacote"
                disabled={!canRenew || !currentPackage}
                onClick={() => currentPackage && escolher(currentPackage as PackageRow)}
                bullets={["Mesmo pacote e benefícios", "Toda sua estrutura e equipe", "Seu histórico de ganhos"]}
              />
              <ActionCard
                title="Fazer upgrade de pacote"
                description="Evolua para um pacote superior e aumente seus ganhos."
                price={moneyValue(upgradePackage?.valor)}
                icon="rocket"
                button="Ver pacotes superiores"
                accent
                disabled={!upgradePackage}
                onClick={() => upgradePackage && escolher(upgradePackage)}
                bullets={["Maiores retornos", "Bônus diários maiores", "Mais pontos por ações", "Novos recursos exclusivos"]}
              />
            </div>
          </Card>

          {packages.length > 0 && (
            <Card className="border-primary/15 bg-card/50 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Compare os pacotes</h2>
                  <p className="mt-1 text-sm text-muted-foreground">O pacote superior aumenta o teto de retorno do ciclo.</p>
                </div>
                <Button size="icon" variant="outline" className="hidden shrink-0 rounded-full lg:inline-flex">
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {packages.map((pkg, index) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    index={index}
                    current={pkg.id === currentPackage?.id}
                    goalPercent={cycleGoalPercent}
                    onChoose={() => escolher(pkg)}
                  />
                ))}
              </div>
            </Card>
          )}
        </main>

        <aside className="space-y-4">
          <BenefitsCard />
          <HistoryCard currentPackage={currentPackage as PackageRow | null} cycle={cycle} progress={cycleProgress} />
          <HelpCard />
        </aside>
      </div>
    </div>
  );
}

function CycleMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="border-primary/15 bg-card/50 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </Card>
  );
}

function ActionCard({
  title, description, price, bullets, button, icon, accent, disabled, onClick,
}: {
  title: string; description: string; price: number; bullets: string[];
  button: string; icon: "renew" | "rocket"; accent?: boolean; disabled?: boolean; onClick: () => void;
}) {
  return (
    <Card className={`relative overflow-hidden p-5 ${accent ? "border-violet-500/30 bg-violet-500/10" : "border-primary/20 bg-background/35"}`}>
      <div className="relative z-10 grid gap-5 md:grid-cols-[minmax(0,1fr)_120px] md:items-center">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-background/45 p-4">
            <p className={`text-sm ${accent ? "text-violet-300" : "text-foreground"}`}>
              {accent ? "Ao fazer upgrade você ganha:" : "Ao renovar agora você mantém:"}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className={`grid h-28 w-28 place-items-center justify-self-center rounded-full ${accent ? "bg-violet-500/15 text-violet-300" : "bg-primary/15 text-primary"}`}>
          {icon === "rocket" ? <Rocket className="h-16 w-16" /> : <RefreshCw className="h-16 w-16" />}
        </div>
      </div>
      <div className="relative z-10 mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Investimento</p>
          <p className={`text-2xl font-bold ${accent ? "text-violet-300" : "text-primary"}`}>{price > 0 ? formatMoney(price) : "—"}</p>
        </div>
        <Button onClick={onClick} disabled={disabled} className={accent ? "bg-violet-600 text-white hover:bg-violet-500" : "bg-primary text-primary-foreground"}>
          {button}
        </Button>
      </div>
    </Card>
  );
}

function PackageCard({ pkg, index, current, goalPercent, onChoose }: { pkg: PackageRow; index: number; current: boolean; goalPercent: number; onChoose: () => void }) {
  const value = moneyValue(pkg.valor);
  const bonusable = moneyValue(pkg.bonusable_amount) || value;
  const maxReturn = bonusable * (goalPercent / 100);
  const dailyBonus = moneyValue(pkg.daily_bonus);
  const tones = ["gray", "blue", "violet", "gold"] as const;
  return (
    <Card className={`cursor-pointer border-primary/15 bg-background/35 p-4 transition hover:border-primary/45 ${current ? "border-primary/70 bg-primary/10" : ""}`} onClick={onChoose}>
      <div className="flex items-start gap-3">
        <PackageIcon tone={tones[index % tones.length]} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{pkg.nome}</h3>
            {current && <Badge className="bg-primary/20 text-primary hover:bg-primary/20">Atual</Badge>}
          </div>
          <p className="mt-1 text-xl font-bold">{formatMoney(value)}</p>
          <p className="mt-2 text-sm text-muted-foreground">Retorno máximo: {formatMoney(maxReturn)}</p>
          <p className="text-sm text-muted-foreground">{goalPercent}% de meta</p>
        </div>
      </div>
      <div className="mt-4 border-t border-border/45 pt-3 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>Bônus diário por publicação: {dailyBonus > 0 ? formatMoney(dailyBonus) : "—"}</span>
        </div>
      </div>
    </Card>
  );
}

function BenefitsCard() {
  const items = [
    { icon: BarChart3, title: "Bônus diários maiores", text: "Quanto mais você avança, mais ganha." },
    { icon: Star, title: "Mais pontos acumulados", text: "Aproxime-se de grandes conquistas." },
    { icon: Users, title: "Equipe mais forte", text: "Sua rede continua crescendo com você." },
    { icon: Lock, title: "Acesso contínuo", text: "Todos os recursos e campanhas liberados." },
  ];
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">Benefícios de manter seu ciclo ativo</h3>
      <div className="mt-5 space-y-5">
        {items.map((item, index) => (
          <div key={item.title} className="flex gap-4">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${index === 1 ? "bg-amber-500/15 text-amber-300" : index === 2 ? "bg-violet-500/15 text-violet-300" : "bg-primary/15 text-primary"}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HistoryCard({ currentPackage, cycle, progress }: { currentPackage: PackageRow | null; cycle: Cycle | null; progress: number }) {
  const rows = cycle
    ? [{ name: currentPackage?.nome ?? "Ciclo atual", date: cycle.started_at ? formatDate(new Date(cycle.started_at)) : "—", progress }]
    : [];
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold">Histórico de ciclos</h3>
        <Button size="sm" variant="outline">Ver todos</Button>
      </div>
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ciclo encontrado ainda.</p>}
        {rows.map((row, index) => (
          <div key={`${row.name}-${index}`} className="flex items-center gap-3 rounded-lg border-b border-border/35 pb-3 last:border-b-0 last:pb-0">
            <PackageIcon tone={index === 0 ? "blue" : "gray"} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">Iniciado em {row.date}</p>
            </div>
            <Badge className={row.progress >= 100 ? "bg-success/15 text-success hover:bg-success/15" : "bg-primary/15 text-primary hover:bg-primary/15"}>
              {row.progress}%
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HelpCard() {
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <div className="flex gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Headphones className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold">Precisa de ajuda?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Fale com nosso suporte e tire suas dúvidas.</p>
        </div>
      </div>
      <Button variant="outline" className="mt-5 w-full border-primary/30 text-primary">
        Abrir chamado
      </Button>
    </Card>
  );
}

function PackageIcon({ tone = "blue", size = "normal" }: { tone?: "blue" | "violet" | "gold" | "gray"; size?: "normal" | "large" }) {
  const colors = {
    blue: "bg-primary/15 text-primary",
    violet: "bg-violet-500/15 text-violet-300",
    gold: "bg-amber-500/15 text-amber-300",
    gray: "bg-slate-500/15 text-slate-300",
  };
  const box = size === "large" ? "h-24 w-24" : "h-11 w-11";
  const icon = size === "large" ? "h-16 w-16" : "h-6 w-6";
  return (
    <div className={`grid ${box} shrink-0 place-items-center rounded-xl ${colors[tone]}`}>
      <Layers3 className={icon} />
    </div>
  );
}

function daysSince(date: Date | null) {
  if (!date) return 1;
  return Math.max(1, Math.ceil((Date.now() - date.getTime()) / 86400000));
}

function moneyValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function uniquePackages(packages: PackageRow[]) {
  const seen = new Set<string>();
  return packages.filter((pkg) => {
    const key = `${pkg.nome}-${moneyValue(pkg.valor)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) return "—";
  return value.toLocaleDateString("pt-BR");
}
