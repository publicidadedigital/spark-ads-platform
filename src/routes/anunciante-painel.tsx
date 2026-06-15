import { Logo } from "@/components/Logo";
import { ExchangeRateTicker } from "@/components/ExchangeRateTicker";
import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Megaphone, CreditCard, UserCircle, LogOut, Menu, BarChart2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const Route = createFileRoute("/anunciante-painel")({ component: AdvertiserLayout });

const nav = [
  { to: "/anunciante-painel", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/anunciante-painel/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/anunciante-painel/campanhas", label: "Relatórios", icon: BarChart2 },
  { to: "/anunciante-perfil", label: "Pagamentos", icon: CreditCard },
  { to: "/anunciante-perfil", label: "Perfil", icon: UserCircle },
];

function AdvertiserLayout() {
  const { session, loading, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  // Derive initials from email
  const email = user?.email ?? "";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-noir-gradient">
      <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-40 bg-background/80">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden"><Menu /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SidebarContent pathname={location.pathname} />
              </SheetContent>
            </Sheet>
            <Link to="/anunciante-painel" className="flex items-center gap-2">
              <Logo className="h-8 w-auto max-w-[140px]" />
              <span className="text-primary text-xs font-bold tracking-wider">ANUNCIANTE</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <ExchangeRateTicker />
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground select-none">
              {initials}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 grid md:grid-cols-[240px_1fr] gap-6">
        <aside className="hidden md:block">
          <SidebarContent pathname={location.pathname} />
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/90 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-around py-2">
          {nav.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to) && to !== "/anunciante-painel";
            const dashActive = exact && location.pathname === "/anunciante-painel";
            const isActive = dashActive || (!exact && location.pathname.startsWith(to) && to !== "/anunciante-painel");
            const finalActive = exact ? location.pathname === to : isActive;
            return (
              <Link
                key={label}
                to={to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] transition ${
                  finalActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <nav className="space-y-1 pt-4">
      {nav.map(({ to, label, icon: Icon, exact }) => {
        const active = exact ? pathname === to : pathname.startsWith(to);
        return (
          <Link key={label} to={to} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
            active ? "bg-gold/10 text-gold border border-gold/30" : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}>
            <Icon className="h-4 w-4" />{label}
          </Link>
        );
      })}
    </nav>
  );
}
