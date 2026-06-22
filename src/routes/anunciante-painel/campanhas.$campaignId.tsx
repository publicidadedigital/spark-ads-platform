import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, ShieldCheck, XCircle, ExternalLink, Users, TrendingUp, Zap } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/anunciante-painel/campanhas/$campaignId")({ component: CampaignParticipants });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type Participant = {
  id: string;
  shared_link: string;
  status: string;
  motivo_rejeicao: string | null;
  created_at: string;
  social_handle: string | null;
  instagram_usado: string | null;
  detected_followers?: number | null;
  auto_validate_status?: string | null;
  auto_validate_checked_at?: string | null;
  auto_validate_detail?: string | null;
  auto_validate_at?: string | null;
  profile?: { nome: string; instagram: string | null; avatar_url: string | null; seguidores_instagram: number | null } | null;
};

function buildDailyData(items: Participant[]) {
  const days: { label: string; key: string; shares: number; cumApproved: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), key: d.toISOString().slice(0, 10), shares: 0, cumApproved: 0 });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  items.forEach((p) => {
    const key = p.created_at.slice(0, 10);
    const day = byKey.get(key);
    if (day) {
      day.shares++;
      if (p.status === "aprovada") day.cumApproved++;
    }
  });
  let cum = 0;
  return days.map((d) => ({ label: d.label, shares: d.shares, cumApproved: (cum += d.cumApproved) }));
}

function hoursOnline(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function CampaignParticipants() {
  const { supabase, user } = useAuth();
  const { campaignId } = Route.useParams();
  const [campaign, setCampaign] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const [{ data: c }, { data: shares }] = await Promise.all([
        supabase
          .from("advertiser_campaigns")
          .select("*, order:order_id(price_usd,estimated_views,package:advertising_package_id(name,duration_days))")
          .eq("id", campaignId)
          .maybeSingle(),
        supabase
          .from("campaign_shares")
          .select("id,shared_link,status,motivo_rejeicao,created_at,social_handle,instagram_usado,detected_followers,auto_validate_status,auto_validate_checked_at,auto_validate_detail,auto_validate_at,profile:user_id(nome,instagram,avatar_url,seguidores_instagram)")
          .eq("advertiser_campaign_id", campaignId)
          .order("created_at", { ascending: false }),
      ]);
      setCampaign(c);
      setParticipants((shares ?? []) as unknown as Participant[]);
      setLoading(false);
    })();
  }, [supabase, user, campaignId]);

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!campaign) return <p className="text-muted-foreground">Campanha nao encontrada.</p>;

  const approved = participants.filter((p) => p.status === "aprovada").length;
  const rejected = participants.filter((p) => p.status === "rejeitada").length;
  const removed = participants.filter((p) => p.status === "removida").length;
  const decided = approved + rejected + removed;
  const taxaAprovacao = Math.round((approved / Math.max(decided, 1)) * 100);
  const alcanceEstimado = participants
    .filter((p) => p.status === "aprovada")
    .reduce((sum, p) => sum + (p.detected_followers ?? p.profile?.seguidores_instagram ?? 0), 0);

  const dailyData = buildDailyData(participants);

  const tooltipStyle = {
    contentStyle: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" },
    labelStyle: { color: "hsl(var(--foreground))" },
  };
  const axisProps = { tick: { fill: "hsl(var(--muted-foreground))", fontSize: 11 }, tickLine: false as const, axisLine: false as const };

  return (
    <div className="space-y-4">
      <div>
        <Link to="/anunciante-painel/campanhas" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar para campanhas
        </Link>
      </div>

      <Card className="border-primary/15 bg-card/50 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <img src={campaign.media_url} alt="" className="h-24 w-24 rounded-md object-cover" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{campaign.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{campaign.caption}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">{campaign.order?.package?.name ?? "-"}</Badge>
              <span className="text-muted-foreground">{usd.format(Number(campaign.order?.price_usd ?? 0))} · ~{Number(campaign.order?.estimated_views ?? 0).toLocaleString("pt-BR")} views estimadas</span>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Participantes</p>
              <p className="text-xl font-bold">{participants.length}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-card/50 border-primary/15">
          <p className="text-xs text-muted-foreground">Total participantes</p>
          <p className="text-2xl font-bold mt-1">{participants.length}</p>
        </Card>
        <Card className="p-4 bg-card/50 border-primary/15">
          <p className="text-xs text-muted-foreground">Aprovados</p>
          <p className="text-2xl font-bold mt-1 text-success">{approved}</p>
        </Card>
        <Card className="p-4 bg-card/50 border-primary/15">
          <p className="text-xs text-muted-foreground">Taxa de aprovação</p>
          <p className="text-2xl font-bold mt-1">{taxaAprovacao}%</p>
        </Card>
        <Card className="p-4 bg-card/50 border-primary/15">
          <p className="text-xs text-muted-foreground">Alcance estimado</p>
          <p className="text-2xl font-bold mt-1">{alcanceEstimado.toLocaleString("pt-BR")}</p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 bg-card/50 border-primary/15">
          <p className="text-sm font-semibold mb-3">Compartilhamentos por dia</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="shares" name="Compartilhamentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4 bg-card/50 border-primary/15">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-success" />
            <p className="text-sm font-semibold">Crescimento (aprovados acumulado)</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis {...axisProps} />
              <Tooltip {...tooltipStyle} />
              <Area type="monotone" dataKey="cumApproved" name="Aprovados acumulado" stroke="hsl(var(--success))" fill="url(#cumGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="border-primary/15 bg-card/50 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="px-4 py-3 text-left font-medium">Participante</th>
                <th className="px-4 py-3 text-left font-medium">Instagram</th>
                <th className="px-4 py-3 text-left font-medium">Seguidores</th>
                <th className="px-4 py-3 text-left font-medium">Link enviado</th>
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Tempo online</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const online = hoursOnline(p.created_at);
                const isOver24h = (Date.now() - new Date(p.created_at).getTime()) >= 86400000;
                return (
                  <tr key={p.id} className="border-b border-border/35 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.profile?.avatar_url ? (
                          <img src={p.profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs text-primary">
                            {(p.profile?.nome ?? "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium">{p.profile?.nome ?? "-"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">@{p.instagram_usado || p.social_handle || p.profile?.instagram || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span>{(p.detected_followers ?? p.profile?.seguidores_instagram ?? 0).toLocaleString("pt-BR")}</span>
                        {p.detected_followers != null && (
                          <span className="text-xs text-success font-medium">verificado</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={p.shared_link} target="_blank" rel="noreferrer" className="flex max-w-[220px] items-center gap-1 truncate text-primary hover:underline">
                        {p.shared_link} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                      {(p.status === "rejeitada" || p.status === "removida") && p.motivo_rejeicao && (
                        <div className="mt-1 max-w-[180px] text-xs text-destructive">{p.motivo_rejeicao}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">{online}</span>
                        {isOver24h ? (
                          <Badge className="border-success/30 bg-success/15 text-success text-xs w-fit">✓ 24h+</Badge>
                        ) : (
                          <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300 text-xs w-fit">&lt; 24h</Badge>
                        )}
                        <AutoValidateBadge
                          status={p.auto_validate_status}
                          checkedAt={p.auto_validate_checked_at}
                          validateAt={p.auto_validate_at}
                        />
                        <a href={p.shared_link} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2">Abrir publicação</Button>
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {participants.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum participante ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AutoValidateBadge({ status, checkedAt, validateAt }: { status?: string | null; checkedAt?: string | null; validateAt?: string | null }) {
  const now = Date.now();
  if (!status || status === "pending") {
    if (!validateAt) return null;
    const msLeft = new Date(validateAt).getTime() - now;
    if (msLeft <= 0) return <Badge className="border-primary/30 bg-primary/15 text-primary text-xs w-fit"><Zap className="mr-1 h-3 w-3" />Verificando...</Badge>;
    const hLeft = Math.ceil(msLeft / 3600000);
    return <Badge variant="outline" className="text-muted-foreground text-xs w-fit"><Clock className="mr-1 h-3 w-3" />Auto-check em {hLeft}h</Badge>;
  }
  const ts = checkedAt ? new Date(checkedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  if (status === "live") return <Badge className="border-success/30 bg-success/15 text-success text-xs w-fit"><Zap className="mr-1 h-3 w-3" />✓ Verificado automaticamente</Badge>;
  if (status === "removed") return <Badge className="border-destructive/30 bg-destructive/15 text-destructive text-xs w-fit"><XCircle className="mr-1 h-3 w-3" />Post removido detectado {ts}</Badge>;
  if (status === "story_manual") return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300 text-xs w-fit"><Clock className="mr-1 h-3 w-3" />Story: validação por print</Badge>;
  if (status === "private") return <Badge className="border-destructive/30 bg-destructive/15 text-destructive text-xs w-fit"><ShieldCheck className="mr-1 h-3 w-3" />Perfil privado — rejeitado</Badge>;
  return null;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "aprovada":
      return <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15"><ShieldCheck className="mr-1 h-3 w-3" /> Validado</Badge>;
    case "rejeitada":
      return <Badge className="border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15"><XCircle className="mr-1 h-3 w-3" /> Recusado</Badge>;
    case "removida":
      return <Badge className="border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15"><XCircle className="mr-1 h-3 w-3" /> Removido (fraude)</Badge>;
    default:
      return <Badge className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/15"><Clock className="mr-1 h-3 w-3" /> Pendente</Badge>;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
