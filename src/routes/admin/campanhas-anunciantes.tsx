import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ExternalLink, Clock, ShieldCheck, XCircle, Rocket, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin/campanhas-anunciantes")({ component: AdminCampanhasAnunciantes });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function AdminCampanhasAnunciantes() {
  const { supabase, user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase
      .from("advertiser_campaigns")
      .select("*, advertiser:advertiser_id(company_name, email), order:order_id(price_usd, estimated_views, package:advertising_package_id(name, duration_days))")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function approve(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("advertiser_campaigns")
      .update({ status: "ativa", approved_by: user?.id, approved_at: new Date().toISOString(), rejection_reason: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campanha aprovada e ativada");
    load();
  }

  async function reject(id: string) {
    if (!supabase) return;
    const motivo = motivos[id]?.trim();
    if (!motivo) return toast.error("Informe o motivo da reprovacao");
    const { error } = await supabase.from("advertiser_campaigns")
      .update({ status: "reprovada", rejection_reason: motivo, approved_by: user?.id, approved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campanha reprovada");
    load();
  }

  async function finish(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("advertiser_campaigns").update({ status: "finalizada" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Campanha finalizada");
    load();
  }

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  const pending = items.filter((c) => c.status === "em_analise");
  const others = items.filter((c) => c.status !== "em_analise");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Campanhas de Anunciantes</h1>
        <p className="text-sm text-muted-foreground">Analise, aprove ou reprove campanhas enviadas por anunciantes</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Pendentes de analise</h2>
        {pending.length === 0 ? (
          <Card className="p-8 bg-card/50 border-border/50 text-center text-muted-foreground">Nenhuma campanha pendente.</Card>
        ) : pending.map((c) => (
          <Card key={c.id} className="p-4 bg-card/50 border-border/50">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-1 min-w-0 gap-3">
                <img src={c.media_url} alt="" className="h-16 w-16 rounded-md object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.advertiser?.company_name} ({c.advertiser?.email})</div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.caption}</p>
                  <a href={c.destination_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline">
                    {c.destination_url} <ExternalLink className="h-3 w-3" />
                  </a>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <Badge variant="outline">{c.order?.package?.name ?? "-"}</Badge>
                    <span className="text-muted-foreground">{usd.format(Number(c.order?.price_usd ?? 0))} · ~{Number(c.order?.estimated_views ?? 0).toLocaleString("pt-BR")} views</span>
                  </div>
                </div>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-72">
                <Input placeholder="Motivo da reprovacao" value={motivos[c.id] || ""} onChange={(e) => setMotivos({ ...motivos, [c.id]: e.target.value })} />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 bg-gold-gradient text-primary-foreground" onClick={() => approve(c.id)}>Aprovar e ativar</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => reject(c.id)}>Reprovar</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Historico</h2>
        {others.length === 0 ? (
          <Card className="p-8 bg-card/50 border-border/50 text-center text-muted-foreground">Nenhuma campanha processada ainda.</Card>
        ) : (
          <Card className="border-border/50 bg-card/50 p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="px-4 py-3 text-left font-medium">Campanha</th>
                    <th className="px-4 py-3 text-left font-medium">Anunciante</th>
                    <th className="px-4 py-3 text-left font-medium">Plano</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {others.map((c) => (
                    <tr key={c.id} className="border-b border-border/35 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={c.media_url} alt="" className="h-8 w-8 rounded-md object-cover" />
                          <span className="max-w-[220px] truncate font-medium">{c.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.advertiser?.company_name}</td>
                      <td className="px-4 py-3">{c.order?.package?.name ?? "-"}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3">
                        {c.status === "ativa" && (
                          <Button size="sm" variant="outline" onClick={() => finish(c.id)}>Finalizar</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ativa":
      return <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15"><Rocket className="mr-1 h-3 w-3" /> Ativa</Badge>;
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
