import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { calculateDailyShareBonus } from "@/lib/business/rules";
import {
  Check,
  CircleHelp,
  Clock,
  ExternalLink,
  Flame,
  Instagram,
  Link2,
  Megaphone,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/campanhas")({ component: CampanhasPage });

type Campaign = {
  id: string;
  titulo: string;
  tipo_midia: "imagem" | "video" | string;
  media_url: string;
  texto_sugerido: string;
  link_campanha: string;
  rede_permitida: string;
  instrucoes_obrigatorias: string | null;
};

type AdvertiserCampaign = {
  id: string;
  title: string;
  media_url: string;
  media_type: "imagem" | "video" | string;
  caption: string;
  destination_url: string;
};

type Share = {
  id: string;
  campaign_id?: string;
  advertiser_campaign_id?: string | null;
  shared_link: string;
  status: "pendente" | "aprovada" | "rejeitada" | string;
  created_at: string;
  motivo_rejeicao: string | null;
  campaigns?: { titulo: string; media_url: string; tipo_midia: string } | null;
};

type Bonus = {
  valor: number | string;
  created_at: string;
};

type ActiveCycle = {
  id: string;
  valor_pacote: number | string | null;
};

const DAILY_GOAL = 5;

function CampanhasPage() {
  const { supabase, user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [advertiserCampaigns, setAdvertiserCampaigns] = useState<AdvertiserCampaign[]>([]);
  const [advertiserShares, setAdvertiserShares] = useState<Share[]>([]);
  const [sharesToday, setSharesToday] = useState<Share[]>([]);
  const [monthBonuses, setMonthBonuses] = useState<Bonus[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [cyclePackageValue, setCyclePackageValue] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user]);

  async function refresh() {
    if (!supabase || !user) return;
    setLoading(true);

    const { data: prof } = await supabase
      .from("users_profile")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!prof) {
      setLoading(false);
      return;
    }

    setProfileId(prof.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today);
    monthStart.setDate(1);

    const [{ data: cycle }, { data: cs }, { data: shares }, { data: bonuses }, { data: advCampaigns }, { data: advShares }] = await Promise.all([
      supabase
        .from("user_cycles")
        .select("id,valor_pacote")
        .eq("user_id", prof.id)
        .eq("status", "ativo")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("campaigns")
        .select("*")
        .eq("status", "ativa")
        .order("created_at", { ascending: false }),
      supabase
        .from("campaign_shares")
        .select("id,campaign_id,shared_link,status,motivo_rejeicao,created_at,campaigns:campaign_id(titulo,media_url,tipo_midia)")
        .eq("user_id", prof.id)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("bonuses")
        .select("valor,created_at")
        .eq("user_id", prof.id)
        .eq("tipo", "diario")
        .eq("status", "liberado")
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("advertiser_campaigns")
        .select("id,title,media_url,media_type,caption,destination_url")
        .eq("status", "ativa")
        .order("created_at", { ascending: false }),
      supabase
        .from("campaign_shares")
        .select("id,advertiser_campaign_id,shared_link,status,motivo_rejeicao,created_at,auto_validate_status,auto_validate_at,auto_validate_checked_at")
        .eq("user_id", prof.id)
        .not("advertiser_campaign_id", "is", null),
    ]);

    const activeCycle = cycle as ActiveCycle | null;
    setCycleId(activeCycle?.id ?? null);
    setCyclePackageValue(Number(activeCycle?.valor_pacote ?? 0));
    setCampaigns((cs ?? []) as Campaign[]);
    setSharesToday((shares ?? []) as Share[]);
    setMonthBonuses((bonuses ?? []) as Bonus[]);
    setAdvertiserCampaigns((advCampaigns ?? []) as AdvertiserCampaign[]);
    setAdvertiserShares((advShares ?? []) as unknown as Share[]);
    setLoading(false);
  }

  const dailyBonus = calculateDailyShareBonus(cyclePackageValue);
  const sharedToday = useMemo(() => new Set(sharesToday.map((share) => share.campaign_id)), [sharesToday]);
  const approvedCount = sharesToday.filter((share) => share.status === "aprovada").length;
  const submittedCount = sharesToday.length;
  const pendingCount = sharesToday.filter((share) => share.status === "pendente").length;
  const progress = Math.min(100, Math.round((approvedCount / DAILY_GOAL) * 100));
  const remaining = Math.max(0, DAILY_GOAL - approvedCount);
  const totalGanho = monthBonuses.reduce((sum, bonus) => sum + Number(bonus.valor ?? 0), 0);
  const currentStreak = Math.max(1, Math.min(7, approvedCount + pendingCount || submittedCount || 1));

  if (loading) return <p className="text-muted-foreground">Carregando campanhas...</p>;

  if (!cycleId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full text-center bg-card/60 border-border/50 p-8 space-y-4">
          <div className="flex items-center justify-center rounded-full bg-primary/10 w-16 h-16 mx-auto">
            <Megaphone className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">Ative seu pacote para participar</h2>
          <p className="text-sm text-muted-foreground">
            Para acessar as campanhas de compartilhamento e ganhar bônus diários, você precisa ter um pacote ativo.
          </p>
          <Link to="/app">
            <Button className="w-full bg-primary text-primary-foreground">Ver pacotes disponíveis</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-4">
          <Card className="border-primary/15 bg-card/50 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-normal">Campanhas</h1>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  Compartilhe {DAILY_GOAL} publicidades por dia no seu Instagram e ganhe bonus.
                  <CircleHelp className="h-4 w-4" />
                </p>
              </div>
              <Button variant="outline" className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15">
                <CircleHelp className="mr-2 h-4 w-4" /> Como funciona
              </Button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 min-[1400px]:grid-cols-4">
              <MetricCard label="Publicidades aprovadas hoje" value={`${approvedCount} / ${DAILY_GOAL}`} sub={`Restam ${remaining} para completar`} icon={Megaphone} />
              <MetricCard label="Bonus do dia" value={formatMoney(dailyBonus)} sub={`Ao completar ${DAILY_GOAL} publicacoes`} icon={Wallet} tone="success" />
              <MetricCard label="Sequencia atual" value={`${currentStreak} dias`} sub="Continue assim!" icon={Flame} tone="warning" />
              <MetricCard label="Total ganho" value={formatMoney(totalGanho)} sub="Este mes" icon={Sparkles} tone="success" />
            </div>
          </Card>

          <Card className="overflow-hidden border-violet-500/35 bg-[radial-gradient(circle_at_right,rgba(245,181,27,0.22),transparent_28%),linear-gradient(90deg,rgba(88,28,135,0.55),rgba(2,6,23,0.55))] p-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(220px,1fr)_minmax(360px,420px)_minmax(190px,250px)] xl:items-center">
              <div>
                <h2 className="font-semibold">Complete as {DAILY_GOAL} publicidades diarias</h2>
                <p className="mt-1 text-sm text-muted-foreground">e garanta seu bonus completo!</p>
              </div>
              <div className="flex min-w-0 items-center justify-center gap-2">
                {Array.from({ length: DAILY_GOAL }, (_, index) => {
                  const done = approvedCount > index;
                  return (
                    <div key={index} className="flex items-center">
                      <div className={`relative flex h-11 w-11 items-center justify-center rounded-full border font-bold ${
                        done ? "border-success/60 bg-success text-success-foreground shadow-[0_0_22px_rgba(34,197,94,0.35)]" : "border-primary/25 bg-primary/15 text-muted-foreground"
                      }`}>
                        {index + 1}
                        {done && <Check className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-success text-success-foreground" />}
                      </div>
                      {index < DAILY_GOAL - 1 && <div className={`h-px w-8 min-[1400px]:w-10 ${approvedCount > index + 1 ? "bg-success" : "bg-primary/30"}`} />}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center gap-4 border-primary/20 xl:border-l xl:pl-4">
                <Trophy className="h-14 w-14 text-amber-300 drop-shadow-[0_0_16px_rgba(245,181,27,0.45)]" />
                <div>
                  <p className="text-sm text-muted-foreground">Bonus diario</p>
                  <p className="text-2xl font-bold text-amber-300">{formatMoney(dailyBonus)}</p>
                </div>
              </div>
            </div>
          </Card>

          <section>
            <div className="mb-3">
              <h2 className="text-xl font-semibold">Publicidades disponiveis</h2>
              <p className="text-sm text-muted-foreground">Escolha uma publicidade, compartilhe no seu Instagram e envie o link para validacao.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {campaigns.slice(0, DAILY_GOAL).map((campaign, index) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  index={index + 1}
                  alreadyShared={sharedToday.has(campaign.id)}
                  profileId={profileId}
                  cycleId={cycleId}
                  onSubmitted={refresh}
                />
              ))}
              {campaigns.length === 0 && (
                <Card className="col-span-full border-primary/15 bg-card/50 p-8 text-center text-muted-foreground">
                  Nenhuma campanha ativa no momento.
                </Card>
              )}
            </div>
          </section>

          <Card className="border-primary/15 bg-card/50 p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Minhas publicacoes de hoje</h2>
                <p className="text-sm text-muted-foreground">Acompanhe o status das suas publicacoes enviadas.</p>
              </div>
              <Button variant="outline" onClick={refresh}>
                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="px-3 py-3 text-left font-medium">#</th>
                    <th className="px-3 py-3 text-left font-medium">Publicidade</th>
                    <th className="px-3 py-3 text-left font-medium">Link enviado</th>
                    <th className="px-3 py-3 text-left font-medium">Status</th>
                    <th className="px-3 py-3 text-left font-medium">Enviado em</th>
                    <th className="px-3 py-3 text-left font-medium">Bonus</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, DAILY_GOAL).map((campaign, index) => {
                    const share = sharesToday.find((item) => item.campaign_id === campaign.id);
                    return (
                      <ShareRow
                        key={campaign.id}
                        index={index + 1}
                        campaign={campaign}
                        share={share}
                        dailyBonus={dailyBonus}
                        profileId={profileId}
                        cycleId={cycleId}
                        onSubmitted={refresh}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {advertiserCampaigns.length > 0 && (
            <section>
              <div className="mb-3">
                <h2 className="text-xl font-semibold">Campanhas de anunciantes</h2>
                <p className="text-sm text-muted-foreground">Divulgue campanhas de anunciantes parceiros e envie o link para validacao.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {advertiserCampaigns.map((campaign, index) => (
                  <AdvertiserCampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    index={index + 1}
                    alreadyShared={advertiserShares.some((s) => s.advertiser_campaign_id === campaign.id)}
                    profileId={profileId}
                    cycleId={cycleId}
                    onSubmitted={refresh}
                  />
                ))}
              </div>
            </section>
          )}

          {advertiserShares.length > 0 && (
            <Card className="border-primary/15 bg-card/50 p-5">
              <h2 className="font-semibold mb-3">Minhas submissões — status de verificação</h2>
              <div className="space-y-3">
                {advertiserShares.map((s: any) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-4 py-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <a href={s.shared_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary truncate hover:underline max-w-xs">
                        {s.shared_link} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <span className="text-xs text-muted-foreground">Enviado {new Date(s.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <ClientAutoValidateBadge status={s.auto_validate_status} validateAt={s.auto_validate_at} shareStatus={s.status} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <ProgressPanel progress={progress} approved={approvedCount} remaining={remaining} />
          <HowItWorks />
          <RulesPanel />
        </aside>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, index, alreadyShared, profileId, cycleId, onSubmitted }: {
  campaign: Campaign;
  index: number;
  alreadyShared: boolean;
  profileId: string | null;
  cycleId: string | null;
  onSubmitted: () => void;
}) {
  const color = cardColor(index);
  return (
    <Card className="overflow-hidden border-primary/15 bg-card/50">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <span className="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-md border text-xs font-semibold" style={{ borderColor: color, color, background: `${color}25` }}>
          {index}
        </span>
        {campaign.tipo_midia === "video" ? (
          <video src={campaign.media_url} controls className="h-full w-full object-cover" />
        ) : (
          <img src={campaign.media_url} alt={campaign.titulo} className="h-full w-full object-cover transition duration-300 hover:scale-105" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/95 to-transparent" />
      </div>
      <div className="space-y-3 p-3 text-center">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold">{campaign.titulo}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{campaign.texto_sugerido}</p>
        </div>
        {alreadyShared ? (
          <Badge className="w-full justify-center border-success/30 bg-success/15 py-2 text-success hover:bg-success/15">
            <ShieldCheck className="mr-1 h-3 w-3" /> Enviada hoje
          </Badge>
        ) : (
          <ShareDialog campaign={campaign} profileId={profileId} cycleId={cycleId} onSubmitted={onSubmitted}>
            <Button size="sm" variant="outline" className="w-full" style={{ borderColor: `${color}88`, color }}>
              Usar esta publicidade
            </Button>
          </ShareDialog>
        )}
      </div>
    </Card>
  );
}

function AdvertiserCampaignCard({ campaign, index, alreadyShared, profileId, cycleId, onSubmitted }: {
  campaign: AdvertiserCampaign;
  index: number;
  alreadyShared: boolean;
  profileId: string | null;
  cycleId: string | null;
  onSubmitted: () => void;
}) {
  const color = cardColor(index);
  return (
    <Card className="overflow-hidden border-primary/15 bg-card/50">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {campaign.media_type === "video" ? (
          <video src={campaign.media_url} controls className="h-full w-full object-cover" />
        ) : (
          <img src={campaign.media_url} alt={campaign.title} className="h-full w-full object-cover transition duration-300 hover:scale-105" />
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/95 to-transparent" />
      </div>
      <div className="space-y-3 p-3 text-center">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold">{campaign.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{campaign.caption}</p>
        </div>
        {alreadyShared ? (
          <Badge className="w-full justify-center border-success/30 bg-success/15 py-2 text-success hover:bg-success/15">
            <ShieldCheck className="mr-1 h-3 w-3" /> Enviada
          </Badge>
        ) : (
          <AdvertiserShareDialog campaign={campaign} profileId={profileId} cycleId={cycleId} onSubmitted={onSubmitted}>
            <Button size="sm" variant="outline" className="w-full" style={{ borderColor: `${color}88`, color }}>
              Compartilhar campanha
            </Button>
          </AdvertiserShareDialog>
        )}
      </div>
    </Card>
  );
}

function AdvertiserShareDialog({ campaign, profileId, cycleId, onSubmitted, children }: {
  campaign: AdvertiserCampaign;
  profileId: string | null;
  cycleId: string | null;
  onSubmitted: () => void;
  children: React.ReactNode;
}) {
  const { supabase, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [insta, setInsta] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase || !user || !profileId) return;
    if (!link.trim()) return toast.error("Informe o link do compartilhamento");
    setBusy(true);
    let proofUrl: string | null = null;
    try {
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("share-proofs").upload(path, file);
        if (upErr) throw upErr;
        proofUrl = path;
      }
      const { error } = await supabase.from("campaign_shares").insert({
        user_id: profileId,
        advertiser_campaign_id: campaign.id,
        cycle_id: cycleId,
        proof_url: proofUrl,
        shared_link: link.trim(),
        instagram_usado: insta.trim() || null,
      });
      if (error) throw error;
      toast.success("Compartilhamento enviado para analise");
      setOpen(false);
      setLink("");
      setInsta("");
      setFile(null);
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Enviar link: {campaign.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>A publicação deve permanecer no ar por pelo menos <strong>24 horas</strong> após o envio. Remover antes pode resultar em rejeição e perda do bônus.</span>
          </div>
          <div>
            <Label>Link do post compartilhado *</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://instagram.com/p/..." />
            <p className="mt-1 text-xs text-muted-foreground">
              Link deve ser do Instagram ou X/Twitter e ainda nao pode ter sido usado em outro envio.
            </p>
          </div>
          <div>
            <Label>Instagram usado</Label>
            <Input value={insta} onChange={(e) => setInsta(e.target.value)} placeholder="@seuusuario" />
          </div>
          <div>
            <Label>Print da publicacao (opcional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gold-gradient text-primary-foreground">
            {busy ? "Enviando..." : "Enviar para analise"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareRow({ campaign, share, index, dailyBonus, profileId, cycleId, onSubmitted }: {
  campaign: Campaign;
  share?: Share;
  index: number;
  dailyBonus: number;
  profileId: string | null;
  cycleId: string | null;
  onSubmitted: () => void;
}) {
  return (
    <tr className="border-b border-border/35 last:border-0">
      <td className="px-3 py-3 text-muted-foreground">{index}</td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-3">
          <img src={campaign.media_url} alt="" className="h-10 w-10 rounded-md object-cover" />
          <span className="max-w-[240px] font-medium">{campaign.titulo}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        {share ? (
          <a href={share.shared_link} target="_blank" rel="noreferrer" className="flex max-w-[240px] items-center gap-2 truncate text-muted-foreground hover:text-primary">
            {share.shared_link} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-3 py-3"><StatusBadge status={share?.status ?? "pendente_envio"} /></td>
      <td className="px-3 py-3 text-muted-foreground">{share ? formatTime(share.created_at) : "-"}</td>
      <td className="px-3 py-3">
        {share?.status === "aprovada" ? (
          <span className="font-semibold text-success">{formatMoney(dailyBonus / DAILY_GOAL)}</span>
        ) : share ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <ShareDialog campaign={campaign} profileId={profileId} cycleId={cycleId} onSubmitted={onSubmitted}>
            <Button size="sm" variant="outline">
              <Send className="mr-2 h-4 w-4" /> Enviar link
            </Button>
          </ShareDialog>
        )}
      </td>
    </tr>
  );
}

function ShareDialog({ campaign, profileId, cycleId, onSubmitted, children }: {
  campaign: Campaign;
  profileId: string | null;
  cycleId: string | null;
  onSubmitted: () => void;
  children: React.ReactNode;
}) {
  const { supabase, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [insta, setInsta] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase || !user || !profileId) return;
    if (!link.trim()) return toast.error("Informe o link do compartilhamento");
    setBusy(true);
    let proofUrl: string | null = null;
    try {
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("share-proofs").upload(path, file);
        if (upErr) throw upErr;
        proofUrl = path;
      }
      const { error } = await supabase.from("campaign_shares").insert({
        user_id: profileId,
        campaign_id: campaign.id,
        cycle_id: cycleId,
        proof_url: proofUrl,
        shared_link: link.trim(),
        instagram_usado: insta.trim() || null,
      });
      if (error) throw error;
      toast.success("Compartilhamento enviado para analise");
      setOpen(false);
      setLink("");
      setInsta("");
      setNotes("");
      setFile(null);
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Enviar link: {campaign.titulo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>A publicação deve permanecer no ar por pelo menos <strong>24 horas</strong> após o envio. Remover antes pode resultar em rejeição e perda do bônus.</span>
          </div>
          <div>
            <Label>Link do post compartilhado *</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://instagram.com/p/..." />
            <p className="mt-1 text-xs text-muted-foreground">
              Link deve ser do Instagram ou X/Twitter e ainda nao pode ter sido usado em outro envio.
            </p>
          </div>
          <div>
            <Label>Instagram usado</Label>
            <Input value={insta} onChange={(e) => setInsta(e.target.value)} placeholder="@seuusuario" />
          </div>
          <div>
            <Label>Observacao opcional</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Algo que ajude na validacao" />
          </div>
          <div>
            <Label>Print da publicacao (opcional)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gold-gradient text-primary-foreground">
            {busy ? "Enviando..." : "Enviar para analise"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgressPanel({ progress, approved, remaining }: { progress: number; approved: number; remaining: number }) {
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">Progresso diario</h3>
      <div className="mt-5 flex items-center gap-5">
        <div className="grid h-36 w-36 place-items-center rounded-full" style={{ background: `conic-gradient(#2563eb ${progress * 3.6}deg, rgba(37,99,235,0.18) 0deg)` }}>
          <div className="grid h-28 w-28 place-items-center rounded-full bg-card text-center">
            <div>
              <p className="text-3xl font-bold">{approved}<span className="text-base text-muted-foreground"> / {DAILY_GOAL}</span></p>
              <p className="text-xs text-muted-foreground">aprovadas</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">Faltam {remaining} publicacoes aprovadas para completar seu bonus de hoje.</p>
          <Progress value={progress} className="mt-4 h-2 bg-primary/10" />
          <p className="mt-2 text-sm font-semibold text-primary">{progress}%</p>
        </div>
      </div>
      <Button className="mt-5 w-full bg-primary text-primary-foreground">Ver minhas publicacoes</Button>
    </Card>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Megaphone, title: "Escolha uma publicidade", text: "Selecione uma das opcoes disponiveis para hoje." },
    { icon: Instagram, title: "Compartilhe no Instagram", text: "Publique no feed, stories ou reels em conta publica." },
    { icon: Link2, title: "Envie o link", text: "Cole o link da publicacao para validacao." },
    { icon: Clock, title: "Aguarde a validacao", text: "Nossa equipe analisara sua publicacao." },
    { icon: Star, title: "Ganhe seu bonus", text: "Se aprovado, o bonus sera liberado automaticamente." },
  ];

  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">Como funciona?</h3>
      <div className="mt-5 space-y-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{index + 1}. {step.title}</p>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RulesPanel() {
  const rules = [
    "5 publicacoes aprovadas por dia (obrigatorio)",
    "Conta do Instagram deve ser publica",
    "Nao e permitido editar a publicacao apos o envio do link",
    "Bonus liberado somente apos validacao das 5 publicacoes",
  ];
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">Regras importantes</h3>
      <div className="mt-4 space-y-3">
        {rules.map((rule) => (
          <p key={rule} className="flex gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {rule}
          </p>
        ))}
        <div className="flex items-start gap-2 text-sm">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>A publicação deve ficar no ar por no mínimo <strong>24h</strong>. Remover antes invalida o compartilhamento.</span>
        </div>
      </div>
      <Button variant="outline" className="mt-5 w-full border-primary/30 bg-primary/10 text-primary">
        Duvidas? Fale com nosso suporte!
      </Button>
    </Card>
  );
}

function MetricCard({ label, value, sub, icon: Icon, tone = "primary" }: any) {
  const tones: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-amber-500/15 text-amber-300",
  };
  return (
    <div className="border-r border-border/50 last:border-r-0">
      <div className="flex items-center gap-4 p-3">
        <div className={`rounded-full p-3 ${tones[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "aprovada") {
    return <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15"><ShieldCheck className="mr-1 h-3 w-3" /> Validado</Badge>;
  }
  if (status === "rejeitada") {
    return <Badge className="border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15">Rejeitado</Badge>;
  }
  if (status === "pendente") {
    return <Badge className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/15"><Clock className="mr-1 h-3 w-3" /> Em analise</Badge>;
  }
  return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15">Pendente</Badge>;
}

function cardColor(index: number) {
  return ["#1677ff", "#8b5cf6", "#06b6d4", "#f59e0b", "#22c55e"][index - 1] ?? "#1677ff";
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ClientAutoValidateBadge({ status, validateAt, shareStatus }: { status?: string; validateAt?: string; shareStatus?: string }) {
  if (shareStatus === "aprovada" && (!status || status === "pending")) {
    return <Badge className="border-success/30 bg-success/15 text-success"><ShieldCheck className="mr-1 h-3 w-3" /> Aprovado</Badge>;
  }
  if (shareStatus === "rejeitada") {
    return <Badge className="border-destructive/30 bg-destructive/15 text-destructive">Rejeitado</Badge>;
  }
  if (!status || status === "pending") {
    if (!validateAt) return <Badge variant="outline" className="text-muted-foreground"><Clock className="mr-1 h-3 w-3" /> Aguardando análise</Badge>;
    const msLeft = new Date(validateAt).getTime() - Date.now();
    if (msLeft > 0) {
      const h = Math.ceil(msLeft / 3600000);
      return (
        <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300">
          <Clock className="mr-1 h-3 w-3" /> Verificação automática em {h}h
        </Badge>
      );
    }
    return <Badge className="border-primary/30 bg-primary/15 text-primary"><Sparkles className="mr-1 h-3 w-3" /> Verificando link...</Badge>;
  }
  if (status === "live") return <Badge className="border-success/30 bg-success/15 text-success"><ShieldCheck className="mr-1 h-3 w-3" /> ✓ Post verificado — ativo</Badge>;
  if (status === "removed") return <Badge className="border-destructive/30 bg-destructive/15 text-destructive">⚠ Post removido detectado</Badge>;
  if (status === "story_manual") return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300"><Clock className="mr-1 h-3 w-3" /> Story: aguardando análise manual</Badge>;
  if (status === "private") return <Badge className="border-primary/30 bg-primary/15 text-primary">Perfil privado — análise manual</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Em análise</Badge>;
}
