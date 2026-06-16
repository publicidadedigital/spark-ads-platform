import { Logo } from "@/components/Logo";
import { ExchangeRateTicker } from "@/components/ExchangeRateTicker";
import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Megaphone, Receipt, Users, RefreshCw,
  LogOut, Menu, ShieldCheck, Wallet, Building2, UserCircle, Package,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/app")({ component: AppLayout });

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/pacotes", label: "Pacotes", icon: Package },
  { to: "/app/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/app/extrato", label: "Extrato", icon: Receipt },
  { to: "/app/saque", label: "Saque", icon: Wallet },
  { to: "/app/rede", label: "Minha Rede", icon: Users },
  { to: "/app/indicacao-anunciante", label: "Indicação de Anunciante", icon: Building2 },
  { to: "/app/renovacao", label: "Renovação", icon: RefreshCw },
  { to: "/app/seguranca", label: "Segurança", icon: ShieldCheck },
  { to: "/app/perfil", label: "Meu Perfil", icon: UserCircle },
];

function AppLayout() {
  const { session, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
                <SidebarContent pathname={location.pathname} />
              </SheetContent>
            </Sheet>
            <Link to="/app" className="flex items-center">
              <Logo className="h-8 w-auto max-w-[140px]" />
            </Link>

          </div>
          <div className="flex items-center gap-3">
            <ExchangeRateTicker />
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container app-container mx-auto px-4 py-6 grid md:grid-cols-[240px_1fr] gap-6 app-shell-grid">
        <aside className="hidden md:block app-sidebar">
          <SidebarContent pathname={location.pathname} />
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <nav className="space-y-1 pt-4">
      {nav.map(({ to, label, icon: Icon, exact }) => {
        const active = exact ? pathname === to : pathname.startsWith(to);
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
