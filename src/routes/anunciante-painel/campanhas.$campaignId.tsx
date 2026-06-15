import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, ShieldCheck, XCircle, ExternalLink, Users } from "lucide-react";

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
  profile?: { nome: string; instagram: string | null; avatar_url: string | null; seguidores_instagram: number | null } | null;
};

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
          .select("id,shared_link,status,motivo_rejeicao,created_at,social_handle,instagram_usado,profile:user_id(nome,instagram,avatar_url,seguidores_instagram)")
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

      <Card className="border-primary/15 bg-card/50 p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="px-4 py-3 text-left font-medium">Participante</th>
                <th className="px-4 py-3 text-left font-medium">Instagram</th>
                <th className="px-4 py-3 text-left font-medium">Seguidores</th>
                <th className="px-4 py-3 text-left font-medium">Link enviado</th>
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Publicacao</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
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
                  <td className="px-4 py-3">{(p.profile?.seguidores_instagram ?? 0).toLocaleString("pt-BR")}</td>
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
                    <a href={p.shared_link} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline">Abrir publicação</Button>
                    </a>
                  </td>
                </tr>
              ))}
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
