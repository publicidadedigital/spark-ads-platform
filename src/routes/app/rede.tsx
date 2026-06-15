import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Crown,
  Flame,
  Medal,
  Network,
  QrCode,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  User,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/rede")({ component: RedePage });

type ReferralProfile = {
  id: string;
  nome: string | null;
  status: string | null;
  created_at: string | null;
  indicador_id: string | null;
};

type ReferralRow = {
  nivel: number;
  status: string | null;
  created_at: string | null;
  indicado: ReferralProfile | ReferralProfile[] | null;
};

type Member = ReferralProfile & {
  nivel: number;
  referralStatus: string | null;
  referralCreatedAt: string | null;
};

const levelStyles: Record<number, { dot: string; border: string; glow: string; badge: string; label: string }> = {
  1: {
    dot: "from-primary to-blue-400",
    border: "border-primary/70",
    glow: "shadow-[0_0_28px_rgba(37,99,235,0.28)]",
    badge: "bg-primary/20 text-primary border-primary/40",
    label: "Nível 1",
  },
  2: {
    dot: "from-violet-600 to-fuchsia-400",
    border: "border-violet-500/70",
    glow: "shadow-[0_0_28px_rgba(124,58,237,0.24)]",
    badge: "bg-violet-500/20 text-violet-300 border-violet-400/40",
    label: "Nível 2",
  },
  3: {
    dot: "from-emerald-600 to-green-300",
    border: "border-emerald-500/70",
    glow: "shadow-[0_0_28px_rgba(16,185,129,0.22)]",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
    label: "Nível 3",
  },
  4: {
    dot: "from-amber-500 to-yellow-300",
    border: "border-amber-400/70",
    glow: "shadow-[0_0_28px_rgba(245,158,11,0.24)]",
    badge: "bg-amber-500/20 text-amber-300 border-amber-400/40",
    label: "Nível 4+",
  },
};

function RedePage() {
  const { supabase, user } = useAuth();
  const [profile, setProfile] = useState<{ id: string; nome: string | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("users_profile")
        .select("id,nome")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!prof) {
        setLoading(false);
        return;
      }

      setProfile(prof);

      const { data: refs } = await supabase
        .from("referrals")
        .select("nivel,status,created_at,indicado:indicado_id(id,nome,status,created_at,indicador_id)")
        .eq("indicador_id", prof.id)
        .order("nivel", { ascending: true })
        .order("created_at", { ascending: true });

      const parsed = (refs ?? [])
        .map((row: ReferralRow) => {
          const indicado = Array.isArray(row.indicado) ? row.indicado[0] : row.indicado;
          if (!indicado) return null;
          return {
            ...indicado,
            nivel: row.nivel,
            referralStatus: row.status,
            referralCreatedAt: row.created_at,
          };
        })
        .filter(Boolean) as Member[];

      const { data: bonuses } = await supabase
        .from("bonuses")
        .select("valor")
        .eq("user_id", prof.id)
        .eq("status", "liberado");

      setMembers(parsed);
      setBonusTotal((bonuses ?? []).reduce((sum: number, b: any) => sum + Number(b.valor ?? 0), 0));
      setExpanded(new Set(["root", ...parsed.filter((m) => m.nivel === 1).slice(0, 4).map((m) => m.id)]));
      setLoading(false);
    })();
  }, [supabase, user]);

  const link = profile && typeof window !== "undefined"
    ? `${window.location.origin}/cadastro?ref=${profile.id}`
    : "";

  const network = useMemo(() => buildNetwork(profile?.id ?? null, members), [profile?.id, members]);
  const directCount = network.roots.length;
  const totalCount = members.length;
  const highestLevel = members.reduce((max, m) => Math.max(max, m.nivel), 0);
  const nextTier = getTierProgress(totalCount, directCount);
  const topBuilders = useMemo(
    () => members
      .map((member) => ({ member, total: countDescendants(member.id, network.childrenByParent) }))
      .sort((a, b) => b.total - a.total || a.member.nivel - b.member.nivel)
      .slice(0, 5),
    [members, network.childrenByParent],
  );

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  const shareLink = async () => {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: "Viralink", text: "Entre na minha rede Viralink", url: link });
      return;
    }
    await copyLink();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-primary/40 bg-primary/15 p-2 text-primary shadow-gold">
              <Network className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-normal">Minha Rede</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Sua equipe está crescendo</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={shareLink} className="bg-gold-gradient text-primary-foreground">
            <Share2 className="mr-2 h-4 w-4" /> Compartilhar link
          </Button>
          <Button variant="outline" onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4" /> Copiar link
          </Button>
          <Button variant="outline" onClick={copyLink}>
            <QrCode className="mr-2 h-4 w-4" /> QR Code
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={Users} label="Equipe total" value={totalCount.toString()} sub="pessoas" />
        <MetricCard icon={Sparkles} label="Bônus gerado" value={`$ ${bonusTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub="total liberado" />
        <MetricCard icon={User} label="Diretos" value={directCount.toString()} sub="pessoas" />
        <MetricCard icon={Star} label="Maior nível alcançado" value={highestLevel ? `Nível ${highestLevel}` : "Nível 0"} sub="na sua rede" />
        <MetricCard icon={TrendingUp} label="Crescimento semanal" value={`+${countRecent(members, 7)}`} sub="novos membros" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_304px]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-primary/25 bg-card/55">
            <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_1fr_1fr] lg:items-center">
              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Progresso da equipe</p>
                    <p className="font-semibold">Nível atual: <span className="text-primary">{nextTier.current}</span></p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{nextTier.percent}%</span>
                </div>
                <Progress value={nextTier.percent} className="h-3 bg-primary/10" />
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Faltam:</p>
                <p className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /> +{nextTier.missingDirect} membros diretos</p>
                <p className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> +{nextTier.missingTeam} membros na equipe</p>
              </div>
              <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-4">
                <p className="text-xs text-muted-foreground">Próximo nível</p>
                <div className="mt-1 flex items-center gap-2 text-amber-300">
                  <Crown className="h-5 w-5" />
                  <span className="text-lg font-bold">{nextTier.next}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden border-primary/20 bg-card/50">
            <div className="flex flex-col gap-4 border-b border-border/60 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Sua rede <span className="text-muted-foreground">(árvore de ramificação)</span></h2>
                <p className="text-sm text-muted-foreground">{totalCount} membro(s) distribuídos em até 10 níveis</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">Nível máximo {highestLevel || 0}</Badge>
                <Button size="sm" variant="outline" onClick={() => setExpanded(new Set(["root", ...members.map((m) => m.id)]))}>
                  <ChevronDown className="mr-2 h-4 w-4" /> Expandir
                </Button>
                <Button size="sm" variant="outline" onClick={() => setExpanded(new Set(["root"]))}>
                  <ChevronUp className="mr-2 h-4 w-4" /> Recolher
                </Button>
              </div>
            </div>

            <div className="relative min-h-[520px] overflow-x-auto bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.18),transparent_34%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px] p-5">
              {loading ? (
                <p className="text-sm text-muted-foreground">Carregando rede...</p>
              ) : (
                <div className="mx-auto min-w-[760px] max-w-6xl">
                  <div className="flex flex-col items-center">
                    <RootNode name={profile?.nome ?? "Você"} directCount={directCount} />
                    <div className="h-8 w-px border-l border-dashed border-primary/50" />
                    {network.roots.length === 0 ? (
                      <EmptyTree />
                    ) : (
                      <div className="flex w-full items-start justify-center gap-6">
                        {network.roots.map((member) => (
                          <Branch
                            key={member.id}
                            member={member}
                            childrenByParent={network.childrenByParent}
                            expanded={expanded}
                            onToggle={(id) => toggleExpanded(id, setExpanded)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="grid gap-4 border-primary/20 bg-card/50 p-5 md:grid-cols-2">
            <div>
              <h3 className="mb-4 font-semibold">Legenda de níveis</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((level) => (
                  <div key={level} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className={`h-3 w-3 rounded-full bg-gradient-to-br ${levelStyles[level].dot}`} />
                    {levelStyles[level].label}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-4 font-semibold">Legenda de status</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatusLegend icon={Flame} label="Entrou hoje" />
                <StatusLegend icon={Zap} label="Cresceu esta semana" />
                <StatusLegend icon={Star} label="Melhor desempenho" />
              </div>
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <RewardCard tier={nextTier.next} percent={nextTier.percent} missing={nextTier.missingDirect + nextTier.missingTeam} />
          <RankingCard builders={topBuilders} />
          <Achievements total={totalCount} direct={directCount} highestLevel={highestLevel} percent={nextTier.percent} />
        </aside>
      </div>
    </div>
  );
}

function buildNetwork(rootId: string | null, members: Member[]) {
  const byId = new Map(members.map((member) => [member.id, member]));
  const childrenByParent = new Map<string, Member[]>();

  members.forEach((member) => {
    const parentId = member.indicador_id && (member.indicador_id === rootId || byId.has(member.indicador_id))
      ? member.indicador_id
      : "root";
    const list = childrenByParent.get(parentId) ?? [];
    list.push(member);
    childrenByParent.set(parentId, list);
  });

  childrenByParent.forEach((list) => {
    list.sort((a, b) => a.nivel - b.nivel || (a.nome ?? "").localeCompare(b.nome ?? ""));
  });

  return { childrenByParent, roots: childrenByParent.get(rootId ?? "root") ?? childrenByParent.get("root") ?? [] };
}

function toggleExpanded(id: string, setExpanded: (next: (prev: Set<string>) => Set<string>) => void) {
  setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function countDescendants(id: string, childrenByParent: Map<string, Member[]>): number {
  const children = childrenByParent.get(id) ?? [];
  return children.length + children.reduce((sum, child) => sum + countDescendants(child.id, childrenByParent), 0);
}

function countRecent(members: Member[], days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return members.filter((member) => new Date(member.created_at ?? member.referralCreatedAt ?? 0).getTime() >= since).length;
}

function getTierProgress(total: number, direct: number) {
  const tiers = [
    { current: "BRONZE", next: "PRATA", direct: 3, team: 10 },
    { current: "PRATA", next: "OURO", direct: 6, team: 50 },
    { current: "OURO", next: "DIAMANTE", direct: 12, team: 100 },
    { current: "DIAMANTE", next: "ELITE", direct: 20, team: 250 },
  ];
  const tier = tiers.find((item) => direct < item.direct || total < item.team) ?? tiers[tiers.length - 1];
  const directProgress = Math.min(1, direct / tier.direct);
  const teamProgress = Math.min(1, total / tier.team);
  return {
    ...tier,
    percent: Math.round(((directProgress + teamProgress) / 2) * 100),
    missingDirect: Math.max(0, tier.direct - direct),
    missingTeam: Math.max(0, tier.team - total),
  };
}

function RootNode({ name, directCount }: { name: string; directCount: number }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/60 bg-primary/20 text-2xl font-bold text-primary shadow-gold">
        {(name || "V").slice(0, 1).toUpperCase()}
      </div>
      <div className="mt-2 font-semibold">{name || "Você"} <span className="text-muted-foreground">(Você)</span></div>
      <div className="text-xs text-muted-foreground">Nível 0 • {directCount} direto(s)</div>
    </div>
  );
}

function Branch({
  member,
  childrenByParent,
  expanded,
  onToggle,
}: {
  member: Member;
  childrenByParent: Map<string, Member[]>;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const children = childrenByParent.get(member.id) ?? [];
  const isOpen = expanded.has(member.id);

  return (
    <div className="flex min-w-[172px] flex-1 flex-col items-center">
      <NodeCard member={member} childCount={children.length} isOpen={isOpen} onToggle={() => onToggle(member.id)} />
      {children.length > 0 && (
        <>
          <div className={`h-8 w-px border-l border-dashed ${connectorColor(member.nivel)}`} />
          {isOpen ? (
            <div className="flex items-start justify-center gap-4">
              {children.map((child) => (
                <Branch
                  key={child.id}
                  member={child}
                  childrenByParent={childrenByParent}
                  expanded={expanded}
                  onToggle={onToggle}
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onToggle(member.id)}
              className="rounded-lg border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            >
              +{children.length} outro(s)
              <div className="text-xs">Nível {Math.min(10, member.nivel + 1)}</div>
            </button>
          )}
        </>
      )}
    </div>
  );
}

function NodeCard({
  member,
  childCount,
  isOpen,
  onToggle,
}: {
  member: Member;
  childCount: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const style = levelStyles[Math.min(4, member.nivel)] ?? levelStyles[4];

  return (
    <div className={`w-full rounded-lg border ${style.border} bg-background/80 p-3 ${style.glow}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${style.dot} text-sm font-bold`}>
          {(member.nome ?? "U").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{member.nome ?? "Usuário"}</div>
          <div className="text-xs text-muted-foreground">Nível {member.nivel}</div>
        </div>
        {childCount > 0 && (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card/80 text-primary transition hover:border-primary/60 hover:bg-primary/10"
            aria-label={isOpen ? "Recolher ramo" : "Expandir ramo"}
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge variant="outline" className={style.badge}>{style.label}</Badge>
        <span className="text-xs text-muted-foreground">{childCount} direto(s)</span>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub }: any) {
  return (
    <Card className="border-primary/15 bg-card/55 p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </Card>
  );
}

function RewardCard({ tier, percent, missing }: { tier: string; percent: number; missing: number }) {
  return (
    <Card className="border-amber-400/25 bg-card/55 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/10 text-amber-300 shadow-[0_0_36px_rgba(245,158,11,0.25)]">
          <Trophy className="h-9 w-9" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Próxima recompensa</p>
          <p className="text-xl font-bold text-amber-300">{tier}</p>
          <p className="text-xs text-muted-foreground">Faltam {missing} pessoa(s)</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Progress value={percent} className="h-2 bg-amber-500/10" />
        <span className="text-sm font-semibold text-amber-300">{percent}%</span>
      </div>
    </Card>
  );
}

function RankingCard({ builders }: { builders: { member: Member; total: number }[] }) {
  return (
    <Card className="border-primary/15 bg-card/55 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Top Construtores</h3>
        <Badge variant="outline" className="border-primary/30 text-primary">Rede</Badge>
      </div>
      <div className="space-y-3">
        {builders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem construtores ainda.</p>
        ) : builders.map(({ member, total }, index) => (
          <div key={member.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
            <div className="flex items-center gap-3">
              <Medal className={`h-5 w-5 ${index === 0 ? "text-amber-300" : "text-muted-foreground"}`} />
              <div>
                <div className="text-sm font-medium">{member.nome ?? "Usuário"}</div>
                <div className="text-xs text-muted-foreground">Nível {member.nivel}</div>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">+{total}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Achievements({ total, direct, highestLevel, percent }: { total: number; direct: number; highestLevel: number; percent: number }) {
  const items = [
    { label: "Primeira indicação", done: direct >= 1, value: direct >= 1 ? 100 : 0 },
    { label: "Equipe com 10 membros", done: total >= 10, value: Math.min(100, total * 10) },
    { label: "Equipe com 50 membros", done: total >= 50, value: Math.min(100, total * 2) },
    { label: "Nível Ouro", done: highestLevel >= 4, value: percent },
  ];

  return (
    <Card className="border-primary/15 bg-card/55 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Conquistas</h3>
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${item.done ? "border-success/40 bg-success/15 text-success" : "border-border bg-muted text-muted-foreground"}`}>
                  <Trophy className="h-3.5 w-3.5" />
                </span>
                {item.label}
              </div>
              <span className={item.done ? "text-xs text-success" : "text-xs text-muted-foreground"}>{item.done ? "Concluída" : `${item.value}%`}</span>
            </div>
            {!item.done && <Progress value={item.value} className="h-1.5 bg-primary/10" />}
          </div>
        ))}
      </div>
    </Card>
  );
}

function StatusLegend({ icon: Icon, label }: any) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="h-4 w-4 text-primary" />
      {label}
    </div>
  );
}

function EmptyTree() {
  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-background/60 px-8 py-10 text-center">
      <Users className="mx-auto mb-3 h-8 w-8 text-primary" />
      <h3 className="font-semibold">Sua árvore começa no primeiro indicado</h3>
      <p className="mt-1 text-sm text-muted-foreground">Compartilhe seu link para iniciar a rede.</p>
    </div>
  );
}

function connectorColor(level: number) {
  if (level === 1) return "border-primary/60";
  if (level === 2) return "border-violet-400/60";
  if (level === 3) return "border-emerald-400/60";
  return "border-amber-400/60";
}
