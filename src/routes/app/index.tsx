import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, TrendingUp, Share2, Users, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/")({ component: Dashboard });

type Stats = {
  saldo: number;
  pacote: { nome: string; valor: number } | null;
  cycle: { percentual: number; status: string } | null;
  status: string;
  sharesHoje: number;
  metaDia: number;
  ganhosDiarios: number;
  ganhosIndicacao: number;
  ganhosEquipe: number;
  recentShares: any[];
};

function Dashboard() {
  const { supabase, user } = useAuth();
  const [s, setS] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("users_profile")
        .select("id, status, pacote_ativo_id, packages:pacote_ativo_id(nome,valor)")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!profile) { setLoading(false); return; }
      const profileId = profile.id;

      const { data: cycle } = await supabase
        .from("user_cycles")
        .select("percentual_atual, saldo_bonificacoes, status")
        .eq("user_id", profileId)
        .eq("status", "ativo")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const today = new Date(); today.setHours(0,0,0,0);
      const { count: sharesHoje } = await supabase
        .from("campaign_shares")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profileId)
        .gte("created_at", today.toISOString());

      const { data: bonusDia } = await supabase
        .from("bonuses")
        .select("valor,tipo")
        .eq("user_id", profileId)
        .eq("status", "liberado");

      const sumBy = (t: string) => (bonusDia ?? [])
        .filter((b: any) => b.tipo === t)
        .reduce((a: number, b: any) => a + Number(b.valor), 0);

      const { data: recentShares } = await supabase
        .from("campaign_shares")
        .select("id,status,motivo_rejeicao,created_at,campaigns:campaign_id(titulo)")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(8);

      setS({
        saldo: Number(cycle?.saldo_bonificacoes ?? 0),
        pacote: profile.packages as any,
        cycle: cycle ? { percentual: Number(cycle.percentual_atual), status: cycle.status } : null,
        status: profile.status,
        sharesHoje: sharesHoje ?? 0,
        metaDia: 5,
        ganhosDiarios: sumBy("diario"),
        ganhosIndicacao: sumBy("indicacao"),
        ganhosEquipe: sumBy("equipe"),
        recentShares: recentShares ?? [],
      });
      setLoading(false);
    })();
  }, [supabase, user]);

  if (loading) return <p className="text-muted-foreground">Carregando dashboard...</p>;
  if (!s) return <EmptyState />;

  const restantes = Math.max(0, s.metaDia - s.sharesHoje);

  return (
    <div className="space-y-6 dashboard-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral do seu desempenho</p>
        </div>
        <StatusBadge status={s.status} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 dashboard-stat-grid">
        <Stat icon={Wallet} label="Saldo do ciclo" value={`R$ ${s.saldo.toFixed(2)}`} />
        <Stat icon={TrendingUp} label="Pacote ativo" value={s.pacote?.nome ?? "Nenhum"} sub={s.pacote ? `R$ ${Number(s.pacote.valor).toFixed(2)}` : "Adquira um pacote"} />
        <Stat icon={Share2} label="Compartilhamentos hoje" value={`${s.sharesHoje} / ${s.metaDia}`} sub={restantes > 0 ? `Faltam ${restantes}` : "Meta cumprida"} />
        <Stat icon={Users} label="Ciclo (até 200%)" value={`${s.cycle?.percentual.toFixed(2) ?? "0,00"}%`} />
      </div>

      <Card className="p-6 bg-card/50 border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Progresso do ciclo</h3>
          {s.cycle && s.cycle.percentual >= 200 && (
            <Link to="/app/renovacao"><Button size="sm" className="bg-gold-gradient text-primary-foreground">Renovar pacote</Button></Link>
          )}
        </div>
        <Progress value={Math.min(100, (s.cycle?.percentual ?? 0) / 2)} className="h-3" />
        <p className="text-xs text-muted-foreground mt-2">{(s.cycle?.percentual ?? 0).toFixed(2)}% de 200%</p>
      </Card>

      <div className="grid md:grid-cols-3 gap-4 dashboard-earnings-grid">
        <Stat label="Ganhos diários" value={`R$ ${s.ganhosDiarios.toFixed(2)}`} />
        <Stat label="Ganhos por indicação" value={`R$ ${s.ganhosIndicacao.toFixed(2)}`} />
        <Stat label="Ganhos de equipe" value={`R$ ${s.ganhosEquipe.toFixed(2)}`} />
      </div>

      <Card className="p-6 bg-card/50 border-border/50">
        <h3 className="font-semibold mb-4">Compartilhamentos recentes</h3>
        {s.recentShares.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum compartilhamento ainda. <Link to="/app/campanhas" className="text-gold hover:underline">Ver campanhas</Link></p>
        ) : (
          <div className="space-y-2">
            {s.recentShares.map((sh) => (
              <div key={sh.id} className="flex items-center justify-between border border-border/50 rounded-md p-3">
                <div>
                  <div className="text-sm font-medium">{sh.campaigns?.titulo ?? "Campanha"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(sh.created_at).toLocaleString("pt-BR")}</div>
                  {sh.status === "rejeitada" && sh.motivo_rejeicao && (
                    <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {sh.motivo_rejeicao}
                    </div>
                  )}
                </div>
                <ShareBadge status={sh.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: any) {
  return (
    <Card className="p-5 bg-card/50 border-border/50">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        {Icon && <Icon className="h-4 w-4 text-gold" />} {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    ativo: { v: "default", c: "bg-success/20 text-success border-success/30", l: "Ativo" },
    pendente: { v: "secondary", c: "bg-warning/20 text-warning border-warning/30", l: "Pendente" },
    bloqueado: { v: "destructive", c: "", l: "Bloqueado" },
    aguardando_renovacao: { v: "outline", c: "border-gold/50 text-gold", l: "Aguardando renovação" },
  };
  const m = map[status] ?? { v: "outline", c: "", l: status };
  return <Badge className={m.c} variant={m.v}>{m.l}</Badge>;
}

function ShareBadge({ status }: { status: string }) {
  const m: any = {
    pendente: "bg-warning/20 text-warning border-warning/30",
    aprovada: "bg-success/20 text-success border-success/30",
    rejeitada: "bg-destructive/20 text-destructive border-destructive/30",
  };
  return <Badge className={m[status] ?? ""} variant="outline">{status}</Badge>;
}

function EmptyState() {
  return (
    <Card className="p-10 text-center bg-card/50 border-border/50">
      <h3 className="font-semibold mb-2">Perfil não encontrado</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Seu perfil ainda não foi criado. Verifique o e-mail de confirmação ou contate o suporte.
      </p>
    </Card>
  );
}
