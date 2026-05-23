import { Logo } from "@/components/Logo";
import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Megaphone, Receipt, Users, RefreshCw,
  Shield, LogOut, Menu,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetTrigger,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/app")({ component: AppLayout });

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/app/extrato", label: "Extrato", icon: Receipt },
  { to: "/app/rede", label: "Minha Rede", icon: Users },
  { to: "/app/renovacao", label: "Renovação", icon: RefreshCw },
];

function AppLayout() {
  const { session, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

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
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden"><Menu /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SidebarContent isAdmin={isAdmin} pathname={location.pathname} />
              </SheetContent>
            </Sheet>
            <Link to="/app" className="flex items-center">
              <Logo className="h-7 w-7" />
            </Link>

          </div>
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 grid md:grid-cols-[240px_1fr] gap-6">
        <aside className="hidden md:block">
          <SidebarContent isAdmin={isAdmin} pathname={location.pathname} />
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}

function SidebarContent({ isAdmin, pathname }: { isAdmin: boolean; pathname: string }) {
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
      {isAdmin && (
        <>
          <div className="pt-4 pb-1 px-3 text-xs uppercase tracking-wider text-muted-foreground">Admin</div>
          <Link to="/admin" className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
            pathname.startsWith("/admin") ? "bg-gold/10 text-gold border border-gold/30" : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}>
            <Shield className="h-4 w-4" /> Painel Admin
          </Link>
        </>
      )}
    </nav>
  );
}
