import { Logo } from "@/components/Logo";
import { ExchangeRateTicker } from "@/components/ExchangeRateTicker";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, LogOut, Mail, MapPin, Megaphone, Phone, UserCircle } from "lucide-react";

export const Route = createFileRoute("/anunciante-painel")({ component: AdvertiserPanel });

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

function AdvertiserPanel() {
  const { supabase, session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdvertiserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("advertiser_profiles")
      .select("id,company_name,cnpj,contact_name,email,phone,country_code,cep,estado,cidade,status")
      .eq("auth_user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data as AdvertiserProfile | null);
        setProfileLoading(false);
      });
  }, [supabase, user]);

  if (loading || profileLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!session) return null;

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-noir-gradient px-4">
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
    <div className="min-h-screen bg-noir-gradient">
      <header className="border-b border-border/50 bg-background/80">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/anunciante-painel" className="flex items-center gap-2">
            <Logo className="h-8 w-auto max-w-[160px]" />
            <span className="text-primary text-xs font-bold tracking-wider">ANUNCIANTE</span>
          </Link>
          <div className="flex items-center gap-3">
            <ExchangeRateTicker />
            <Link to="/anunciante-perfil">
              <Button variant="ghost" size="sm">
                <UserCircle className="h-4 w-4 mr-2" /> Meu Perfil
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        <Card className="border-primary/15 bg-card/50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{profile.company_name || "Sua empresa"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{profile.contact_name}</p>
            </div>
            <Badge className={meta.className}>{meta.label}</Badge>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Building2} label="CNPJ" value={cnpjFormatted} />
            <InfoRow icon={Mail} label="E-mail" value={profile.email} />
            <InfoRow icon={Phone} label="Telefone" value={profile.phone} />
            <InfoRow icon={MapPin} label="Localizacao" value={[profile.cidade, profile.estado, profile.country_code].filter(Boolean).join(" - ")} />
          </div>

          {profile.status !== "ativo" && (
            <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              Seu cadastro esta em analise. Voce sera notificado por e-mail quando sua conta for liberada para criar campanhas.
            </p>
          )}
        </Card>

        <Card className="border-primary/15 bg-card/50 p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/15 p-2 text-primary">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-semibold">Campanhas</h2>
              <p className="text-sm text-muted-foreground">Em breve voce podera criar e acompanhar suas campanhas por aqui.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
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
