import { Logo } from "@/components/Logo";
import { ExchangeRateTicker } from "@/components/ExchangeRateTicker";
import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LogOut, Users, Megaphone, CheckSquare, Package, ShieldAlert, ShieldCheck, Bug, Send, DollarSign, Lock, RefreshCw, Trophy, Building2, CreditCard, Zap, Menu, Network, Wallet } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

const nav = [
  { to: "/admin", label: "Usuarios", icon: Users, exact: true },
  { to: "/admin/admins", label: "Administradores", icon: ShieldCheck },
  { to: "/admin/campanhas", label: "Campanhas", icon: Megaphone },
  { to: "/admin/provas", label: "Provas", icon: CheckSquare },
  { to: "/admin/campanhas-anunciantes", label: "Campanhas Anunciantes", icon: Building2, countKey: "campanhasAnunciantes" },
  { to: "/admin/pagamentos", label: "Pagamentos", icon: CreditCard },
  { to: "/admin/pacotes", label: "Pacotes", icon: Package },
  { to: "/admin/renovacao", label: "Renovação", icon: RefreshCw },
  { to: "/admin/pontuacao", label: "Pontuação", icon: Trophy },
  { to: "/admin/saques", label: "Saques", icon: Send, countKey: "saques" },
  { to: "/admin/rede", label: "Bônus de Rede", icon: Network },
  { to: "/admin/carteiras", label: "Carteiras", icon: Wallet },
  { to: "/admin/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/admin/seguranca", label: "Segurança", icon: Lock },
  { to: "/admin/ativacao", label: "Ativação Manual", icon: Zap },
  { to: "/admin/logs", label: "Logs do Sistema", icon: Bug },
] as const;

type PendingCounts = { campanhasAnunciantes: number; saques: number };

function AdminLayout() {
  const { session, loading, isAdmin, signOut, supabase } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [counts, setCounts] = useState<PendingCounts>({ campanhasAnunciantes: 0, saques: 0 });

  useEffect(() => {
    if (!loading && !session && loc.pathname !== "/admin/login") navigate({ to: "/admin/login" });
  }, [loading, session, navigate, loc.pathname]);

  useEffect(() => {
    if (!supabase || !isAdmin) return;
    const client = supabase;
    async function loadCounts() {
      const [{ count: campCount }, { count: saqueCount }] = await Promise.all([
        client.from("advertiser_campaigns").select("id", { count: "exact", head: true }).eq("status", "em_analise"),
        client.from("withdrawal_requests").select("id", { count: "exact", head: true }).in("status", ["solicitado", "em_analise"]),
      ]);
      setCounts({ campanhasAnunciantes: campCount ?? 0, saques: saqueCount ?? 0 });
    }
    loadCounts();
    const interval = setInterval(loadCounts, 60_000);
    return () => clearInterval(interval);
  }, [supabase, isAdmin]);

  if (loc.pathname === "/admin/login") return <Outlet />;

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
            <Button variant="ghost" onClick={() => { signOut(); navigate({ to: "/admin/login" }); }}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-noir-gradient">
      <header className="border-b border-border/50 bg-background/80 sticky top-0 z-40 backdrop-blur">
        <div className="w-full max-w-screen-2xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="app-mobile-menu hidden"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 pt-6">
                <AdminNav pathname={loc.pathname} counts={counts} />
              </SheetContent>
            </Sheet>
            <Link to="/admin" className="flex items-center gap-2">
              <Logo className="h-8 w-auto max-w-[140px]" textClassName="text-base" />
              <span className="text-primary text-xs font-bold tracking-wider">ADMIN</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ExchangeRateTicker />
            <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate({ to: "/admin/login" }); }}>
              <LogOut className="h-4 w-4 mr-2" /><span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>
      <div className="app-shell-grid w-full max-w-screen-2xl mx-auto px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
        <aside className="app-sidebar hidden md:block">
          <AdminNav pathname={loc.pathname} counts={counts} />
        </aside>
        <main className="min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}

function AdminNav({ pathname, counts }: { pathname: string; counts: PendingCounts }) {
  return (
    <nav className="space-y-1 px-3">
      {nav.map((item) => {
        const { to, label, icon: Icon, exact } = item as typeof item & { exact?: boolean; countKey?: keyof PendingCounts };
        const active = exact ? pathname === to : pathname.startsWith(to);
        const countKey = (item as any).countKey as keyof PendingCounts | undefined;
        const count = countKey ? counts[countKey] : 0;
        return (
          <Link key={to} to={to as any} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
            active ? "bg-gold/10 text-gold border border-gold/30" : "text-muted-foreground hover:bg-card hover:text-foreground"
          }`}>
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {count > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-destructive-foreground">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
