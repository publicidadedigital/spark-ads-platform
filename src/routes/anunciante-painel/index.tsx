import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Mail, MapPin, Phone, UserCircle, LogOut, Calendar, CheckCircle2,
  Info, ChevronDown, ChevronUp, Megaphone, Clock, TrendingUp, Users,
} from "lucide-react";

export const Route = createFileRoute("/anunciante-painel/")({
  validateSearch: (s) => ({ tab: (s.tab as Tab) || "pagamentos" }),
  component: AdvertiserDashboard,
});

type Tab = "pagamentos" | "historico" | "campanhas";

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

type Pkg = {
  id: string;
  name: string;
  price_usd: number | string;
  estimated_views: number;
  duration_days: number | null;
  description: string | null;
};

type PaymentOrder = {
  id: string;
  created_at: string;
  amount_usd: number | string | null;
  status: string;
  advertising_package: { name: string | null; duration_days: number | null } | null;
};

type Campaign = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  advertising_package: { name: string | null; duration_days: number | null } | null;
  shares_count: number;
  approved_count: number;
  estimated_views: number;
};

const profileStatusMeta: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "border-success/30 bg-success/15 text-success hover:bg-success/15" },
  pendente: { label: "Em análise", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  bloqueado: { label: "Bloqueado", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

const paymentStatusMeta: Record<string, { label: string; className: string }> = {
  approved: { label: "Aprovado", className: "border-success/30 bg-success/15 text-success" },
  pending: { label: "Aguardando pagamento", className: "border-amber-400/30 bg-amber-500/15 text-amber-300" },
  failed: { label: "Falhou", className: "border-destructive/30 bg-destructive/15 text-destructive" },
  expired: { label: "Expirado", className: "border-destructive/30 bg-destructive/15 text-destructive" },
};

const campaignStatusMeta: Record<string, { label: string; className: string }> = {
  ativa: { label: "Ativa", className: "border-success/30 bg-success/15 text-success" },
  pausada: { label: "Pausada", className: "border-amber-400/30 bg-amber-500/15 text-amber-300" },
  encerrada: { label: "Encerrada", className: "border-border/50 bg-muted/20 text-muted-foreground" },
  pendente: { label: "Em análise", className: "border-amber-400/30 bg-amber-500/15 text-amber-300" },
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const CAKTO_URLS: Record<number, string> = {
  7: "https://pay.cakto.com.br/d9aminn_928121",
  15: "https://pay.cakto.com.br/zyptdsm_928127",
  30: "https://pay.cakto.com.br/3frwppn_928132",
};

const HOW_IT_WORKS = [
  "Você contrata um plano de divulgação (7, 15 ou 30 dias).",
  "Você cria sua campanha e nós aprovamos e distribuímos para nossa rede de criadores no Instagram.",
  "Cada criador compartilha seu anúncio nos stories ou feed com o link da sua marca.",
  "Você acompanha em tempo real o número de compartilhamentos, alcance estimado e desempenho.",
  "Ao final do período, você tem acesso ao relatório completo da campanha.",
];

function formatCnpj(cnpj: string | null) {
  if (!cnpj) return null;
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function AdvertiserDashboard() {
  const { supabase, session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdvertiserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [payments, setPayments] = useState<PaymentOrder[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const { tab: initialTab } = Route.useSearch();
  const [tab, setTab] = useState<Tab>(initialTab ?? "pagamentos");
  const [howOpen, setHowOpen] = useState(false);

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

      const [{ data: pkgs }, { data: payRows }, { data: campRows }] = await Promise.all([
        supabase.from("advertising_packages").select("*").eq("status", "ativo").order("price_usd"),
        supabase
          .from("advertiser_payment_orders")
          .select("id,created_at,amount_usd,status,advertising_package:advertising_package_id(name,duration_days)")
          .eq("advertiser_profile_id", prof?.id ?? "")
          .order("created_at", { ascending: false }),
        supabase
          .from("advertiser_campaigns")
          .select("id,title,status,created_at,order:order_id(advertising_package:advertising_package_id(name,duration_days))")
          .eq("advertiser_id", prof?.id ?? "")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setProfile(prof as AdvertiserProfile | null);
      setPackages((pkgs ?? []) as Pkg[]);
      setPayments((payRows ?? []) as unknown as PaymentOrder[]);

      // Fetch metrics per campaign
      const rawCampaigns = (campRows ?? []) as any[];
      const enriched: Campaign[] = await Promise.all(
        rawCampaigns.map(async (c) => {
          const { data: events } = await supabase
            .from("advertiser_campaign_events")
            .select("followers_snapshot,estimated_views")
            .eq("advertiser_campaign_id", c.id);
          const { count: sharesCount } = await supabase
            .from("campaign_shares")
            .select("id", { count: "exact", head: true })
            .eq("advertiser_campaign_id", c.id);
          const { count: approvedCount } = await supabase
            .from("campaign_shares")
            .select("id", { count: "exact", head: true })
            .eq("advertiser_campaign_id", c.id)
            .eq("status", "aprovada");
          const estimatedViews = (events ?? []).reduce((s: number, e: any) => s + Number(e.estimated_views ?? 0), 0);
          return {
            id: c.id,
            title: c.title,
            status: c.status,
            created_at: c.created_at,
            advertising_package: c.order?.advertising_package ?? null,
            shares_count: sharesCount ?? 0,
            approved_count: approvedCount ?? 0,
            estimated_views: estimatedViews,
          };
        }),
      );
      setCampaigns(enriched);
      setProfileLoading(false);
    })();
  }, [supabase, user]);

  if (loading || profileLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!session) return null;

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="max-w-md w-full text-center bg-card/60 border-border/50 p-8">
          <h1 className="text-2xl font-bold mb-2">Perfil de anunciante não encontrado</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Esta conta não possui um cadastro de anunciante.
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

  const meta = profileStatusMeta[profile.status] ?? { label: profile.status, className: "" };
  const cnpjFormatted = formatCnpj(profile.cnpj);
  const locationStr = [profile.cidade, profile.estado, profile.country_code].filter(Boolean).join(" - ");
  const approvedPayment = payments.find((p) => p.status === "approved");
  const canCreateCampaign = profile.status === "ativo" && !!approvedPayment;

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      {/* Profile card */}
      <Card className="border-border/50 bg-card/60 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{profile.company_name || "Sua empresa"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{profile.contact_name}</p>
          </div>
          <Badge className={meta.className}>{meta.label}</Badge>
        </div>

        {profile.status !== "ativo" && (
          <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Seu cadastro está em análise. Você será notificado por e-mail quando sua conta for liberada.
          </p>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon={Building2} label="CNPJ" value={cnpjFormatted} />
          <InfoCard icon={Mail} label="E-mail" value={profile.email} />
          <InfoCard icon={Phone} label="Telefone" value={profile.phone} />
          <InfoCard icon={MapPin} label="Localização" value={locationStr || null} />
        </div>

        <div className="mt-4">
          <Link to="/anunciante-perfil">
            <Button variant="outline" size="sm">
              <UserCircle className="mr-2 h-4 w-4" /> Editar perfil
            </Button>
          </Link>
        </div>
      </Card>

      {/* Como funciona */}
      <Card className="border-primary/20 bg-primary/5 p-5">
        <button
          className="w-full flex items-center justify-between gap-4 text-left"
          onClick={() => setHowOpen((v) => !v)}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/15 p-2 shrink-0">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Como funciona?</p>
              <p className="text-xs text-muted-foreground">
                Seu anúncio compartilhado por usuários reais no Instagram durante o período contratado.
              </p>
            </div>
          </div>
          <span className="shrink-0 text-primary">
            {howOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>
        {howOpen && (
          <ul className="mt-4 space-y-2 pl-11">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="rounded-full bg-primary/20 text-primary text-xs font-bold w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={tab === "pagamentos" ? "default" : "outline"} onClick={() => setTab("pagamentos")}>Pagamentos</Button>
        <Button size="sm" variant={tab === "historico" ? "default" : "outline"} onClick={() => setTab("historico")}>
          Histórico {payments.length > 0 && <span className="ml-1 text-xs opacity-70">({payments.length})</span>}
        </Button>
        <Button size="sm" variant={tab === "campanhas" ? "default" : "outline"} onClick={() => setTab("campanhas")}>
          Campanhas {campaigns.length > 0 && <span className="ml-1 text-xs opacity-70">({campaigns.length})</span>}
        </Button>
      </div>

      {/* Tab: Pagamentos */}
      {tab === "pagamentos" && (
        <div className="space-y-5">
          {canCreateCampaign && approvedPayment && (
            <Card className="border-success/30 bg-success/5 p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-success/15 p-2 shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-success">Plano ativo</p>
                    <p className="text-sm text-muted-foreground">
                      {(approvedPayment.advertising_package as any)?.name
                        ? `${(approvedPayment.advertising_package as any).name}${(approvedPayment.advertising_package as any).duration_days ? ` — ${(approvedPayment.advertising_package as any).duration_days} dias` : ""}`
                        : "Pacote contratado"}
                      {approvedPayment.amount_usd != null ? ` · ${usd.format(Number(approvedPayment.amount_usd))}` : ""}
                    </p>
                  </div>
                </div>
                <Link to="/anunciante-painel/nova-campanha" search={{ packageId: "" }}>
                  <Button className="bg-primary text-primary-foreground gap-2 shrink-0">
                    <Megaphone className="h-4 w-4" /> Criar campanha
                  </Button>
                </Link>
              </div>
            </Card>
          )}

          <div>
            <h2 className="text-lg font-bold mb-3">Pacotes de Anúncios</h2>
            <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard
                  key={pkg.id}
                  pkg={pkg}
                  canSelect={profile.status === "ativo"}
                  email={profile.email}
                  contactName={profile.contact_name}
                />
              ))}
              {packages.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground">Nenhum pacote disponível no momento.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Histórico */}
      {tab === "historico" && (
        <Card className="bg-card/50 border-border/50 overflow-auto">
          {payments.length === 0 ? (
            <p className="p-6 text-muted-foreground">Nenhum pagamento registrado ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Data e Hora</th>
                  <th className="text-left p-3">Pacote</th>
                  <th className="text-left p-3">Valor</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const pkg = p.advertising_package as any;
                  const pkgLabel = pkg
                    ? `${pkg.name ?? "Pacote"}${pkg.duration_days ? ` (${pkg.duration_days} dias)` : ""}`
                    : "—";
                  const meta = paymentStatusMeta[p.status] ?? { label: p.status, className: "border-border/50 text-muted-foreground" };
                  return (
                    <tr key={p.id} className="border-b border-border/30">
                      <td className="p-3 text-muted-foreground">{fmtDate(p.created_at)}</td>
                      <td className="p-3">{pkgLabel}</td>
                      <td className="p-3 font-semibold">{p.amount_usd != null ? usd.format(Number(p.amount_usd)) : "—"}</td>
                      <td className="p-3"><Badge className={meta.className}>{meta.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Tab: Campanhas */}
      {tab === "campanhas" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Acompanhamento de Campanhas</h2>
            {canCreateCampaign && (
              <Link to="/anunciante-painel/nova-campanha" search={{ packageId: "" }}>
                <Button size="sm" className="bg-primary text-primary-foreground gap-2">
                  <Megaphone className="h-4 w-4" /> Nova campanha
                </Button>
              </Link>
            )}
          </div>
          {campaigns.length === 0 ? (
            <Card className="p-8 text-center bg-card/50 border-border/50 text-muted-foreground">
              <Megaphone className="mx-auto h-8 w-8 mb-3 opacity-40" />
              <p>Nenhuma campanha criada ainda.</p>
              {canCreateCampaign && (
                <Link to="/anunciante-painel/nova-campanha" search={{ packageId: "" }}>
                  <Button size="sm" className="mt-4">Criar primeira campanha</Button>
                </Link>
              )}
            </Card>
          ) : (
            campaigns.map((c) => {
              const pkg = c.advertising_package as any;
              const planLabel = pkg ? `${pkg.name ?? "Pacote"}${pkg.duration_days ? ` · ${pkg.duration_days}d` : ""}` : null;
              const statusM = campaignStatusMeta[c.status] ?? { label: c.status, className: "border-border/50 text-muted-foreground" };
              return (
                <Card key={c.id} className="p-4 bg-card/50 border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{c.title}</p>
                        <Badge className={statusM.className}>{statusM.label}</Badge>
                        {planLabel && <Badge variant="outline" className="text-xs">{planLabel}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Criada em {fmtDate(c.created_at)}
                      </p>
                    </div>
                    <Link to="/anunciante-painel/campanhas/$campaignId" params={{ campaignId: c.id }}>
                      <Button size="sm" variant="outline">Ver detalhes</Button>
                    </Link>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <MetricMini icon={Users} label="Participantes" value={c.shares_count} />
                    <MetricMini icon={CheckCircle2} label="Aprovados" value={c.approved_count} />
                    <MetricMini icon={TrendingUp} label="Alcance est." value={c.estimated_views.toLocaleString("pt-BR")} />
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function MetricMini({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/30 p-3 text-center">
      <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3 min-w-0">
      <div className="rounded-full bg-primary/10 p-2 shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate" title={value ?? ""}>{value || "-"}</p>
      </div>
    </div>
  );
}

function PackageCard({ pkg, canSelect, email, contactName }: { pkg: Pkg; canSelect: boolean; email?: string | null; contactName?: string | null }) {
  const features = ["Compartilhamentos reais", "Alcance orgânico", "Relatório de desempenho"];
  const baseUrl = pkg.duration_days ? CAKTO_URLS[pkg.duration_days] : undefined;
  const caktoUrl = baseUrl
    ? (() => {
        const u = new URL(baseUrl);
        if (email) u.searchParams.set("email", email);
        if (contactName) u.searchParams.set("name", contactName);
        return u.toString();
      })()
    : undefined;
  return (
    <Card className="flex flex-col border-border/50 bg-card/60 p-6 gap-0">
      <div className="mb-4 flex items-center justify-center rounded-2xl bg-primary/10 w-14 h-14 shrink-0">
        <Calendar className="h-7 w-7 text-primary" />
      </div>
      <h3 className="font-semibold text-lg leading-snug mb-1">
        {pkg.duration_days ? `${pkg.duration_days} Dias` : pkg.name}
      </h3>
      <p className="text-sm text-muted-foreground mb-3">de compartilhamentos</p>
      <p className="text-3xl font-bold text-primary mb-4">{usd.format(Number(pkg.price_usd))}</p>
      <ul className="space-y-2 mb-4 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-300 mb-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2">
        Após o pagamento, sua conta será ativada automaticamente e você poderá criar campanhas.
      </p>
      {caktoUrl && canSelect ? (
        <a href={caktoUrl} target="_blank" rel="noreferrer">
          <Button className="w-full bg-primary text-primary-foreground">Contratar agora</Button>
        </a>
      ) : (
        <Button className="w-full bg-primary text-primary-foreground" disabled={!canSelect}>
          Contratar agora
        </Button>
      )}
    </Card>
  );
}
