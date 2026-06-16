import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Clock, ExternalLink, Zap, Bot, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/provas")({
  validateSearch: (s) => ({ campaignId: (s.campaignId as string) || "" }),
  component: AdminProvas,
});

function hoursAgo(createdAt: string) {
  const h = Math.floor((Date.now() - new Date(createdAt).getTime()) / 3600000);
  if (h < 24) return { label: `${h}h de publicação`, warn: true };
  const d = Math.floor(h / 24);
  return { label: `${d}d ${h % 24}h online`, warn: false };
}

function AdminProvas() {
  const { supabase, user } = useAuth();
  const { campaignId } = Route.useSearch();
  const [items, setItems] = useState<any[]>([]);
  const [motivos, setMotivos] = useState<Record<string,string>>({});

  async function load() {
    if (!supabase) return;
    let query = supabase
      .from("campaign_shares")
      .select("*, profile:user_id(nome, instagram, seguidores_instagram), campaign:campaign_id(titulo), advertiser_campaign:advertiser_campaign_id(title), auto_validate_status, auto_validate_checked_at, auto_validate_detail")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    if (campaignId) query = query.eq("advertiser_campaign_id", campaignId);
    const { data } = await query;
    setItems(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase, campaignId]);

  async function approve(item: any) {
    if (!supabase) return;
    const { warn } = hoursAgo(item.created_at);
    if (warn) {
      toast.warning("Atenção: publicação com menos de 24h. Aprovando assim mesmo.");
    }
    const { error } = await supabase.from("campaign_shares")
      .update({ status: "aprovada", reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", item.id);
    if (error) return toast.error(error.message);

    if (item.advertiser_campaign_id) {
      const followers = Number(item.detected_followers || item.profile?.seguidores_instagram || 0);
      const { error: eventError } = await supabase.from("advertiser_campaign_events").insert({
        advertiser_campaign_id: item.advertiser_campaign_id,
        campaign_share_id: item.id,
        user_id: item.user_id,
        social_network: item.social_network ?? "instagram",
        followers_snapshot: followers,
        estimated_views: Math.max(followers, 100),
      });
      if (eventError) toast.error(`Aprovada, mas falhou ao registrar evento: ${eventError.message}`);
    }

    toast.success("Aprovada");
    load();
  }
  async function reject(id: string) {
    if (!supabase) return;
    const motivo = motivos[id] || "Não cumpre as regras";
    const { error } = await supabase.from("campaign_shares")
      .update({ status: "rejeitada", motivo_rejeicao: motivo, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Rejeitada");
    load();
  }

  async function removeFraud(id: string) {
    if (!supabase) return;
    const motivo = motivos[id] || "Envio fraudulento";
    const { error } = await supabase.from("campaign_shares")
      .update({ status: "removida", motivo_rejeicao: motivo, removed_at: new Date().toISOString(), reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Envio removido por fraude");
    load();
  }

  async function runAutoApprove() {
    if (!supabase) return;
    const { error } = await supabase.rpc("auto_approve_validated_shares");
    if (error) return toast.error(error.message);
    toast.success("Aprovação automática executada");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Provas pendentes</h1>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Bot className="h-3 w-3" /> Publicações com 24h+ online e verificadas automaticamente são aprovadas a cada 30 min pelo sistema.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runAutoApprove} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Rodar aprovação automática agora
        </Button>
      </div>
      {items.length === 0 ? (
        <Card className="p-8 bg-card/50 border-border/50 text-center text-muted-foreground">Sem provas pendentes.</Card>
      ) : items.map((s) => {
        const timeInfo = hoursAgo(s.created_at);
        return (
          <Card key={s.id} className="p-4 bg-card/50 border-border/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{s.campaign?.titulo ?? s.advertiser_campaign?.title}</div>
                {s.advertiser_campaign_id && <Badge variant="outline" className="mt-1">Campanha de anunciante</Badge>}
                <div className="text-xs text-muted-foreground">por {s.profile?.nome} (@{s.profile?.instagram})</div>
                {s.profile?.seguidores_instagram != null && (
                  <div className="text-xs text-muted-foreground">{s.profile.seguidores_instagram.toLocaleString("pt-BR")} seguidores</div>
                )}
                <div className="text-xs text-muted-foreground mt-1 break-all">{s.shared_link}</div>
                {s.instagram_usado && <div className="text-xs">Insta usado: @{s.instagram_usado}</div>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {timeInfo.warn ? (
                    <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300">
                      <Clock className="mr-1 h-3 w-3" /> ⏱ {timeInfo.label} — aguardando 24h
                    </Badge>
                  ) : (
                    <Badge className="border-success/30 bg-success/15 text-success">
                      ✓ {timeInfo.label}
                    </Badge>
                  )}
                  <Badge variant="outline">{s.status}</Badge>
                  {s.auto_validate_status === "live" && !timeInfo.warn && s.validation_status !== "suspeito" && (
                    <Badge className="border-primary/30 bg-primary/15 text-primary">
                      <Bot className="mr-1 h-3 w-3" /> Será auto-aprovada em breve
                    </Badge>
                  )}
                  {s.validation_status === "suspeito" && (
                    <Badge className="border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15">
                      Suspeito: {s.validation_reason}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <a href={s.shared_link} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline" className="gap-2">
                      <ExternalLink className="h-3 w-3" /> Abrir publicação
                    </Button>
                  </a>
                  <AutoValidateBadge status={s.auto_validate_status} detail={s.auto_validate_detail} checkedAt={s.auto_validate_checked_at} />
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full md:w-72">
                <Input placeholder="Motivo da rejeição / fraude" value={motivos[s.id] || ""} onChange={(e) => setMotivos({...motivos, [s.id]: e.target.value})} />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-gold-gradient text-primary-foreground" onClick={() => approve(s)}>Aprovar</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => reject(s.id)}>Rejeitar</Button>
                </div>
                <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => removeFraud(s.id)}>
                  Excluir envio fraudulento
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AutoValidateBadge({ status, detail, checkedAt }: { status?: string; detail?: string; checkedAt?: string }) {
  if (!status || status === "pending") return null;
  const ts = checkedAt ? new Date(checkedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  if (status === "live") return (
    <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15">
      <Zap className="mr-1 h-3 w-3" /> Auto-verificado ✓ ativo {ts && `(${ts})`}
    </Badge>
  );
  if (status === "removed") return (
    <Badge className="border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15">
      <Zap className="mr-1 h-3 w-3" /> Auto: post REMOVIDO {ts && `(${ts})`}
    </Badge>
  );
  if (status === "story_manual") return (
    <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300">
      <Clock className="mr-1 h-3 w-3" /> Story — validação manual pelo print
    </Badge>
  );
  if (status === "private") return (
    <Badge className="border-primary/30 bg-primary/15 text-primary">
      <Zap className="mr-1 h-3 w-3" /> Perfil privado — verifique manualmente
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Auto-check: {detail ?? status}
    </Badge>
  );
}
