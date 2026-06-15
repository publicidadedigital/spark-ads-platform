import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({ component: AdminUsers });

type Tab = "clientes" | "anunciantes";

function AdminUsers() {
  const { supabase } = useAuth();
  const [tab, setTab] = useState<Tab>("clientes");
  const [users, setUsers] = useState<any[]>([]);
  const [advertisers, setAdvertisers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [{ data }, { data: adminRoles }, { data: legacyAdmins }, { data: adv }] = await Promise.all([
      supabase.from("users_profile").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("admin_roles").select("auth_user_id").eq("status", "ativo"),
      supabase.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]),
      supabase.from("advertiser_profiles").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    const adminIds = new Set([
      ...((adminRoles ?? []).map((r: any) => r.auth_user_id)),
      ...((legacyAdmins ?? []).map((r: any) => r.user_id)),
    ]);
    setUsers((data ?? []).filter((u: any) => !adminIds.has(u.auth_user_id)));
    setAdvertisers(adv ?? []);
    setLoading(false);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <Link to="/admin/admins" className="inline-flex">
          <Button variant="outline" size="sm"><ShieldCheck className="mr-2 h-4 w-4" /> Administradores</Button>
        </Link>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "clientes" ? "default" : "outline"} onClick={() => setTab("clientes")}>
          Clientes ({users.length})
        </Button>
        <Button size="sm" variant={tab === "anunciantes" ? "default" : "outline"} onClick={() => setTab("anunciantes")}>
          Anunciantes ({advertisers.length})
        </Button>
      </div>

      {tab === "clientes" ? (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {loading ? <p className="p-6 text-muted-foreground">Carregando...</p> : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-3">Nome</th><th className="text-left p-3">E-mail</th><th className="text-left p-3">Instagram</th><th className="text-left p-3">Status</th><th className="text-right p-3">Ações</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/30">
                    <td className="p-3">{u.nome}</td>
                    <td className="p-3 text-muted-foreground">{u.email}</td>
                    <td className="p-3">@{u.instagram}</td>
                    <td className="p-3"><Badge variant="outline">{u.status}</Badge></td>
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
      ) : (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {loading ? <p className="p-6 text-muted-foreground">Carregando...</p> : advertisers.length === 0 ? (
            <p className="p-6 text-muted-foreground">Nenhum anunciante cadastrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-3">Empresa</th><th className="text-left p-3">Contato</th><th className="text-left p-3">E-mail</th><th className="text-left p-3">Status</th><th className="text-right p-3">Ações</th></tr>
              </thead>
              <tbody>
                {advertisers.map((a) => (
                  <tr key={a.id} className="border-b border-border/30">
                    <td className="p-3">{a.company_name}</td>
                    <td className="p-3 text-muted-foreground">{a.contact_name}</td>
                    <td className="p-3 text-muted-foreground">{a.email}</td>
                    <td className="p-3"><Badge variant="outline">{a.status}</Badge></td>
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
      )}
    </div>
  );
}
