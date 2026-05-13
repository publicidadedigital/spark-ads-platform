import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({ component: LegalLayout });

const tabs = [
  { to: "/legal/termos", l: "Termos de uso" },
  { to: "/legal/privacidade", l: "Privacidade" },
  { to: "/legal/bonificacao", l: "Bonificação" },
  { to: "/legal/renovacao", l: "Renovação" },
  { to: "/legal/antifraude", l: "Antifraude" },
];

function LegalLayout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-noir-gradient">
      <header className="border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8 grid md:grid-cols-[220px_1fr] gap-8">
        <nav className="space-y-1">
          {tabs.map((t) => (
            <Link key={t.to} to={t.to} className={`block rounded-md px-3 py-2 text-sm transition ${
              loc.pathname === t.to ? "bg-gold/10 text-gold" : "text-muted-foreground hover:bg-card"
            }`}>{t.l}</Link>
          ))}
        </nav>
        <article className="prose prose-invert max-w-none">
          <Outlet />
        </article>
      </div>
    </div>
  );
}
