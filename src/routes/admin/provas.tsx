import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/provas")({ component: AdminProvas });

function AdminProvas() {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [motivos, setMotivos] = useState<Record<string,string>>({});

  async function load() {
    if (!supabase) return;
    const { data } = await supabase
      .from("campaign_shares")
      .select("*, profile:user_id(nome, instagram, seguidores_instagram), campaign:campaign_id(titulo), advertiser_campaign:advertiser_campaign_id(title)")
      .eq("status", "pendente")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function approve(item: any) {
    if (!supabase) return;
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Provas pendentes</h1>
      {items.length === 0 ? (
        <Card className="p-8 bg-card/50 border-border/50 text-center text-muted-foreground">Sem provas pendentes.</Card>
      ) : items.map((s) => (
        <Card key={s.id} className="p-4 bg-card/50 border-border/50">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{s.campaign?.titulo ?? s.advertiser_campaign?.title}</div>
              {s.advertiser_campaign_id && <Badge variant="outline" className="mt-1">Campanha de anunciante</Badge>}
              <div className="text-xs text-muted-foreground">por {s.profile?.nome} (@{s.profile?.instagram})</div>
              <div className="text-xs text-muted-foreground mt-1 break-all">{s.shared_link}</div>
              {s.instagram_usado && <div className="text-xs">Insta usado: @{s.instagram_usado}</div>}
              <Badge variant="outline" className="mt-2">{s.status}</Badge>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-72">
              <Input placeholder="Motivo da rejeição" value={motivos[s.id] || ""} onChange={(e) => setMotivos({...motivos, [s.id]: e.target.value})} />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-gold-gradient text-primary-foreground" onClick={() => approve(s)}>Aprovar</Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => reject(s.id)}>Rejeitar</Button>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
