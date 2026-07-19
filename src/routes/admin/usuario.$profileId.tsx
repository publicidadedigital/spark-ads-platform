import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Clock, TrendingUp, Users, Wallet, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/usuario/$profileId")({ component: AdminUserDashboard });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR") + " " + new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const todayBRStr = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

type Profile = { nome: string | null; email: string | null; status: string | null; packages: { nome: string; valor: number } | null };
type Cycle = { saldo_bonificacoes: number; percentual_atual: number; status: string; started_at: string };
type Bonus = { id: string; tipo: string; valor: string; status: string; created_at: string };
type Share = { id: string; status: string; created_at: string; operational_day: string; shared_link: string; campaigns?: { titulo: string } | null };
type NetMember = { id: string; nome: string | null; email: string | null; status: string | null };

const TIPO_LABEL: Record<string, string> = {
  adesao: "Adesão", renovacao: "Renovação", residual: "Residual",
  diario: "Diário", mensalidade: "Mensalidade", ajuste: "Ajuste", publicidade: "Publicidade",
};

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: any }) {
  return (
    <Card className="border-primary/15 bg-card/50 p-4 flex items-start gap-3">
      <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
}

export function AdminUserDashboard() {
  const { supabase } = useAuth();
  const { profileId } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [network, setNetwork] = useState<NetMember[]>([]);

  useEffect(() => {
    if (!supabase || !profileId) return;
    (async () => {
      const [
        { data: prof },
        { data: cyc },
        { data: bon },
        { data: shr },
        { data: net },
      ] = await Promise.all([
        supabase
          .from("users_profile")
          .select("nome,email,status,packages:pacote_ativo_id(nome,valor)")
          .eq("id", profileId)
          .maybeSingle(),
        supabase
          .from("user_cycles")
          .select("saldo_bonificacoes,percentual_atual,status,started_at")
          .eq("user_id", profileId)
          .in("status", ["ativo", "concluido"])
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("bonuses")
          .select("id,tipo,valor,status,created_at")
          .eq("user_id", profileId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("campaign_shares")
          .select("id,status,created_at,operational_day,shared_link,campaigns:campaign_id(titulo)")
          .eq("user_id", profileId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("users_profile")
          .select("id,nome,email,status")
          .eq("indicador_id", profileId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      setProfile(prof as Profile);
      setCycle(cyc as Cycle);
      setBonuses((bon ?? []) as Bonus[]);
      setShares((shr ?? []) as Share[]);
      setNetwork((net ?? []) as NetMember[]);
      setLoading(false);
    })();
  }, [supabase, profileId]);

  if (loading) return <p className="p-6 text-muted-foreground text-sm">Carregando...</p>;
  if (!profile) return <p className="p-6 text-muted-foreground text-sm">Usuário não encontrado.</p>;

  const releasedBonuses = bonuses.filter((b) => b.status === "liberado");
  const sumBy = (tipo: string) =>
    releasedBonuses.filter((b) => b.tipo === tipo).reduce((s, b) => s + Number(b.valor), 0);
  const totalBonus = releasedBonuses.reduce((s, b) => s + Number(b.valor), 0);
  const sharesToday = shares.filter((s) => s.operational_day === todayBRStr);
  const approvedToday = sharesToday.filter((s) => s.status === "aprovada").length;

  const STATUS_BADGE: Record<string, JSX.Element> = {
    aprovada: <Badge className="border-success/30 bg-success/10 text-success text-[10px]">Aprovada</Badge>,
    pendente: <Badge className="border-amber-400/30 bg-amber-500/10 text-amber-300 text-[10px]">Pendente</Badge>,
    rejeitada: <Badge className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">Rejeitada</Badge>,
    removida: <Badge className="border-muted/30 bg-muted/10 text-muted-foreground text-[10px]">Removida</Badge>,
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/rede">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{profile.nome ?? "—"}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
        <Badge className="ml-auto" variant={profile.status === "ativo" ? "default" : "secondary"}>
          {profile.status ?? "—"}
        </Badge>
      </div>

      {/* Stats grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Saldo disponível"
          value={usd.format(Number(cycle?.saldo_bonificacoes ?? 0))}
          sub={cycle ? `Ciclo ${cycle.status}` : "Sem ciclo ativo"}
          icon={Wallet}
        />
        <StatCard
          label="Ganhos diários"
          value={usd.format(sumBy("diario"))}
          sub="Total liberado"
          icon={TrendingUp}
        />
        <StatCard
          label="Total bônus liberado"
          value={usd.format(totalBonus)}
          sub="Todos os tipos"
          icon={Wallet}
        />
        <StatCard
          label="Compartilhamentos hoje"
          value={`${approvedToday} aprovados`}
          sub={`${sharesToday.length} enviados`}
          icon={Users}
        />
      </div>

      {/* Pacote + ciclo */}
      {(profile.packages || cycle) && (
        <Card className="border-primary/15 bg-card/50 p-4">
          <h2 className="font-semibold mb-3">Ciclo atual</h2>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            {profile.packages && (
              <div>
                <p className="text-xs text-muted-foreground">Pacote</p>
                <p className="font-medium">{(profile.packages as any).nome} — {usd.format(Number((profile.packages as any).valor))}</p>
              </div>
            )}
            {cycle && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Percentual atual</p>
                  <p className="font-medium">{cycle.percentual_atual}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Início</p>
                  <p className="font-medium">{new Date(cycle.started_at).toLocaleDateString("pt-BR")}</p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Bônus */}
        <Card className="border-primary/15 bg-card/50 p-4">
          <h2 className="font-semibold mb-3">Bônus ({bonuses.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/40 text-muted-foreground">
                <tr>
                  <th className="text-left py-1.5 pr-3">Tipo</th>
                  <th className="text-left py-1.5 pr-3">Valor</th>
                  <th className="text-left py-1.5 pr-3">Status</th>
                  <th className="text-left py-1.5">Data</th>
                </tr>
              </thead>
              <tbody>
                {bonuses.slice(0, 20).map((b) => (
                  <tr key={b.id} className="border-b border-border/20">
                    <td className="py-1.5 pr-3">{TIPO_LABEL[b.tipo] ?? b.tipo}</td>
                    <td className="py-1.5 pr-3 font-medium">{usd.format(Number(b.valor))}</td>
                    <td className="py-1.5 pr-3">
                      {b.status === "liberado" ? (
                        <span className="text-success flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Liberado</span>
                      ) : b.status === "cancelado" ? (
                        <span className="text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" /> Cancelado</span>
                      ) : (
                        <span className="text-amber-300 flex items-center gap-1"><Clock className="h-3 w-3" /> {b.status}</span>
                      )}
                    </td>
                    <td className="py-1.5 text-muted-foreground">{fmtDate(b.created_at)}</td>
                  </tr>
                ))}
                {bonuses.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-muted-foreground">Nenhum bônus</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Compartilhamentos */}
        <Card className="border-primary/15 bg-card/50 p-4">
          <h2 className="font-semibold mb-3">Compartilhamentos recentes ({shares.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/40 text-muted-foreground">
                <tr>
                  <th className="text-left py-1.5 pr-3">Campanha</th>
                  <th className="text-left py-1.5 pr-3">Status</th>
                  <th className="text-left py-1.5">Data</th>
                </tr>
              </thead>
              <tbody>
                {shares.slice(0, 20).map((s) => (
                  <tr key={s.id} className="border-b border-border/20">
                    <td className="py-1.5 pr-3 max-w-[160px] truncate">
                      {(s.campaigns as any)?.titulo ?? <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-1.5 pr-3">{STATUS_BADGE[s.status] ?? s.status}</td>
                    <td className="py-1.5 text-muted-foreground">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
                {shares.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-center text-muted-foreground">Nenhum compartilhamento</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Rede indicada */}
      {network.length > 0 && (
        <Card className="border-primary/15 bg-card/50 p-4">
          <h2 className="font-semibold mb-3">Indicados diretos ({network.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/40 text-muted-foreground">
                <tr>
                  <th className="text-left py-1.5 pr-3">Nome</th>
                  <th className="text-left py-1.5 pr-3">E-mail</th>
                  <th className="text-left py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {network.map((m) => (
                  <tr key={m.id} className="border-b border-border/20">
                    <td className="py-1.5 pr-3 font-medium">{m.nome ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{m.email ?? "—"}</td>
                    <td className="py-1.5">
                      <Badge variant={m.status === "ativo" ? "default" : "secondary"} className="text-[10px]">
                        {m.status ?? "—"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
