import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Zap, PackageOpen, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getTwoFactorStatus } from "@/lib/security/totp.functions";
import { TwoFactorReminderBanner } from "@/components/TwoFactorSetup";
import { getUsersLastLogin } from "@/lib/admin/users.functions";
import { activateDepositManually } from "@/lib/payments/admin-deposits.functions";

export const Route = createFileRoute("/admin/")({ component: AdminUsers });

type Tab = "clientes" | "anunciantes" | "saques" | "depositos";

type WithdrawalRow = {
  id: string;
  created_at: string;
  amount_usd: number | string;
  status: string;
  users_profile?: { nome: string | null; email: string | null } | null;
};

type DepositRow = {
  id: string;
  created_at: string;
  amount_usd: number | string;
  status: string;
  method: string;
  users_profile?: { nome: string | null; email: string | null } | null;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const withdrawalStatusMeta: Record<string, { label: string; className: string }> = {
  pago: { label: "Concluído", className: "border-success/30 bg-success/15 text-success hover:bg-success/15" },
  solicitado: { label: "Pendente", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  em_analise: { label: "Pendente", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  aprovado: { label: "Pendente", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  em_processamento: { label: "Pendente", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  recusado: { label: "Falhou", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
  cancelado: { label: "Falhou", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

const depositStatusMeta: Record<string, { label: string; className: string }> = {
  approved: { label: "Concluído", className: "border-success/30 bg-success/15 text-success hover:bg-success/15" },
  pending: { label: "Pendente", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  failed: { label: "Falhou", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
  expired: { label: "Falhou", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
  cancelled: { label: "Falhou", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

function AdminUsers() {
  const { supabase } = useAuth();
  const [tab, setTab] = useState<Tab>("clientes");
  const [users, setUsers] = useState<any[]>([]);
  const [advertisers, setAdvertisers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [lastLogins, setLastLogins] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [editingIndicador, setEditingIndicador] = useState<string | null>(null);
  const [indicadorSearch, setIndicadorSearch] = useState("");
  const [indicadorResults, setIndicadorResults] = useState<{ id: string; nome: string }[]>([]);
  const [activeCycles, setActiveCycles] = useState<Map<string, string>>(new Map());

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [{ data }, { data: adminRoles }, { data: legacyAdmins }, { data: adv }, { data: withdrawalRows }, { data: depositRows }, { data: cycleRows }] = await Promise.all([
      supabase.from("users_profile").select("*,package:pacote_ativo_id(nome,valor),indicador:indicador_id(id,nome)").order("created_at", { ascending: false }).limit(200),
      supabase.from("admin_roles").select("auth_user_id").eq("status", "ativo"),
      supabase.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
      supabase.from("advertiser_profiles").select("*").order("created_at", { ascending: false }).limit(200),
      supabase
        .from("withdrawal_requests")
        .select("id,created_at,amount_usd,status,users_profile:user_id(nome,email)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("payment_orders")
        .select("id,created_at,amount_usd,status,method,users_profile:user_id(nome,email)")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("user_cycles")
        .select("user_id,activation_source")
        .eq("status", "ativo"),
    ]);
    const adminIds = new Set([
      ...((adminRoles ?? []).map((r: any) => r.auth_user_id)),
      ...((legacyAdmins ?? []).map((r: any) => r.user_id)),
    ]);
    const cycleMap = new Map<string, string>();
    for (const c of cycleRows ?? []) cycleMap.set(c.user_id, c.activation_source ?? "payment_webhook");
    setActiveCycles(cycleMap);
    setUsers((data ?? []).filter((u: any) => !adminIds.has(u.auth_user_id)));
    setAdvertisers(adv ?? []);
    setWithdrawals((withdrawalRows ?? []) as unknown as WithdrawalRow[]);
    setDeposits((depositRows ?? []) as unknown as DepositRow[]);
    setLoading(false);

    const { data: session } = await supabase.auth.getSession();
    const accessToken = session.session?.access_token;
    if (accessToken) {
      getTwoFactorStatus({ data: { accessToken } })
        .then((status) => setTwoFactorEnabled(status.enabled))
        .catch(() => {});
      getUsersLastLogin({ data: { accessToken } })
        .then((result) => setLastLogins(result.lastLogins))
        .catch(() => {});
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function setStatus(id: string, status: string) {
    if (!supabase) return;
    const { error } = await supabase.from("users_profile").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    load();
  }

  async function activateDeposit(id: string) {
    if (!supabase) return;
    if (!window.confirm("Ativar este depósito manualmente? O ciclo do usuário será ativado.")) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error("Sessao expirada");
      await activateDepositManually({ data: { accessToken, paymentOrderId: id } });
      toast.success("Depósito ativado");
      load();
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao ativar depósito");
    }
  }

  async function searchIndicador(term: string) {
    setIndicadorSearch(term);
    if (!supabase || term.trim().length < 2) { setIndicadorResults([]); return; }
    const { data } = await supabase.from("users_profile").select("id,nome").ilike("nome", `%${term.trim()}%`).limit(8);
    setIndicadorResults((data ?? []) as { id: string; nome: string }[]);
  }

  async function saveIndicador(userId: string, indicadorId: string | null) {
    if (!supabase) return;
    const { error } = await supabase.from("users_profile").update({ indicador_id: indicadorId }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Indicador atualizado");
    setEditingIndicador(null);
    setIndicadorSearch("");
    setIndicadorResults([]);
    load();
  }

  async function setAdvertiserStatus(id: string, status: string) {
    if (!supabase) return;
    const { error } = await supabase.from("advertiser_profiles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    load();
  }

  function lastLoginLabel(authUserId: string | null | undefined) {
    if (!authUserId) return "—";
    const value = lastLogins[authUserId];
    if (!value) return "Nunca acessou";
    return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <Link to="/admin/admins" className="inline-flex">
          <Button variant="outline" size="sm"><ShieldCheck className="mr-2 h-4 w-4" /> Administradores</Button>
        </Link>
      </div>

      {!twoFactorEnabled && <TwoFactorReminderBanner to="/admin/seguranca" />}

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "clientes" ? "default" : "outline"} onClick={() => setTab("clientes")}>
          Clientes ({users.length})
        </Button>
        <Button size="sm" variant={tab === "anunciantes" ? "default" : "outline"} onClick={() => setTab("anunciantes")}>
          Anunciantes ({advertisers.length})
        </Button>
        <Button size="sm" variant={tab === "saques" ? "default" : "outline"} onClick={() => setTab("saques")}>
          Saques ({withdrawals.length})
        </Button>
        <Button size="sm" variant={tab === "depositos" ? "default" : "outline"} onClick={() => setTab("depositos")}>
          Depósitos ({deposits.length})
        </Button>
      </div>

      {tab === "clientes" ? (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {loading ? <p className="p-6 text-muted-foreground">Carregando...</p> : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-3">Nome</th><th className="text-left p-3">E-mail</th><th className="text-left p-3">Instagram</th><th className="text-left p-3">Indicado por</th><th className="text-left p-3">Plano</th><th className="text-left p-3">Status</th><th className="text-left p-3">Último login</th><th className="text-right p-3">Ações</th></tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const pkg = Array.isArray(u.package) ? u.package[0] : u.package;
                  return (
                  <tr key={u.id} className="border-b border-border/30">
                    <td className="p-3">{u.nome}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">@{u.instagram}</td>
                    <td className="p-3 min-w-[180px]">
                      {editingIndicador === u.id ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <Input
                              autoFocus
                              className="h-7 text-xs"
                              placeholder="Buscar por nome..."
                              value={indicadorSearch}
                              onChange={(e) => searchIndicador(e.target.value)}
                            />
                            <button type="button" onClick={() => { setEditingIndicador(null); setIndicadorSearch(""); setIndicadorResults([]); }} className="text-muted-foreground hover:text-foreground">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          {indicadorResults.length > 0 && (
                            <div className="rounded-md border border-border bg-background shadow-md z-10">
                              {indicadorResults.map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted"
                                  onClick={() => saveIndicador(u.id, r.id)}
                                >
                                  {r.nome}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            className="text-left text-[11px] text-destructive hover:underline"
                            onClick={() => saveIndicador(u.id, null)}
                          >
                            Remover indicador
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="group flex items-center gap-1 text-left"
                          onClick={() => { setEditingIndicador(u.id); const ind = Array.isArray(u.indicador) ? u.indicador[0] : u.indicador; setIndicadorSearch(ind?.nome ?? ""); setIndicadorResults([]); }}
                        >
                          <span className="text-xs text-muted-foreground group-hover:text-foreground">
                            {(() => { const ind = Array.isArray(u.indicador) ? u.indicador[0] : u.indicador; return ind?.nome ?? "—"; })()}
                          </span>
                          <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </button>
                      )}
                    </td>
                    <td className="p-3">
                      {pkg?.nome ? (
                        u.status === "ativo" ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300">
                              <Zap className="h-3 w-3" />{pkg.nome}
                            </span>
                            {activeCycles.get(u.id) === "manual" ? (
                              <span className="text-[10px] text-violet-400">⚡ Ativação manual</span>
                            ) : activeCycles.has(u.id) ? (
                              <span className="text-[10px] text-emerald-400">✓ Pagamento automático</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                            <PackageOpen className="h-3 w-3" />{pkg.nome} · pendente
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem plano</span>
                      )}
                    </td>
                    <td className="p-3"><Badge variant="outline">{u.status}</Badge></td>
                    <td className="p-3 text-muted-foreground">{lastLoginLabel(u.auth_user_id)}</td>
                    <td className="p-3 text-right space-x-1">
                      {u.status !== "ativo" && <Button size="sm" variant="outline" onClick={() => setStatus(u.id, "ativo")}>Aprovar</Button>}
                      {u.status !== "bloqueado" && <Button size="sm" variant="destructive" onClick={() => setStatus(u.id, "bloqueado")}>Bloquear</Button>}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      ) : tab === "anunciantes" ? (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {loading ? <p className="p-6 text-muted-foreground">Carregando...</p> : advertisers.length === 0 ? (
            <p className="p-6 text-muted-foreground">Nenhum anunciante cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-3">Empresa</th><th className="text-left p-3">Contato</th><th className="text-left p-3">E-mail</th><th className="text-left p-3">Status</th><th className="text-left p-3">Último login</th><th className="text-right p-3">Ações</th></tr>
              </thead>
              <tbody>
                {advertisers.map((a) => (
                  <tr key={a.id} className="border-b border-border/30">
                    <td className="p-3">{a.company_name}</td>
                    <td className="p-3 text-muted-foreground">{a.contact_name}</td>
                    <td className="p-3 text-muted-foreground">{a.email}</td>
                    <td className="p-3"><Badge variant="outline">{a.status}</Badge></td>
                    <td className="p-3 text-muted-foreground">{lastLoginLabel(a.auth_user_id)}</td>
                    <td className="p-3 text-right space-x-1">
                      {a.status !== "ativo" && <Button size="sm" variant="outline" onClick={() => setAdvertiserStatus(a.id, "ativo")}>Aprovar</Button>}
                      {a.status !== "bloqueado" && <Button size="sm" variant="destructive" onClick={() => setAdvertiserStatus(a.id, "bloqueado")}>Bloquear</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : tab === "saques" ? (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {loading ? <p className="p-6 text-muted-foreground">Carregando...</p> : withdrawals.length === 0 ? (
            <p className="p-6 text-muted-foreground">Nenhuma solicitação de saque ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-3">Cliente</th><th className="text-left p-3">Valor</th><th className="text-left p-3">Data</th><th className="text-left p-3">Hora</th><th className="text-left p-3">Status</th></tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => {
                  const date = new Date(w.created_at);
                  const meta = withdrawalStatusMeta[w.status] ?? { label: w.status, className: "" };
                  return (
                    <tr key={w.id} className="border-b border-border/30">
                      <td className="p-3">{w.users_profile?.nome ?? "—"}</td>
                      <td className="p-3 font-semibold">{usd.format(Number(w.amount_usd ?? 0))}</td>
                      <td className="p-3 text-muted-foreground">{date.toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-muted-foreground">{date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-3"><Badge className={meta.className}>{meta.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      ) : (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {loading ? <p className="p-6 text-muted-foreground">Carregando...</p> : deposits.length === 0 ? (
            <p className="p-6 text-muted-foreground">Nenhum depósito registrado ainda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-3">Usuário</th><th className="text-left p-3">Método</th><th className="text-left p-3">Valor</th><th className="text-left p-3">Data</th><th className="text-left p-3">Hora</th><th className="text-left p-3">Status</th><th className="text-right p-3">Ações</th></tr>
              </thead>
              <tbody>
                {deposits.map((d) => {
                  const date = new Date(d.created_at);
                  const meta = depositStatusMeta[d.status] ?? { label: d.status, className: "" };
                  return (
                    <tr key={d.id} className="border-b border-border/30">
                      <td className="p-3">{d.users_profile?.nome ?? "—"}</td>
                      <td className="p-3 text-muted-foreground uppercase">{d.method}</td>
                      <td className="p-3 font-semibold">{usd.format(Number(d.amount_usd ?? 0))}</td>
                      <td className="p-3 text-muted-foreground">{date.toLocaleDateString("pt-BR")}</td>
                      <td className="p-3 text-muted-foreground">{date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-3"><Badge className={meta.className}>{meta.label}</Badge></td>
                      <td className="p-3 text-right">
                        {d.status !== "approved" && (
                          <Button size="sm" variant="outline" onClick={() => activateDeposit(d.id)}>Ativar manualmente</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
