import { Logo } from "@/components/Logo";
import { ExchangeRateTicker } from "@/components/ExchangeRateTicker";
import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Users, Megaphone, CheckSquare, Package, ShieldAlert, ShieldCheck, Bug, Send } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const nav = [
  { to: "/admin", label: "Usuarios", icon: Users, exact: true },
  { to: "/admin/admins", label: "Administradores", icon: ShieldCheck },
  { to: "/admin/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/admin/provas", label: "Provas", icon: CheckSquare },
  { to: "/admin/pacotes", label: "Pacotes", icon: Package },
  { to: "/admin/saques", label: "Saques", icon: Send },
  { to: "/admin/logs", label: "Logs do Sistema", icon: Bug },
];

function AdminLayout() {
  const { session, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Verificando permissoes...</div>;
  }

  if (!session) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-noir-gradient flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center bg-card/60 border border-destructive/40 rounded-lg p-8">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Acesso Negado</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Voce nao possui o papel <span className="text-gold font-semibold">admin</span> e
            nao pode acessar esta area. Caso acredite ser um engano, peca a um administrador
            para promover seu usuario.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => navigate({ to: "/app" })}>Ir para o app</Button>
            <Button variant="ghost" onClick={() => { signOut(); navigate({ to: "/login" }); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-gradient">
      <header className="border-b border-border/50 bg-background/80">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2">
            <Logo className="h-8 w-auto max-w-[180px]" textClassName="text-base" />
            <span className="text-primary text-xs font-bold tracking-wider">ADMIN</span>
          </Link>

          <div className="flex items-center gap-3">
            <ExchangeRateTicker />
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <aside>
          <nav className="space-y-1">
            {nav.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
              return (
                <Link key={to} to={to as any} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-gold/10 text-gold border border-gold/30" : "text-muted-foreground hover:bg-card hover:text-foreground"
                }`}><Icon className="h-4 w-4" />{label}</Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}
