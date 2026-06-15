import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Mail, MapPin, Megaphone, Phone, PlusCircle,
  Share2, Eye, Wallet, Rocket, UserCircle, LogOut,
} from "lucide-react";

export const Route = createFileRoute("/anunciante-painel/")({ component: AdvertiserDashboard });

type AdvertiserProfile = {
  id: string;
  company_name: string | null;
  cnpj: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  cep: string | null;
  estado: string | null;
  cidade: string | null;
  status: string;
};

const statusMeta: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "border-success/30 bg-success/15 text-success hover:bg-success/15" },
  pendente: { label: "Em analise", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  bloqueado: { label: "Bloqueado", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function AdvertiserDashboard() {
  const { supabase, session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdvertiserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalShares: 0,
    estimatedReach: 0,
    totalInvested: 0,
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("advertiser_profiles")
        .select("id,company_name,cnpj,contact_name,email,phone,country_code,cep,estado,cidade,status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      setProfile(prof as AdvertiserProfile | null);
      setProfileLoading(false);

      if (!prof) return;

      const { data: campaigns } = await supabase
        .from("advertiser_campaigns")
        .select("id,status,order:order_id(price_usd,estimated_views)")
        .eq("advertiser_id", prof.id);

      const list = campaigns ?? [];
      const ids = list.map((c: any) => c.id);

      let totalShares = 0;
      if (ids.length > 0) {
        const { count } = await supabase
          .from("advertiser_campaign_events")
          .select("id", { count: "exact", head: true })
          .in("advertiser_campaign_id", ids);
        totalShares = count ?? 0;
      }

      const totalInvested = list.reduce((sum: number, c: any) => sum + Number(c.order?.price_usd ?? 0), 0);
      const estimatedReach = list.reduce((sum: number, c: any) => sum + Number(c.order?.estimated_views ?? 0), 0);
      const activeCampaigns = list.filter((c: any) => c.status === "ativa").length;

      setMetrics({
        totalCampaigns: list.length,
        activeCampaigns,
        totalShares,
        estimatedReach,
        totalInvested,
      });
    })();
  }, [supabase, user]);

  if (loading || profileLoading) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  if (!session) return null;

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full text-center bg-card/60 border-border/50 p-8">
          <h1 className="text-2xl font-bold mb-2">Perfil de anunciante nao encontrado</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Esta conta nao possui um cadastro de anunciante. Se voce e cliente da Viral Hub, acesse o painel do cliente.
          </p>
          <div className="flex gap-2 justify-center">
            <Link to="/app"><Button variant="outline">Ir para o painel do cliente</Button></Link>
            <Button variant="ghost" onClick={() => { signOut(); navigate({ to: "/login" }); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const meta = statusMeta[profile.status] ?? { label: profile.status, className: "" };
  const cnpjFormatted = formatCnpj(profile.cnpj);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-violet-500/35 bg-[radial-gradient(circle_at_right,rgba(245,181,27,0.18),transparent_28%),linear-gradient(90deg,rgba(88,28,135,0.55),rgba(2,6,23,0.55))] p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{profile.company_name || "Sua empresa"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{profile.contact_name}</p>
          </div>
          <Badge className={meta.className}>{meta.label}</Badge>
        </div>

        {profile.status !== "ativo" ? (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Seu cadastro esta em analise. Voce sera notificado por e-mail quando sua conta for liberada para criar campanhas.
          </p>
        ) : (
          <div className="mt-4">
            <Link to="/anunciante-painel/nova-campanha">
              <Button className="bg-gold-gradient text-primary-foreground">
                <PlusCircle className="mr-2 h-4 w-4" /> Criar nova campanha
              </Button>
            </Link>
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Campanhas" value={String(metrics.totalCampaigns)} sub="Total criadas" icon={Megaphone} />
        <MetricCard label="Campanhas ativas" value={String(metrics.activeCampaigns)} sub="Em execução" icon={Rocket} tone="success" />
        <MetricCard label="Compartilhamentos" value={String(metrics.totalShares)} sub="Recebidos" icon={Share2} tone="primary" />
        <MetricCard label="Alcance estimado" value={metrics.estimatedReach.toLocaleString("pt-BR")} sub="Visualizações" icon={Eye} tone="primary" />
        <MetricCard label="Total investido" value={usd.format(metrics.totalInvested)} sub="Em campanhas" icon={Wallet} tone="warning" />
      </div>

      <Card className="border-primary/15 bg-card/50 p-5">
        <h2 className="mb-4 font-semibold">Dados da empresa</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon={Building2} label="CNPJ" value={cnpjFormatted} />
          <InfoRow icon={Mail} label="E-mail" value={profile.email} />
          <InfoRow icon={Phone} label="Telefone" value={profile.phone} />
          <InfoRow icon={MapPin} label="Localizacao" value={[profile.cidade, profile.estado, profile.country_code].filter(Boolean).join(" - ")} />
        </div>
        <div className="mt-4">
          <Link to="/anunciante-perfil">
            <Button variant="outline" size="sm"><UserCircle className="mr-2 h-4 w-4" /> Editar perfil</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon, tone = "primary" }: any) {
  const tones: Record<string, string> = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-amber-500/15 text-amber-300",
  };
  return (
    <Card className="border-primary/15 bg-card/50 p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-3 ${tones[tone]}`}>
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

function InfoRow({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value || "-"}</p>
      </div>
    </div>
  );
}

function formatCnpj(cnpj: string | null) {
  if (!cnpj) return null;
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}
