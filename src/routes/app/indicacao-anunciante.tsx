import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Megaphone, QrCode, Share2, Sparkles, Building2 } from "lucide-react";
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
  advertiser: { company_name: string | null } | { company_name: string | null }[] | null;
};

const statusMeta: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "border-success/30 bg-success/15 text-success hover:bg-success/15" },
  pendente: { label: "Em análise", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  bloqueado: { label: "Bloqueado", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

function IndicacaoAnunciantePage() {
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

      const [{ data: ads }, { data: bonuses }] = await Promise.all([
        supabase
          .from("advertiser_profiles")
          .select("id,company_name,status,created_at")
          .eq("indicador_id", prof.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("advertiser_bonus_events")
          .select("id,created_at,gross_amount,referrer_bonus,status,advertiser:advertiser_id(company_name)")
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

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  };

  const shareLink = async () => {
    if (!link) return;
    if (navigator.share) {
      await navigator.share({ title: "Viralink", text: "Anuncie na Viralink usando meu link", url: link });
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
            <h1 className="text-3xl font-bold tracking-normal">Indicação de Anunciante</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Receba 50% de comissão na hora em que o anunciante indicado pagar um pacote de anúncios.
          </p>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard icon={Building2} label="Anunciantes indicados" value={advertisers.length.toString()} sub="empresas" />
        <MetricCard icon={Sparkles} label="Comissão recebida" value={usd.format(totalRecebido)} sub="total liberado (50%)" />
        <MetricCard icon={Megaphone} label="Pagamentos comissionados" value={bonusEvents.length.toString()} sub="eventos" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden border-primary/20 bg-card/50">
          <div className="border-b border-border/60 p-5">
            <h2 className="text-lg font-semibold">Anunciantes indicados</h2>
            <p className="text-sm text-muted-foreground">Empresas que se cadastraram com o seu link</p>
          </div>
          <div className="p-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : advertisers.length === 0 ? (
              <EmptyState text="Nenhum anunciante indicado ainda. Compartilhe seu link para começar." />
            ) : (
              <div className="space-y-3">
                {advertisers.map((ad) => {
                  const meta = statusMeta[ad.status ?? ""] ?? { label: ad.status ?? "-", className: "" };
                  return (
                    <div key={ad.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{ad.company_name || "Anunciante"}</p>
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
            <h2 className="text-lg font-semibold">Comissões recebidas</h2>
            <p className="text-sm text-muted-foreground">50% do lucro real liberado automaticamente no pagamento</p>
          </div>
          <div className="p-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : bonusEvents.length === 0 ? (
              <EmptyState text="Nenhuma comissão recebida ainda." />
            ) : (
              <div className="space-y-3">
                {bonusEvents.map((b) => {
                  const advertiser = Array.isArray(b.advertiser) ? b.advertiser[0] : b.advertiser;
                  return (
                    <div key={b.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-3 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{advertiser?.company_name || "Anunciante"}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.created_at ? new Date(b.created_at).toLocaleDateString("pt-BR") : "-"} · Pacote {usd.format(Number(b.gross_amount ?? 0))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-success">+{usd.format(Number(b.referrer_bonus ?? 0))}</p>
                        <Badge variant="outline" className="text-xs">{b.status}</Badge>
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-background/60 px-8 py-10 text-center">
      <Megaphone className="mx-auto mb-3 h-8 w-8 text-primary" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
