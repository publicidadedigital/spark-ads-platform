import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useLanguage } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { calculateDailyShareBonus } from "@/lib/business/rules";
import {
  Check,
  CircleHelp,
  Clock,
  Download,
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
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [advertiserCampaigns, setAdvertiserCampaigns] = useState<AdvertiserCampaign[]>([]);
  const [advertiserShares, setAdvertiserShares] = useState<Share[]>([]);
  const [sharesToday, setSharesToday] = useState<Share[]>([]);
  const [monthBonuses, setMonthBonuses] = useState<Bonus[]>([]);
  const [dailyBonusByDay, setDailyBonusByDay] = useState<Record<string, string>>({});
  const [historyShares, setHistoryShares] = useState<Share[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [registeredInstagram, setRegisteredInstagram] = useState<string>("");
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
      .select("id,instagram")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!prof) {
      setLoading(false);
      return;
    }

    setProfileId(prof.id);
    setRegisteredInstagram(prof.instagram ?? "");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today);
    monthStart.setDate(1);

    const [{ data: cycle }, { data: cs }, { data: shares }, { data: bonuses }, { data: advCampaigns }, { data: advShares }, { data: history }, { data: allDailyBonuses }] = await Promise.all([
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
        .select("valor,created_at,status")
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
        .not("advertiser_campaign_id", "is", null)
        .gte("created_at", today.toISOString()),
      supabase
        .from("campaign_shares")
        .select("id,campaign_id,shared_link,status,motivo_rejeicao,created_at,campaigns:campaign_id(titulo,media_url,tipo_midia)")
        .eq("user_id", prof.id)
        .not("campaign_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("bonuses")
        .select("status,created_at,operational_day")
        .eq("user_id", prof.id)
        .eq("tipo", "diario")
        .order("created_at", { ascending: false })
        .limit(90),
    ]);

    const activeCycle = cycle as ActiveCycle | null;
    setCycleId(activeCycle?.id ?? null);
    setCyclePackageValue(Number(activeCycle?.valor_pacote ?? 0));
    setCampaigns((cs ?? []) as Campaign[]);
    setSharesToday((shares ?? []) as unknown as Share[]);
    setMonthBonuses((bonuses ?? []) as Bonus[]);
    setAdvertiserCampaigns((advCampaigns ?? []) as AdvertiserCampaign[]);
    setAdvertiserShares((advShares ?? []) as unknown as Share[]);
    setHistoryShares((history ?? []) as unknown as Share[]);
    const bonusByDay: Record<string, string> = {};
    for (const b of (allDailyBonuses ?? []) as any[]) {
      const day = b.operational_day ?? b.created_at?.slice(0, 10);
      if (day && !bonusByDay[day]) bonusByDay[day] = b.status;
    }
    setDailyBonusByDay(bonusByDay);
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
  const currentStreak = approvedCount;

  if (loading) return <p className="text-muted-foreground">{t("campaigns.loading")}</p>;

  if (!cycleId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full text-center bg-card/60 border-border/50 p-8 space-y-4">
          <div className="flex items-center justify-center rounded-full bg-primary/10 w-16 h-16 mx-auto">
            <Megaphone className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">{t("campaigns.activateTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("campaigns.activateDesc")}
          </p>
          <Link to="/app">
            <Button className="w-full bg-primary text-primary-foreground">{t("campaigns.viewAvailablePackages")}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <div className="min-w-0 space-y-4">
          <Card className="border-primary/15 bg-card/50 p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-normal">{t("campaigns.title")}</h1>
                <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  {t("campaigns.subtitle").replace("{n}", String(DAILY_GOAL))}
                  <CircleHelp className="h-4 w-4" />
                </p>
              </div>
              <Button variant="outline" className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/15">
                <CircleHelp className="mr-2 h-4 w-4" /> {t("campaigns.howItWorksBtn")}
              </Button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 min-[1400px]:grid-cols-4">
              <MetricCard label={t("campaigns.approvedToday")} value={`${approvedCount} / ${DAILY_GOAL}`} sub={t("campaigns.remainingToComplete").replace("{n}", String(remaining))} icon={Megaphone} />
              <MetricCard label={t("campaigns.dailyBonus")} value={formatMoney(dailyBonus)} sub={t("campaigns.uponCompleting").replace("{n}", String(DAILY_GOAL))} icon={Wallet} tone="success" />
              <MetricCard label={t("campaigns.approvedTodayShort")} value={`${approvedCount} / ${DAILY_GOAL}`} sub={approvedCount >= DAILY_GOAL ? t("campaigns.goalCompleted") : t("campaigns.missing").replace("{n}", String(remaining))} icon={Flame} tone="warning" />
              <MetricCard label={t("campaigns.totalEarned")} value={formatMoney(totalGanho)} sub={t("campaigns.thisMonth")} icon={Sparkles} tone="success" />
            </div>
          </Card>

          <Card className="border-violet-500/35 bg-[radial-gradient(circle_at_right,rgba(245,181,27,0.22),transparent_28%),linear-gradient(90deg,rgba(88,28,135,0.55),rgba(2,6,23,0.55))] p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="shrink-0">
                <h2 className="font-semibold">{t("campaigns.completeDailyAds").replace("{n}", String(DAILY_GOAL))}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("campaigns.ensureFullBonus")}</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1">
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
                      {index < DAILY_GOAL - 1 && <div className={`h-px w-6 ${approvedCount > index + 1 ? "bg-success" : "bg-primary/30"}`} />}
                    </div>
                  );
                })}
              </div>
              <div className="flex shrink-0 items-center justify-center gap-3 border-t border-primary/20 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <Trophy className="h-12 w-12 text-amber-300 drop-shadow-[0_0_16px_rgba(245,181,27,0.45)]" />
                <div>
                  <p className="text-sm text-muted-foreground">{t("campaigns.dailyBonusLabel")}</p>
                  <p className="text-2xl font-bold text-amber-300">{formatMoney(dailyBonus)}</p>
                </div>
              </div>
            </div>
          </Card>

          <section>
            <div className="mb-3">
              <h2 className="text-xl font-semibold">{t("campaigns.availableAds")}</h2>
              <p className="text-sm text-muted-foreground">{t("campaigns.chooseAdDesc")}</p>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {campaigns.map((campaign, index) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  index={index + 1}
                  alreadyShared={sharedToday.has(campaign.id)}
                  profileId={profileId}
                  cycleId={cycleId}
                  registeredInstagram={registeredInstagram}
                  onSubmitted={refresh}
                />
              ))}
              {campaigns.length === 0 && (
                <Card className="col-span-full border-primary/15 bg-card/50 p-8 text-center text-muted-foreground">
                  {t("campaigns.noActiveCampaigns")}
                </Card>
              )}
            </div>
          </section>


          {advertiserCampaigns.length > 0 && (
            <section>
              <div className="mb-3">
                <h2 className="text-xl font-semibold">{t("campaigns.advertiserCampaigns")}</h2>
                <p className="text-sm text-muted-foreground">{t("campaigns.advertiserCampaignsDesc")}</p>
              </div>
              <div className="grid min-w-0 grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2.5">
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
              <h2 className="font-semibold mb-3">{t("campaigns.mySubmissions")}</h2>
              <div className="space-y-3">
                {advertiserShares.map((s: any) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-4 py-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <a href={s.shared_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-primary truncate hover:underline max-w-xs">
                        {s.shared_link} <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <span className="text-xs text-muted-foreground">{t("campaigns.sentAt")} {new Date(s.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <ClientAutoValidateBadge status={s.auto_validate_status} validateAt={s.auto_validate_at} shareStatus={s.status} />
                  </div>
                ))}
              </div>
            </Card>
          )}
          {historyShares.length > 0 && (
            <Card className="border-primary/15 bg-card/50 p-5">
              <h2 className="font-semibold mb-3">{t("campaigns.historyTitle")}</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <th className="px-3 py-2 text-left font-medium">{t("campaigns.colAd")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("campaigns.colLinkSent")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("campaigns.colStatus")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("campaigns.colSentAt")}</th>
                      <th className="px-3 py-2 text-left font-medium">Bônus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyShares.map((s) => {
                      const camp = (s as any).campaigns;
                      const day = s.created_at?.slice(0, 10);
                      const todayStr = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time
                      const isToday = day === todayStr;
                      const bonusStatus = day ? dailyBonusByDay[day] : undefined;
                      return (
                        <tr key={s.id} className="border-b border-border/30 last:border-0">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {camp?.media_url && <img src={camp.media_url} alt="" className="h-8 w-8 rounded object-cover" />}
                              <span className="max-w-[180px] truncate font-medium">{camp?.titulo ?? "—"}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <a href={s.shared_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 max-w-[200px] truncate text-muted-foreground hover:text-primary">
                              {s.shared_link} <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={s.status} />
                            {s.motivo_rejeicao && (
                              <p className="mt-1 text-xs text-destructive">{s.motivo_rejeicao}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatTime(s.created_at)}</td>
                          <td className="px-3 py-2">
                            {bonusStatus === "liberado" ? (
                              <span className="text-xs font-medium text-success">Liberado</span>
                            ) : s.status === "pendente" || bonusStatus === "pendente" || isToday ? (
                              <span className="text-xs font-medium text-amber-300">Pendente</span>
                            ) : (
                              <span className="text-xs font-medium text-destructive">Rejeitado</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <ProgressPanel progress={progress} approved={approvedCount} remaining={remaining} />
          <HowItWorks />
          <RulesPanel />
        </aside>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, index, alreadyShared, profileId, cycleId, registeredInstagram, onSubmitted }: {
  campaign: Campaign;
  index: number;
  alreadyShared: boolean;
  profileId: string | null;
  cycleId: string | null;
  registeredInstagram: string;
  onSubmitted: () => void;
}) {
  const { t } = useLanguage();
  const color = cardColor(index);
  const ext = campaign.tipo_midia === "video" ? "mp4" : "jpg";
  return (
    <Card className="min-w-0 overflow-hidden border-primary/15 bg-card/50">
      <div className="relative aspect-[4/3] w-full min-w-0 overflow-hidden bg-black/40">
        <span className="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-md border text-xs font-semibold" style={{ borderColor: color, color, background: `${color}25` }}>
          {index}
        </span>
        {campaign.tipo_midia === "video" ? (
          <video src={campaign.media_url} controls className="h-full w-full object-contain" />
        ) : (
          <img src={campaign.media_url} alt={campaign.titulo} className="h-full w-full object-contain" />
        )}
      </div>
      <div className="space-y-3 p-3 text-center">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold">{campaign.titulo}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{campaign.texto_sugerido}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-full gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => downloadMedia(campaign.media_url, `${campaign.titulo.replace(/\s+/g, "-")}.${ext}`)}
        >
          <Download className="h-3.5 w-3.5" /> {t("campaigns.download")} {campaign.tipo_midia === "video" ? t("campaigns.downloadVideo") : t("campaigns.downloadImage")}
        </Button>
        {!alreadyShared && (
          <InstagramShareGuide
            onShare={() => shareToInstagram(campaign.media_url, `${campaign.titulo.replace(/\s+/g, "-")}.${ext}`, campaign.tipo_midia === "video" ? "video/mp4" : "image/jpeg", t("campaigns.shareInstagramFallback"))}
          >
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-full gap-1.5 border-pink-400/40 text-xs text-pink-300 hover:bg-pink-500/10"
            >
              <Instagram className="h-3.5 w-3.5" /> {t("campaigns.shareInstagram")}
            </Button>
          </InstagramShareGuide>
        )}
        {alreadyShared ? (
          <Badge className="w-full justify-center border-success/30 bg-success/15 py-2 text-success hover:bg-success/15">
            <ShieldCheck className="mr-1 h-3 w-3" /> {t("campaigns.sentToday")}
          </Badge>
        ) : (
          <ShareDialog campaign={campaign} profileId={profileId} cycleId={cycleId} registeredInstagram={registeredInstagram} onSubmitted={onSubmitted}>
            <Button size="sm" variant="outline" className="w-full" style={{ borderColor: `${color}88`, color }}>
              {t("campaigns.useThisAd")}
            </Button>
          </ShareDialog>
        )}
      </div>
    </Card>
  );
}

async function downloadMedia(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank");
  }
}

async function shareToInstagram(url: string, filename: string, mimeType: string, fallbackMessage: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type || mimeType });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
      return;
    }
    throw new Error("share-unsupported");
  } catch (e: any) {
    if (e?.name === "AbortError") return;
    await downloadMedia(url, filename);
    toast.info(fallbackMessage);
  }
}

function InstagramShareGuide({ onShare, children }: { onShare: () => void | Promise<void>; children: React.ReactNode }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      await onShare();
      toast.warning(t("campaigns.shareGuideWarning"));
    } finally {
      setSharing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("campaigns.shareGuideTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t("campaigns.shareGuideIntro")}</p>

          <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
            <p className="font-semibold text-foreground">{t("campaigns.shareGuideFeedTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("campaigns.shareGuideFeedSteps")}</p>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
            <p className="font-semibold text-foreground">{t("campaigns.shareGuideStoriesTitle")}</p>
            <p className="mt-1 text-muted-foreground">{t("campaigns.shareGuideStoriesSteps")}</p>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-amber-200">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t("campaigns.shareGuideWarning")}</span>
          </div>

          <Button onClick={handleShare} disabled={sharing} className="w-full gap-1.5 bg-pink-500 text-white hover:bg-pink-600">
            <Instagram className="h-4 w-4" /> {t("campaigns.shareGuideAction")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
  const { t } = useLanguage();
  const color = cardColor(index);
  const ext = campaign.media_type === "video" ? "mp4" : "jpg";
  return (
    <Card className="min-w-0 overflow-hidden border-primary/15 bg-card/50">
      <div className="relative aspect-square w-full min-w-0 overflow-hidden bg-black/40">
        {campaign.media_type === "video" ? (
          <video src={campaign.media_url} controls className="h-full w-full object-contain" />
        ) : (
          <img src={campaign.media_url} alt={campaign.title} className="h-full w-full object-contain" />
        )}
      </div>
      <div className="space-y-2 p-2.5 text-center">
        <div>
          <h3 className="line-clamp-1 text-xs font-semibold">{campaign.title}</h3>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{campaign.caption}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-full gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => downloadMedia(campaign.media_url, `${campaign.title.replace(/\s+/g, "-")}.${ext}`)}
        >
          <Download className="h-3 w-3" /> {t("campaigns.download")} {campaign.media_type === "video" ? t("campaigns.downloadVideo") : t("campaigns.downloadImage")}
        </Button>
        {alreadyShared ? (
          <Badge className="h-7 w-full justify-center border-success/30 bg-success/15 text-[11px] text-success hover:bg-success/15">
            <ShieldCheck className="mr-1 h-3 w-3" /> {t("campaigns.sentBadge")}
          </Badge>
        ) : (
          <AdvertiserShareDialog campaign={campaign} profileId={profileId} cycleId={cycleId} onSubmitted={onSubmitted}>
            <Button size="sm" variant="outline" className="h-auto min-h-7 w-full whitespace-normal px-1 py-1 text-[9px] leading-[1.1]" style={{ borderColor: `${color}88`, color }}>
              {t("campaigns.shareCampaign")}
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
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [insta, setInsta] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase || !user || !profileId) return;
    if (!link.trim()) return toast.error(t("campaigns.linkRequired"));
    setBusy(true);
    try {
      const { data: inserted, error } = await supabase.from("campaign_shares").insert({
        user_id: profileId,
        advertiser_campaign_id: campaign.id,
        cycle_id: cycleId,
        shared_link: link.trim(),
        instagram_usado: insta.trim() || null,
      }).select("id").single();
      if (error) throw error;

      // Immediate link check: rejects right away if post is not found or profile is private
      const { data: checkResult } = await supabase.functions.invoke("validate-share-links", {
        body: { shareId: inserted.id },
      });
      if (checkResult?.validateStatus === "removed") {
        throw new Error(t("campaigns.linkNotFound"));
      }
      if (checkResult?.validateStatus === "private") {
        throw new Error(t("campaigns.profilePrivate"));
      }

      toast.success(t("campaigns.sentForAnalysisToast"));
      setOpen(false);
      setLink("");
      setInsta("");
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message || t("campaigns.sendError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("campaigns.sendLinkTitle").replace("{title}", campaign.title)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t("campaigns.postLiveWarning").replace("{hours}", t("campaigns.postLiveHours"))}</span>
          </div>
          <div>
            <Label>{t("campaigns.linkLabel")}</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder={t("campaigns.linkPlaceholder")} />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("campaigns.linkHelp")}
            </p>
          </div>
          <div>
            <Label>{t("campaigns.instagramUsed")}</Label>
            <Input value={insta} onChange={(e) => setInsta(e.target.value)} placeholder={t("campaigns.instagramPlaceholder")} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gold-gradient text-primary-foreground">
            {busy ? t("campaigns.sending") : t("campaigns.sendForAnalysis")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareRow({ campaign, share, index, dailyBonus, profileId, cycleId, registeredInstagram, onSubmitted }: {
  campaign: Campaign;
  share?: Share;
  index: number;
  dailyBonus: number;
  profileId: string | null;
  cycleId: string | null;
  registeredInstagram?: string;
  onSubmitted: () => void;
}) {
  const { t } = useLanguage();
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
          <ShareDialog campaign={campaign} profileId={profileId} cycleId={cycleId} registeredInstagram={registeredInstagram} onSubmitted={onSubmitted}>
            <Button size="sm" variant="outline">
              <Send className="mr-2 h-4 w-4" /> {t("campaigns.sendLink")}
            </Button>
          </ShareDialog>
        )}
      </td>
    </tr>
  );
}

function ShareDialog({ campaign, profileId, cycleId, registeredInstagram, onSubmitted, children }: {
  campaign: Campaign;
  profileId: string | null;
  cycleId: string | null;
  registeredInstagram?: string;
  onSubmitted: () => void;
  children: React.ReactNode;
}) {
  const { supabase, user } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const insta = registeredInstagram ?? "";
  const [notes, setNotes] = useState("");
  const [postType, setPostType] = useState<"feed" | "stories" | "">("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase || !user || !profileId) return;
    if (!link.trim()) return toast.error(t("campaigns.linkRequired"));
    if (!postType) return toast.error(t("campaigns.postTypeRequired"));
    setBusy(true);
    try {
      const { data: inserted, error } = await supabase.from("campaign_shares").insert({
        user_id: profileId,
        campaign_id: campaign.id,
        cycle_id: cycleId,
        shared_link: link.trim(),
        instagram_usado: insta.trim() || null,
        post_type: postType,
      }).select("id").single();
      if (error) throw error;

      // Immediate link check: rejects right away if post is not found or profile is private
      const { data: checkResult } = await supabase.functions.invoke("validate-share-links", {
        body: { shareId: inserted.id },
      });
      if (checkResult?.validateStatus === "removed") {
        throw new Error(t("campaigns.linkNotFound"));
      }
      if (checkResult?.validateStatus === "private") {
        throw new Error(t("campaigns.profilePrivate"));
      }

      toast.success(t("campaigns.sentForAnalysisToast"));
      setOpen(false);
      setLink("");
      setNotes("");
      setPostType("");
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message || t("campaigns.sendError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("campaigns.sendLinkTitle").replace("{title}", campaign.titulo)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            <Clock className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t("campaigns.postLiveWarning").replace("{hours}", t("campaigns.postLiveHours"))}</span>
          </div>
          <div>
            <Label>{t("campaigns.postTypeLabel")}</Label>
            <ToggleGroup type="single" value={postType} onValueChange={(v) => setPostType(v as "feed" | "stories" | "")} className="mt-1 justify-start gap-2">
              <ToggleGroupItem value="feed" variant="outline" className="flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
                {t("campaigns.postTypeFeed")}
              </ToggleGroupItem>
              <ToggleGroupItem value="stories" variant="outline" className="flex-1 data-[state=on]:border-primary data-[state=on]:bg-primary/15 data-[state=on]:text-primary">
                {t("campaigns.postTypeStories")}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div>
            <Label>{t("campaigns.linkLabel")}</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder={t("campaigns.linkPlaceholder")} />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("campaigns.linkHelp")}
            </p>
          </div>
          <div>
            <Label>{t("campaigns.instagramUsed")}</Label>
            <Input value={insta} disabled readOnly placeholder={t("campaigns.instagramPlaceholder")} />
          </div>
          <div>
            <Label>{t("campaigns.optionalNote")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("campaigns.optionalNotePlaceholder")} />
          </div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gold-gradient text-primary-foreground">
            {busy ? t("campaigns.sending") : t("campaigns.sendForAnalysis")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgressPanel({ progress, approved, remaining }: { progress: number; approved: number; remaining: number }) {
  const { t } = useLanguage();
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">{t("campaigns.dailyProgress")}</h3>
      <div className="mt-5 flex items-center gap-5">
        <div className="grid h-36 w-36 place-items-center rounded-full" style={{ background: `conic-gradient(#2563eb ${progress * 3.6}deg, rgba(37,99,235,0.18) 0deg)` }}>
          <div className="grid h-28 w-28 place-items-center rounded-full bg-card text-center">
            <div>
              <p className="text-3xl font-bold">{approved}<span className="text-base text-muted-foreground"> / {DAILY_GOAL}</span></p>
              <p className="text-xs text-muted-foreground">{t("campaigns.approved")}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{t("campaigns.remainingApprovedForBonus").replace("{n}", String(remaining))}</p>
          <Progress value={progress} className="mt-4 h-2 bg-primary/10" />
          <p className="mt-2 text-sm font-semibold text-primary">{progress}%</p>
        </div>
      </div>
      <Button
        className="mt-5 w-full bg-primary text-primary-foreground"
        onClick={() => document.getElementById("minhas-publicacoes")?.scrollIntoView({ behavior: "smooth", block: "start" })}
      >
        {t("campaigns.viewMyPosts")}
      </Button>
    </Card>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  const steps = [
    { icon: Megaphone, title: t("campaigns.step1Title"), text: t("campaigns.step1Text") },
    { icon: Instagram, title: t("campaigns.step2Title"), text: t("campaigns.step2Text") },
    { icon: Link2, title: t("campaigns.step3Title"), text: t("campaigns.step3Text") },
    { icon: Clock, title: t("campaigns.step4Title"), text: t("campaigns.step4Text") },
    { icon: Star, title: t("campaigns.step5Title"), text: t("campaigns.step5Text") },
  ];

  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">{t("campaigns.howItWorksTitle")}</h3>
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
  const { t } = useLanguage();
  const rules = [
    t("campaigns.rule1"),
    t("campaigns.rule2"),
    t("campaigns.rule3"),
    t("campaigns.rule4"),
  ];
  return (
    <Card className="border-primary/15 bg-card/50 p-5">
      <h3 className="font-semibold">{t("campaigns.importantRules")}</h3>
      <div className="mt-4 space-y-3">
        {rules.map((rule) => (
          <p key={rule} className="flex gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {rule}
          </p>
        ))}
        <div className="flex items-start gap-2 text-sm">
          <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{t("campaigns.postLiveRuleNote").replace("{hours}", t("campaigns.minHours"))}</span>
        </div>
      </div>
      <Button variant="outline" className="mt-5 w-full border-primary/30 bg-primary/10 text-primary">
        {t("campaigns.support")}
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
  const { t } = useLanguage();
  if (status === "aprovada") {
    return <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15"><ShieldCheck className="mr-1 h-3 w-3" /> {t("campaigns.statusValidated")}</Badge>;
  }
  if (status === "rejeitada") {
    return <Badge className="border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15">{t("campaigns.statusRejected")}</Badge>;
  }
  if (status === "pendente") {
    return <Badge className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/15"><Clock className="mr-1 h-3 w-3" /> {t("campaigns.statusInAnalysis")}</Badge>;
  }
  return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15">{t("campaigns.statusPending")}</Badge>;
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
  const { t } = useLanguage();
  if (shareStatus === "aprovada" && (!status || status === "pending")) {
    return <Badge className="border-success/30 bg-success/15 text-success"><ShieldCheck className="mr-1 h-3 w-3" /> {t("campaigns.autoValidateApproved")}</Badge>;
  }
  if (shareStatus === "rejeitada") {
    return <Badge className="border-destructive/30 bg-destructive/15 text-destructive">{t("campaigns.statusRejected")}</Badge>;
  }
  if (!status || status === "pending") {
    if (!validateAt) return <Badge variant="outline" className="text-muted-foreground"><Clock className="mr-1 h-3 w-3" /> {t("campaigns.autoValidatePending")}</Badge>;
    const msLeft = new Date(validateAt).getTime() - Date.now();
    if (msLeft > 0) {
      const h = Math.ceil(msLeft / 3600000);
      return (
        <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300">
          <Clock className="mr-1 h-3 w-3" /> {t("campaigns.autoValidateCheckingIn").replace("{h}", String(h))}
        </Badge>
      );
    }
    return <Badge className="border-primary/30 bg-primary/15 text-primary"><Sparkles className="mr-1 h-3 w-3" /> {t("campaigns.autoValidateChecking")}</Badge>;
  }
  if (status === "live") return <Badge className="border-success/30 bg-success/15 text-success"><ShieldCheck className="mr-1 h-3 w-3" /> ✓ {t("campaigns.autoValidateLive")}</Badge>;
  if (status === "removed") return <Badge className="border-destructive/30 bg-destructive/15 text-destructive">⚠ {t("campaigns.autoValidateRemoved")}</Badge>;
  if (status === "story_manual") return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300"><Clock className="mr-1 h-3 w-3" /> {t("campaigns.autoValidateStoryManual")}</Badge>;
  if (status === "private") return <Badge className="border-destructive/30 bg-destructive/15 text-destructive">⚠ {t("campaigns.autoValidatePrivate")}</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">{t("campaigns.autoValidateInAnalysis")}</Badge>;
}
