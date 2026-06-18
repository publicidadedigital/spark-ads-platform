import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useLanguage } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Megaphone, QrCode, Share2, Sparkles, Building2, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/indicacao-anunciante")({ component: IndicacaoAnunciantePage });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type Advertiser = {
  id: string;
  company_name: string | null;
  status: string | null;
  created_at: string | null;
};

type BonusEvent = {
  id: string;
  created_at: string | null;
  gross_amount: number;
  referrer_bonus: number;
  status: string;
  available_at: string | null;
  motivo: string | null;
  advertiser: { company_name: string | null } | { company_name: string | null }[] | null;
};

function getStatusMeta(t: (key: string) => string): Record<string, { label: string; className: string }> {
  return {
    ativo: { label: t("advertiserReferral.statusActive"), className: "border-success/30 bg-success/15 text-success hover:bg-success/15" },
    pendente: { label: t("advertiserReferral.statusInReview"), className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
    bloqueado: { label: t("advertiserReferral.statusBlocked"), className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
  };
}

function IndicacaoAnunciantePage() {
  const { t } = useLanguage();
  const statusMeta = getStatusMeta(t);
  const { supabase, user } = useAuth();
  const [profile, setProfile] = useState<{ id: string; nome: string | null } | null>(null);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [bonusEvents, setBonusEvents] = useState<BonusEvent[]>([]);
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

      // Release any bonuses whose 7-day hold has elapsed
      await supabase.rpc("release_due_advertiser_bonuses");

      const [{ data: ads }, { data: bonuses }] = await Promise.all([
        supabase
          .from("advertiser_profiles")
          .select("id,company_name,status,created_at")
          .eq("indicador_id", prof.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("advertiser_bonus_events")
          .select("id,created_at,gross_amount,referrer_bonus,status,available_at,motivo,advertiser:advertiser_id(company_name)")
          .eq("referrer_user_id", prof.id)
          .order("created_at", { ascending: false }),
      ]);

      setAdvertisers(ads ?? []);
      setBonusEvents((bonuses ?? []) as BonusEvent[]);
      setLoading(false);
    })();
  }, [supabase, user]);

  const link = profile && typeof window !== "undefined"
    ? `${window.location.origin}/cadastro?ref=${profile.id}&tipo=anunciante`
    : "";

  const totalRecebido = bonusEvents
    .filter((b) => b.status === "liberado")
    .reduce((sum, b) => sum + Number(b.referrer_bonus ?? 0), 0);

  const totalPendente = bonusEvents
    .filter((b) => b.status === "pendente")
    .reduce((sum, b) => sum + Number(b.referrer_bonus ?? 0), 0);

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success(t("advertiserReferral.linkCopied"));
  };

  const shareLink = async () => {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: t("advertiserReferral.shareTitle"), text: t("advertiserReferral.shareText"), url: link });
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
              <Megaphone className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-normal">{t("advertiserReferral.title")}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("advertiserReferral.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={shareLink} className="bg-gold-gradient text-primary-foreground">
            <Share2 className="mr-2 h-4 w-4" /> {t("advertiserReferral.shareLink")}
          </Button>
          <Button variant="outline" onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4" /> {t("advertiserReferral.copyLink")}
          </Button>
          <Button variant="outline" onClick={copyLink}>
            <QrCode className="mr-2 h-4 w-4" /> {t("advertiserReferral.qrCode")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Building2} label={t("advertiserReferral.referredAdvertisers")} value={advertisers.length.toString()} sub={t("advertiserReferral.companies")} />
        <MetricCard icon={CheckCircle2} label={t("advertiserReferral.releasedCommission")} value={usd.format(totalRecebido)} sub={t("advertiserReferral.totalReceived")} />
        <MetricCard icon={Clock} label={t("advertiserReferral.waitingRelease")} value={usd.format(totalPendente)} sub={t("advertiserReferral.inQuarantine")} />
        <MetricCard icon={Megaphone} label={t("advertiserReferral.totalEvents")} value={bonusEvents.length.toString()} sub={t("advertiserReferral.payments")} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden border-primary/20 bg-card/50">
          <div className="border-b border-border/60 p-5">
            <h2 className="text-lg font-semibold">{t("advertiserReferral.referredAdvertisersTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("advertiserReferral.companiesRegistered")}</p>
          </div>
          <div className="p-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">{t("advertiserReferral.loading")}</p>
            ) : advertisers.length === 0 ? (
              <EmptyState text={t("advertiserReferral.noAdvertisersYet")} />
            ) : (
              <div className="space-y-3">
                {advertisers.map((ad) => {
                  const meta = statusMeta[ad.status ?? ""] ?? { label: ad.status ?? "-", className: "" };
                  return (
                    <div key={ad.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{ad.company_name || t("advertiserReferral.advertiser")}</p>
                        <p className="text-xs text-muted-foreground">
                          {ad.created_at ? new Date(ad.created_at).toLocaleDateString("pt-BR") : "-"}
                        </p>
                      </div>
                      <Badge className={meta.className}>{meta.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden border-primary/20 bg-card/50">
          <div className="border-b border-border/60 p-5">
            <h2 className="text-lg font-semibold">{t("advertiserReferral.commissions")}</h2>
            <p className="text-sm text-muted-foreground">{t("advertiserReferral.commissionsDesc")}</p>
          </div>
          <div className="p-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">{t("advertiserReferral.loading")}</p>
            ) : bonusEvents.length === 0 ? (
              <EmptyState text={t("advertiserReferral.noCommissionsYet")} />
            ) : (
              <div className="space-y-3">
                {bonusEvents.map((b) => {
                  const advertiser = Array.isArray(b.advertiser) ? b.advertiser[0] : b.advertiser;
                  const daysLeft = b.available_at
                    ? Math.max(0, Math.ceil((new Date(b.available_at).getTime() - Date.now()) / 86_400_000))
                    : null;
                  return (
                    <div key={b.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{advertiser?.company_name || t("advertiserReferral.advertiser")}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.created_at ? new Date(b.created_at).toLocaleDateString("pt-BR") : "-"} · {t("advertiserReferral.package")} {usd.format(Number(b.gross_amount ?? 0))}
                        </p>
                        {b.motivo && (
                          <p className="mt-1 text-xs text-muted-foreground italic">{b.motivo}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-semibold ${b.status === "cancelado" ? "text-destructive line-through" : "text-success"}`}>
                          +{usd.format(Number(b.referrer_bonus ?? 0))}
                        </p>
                        <BonusStatusBadge status={b.status} daysLeft={daysLeft} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
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

function BonusStatusBadge({ status, daysLeft }: { status: string; daysLeft: number | null }) {
  const { t } = useLanguage();
  if (status === "liberado") {
    return (
      <Badge className="mt-1 border-success/30 bg-success/15 text-success hover:bg-success/15">
        <CheckCircle2 className="mr-1 h-3 w-3" /> {t("advertiserReferral.released")}
      </Badge>
    );
  }
  if (status === "cancelado") {
    return (
      <Badge className="mt-1 border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15">
        <XCircle className="mr-1 h-3 w-3" /> {t("advertiserReferral.canceled")}
      </Badge>
    );
  }
  // pendente
  return (
    <Badge className="mt-1 border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15">
      <Clock className="mr-1 h-3 w-3" />
      {daysLeft !== null && daysLeft > 0 ? t("advertiserReferral.releasesIn").replace("{n}", String(daysLeft)) : t("advertiserReferral.processing")}
    </Badge>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-background/60 px-8 py-10 text-center">
      <Megaphone className="mx-auto mb-3 h-8 w-8 text-primary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
