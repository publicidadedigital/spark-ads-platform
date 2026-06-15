import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getTwoFactorStatus } from "@/lib/security/totp.functions";
import { TwoFactorReminderBanner } from "@/components/TwoFactorSetup";
import { getUsersLastLogin } from "@/lib/admin/users.functions";

export const Route = createFileRoute("/admin/")({ component: AdminUsers });

type Tab = "clientes" | "anunciantes" | "saques";

type WithdrawalRow = {
  id: string;
  created_at: string;
  amount_usd: number | string;
  status: string;
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

function AdminUsers() {
  const { supabase } = useAuth();
  const [tab, setTab] = useState<Tab>("clientes");
  const [users, setUsers] = useState<any[]>([]);
  const [advertisers, setAdvertisers] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [lastLogins, setLastLogins] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [{ data }, { data: adminRoles }, { data: legacyAdmins }, { data: adv }, { data: withdrawalRows }] = await Promise.all([
      supabase.from("users_profile").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("admin_roles").select("auth_user_id").eq("status", "ativo"),
      supabase.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
      supabase.from("advertiser_profiles").select("*").order("created_at", { ascending: false }).limit(200),
      supabase
        .from("withdrawal_requests")
        .select("id,created_at,amount_usd,status,users_profile:user_id(nome,email)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    const adminIds = new Set([
      ...((adminRoles ?? []).map((r: any) => r.auth_user_id)),
      ...((legacyAdmins ?? []).map((r: any) => r.user_id)),
    ]);
    setUsers((data ?? []).filter((u: any) => !adminIds.has(u.auth_user_id)));
    setAdvertisers(adv ?? []);
    setWithdrawals((withdrawalRows ?? []) as unknown as WithdrawalRow[]);
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
      </div>

      {tab === "clientes" ? (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {loading ? <p className="p-6 text-muted-foreground">Carregando...</p> : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-3">Nome</th><th className="text-left p-3">E-mail</th><th className="text-left p-3">Instagram</th><th className="text-left p-3">Status</th><th className="text-left p-3">Último login</th><th className="text-right p-3">Ações</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/30">
                    <td className="p-3">{u.nome}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">@{u.instagram}</td>
                    <td className="p-3"><Badge variant="outline">{u.status}</Badge></td>
                    <td className="p-3 text-muted-foreground">{lastLoginLabel(u.auth_user_id)}</td>
                    <td className="p-3 text-right space-x-1">
                      {u.status !== "ativo" && <Button size="sm" variant="outline" onClick={() => setStatus(u.id, "ativo")}>Aprovar</Button>}
                      {u.status !== "bloqueado" && <Button size="sm" variant="destructive" onClick={() => setStatus(u.id, "bloqueado")}>Bloquear</Button>}
                    </td>
                  </tr>
                ))}
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
      ) : (
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
      )}
    </div>
  );
}
