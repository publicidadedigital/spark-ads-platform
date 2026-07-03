import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, Network, Search, XCircle, CheckCircle, AlertTriangle, Zap, CreditCard, FileText, ExternalLink } from "lucide-react";
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
  observacao: string | null;
  motivo_cancelamento: string | null;
  comprovante_url: string | null;
  users_profile: { nome: string | null; email: string | null } | null;
  balance_holds: { release_at: string; status: string }[];
  // enriched after fetch
  activation_source?: string | null;
};

type CancelState = {
  row: BonusRow;
  motivo: "pagamento_nao_confirmado" | "ativacao_manual_sem_pagamento" | "outro" | "";
  observacao: string;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR") + " " + new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

const TIPO_LABEL: Record<string, string> = {
  adesao: "Adesão", renovacao: "Renovação", residual: "Residual",
  diario: "Diário", mensalidade: "Mensalidade", ajuste: "Ajuste", publicidade: "Publicidade",
};

const MOTIVO_LABELS: Record<string, string> = {
  pagamento_nao_confirmado: "Pagamento não confirmado",
  ativacao_manual_sem_pagamento: "Ativação manual sem pagamento efetuado",
  outro: "Outro motivo",
};

const STATUS_FILTERS = ["todos", "pendente", "liberado", "cancelado", "bloqueado"] as const;

function AdminRede() {
  const { supabase } = useAuth();
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [orphanOrigem, setOrphanOrigem] = useState<Set<string>>(new Set());
  const [cancelState, setCancelState] = useState<CancelState | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bonuses")
      .select("id,tipo,valor,status,nivel,created_at,origem_id,observacao,motivo_cancelamento,comprovante_url,users_profile:user_id(nome,email),balance_holds(release_at,status)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    const list = (data ?? []) as unknown as BonusRow[];

    // Enrich with activation_source from user_cycles
    const origemIds = [...new Set(list.map((r) => r.origem_id).filter((v): v is string => !!v))];
    if (origemIds.length) {
      const { data: cycles } = await supabase
        .from("user_cycles")
        .select("id,activation_source")
        .in("id", origemIds);
      const cycleMap = new Map((cycles ?? []).map((c: any) => [c.id, c]));
      const existing = new Set((cycles ?? []).map((c: any) => c.id));
      setOrphanOrigem(new Set(origemIds.filter((id) => !existing.has(id))));
      setRows(list.map((r) => ({
        ...r,
        activation_source: r.origem_id ? (cycleMap.get(r.origem_id)?.activation_source ?? null) : null,
      })));
    } else {
      setOrphanOrigem(new Set());
      setRows(list);
    }
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
    setActing(row.id);
    try {
      const { error: bErr } = await supabase.from("bonuses").update({ status: "liberado" }).eq("id", row.id);
      if (bErr) throw bErr;
      await supabase.from("balance_holds").delete().eq("bonus_id", row.id);
      supabase.rpc("release_available_balances");
      toast.success("Bônus liberado com sucesso");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao liberar");
    } finally {
      setActing(null);
    }
  }

  async function confirmarCancelamento() {
    if (!supabase || !cancelState) return;
    if (!cancelState.motivo) {
      toast.error("Selecione um motivo de cancelamento");
      return;
    }
    if (cancelState.motivo === "outro" && !cancelState.observacao.trim()) {
      toast.error("Informe o motivo no campo de texto");
      return;
    }
    setCancelling(true);
    try {
      const { error: bErr } = await supabase.from("bonuses").update({
        status: "cancelado",
        motivo_cancelamento: cancelState.motivo,
        observacao: cancelState.observacao.trim() || null,
      }).eq("id", cancelState.row.id);
      if (bErr) throw bErr;
      await supabase.from("balance_holds").delete().eq("bonus_id", cancelState.row.id);
      const profile = await supabase.from("bonuses").select("user_id,valor").eq("id", cancelState.row.id).single();
      if (profile.data) {
        supabase.rpc("decrement_saldo_a_liberar", {
          p_user_id: profile.data.user_id,
          p_valor: Number(profile.data.valor),
        });
      }
      toast.success("Bônus cancelado");
      setCancelState(null);
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao cancelar");
    } finally {
      setCancelling(false);
    }
  }

  async function getSignedUrl(comprovante_url: string, bonusId: string) {
    if (!supabase || signedUrls[bonusId]) {
      if (signedUrls[bonusId]) window.open(signedUrls[bonusId], "_blank");
      return;
    }
    const { data, error } = await supabase.storage
      .from("bonus-proofs")
      .createSignedUrl(comprovante_url, 300);
    if (error) { toast.error("Erro ao abrir comprovante"); return; }
    setSignedUrls((prev) => ({ ...prev, [bonusId]: data.signedUrl }));
    window.open(data.signedUrl, "_blank");
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
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground bg-muted/10">
                <tr>
                  <th className="text-left p-3">Usuário</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Ativação</th>
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
                  const isManual = row.activation_source === "manual";
                  const isPagamento = row.activation_source && row.activation_source !== "manual";
                  return (
                    <tr key={row.id} className="border-b border-border/30 hover:bg-muted/5 transition-colors align-top">
                      <td className="p-3">
                        <div className="font-medium">{profile?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{profile?.email ?? "—"}</div>
                      </td>
                      <td className="p-3">{TIPO_LABEL[row.tipo] ?? row.tipo}</td>
                      <td className="p-3">
                        {isManual ? (
                          <Badge className="border-violet-400/30 bg-violet-500/10 text-violet-300 gap-1">
                            <Zap className="h-3 w-3" /> Manual
                          </Badge>
                        ) : isPagamento ? (
                          <Badge className="border-emerald-400/30 bg-emerald-500/10 text-emerald-300 gap-1">
                            <CreditCard className="h-3 w-3" /> Pagamento
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{row.nivel != null ? `Nv ${row.nivel}` : "—"}</td>
                      <td className="p-3 font-semibold">{usd.format(Number(row.valor))}</td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(row.created_at)}</td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {releaseAt ? <span>{new Date(releaseAt).toLocaleDateString("pt-BR")}</span> : "—"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
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
                            {row.origem_id && orphanOrigem.has(row.origem_id) && (
                              <Badge title="O usuário que gerou este bônus foi excluído" className="border-destructive/30 bg-destructive/15 text-destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />Origem excluída
                              </Badge>
                            )}
                          </div>
                          {row.status === "cancelado" && row.motivo_cancelamento && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p className="font-medium text-destructive/70">{MOTIVO_LABELS[row.motivo_cancelamento] ?? row.motivo_cancelamento}</p>
                              {row.observacao && <p className="italic">"{row.observacao}"</p>}
                              {row.comprovante_url && (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 text-primary hover:underline"
                                  onClick={() => getSignedUrl(row.comprovante_url!, row.id)}
                                >
                                  <FileText className="h-3 w-3" /> Ver comprovante
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {row.status === "pendente" && (
                          <div className="flex gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={acting === row.id}
                              onClick={() => liberarBonus(row)}
                              className="text-xs text-success border-success/30 hover:bg-success/10"
                            >
                              Liberar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={acting === row.id}
                              onClick={() => setCancelState({ row, motivo: "", observacao: "" })}
                              className="text-xs"
                            >
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

      {/* ── Cancel Dialog ── */}
      <Dialog open={!!cancelState} onOpenChange={(open) => { if (!open) setCancelState(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar bônus</DialogTitle>
          </DialogHeader>
          {cancelState && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Bônus de <span className="font-semibold text-foreground">{usd.format(Number(cancelState.row.valor))}</span> para{" "}
                <span className="font-semibold text-foreground">{(cancelState.row.users_profile as any)?.nome ?? "—"}</span>.
                Esta ação não pode ser desfeita.
              </p>

              <div className="space-y-2">
                <Label>Motivo do cancelamento *</Label>
                <div className="space-y-2">
                  {(["pagamento_nao_confirmado", "ativacao_manual_sem_pagamento", "outro"] as const).map((m) => (
                    <label key={m} className="flex items-start gap-2.5 cursor-pointer rounded-lg border border-border/50 p-3 hover:bg-muted/10 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                      <input
                        type="radio"
                        name="motivo"
                        value={m}
                        checked={cancelState.motivo === m}
                        onChange={() => setCancelState((s) => s ? { ...s, motivo: m } : s)}
                        className="mt-0.5 accent-primary"
                      />
                      <span>{MOTIVO_LABELS[m]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {cancelState.motivo === "outro" && (
                <div className="space-y-1">
                  <Label>Descreva o motivo *</Label>
                  <Textarea
                    value={cancelState.observacao}
                    onChange={(e) => setCancelState((s) => s ? { ...s, observacao: e.target.value } : s)}
                    placeholder="Ex: Irregularidade detectada na conta..."
                    rows={3}
                  />
                </div>
              )}

              {cancelState.motivo === "pagamento_nao_confirmado" && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-amber-200 text-xs space-y-1">
                  <p className="font-semibold">O que acontece após o cancelamento:</p>
                  <p>• O associado verá o motivo "<strong>Pagamento não confirmado</strong>" no extrato.</p>
                  <p>• Um campo de upload de comprovante será exibido para o associado enviar o comprovante de pagamento.</p>
                  <p>• O comprovante ficará disponível nesta página para sua revisão.</p>
                </div>
              )}

              {cancelState.motivo === "ativacao_manual_sem_pagamento" && (
                <div className="space-y-1">
                  <Label>Observação adicional (opcional)</Label>
                  <Textarea
                    value={cancelState.observacao}
                    onChange={(e) => setCancelState((s) => s ? { ...s, observacao: e.target.value } : s)}
                    placeholder="Detalhes adicionais..."
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelState(null)} disabled={cancelling}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={confirmarCancelamento} disabled={cancelling || !cancelState?.motivo}>
              {cancelling ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
