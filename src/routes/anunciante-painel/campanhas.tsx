import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, ShieldCheck, XCircle, Rocket, CheckCircle2, PlusCircle, PauseCircle } from "lucide-react";

export const Route = createFileRoute("/anunciante-painel/campanhas")({ component: AdvertiserCampaigns });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type Campaign = {
  id: string;
  title: string;
  media_url: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  order?: { price_usd: number | string; estimated_views: number; package?: { name: string; duration_days: number | null } | null } | null;
};

function AdvertiserCampaigns() {
  const { supabase, user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
  const [hasApprovedPayment, setHasApprovedPayment] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("advertiser_profiles")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!prof) {
        setLoading(false);
        return;
      }

      const [{ data }, { data: payments }] = await Promise.all([
        supabase
          .from("advertiser_campaigns")
          .select("id,title,media_url,status,rejection_reason,created_at,order:order_id(price_usd,estimated_views,package:advertising_package_id(name,duration_days))")
          .eq("advertiser_id", prof.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("advertiser_payment_orders")
          .select("id")
          .eq("advertiser_profile_id", prof.id)
          .eq("status", "approved")
          .limit(1),
      ]);

      setHasApprovedPayment((payments ?? []).length > 0);

      const list = (data ?? []) as unknown as Campaign[];
      setCampaigns(list);

      const ids = list.map((c) => c.id);
      if (ids.length > 0) {
        const { data: events } = await supabase
          .from("advertiser_campaign_events")
          .select("advertiser_campaign_id")
          .in("advertiser_campaign_id", ids);
        const counts: Record<string, number> = {};
        (events ?? []).forEach((e: any) => {
          counts[e.advertiser_campaign_id] = (counts[e.advertiser_campaign_id] ?? 0) + 1;
        });
        setShareCounts(counts);
      }

      setLoading(false);
    })();
  }, [supabase, user]);

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Minhas Campanhas</h1>
          <p className="text-sm text-muted-foreground">Acompanhe o status, plano e desempenho das suas campanhas</p>
        </div>
        {hasApprovedPayment ? (
          <Link to="/anunciante-painel/nova-campanha" search={{ packageId: "" }}>
            <Button className="bg-gold-gradient text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Nova campanha
            </Button>
          </Link>
        ) : (
          <Link to="/anunciante-painel/" search={{ tab: "pagamentos" }}>
            <Button variant="outline" className="border-amber-400/30 text-amber-300">
              Ative um pacote para criar campanhas
            </Button>
          </Link>
        )}
      </div>

      {campaigns.length === 0 ? (
        <Card className="border-primary/15 bg-card/50 p-8 text-center text-muted-foreground">
          Nenhuma campanha criada ainda.
        </Card>
      ) : (
        <Card className="border-primary/15 bg-card/50 p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border/50">
                  <th className="px-4 py-3 text-left font-medium">Campanha</th>
                  <th className="px-4 py-3 text-left font-medium">Criada em</th>
                  <th className="px-4 py-3 text-left font-medium">Plano</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Compartilhamentos</th>
                  <th className="px-4 py-3 text-left font-medium">Alcance estimado</th>
                  <th className="px-4 py-3 text-left font-medium">Investimento</th>
                  <th className="px-4 py-3 text-left font-medium">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border/35 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={c.media_url} alt="" className="h-10 w-10 rounded-md object-cover" />
                        <div className="min-w-0">
                          <div className="max-w-[220px] truncate font-medium">{c.title}</div>
                          {c.status === "reprovada" && c.rejection_reason && (
                            <div className="max-w-[220px] truncate text-xs text-destructive">{c.rejection_reason}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3">{c.order?.package?.name ?? "-"}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">{shareCounts[c.id] ?? 0}</td>
                    <td className="px-4 py-3">{(c.order?.estimated_views ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3">{usd.format(Number(c.order?.price_usd ?? 0))}</td>
                    <td className="px-4 py-3">
                      <Link to="/anunciante-painel/campanhas/$campaignId" params={{ campaignId: c.id }}>
                        <Button size="sm" variant="outline">Participantes</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ativa":
      return <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15"><Rocket className="mr-1 h-3 w-3" /> Ativa</Badge>;
    case "pausada":
      return <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15"><PauseCircle className="mr-1 h-3 w-3" /> Pausada</Badge>;
    case "aprovada":
      return <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15"><CheckCircle2 className="mr-1 h-3 w-3" /> Aprovada</Badge>;
    case "reprovada":
      return <Badge className="border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15"><XCircle className="mr-1 h-3 w-3" /> Reprovada</Badge>;
    case "finalizada":
      return <Badge className="border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/30"><ShieldCheck className="mr-1 h-3 w-3" /> Finalizada</Badge>;
    default:
      return <Badge className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/15"><Clock className="mr-1 h-3 w-3" /> Em analise</Badge>;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}
