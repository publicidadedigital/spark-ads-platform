import { Logo } from "@/components/Logo";
import { ExchangeRateTicker } from "@/components/ExchangeRateTicker";
import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  LayoutDashboard, Megaphone, Receipt, Users, RefreshCw,
  LogOut, Menu, ShieldCheck, Wallet, Building2, UserCircle, Package, Lock,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";

export const Route = createFileRoute("/app")({ component: AppLayout });

const nav = [
  { to: "/app", labelKey: "appNav.dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/pacotes", labelKey: "appNav.pacotes", icon: Package, free: true },
  { to: "/app/campanhas", labelKey: "appNav.campanhas", icon: Megaphone },
  { to: "/app/extrato", labelKey: "appNav.extrato", icon: Receipt },
  { to: "/app/saque", labelKey: "appNav.saque", icon: Wallet },
  { to: "/app/rede", labelKey: "appNav.rede", icon: Users },
  { to: "/app/indicacao-anunciante", labelKey: "appNav.indicarAnunciante", icon: Building2 },
  { to: "/app/renovacao", labelKey: "appNav.renovacao", icon: RefreshCw },
  { to: "/app/seguranca", labelKey: "appNav.seguranca", icon: ShieldCheck },
  { to: "/app/perfil", labelKey: "appNav.perfil", icon: UserCircle },
];

function AppLayout() {
  const { session, loading, signOut, supabase, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasCycle, setHasCycle] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (session) return;
    const timeout = window.setTimeout(() => {
      window.location.replace("/login");
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [session]);

  useEffect(() => {
    if (!session || !supabase || !user) { setHasCycle(null); return; }
    (async () => {
      const { data: prof } = await supabase
        .from("users_profile")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!prof) { setHasCycle(true); return; }

      const { data: cycle } = await supabase
        .from("user_cycles")
        .select("id")
        .eq("user_id", prof.id)
        .eq("status", "ativo")
        .limit(1)
        .maybeSingle();

      setHasCycle(!!cycle);
    })();
  }, [session, supabase, user]);

  if (loading || !session) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-muted-foreground"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          color: "#94a3b8",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Carregando...
      </div>
    );
  }

  const onPacotes = location.pathname === "/app/pacotes";
  const blocked = hasCycle === false && !onPacotes;

  return (
    <div className="min-h-screen bg-noir-gradient">
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-40 bg-background/80">
        <div className="container app-container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="app-mobile-menu md:hidden"><Menu /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SidebarContent pathname={location.pathname} hasCycle={hasCycle} />
              </SheetContent>
            </Sheet>
            <Link to="/app" className="flex items-center">
              <Logo className="h-8 w-auto max-w-[140px]" />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ExchangeRateTicker />
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4 mr-2" /> {t("appNav.sair")}
            </Button>
          </div>
        </div>
      </header>

      <div className="container app-container mx-auto px-4 py-6 grid md:grid-cols-[240px_1fr] gap-6 app-shell-grid">
        <aside className="hidden md:block app-sidebar">
          <SidebarContent pathname={location.pathname} hasCycle={hasCycle} />
        </aside>
        <main className="min-w-0">
          {hasCycle === null ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : blocked ? (
            <NoPacoteBlock />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

function NoPacoteBlock() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md w-full text-center bg-card/60 border-border/50 p-8 space-y-4">
        <div className="flex items-center justify-center rounded-full bg-primary/10 w-16 h-16 mx-auto">
          <Package className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Ative um pacote para continuar</h2>
        <p className="text-sm text-muted-foreground">
          Para acessar o dashboard, campanhas, saques e todos os recursos, você precisa ter um pacote ativo.
        </p>
        <Link to="/app/pacotes">
          <Button className="w-full bg-primary text-primary-foreground mt-2">Ver pacotes disponíveis</Button>
        </Link>
      </Card>
    </div>
  );
}

function SidebarContent({ pathname, hasCycle }: { pathname: string; hasCycle: boolean | null }) {
  const { t } = useLanguage();
  return (
    <nav className="space-y-1 pt-4">
      {nav.map(({ to, labelKey, icon: Icon, exact, free }) => {
        const active = exact ? pathname === to : pathname.startsWith(to);
        const locked = hasCycle === false && !free;
        const label = t(labelKey);
        if (locked) {
          return (
            <span key={to} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/40 cursor-not-allowed select-none">
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              <Lock className="h-3 w-3" />
            </span>
          );
        }
        return (
          <Link key={to} to={to} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
            active ? "bg-gold/10 text-gold border border-gold/30" : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}>
            <Icon className="h-4 w-4" />{label}
          </Link>
        );
      })}
    </nav>
  );
}
