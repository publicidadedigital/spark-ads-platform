import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Network, Search, TrendingUp, XCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/rede")({ component: AdminRede });

type BonusRow = {
  id: string;
  tipo: string;
  valor: number | string;
  status: string;
  nivel: number | null;
  created_at: string;
  origem_id: string | null;
  users_profile: { nome: string | null; email: string | null } | null;
  balance_holds: { release_at: string; status: string }[];
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR") + " " + new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

const TIPO_LABEL: Record<string, string> = {
  adesao: "Adesão", renovacao: "Renovação", residual: "Residual",
  diario: "Diário", mensalidade: "Mensalidade", ajuste: "Ajuste", publicidade: "Publicidade",
};

const STATUS_FILTERS = ["todos", "pendente", "liberado", "cancelado", "bloqueado"] as const;

function AdminRede() {
  const { supabase } = useAuth();
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bonuses")
      .select("id,tipo,valor,status,nivel,created_at,origem_id,users_profile:user_id(nome,email),balance_holds(release_at,status)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setRows((data ?? []) as unknown as BonusRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  const totals = useMemo(() => ({
    pendente: rows.filter((r) => r.status === "pendente").reduce((s, r) => s + Number(r.valor), 0),
    liberado: rows.filter((r) => r.status === "liberado").reduce((s, r) => s + Number(r.valor), 0),
    cancelado: rows.filter((r) => r.status === "cancelado").reduce((s, r) => s + Number(r.valor), 0),
  }), [rows]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (term) {
        const profile = r.users_profile as any;
        return (profile?.nome ?? "").toLowerCase().includes(term) || (profile?.email ?? "").toLowerCase().includes(term);
      }
      return true;
    });
  }, [rows, statusFilter, search]);

  async function liberarBonus(row: BonusRow) {
    if (!supabase) return;
    if (!confirm(`Liberar bônus de ${usd.format(Number(row.valor))} manualmente?`)) return;
    setActing(row.id);
    try {
      const { error: bErr } = await supabase.from("bonuses").update({ status: "liberado" }).eq("id", row.id);
      if (bErr) throw bErr;
      await supabase.from("balance_holds").delete().eq("bonus_id", row.id);
      await supabase.rpc("release_available_balances").catch(() => {});
      toast.success("Bônus liberado com sucesso");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao liberar");
    } finally {
      setActing(null);
    }
  }

  async function cancelarBonus(row: BonusRow) {
    if (!supabase) return;
    if (!confirm(`Cancelar bônus de ${usd.format(Number(row.valor))}? Esta ação não pode ser desfeita.`)) return;
    setActing(row.id);
    try {
      const { error: bErr } = await supabase.from("bonuses").update({ status: "cancelado" }).eq("id", row.id);
      if (bErr) throw bErr;
      await supabase.from("balance_holds").delete().eq("bonus_id", row.id);
      const profile = await supabase.from("bonuses").select("user_id,valor").eq("id", row.id).single();
      if (profile.data) {
        await supabase.rpc("decrement_saldo_a_liberar", { p_user_id: profile.data.user_id, p_valor: Number(profile.data.valor) }).catch(() => {});
      }
      toast.success("Bônus cancelado");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao cancelar");
    } finally {
      setActing(null);
    }
  }

  const pendingCount = rows.filter((r) => r.status === "pendente").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6 text-gold shrink-0" /> Bônus de Rede
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie todos os bônus de indicação, renovação e residuais. Libere ou cancele manualmente.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Atualizar</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-amber-500/10 border-amber-400/30 p-4">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-amber-300 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-2xl font-bold text-amber-300">{usd.format(totals.pendente)}</p>
              <p className="text-xs text-muted-foreground">{pendingCount} bônus em retenção</p>
            </div>
          </div>
        </Card>
        <Card className="bg-success/10 border-success/30 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-success shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Liberados</p>
              <p className="text-2xl font-bold text-success">{usd.format(totals.liberado)}</p>
              <p className="text-xs text-muted-foreground">{rows.filter((r) => r.status === "liberado").length} bônus confirmados</p>
            </div>
          </div>
        </Card>
        <Card className="bg-destructive/10 border-destructive/30 p-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-destructive shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Cancelados</p>
              <p className="text-2xl font-bold text-destructive">{usd.format(totals.cancelado)}</p>
              <p className="text-xs text-muted-foreground">{rows.filter((r) => r.status === "cancelado").length} bônus cancelados</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)} className="capitalize">
              {s === "todos" ? "Todos" : s}
              {s === "pendente" && pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-black text-xs px-1.5">{pendingCount}</span>
              )}
            </Button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} registros</span>
      </div>

      <Card className="bg-card/50 border-border/50 overflow-hidden">
        {loading ? (
          <p className="p-6 text-muted-foreground text-sm">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">Nenhum bônus encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground bg-muted/10">
                <tr>
                  <th className="text-left p-3">Usuário</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Nível</th>
                  <th className="text-left p-3">Valor</th>
                  <th className="text-left p-3">Criado em</th>
                  <th className="text-left p-3">Libera em</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const profile = row.users_profile as any;
                  const hold = (row.balance_holds as any[])?.[0];
                  const releaseAt = hold?.release_at;
                  const days = releaseAt ? daysUntil(releaseAt) : null;
                  return (
                    <tr key={row.id} className="border-b border-border/30 hover:bg-muted/5 transition-colors">
                      <td className="p-3">
                        <div className="font-medium">{profile?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{profile?.email ?? "—"}</div>
                      </td>
                      <td className="p-3">{TIPO_LABEL[row.tipo] ?? row.tipo}</td>
                      <td className="p-3 text-muted-foreground">{row.nivel != null ? `Nv ${row.nivel}` : "—"}</td>
                      <td className="p-3 font-semibold">{usd.format(Number(row.valor))}</td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(row.created_at)}</td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {releaseAt ? (
                          <span>{new Date(releaseAt).toLocaleDateString("pt-BR")}</span>
                        ) : "—"}
                      </td>
                      <td className="p-3">
                        {row.status === "pendente" ? (
                          <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300">
                            <Clock className="h-3 w-3 mr-1" />{days != null ? `${days}d restantes` : "Pendente"}
                          </Badge>
                        ) : row.status === "liberado" ? (
                          <Badge className="border-success/30 bg-success/15 text-success">Liberado</Badge>
                        ) : row.status === "cancelado" ? (
                          <Badge className="border-destructive/30 bg-destructive/15 text-destructive">Cancelado</Badge>
                        ) : (
                          <Badge variant="outline">{row.status}</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {row.status === "pendente" && (
                          <div className="flex gap-1.5 justify-end">
                            <Button size="sm" variant="outline" disabled={acting === row.id} onClick={() => liberarBonus(row)} className="text-xs text-success border-success/30 hover:bg-success/10">
                              Liberar
                            </Button>
                            <Button size="sm" variant="destructive" disabled={acting === row.id} onClick={() => cancelarBonus(row)} className="text-xs">
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
