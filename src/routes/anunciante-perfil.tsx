import { Logo } from "@/components/Logo";
import { ExchangeRateTicker } from "@/components/ExchangeRateTicker";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { ProfileEditor } from "@/components/ProfileEditor";
import { LogOut, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/anunciante-perfil")({ component: AdvertiserProfilePage });

type Profile = {
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  cidade: string | null;
  estado: string | null;
  country_code: string | null;
  cnpj: string | null;
};

function AdvertiserProfilePage() {
  const { supabase, session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("advertiser_profiles")
      .select("company_name,contact_name,email,phone,cidade,estado,country_code,cnpj")
      .eq("auth_user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => setProfile(data as Profile | null));
  }, [supabase, user]);

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

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
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-4">
        <Link to="/anunciante-painel" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Conta</p>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">Gerencie a foto, dados da empresa e senha de acesso.</p>
        </div>

        <ProfileEditor
          table="advertiser_profiles"
          nameField="company_name"
          fields={[
            { label: "Empresa", value: profile?.company_name },
            { label: "Responsável", value: profile?.contact_name },
            { label: "E-mail", value: profile?.email },
            { label: "Telefone", value: profile?.phone },
            { label: "CNPJ", value: profile?.cnpj },
            { label: "Localização", value: [profile?.cidade, profile?.estado, profile?.country_code].filter(Boolean).join(" - ") },
          ]}
        />
      </div>
    </div>
  );
}
