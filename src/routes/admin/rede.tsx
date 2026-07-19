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
import { ChevronDown, ChevronUp, Clock, Network, RefreshCw, Search, Users, XCircle, CheckCircle, AlertTriangle, Zap, CreditCard, FileText, ExternalLink, Megaphone, UserCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/rede")({ component: AdminRede });

type BonusRow = {
  id: string;
  user_id: string;
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

// ── Cascade network types ──
type NetMember = {
  id: string;
  nome: string | null;
  status: string | null;
  created_at: string | null;
  indicador_id: string | null;
  nivel: number;
  pacote_nome: string | null;
};

function buildNetwork(rootId: string | null, members: NetMember[]) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const childrenByParent = new Map<string, NetMember[]>();
  members.forEach((m) => {
    const parentId = m.indicador_id && (m.indicador_id === rootId || byId.has(m.indicador_id)) ? m.indicador_id : "root";
    const list = childrenByParent.get(parentId) ?? [];
    list.push(m);
    childrenByParent.set(parentId, list);
  });
  childrenByParent.forEach((list) => list.sort((a, b) => a.nivel - b.nivel || (a.nome ?? "").localeCompare(b.nome ?? "")));
  return { childrenByParent, roots: childrenByParent.get(rootId ?? "root") ?? childrenByParent.get("root") ?? [] };
}

function countDesc(id: string, byParent: Map<string, NetMember[]>): number {
  const ch = byParent.get(id) ?? [];
  return ch.length + ch.reduce((s, c) => s + countDesc(c.id, byParent), 0);
}

const LEVEL_STYLE: Record<number, { dot: string; border: string; badge: string; label: string }> = {
  1: { dot: "from-primary to-blue-400",   border: "border-primary/70",   badge: "bg-primary/20 text-primary border-primary/40",         label: "Nível 1" },
  2: { dot: "from-violet-600 to-fuchsia-400", border: "border-violet-500/70", badge: "bg-violet-500/20 text-violet-300 border-violet-400/40", label: "Nível 2" },
  3: { dot: "from-emerald-600 to-green-300",  border: "border-emerald-500/70", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40", label: "Nível 3" },
  4: { dot: "from-amber-500 to-yellow-300",   border: "border-amber-400/70",   badge: "bg-amber-500/20 text-amber-300 border-amber-400/40",   label: "Nível 4+" },
};

function connectorColor(level: number) {
  if (level === 1) return "border-primary/60";
  if (level === 2) return "border-violet-400/60";
  if (level === 3) return "border-emerald-400/60";
  return "border-amber-400/60";
}

function NetTreeNode({
  member, byParent, expanded, onToggle, depth,
}: { member: NetMember; byParent: Map<string, NetMember[]>; expanded: Set<string>; onToggle: (id: string) => void; depth: number }) {
  const children = byParent.get(member.id) ?? [];
  const isOpen = expanded.has(member.id);
  const hasChildren = children.length > 0;
  const style = LEVEL_STYLE[Math.min(4, member.nivel)] ?? LEVEL_STYLE[4];
  const totalDesc = countDesc(member.id, byParent);

  return (
    <div>
      <div className="flex items-center gap-2 group" style={{ paddingLeft: `${depth * 24}px` }}>
        {depth > 0 && <div className={`w-4 h-px ${connectorColor(member.nivel)} border-t border-dashed shrink-0`} />}
        <button
          type="button"
          onClick={() => hasChildren && onToggle(member.id)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border transition ${hasChildren ? "border-border/60 bg-card hover:border-primary/60 hover:bg-primary/10 cursor-pointer" : "border-transparent cursor-default opacity-0"}`}
        >
          {hasChildren && (isOpen
            ? <ChevronDown className="h-3.5 w-3.5 text-primary" />
            : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground -rotate-90 transition-transform" />)}
        </button>
        <div
          className={`flex flex-1 min-w-0 items-center gap-3 rounded-lg border ${style.border} bg-card/70 px-3 py-2.5 my-0.5 transition hover:bg-card/90 ${hasChildren ? "cursor-pointer" : ""}`}
          onClick={() => hasChildren && onToggle(member.id)}
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${style.dot} text-xs font-bold text-white`}>
            {(member.nome ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="truncate text-sm font-semibold">{member.nome ?? "Usuário"}</span>
              {member.pacote_nome && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 shrink-0">
                  <Zap className="h-2.5 w-2.5" />{member.pacote_nome}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${style.badge}`}>{style.label}</Badge>
              {hasChildren && (
                <span className="text-[10px] text-muted-foreground">
                  {children.length} diretos{totalDesc > children.length ? ` · ${totalDesc} na rede` : ""}
                </span>
              )}
              {!hasChildren && <span className="text-[10px] text-muted-foreground">Sem indicados</span>}
            </div>
          </div>
          <div className={`h-2 w-2 shrink-0 rounded-full ${member.status === "ativo" ? "bg-success" : "bg-muted-foreground/40"}`} title={member.status ?? ""} />
        </div>
      </div>
      {isOpen && hasChildren && (
        <div className="relative">
          <div className={`absolute top-0 bottom-0 border-l border-dashed ${connectorColor(member.nivel)}`} style={{ left: `${depth * 24 + 30}px` }} />
          <div className="space-y-0">
            {children.map((child) => (
              <NetTreeNode key={child.id} member={child} byParent={byParent} expanded={expanded} onToggle={onToggle} depth={depth + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminRede() {
  const { supabase } = useAuth();
  const [tab, setTab] = useState<"bonus" | "cascata">("bonus");

  // ── Bonus tab state ──
  const [rows, setRows] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);
  const [orphanOrigem, setOrphanOrigem] = useState<Set<string>>(new Set());
  const [cancelState, setCancelState] = useState<CancelState | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // ── Cascata tab state ──
  const [userSearch, setUserSearch] = useState("");
  const [userSuggestions, setUserSuggestions] = useState<{ id: string; nome: string | null; email: string | null }[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; nome: string | null } | null>(null);
  const [netMembers, setNetMembers] = useState<NetMember[]>([]);
  const [netLoading, setNetLoading] = useState(false);
  const [netExpanded, setNetExpanded] = useState<Set<string>>(new Set());

  async function searchUsers(term: string) {
    if (!supabase || term.length < 2) { setUserSuggestions([]); return; }
    const { data } = await supabase
      .from("users_profile")
      .select("id,nome,email")
      .or(`nome.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(8);
    setUserSuggestions((data ?? []) as any[]);
  }

  async function loadNetwork(user: { id: string; nome: string | null }) {
    if (!supabase) return;
    setSelectedUser(user);
    setUserSearch(user.nome ?? "");
    setUserSuggestions([]);
    setNetLoading(true);
    const { data } = await supabase.rpc("get_user_network", { root_id: user.id });
    const parsed = (data ?? []).map((row: any) => ({
      id: row.id, nome: row.nome, status: row.status, created_at: row.created_at,
      indicador_id: row.indicador_id, nivel: row.nivel, pacote_nome: row.pacote_nome ?? null,
    })) as NetMember[];
    setNetMembers(parsed);
    setNetExpanded(new Set(parsed.filter((m) => m.nivel === 1).slice(0, 5).map((m) => m.id)));
    setNetLoading(false);
  }

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bonuses")
      .select("id,user_id,tipo,valor,status,nivel,created_at,origem_id,observacao,motivo_cancelamento,comprovante_url,users_profile:user_id(nome,email),balance_holds(release_at,status)")
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
  const netNetwork = useMemo(() => buildNetwork(selectedUser?.id ?? null, netMembers), [selectedUser?.id, netMembers]);

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

      {/* Tab switcher */}
      <div className="flex gap-2">
        <Button size="sm" variant={tab === "bonus" ? "default" : "outline"} onClick={() => setTab("bonus")}>
          Bônus {pendingCount > 0 && <span className="ml-1.5 rounded-full bg-amber-500 text-black text-xs px-1.5">{pendingCount}</span>}
        </Button>
        <Button size="sm" variant={tab === "cascata" ? "default" : "outline"} onClick={() => setTab("cascata")}>
          <Users className="mr-2 h-4 w-4" /> Rede em Cascata
        </Button>
      </div>

      {/* ── CASCATA TAB ── */}
      {tab === "cascata" && (
        <div className="space-y-4">
          <Card className="p-4 bg-card/50 border-border/50">
            <p className="text-sm text-muted-foreground mb-3">Busque um associado para visualizar a rede dele em cascata:</p>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nome ou e-mail do associado..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); searchUsers(e.target.value); }}
              />
              {userSuggestions.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                  {userSuggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/20 transition border-b border-border/30 last:border-0"
                      onClick={() => loadNetwork(u)}
                    >
                      <div className="font-medium">{u.nome ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {selectedUser && (
            <Card className="overflow-hidden border-primary/20 bg-card/50">
              <div className="flex flex-col gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Rede de {selectedUser.nome}</h2>
                  <p className="text-sm text-muted-foreground">{netMembers.length} membro(s) na rede</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => loadNetwork(selectedUser)} disabled={netLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
                  </Button>
                  {netMembers.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setNetExpanded((prev) => {
                        const allOpen = netMembers.every((m) => prev.has(m.id));
                        return allOpen ? new Set<string>() : new Set(netMembers.map((m) => m.id));
                      });
                    }}>
                      {netMembers.every((m) => netExpanded.has(m.id)) ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                      {netMembers.every((m) => netExpanded.has(m.id)) ? "Recolher tudo" : "Expandir tudo"}
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-4">
                {netLoading ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Carregando rede...</p>
                ) : netMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Este associado não possui indicados na rede.</p>
                ) : (
                  <div className="space-y-0">
                    {netNetwork.roots.map((member) => (
                      <NetTreeNode
                        key={member.id}
                        member={member}
                        byParent={netNetwork.childrenByParent}
                        expanded={netExpanded}
                        onToggle={(id) => setNetExpanded((prev) => {
                          const next = new Set(prev);
                          next.has(id) ? next.delete(id) : next.add(id);
                          return next;
                        })}
                        depth={0}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "bonus" && (<>

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
                        {row.tipo === "diario" ? (
                          <Badge className="border-blue-400/30 bg-blue-500/10 text-blue-300 gap-1">
                            <Megaphone className="h-3 w-3" /> Campanha
                          </Badge>
                        ) : isManual ? (
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
                        <div className="flex flex-col gap-1.5 items-end">
                          <ImpersonateButton profileId={row.user_id} />
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      </>)}

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

function ImpersonateButton({ profileId }: { profileId: string }) {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleImpersonate() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error("Sessão inválida"); return; }

      const res = await fetch(`/api/admin/impersonate/${profileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Erro ao gerar acesso"); return; }

      // Copy link to clipboard and show instruction to open in incognito
      await navigator.clipboard.writeText(json.link).catch(() => {});
      toast.info(
        "Link copiado! Abra uma aba anônima (Ctrl+Shift+N) e cole o link para entrar como este usuário sem perder sua sessão.",
        { duration: 8000 },
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      onClick={handleImpersonate}
      className="text-xs gap-1 border-violet-400/30 text-violet-300 hover:bg-violet-500/10"
    >
      <UserCheck className="h-3 w-3" />
      {loading ? "Gerando..." : "Assumir conta"}
    </Button>
  );
}
