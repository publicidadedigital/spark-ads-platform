import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Mail, MapPin, Phone, UserCircle, LogOut, Calendar, CheckCircle2, Info,
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

type Pkg = {
  id: string;
  name: string;
  price_usd: number | string;
  estimated_views: number;
  duration_days: number | null;
  description: string | null;
};

const statusMeta: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "border-success/30 bg-success/15 text-success hover:bg-success/15" },
  pendente: { label: "Em analise", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  bloqueado: { label: "Bloqueado", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const CAKTO_URLS: Record<number, string> = {
  7: "https://pay.cakto.com.br/d9aminn_928121",
  15: "https://pay.cakto.com.br/zyptdsm_928127",
  30: "https://pay.cakto.com.br/3frwppn_928132",
};

function formatCnpj(cnpj: string | null) {
  if (!cnpj) return null;
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function AdvertiserDashboard() {
  const { supabase, session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdvertiserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [packages, setPackages] = useState<Pkg[]>([]);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const [{ data: prof }, { data: pkgs }] = await Promise.all([
        supabase
          .from("advertiser_profiles")
          .select("id,company_name,cnpj,contact_name,email,phone,country_code,cep,estado,cidade,status")
          .eq("auth_user_id", user.id)
          .maybeSingle(),
        supabase.from("advertising_packages").select("*").eq("status", "ativo").order("price_usd"),
      ]);

      setProfile(prof as AdvertiserProfile | null);
      setPackages((pkgs ?? []) as Pkg[]);
      setProfileLoading(false);
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
  const locationStr = [profile.cidade, profile.estado, profile.country_code].filter(Boolean).join(" - ");

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
            Seu cadastro esta em analise. Voce sera notificado por e-mail quando sua conta for liberada para criar campanhas.
          </p>
        )}

        {/* Company info 2-col grid */}
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

      {/* Pacotes de Anúncios */}
      <div>
        <h2 className="text-xl font-bold mb-1">Pacotes de Anúncios</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Escolha o pacote ideal para impulsionar sua marca com compartilhamentos reais.
        </p>
        <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} canSelect={profile.status === "ativo"} email={profile.email} contactName={profile.contact_name} />
          ))}
          {packages.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">Nenhum pacote disponível no momento.</p>
          )}
        </div>
      </div>

      {/* Como funciona strip */}
      <Card className="border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/15 p-3 shrink-0">
              <Info className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold mb-1">Como funciona?</p>
              <p className="text-sm text-muted-foreground">
                Seu anúncio é divulgado na nossa rede e compartilhado no Instagram por usuários reais durante o período contratado.
              </p>
            </div>
          </div>
          <Link to="/anunciante-perfil" className="shrink-0">
            <Button variant="outline" size="sm">Saiba mais</Button>
          </Link>
        </div>
      </Card>
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
          <Button className="w-full bg-primary text-primary-foreground">
            Contratar agora
          </Button>
        </a>
      ) : (
        <Button className="w-full bg-primary text-primary-foreground" disabled={!canSelect}>
          Contratar agora
        </Button>
      )}
    </Card>
  );
}
