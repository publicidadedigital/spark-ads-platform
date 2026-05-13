import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({ component: AdminUsers });

function AdminUsers() {
  const { supabase } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase.from("users_profile").select("*").order("created_at", { ascending: false }).limit(200);
    setUsers(data ?? []);
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Usuários</h1>
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
    </div>
  );
}
