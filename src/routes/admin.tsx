import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, Users, Megaphone, CheckSquare, Package } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const nav = [
  { to: "/admin", label: "Usuários", icon: Users, exact: true },
  { to: "/admin/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/admin/provas", label: "Provas", icon: CheckSquare },
  { to: "/admin/pacotes", label: "Pacotes", icon: Package },
];

function AdminLayout() {
  const { session, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
    if (!loading && session && !isAdmin) navigate({ to: "/app" });
  }, [loading, session, isAdmin, navigate]);

  if (loading || !session || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Verificando permissões...</div>;
  }

  return (
    <div className="min-h-screen bg-noir-gradient">
      <header className="border-b border-border/50 bg-background/80">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/admin" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            <span className="font-bold tracking-tight">AURUM <span className="text-gold text-xs">ADMIN</span></span>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <aside>
          <nav className="space-y-1">
            {nav.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
              return (
                <Link key={to} to={to} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
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
