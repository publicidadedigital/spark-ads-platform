import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/admins")({ component: AdminAdmins });

type AdminRow = {
  user_id: string;
  role: string;
  profile?: { nome: string | null; email: string | null; instagram: string | null } | null;
};

function AdminAdmins() {
  const { supabase, user } = useAuth();
  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");
    const ids = (roles ?? []).map((r) => r.user_id);
    let profiles: any[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from("users_profile")
        .select("auth_user_id,nome,email,instagram")
        .in("auth_user_id", ids);
      profiles = data ?? [];
    }
    const merged = (roles ?? []).map((r) => ({
      ...r,
      profile: profiles.find((p) => p.auth_user_id === r.user_id) ?? null,
    }));
    setRows(merged as AdminRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function promote(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const target = email.trim().toLowerCase();
    if (!target) return toast.error("Informe o e-mail");
    setSubmitting(true);
    try {
      const { data: profile, error: pErr } = await supabase
        .from("users_profile")
        .select("auth_user_id,email,nome")
        .ilike("email", target)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!profile?.auth_user_id) {
        toast.error("Usuário não encontrado. Ele precisa se cadastrar primeiro.");
        return;
      }
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: profile.auth_user_id, role: "admin" });
      if (error && !`${error.message}`.includes("duplicate")) throw error;
      toast.success(`${profile.nome ?? profile.email} promovido a admin`);
      setEmail("");
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao promover");
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(userId: string) {
    if (!supabase) return;
    if (userId === user?.id) return toast.error("Você não pode remover seu próprio acesso");
    if (!confirm("Remover privilégio de admin deste usuário?")) return;
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin");
    if (error) return toast.error(error.message);
    toast.success("Admin removido");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-gold" /> Administradores
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Promova usuários para admin pelo e-mail. Admins têm acesso total ao painel:
          aprovar/bloquear usuários, gerenciar campanhas, validar provas e configurar pacotes.
        </p>
      </div>

      <Card className="bg-card/50 border-border/50 p-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-gold" /> Promover novo admin
        </h2>
        <form onSubmit={promote} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <Label htmlFor="email">E-mail do usuário</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@exemplo.com"
              required
            />
          </div>
          <Button type="submit" disabled={submitting} className="bg-gold-gradient text-primary-foreground">
            {submitting ? "Promovendo..." : "Promover a admin"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          O usuário precisa estar cadastrado na plataforma. Após a promoção, ele deve sair e
          entrar novamente para o acesso ser ativado.
        </p>
      </Card>

      <Card className="bg-card/50 border-border/50 overflow-hidden">
        <div className="p-4 border-b border-border/50">
          <h2 className="font-semibold">Admins atuais</h2>
        </div>
        {loading ? (
          <p className="p-6 text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-muted-foreground">Nenhum admin encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">E-mail</th>
                <th className="text-left p-3">Instagram</th>
                <th className="text-left p-3">Papel</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user_id} className="border-b border-border/30">
                  <td className="p-3">{r.profile?.nome ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.profile?.email ?? r.user_id.slice(0, 8)}</td>
                  <td className="p-3">{r.profile?.instagram ? `@${r.profile.instagram}` : "—"}</td>
                  <td className="p-3"><Badge className="bg-gold/20 text-gold border-gold/40">{r.role}</Badge></td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => revoke(r.user_id)}
                      disabled={r.user_id === user?.id}
                    >
                      <ShieldOff className="h-3 w-3 mr-1" /> Remover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="bg-card/30 border-border/30 p-6">
        <h2 className="font-semibold mb-3">O que um admin pode fazer</h2>
        <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
          <li><strong className="text-foreground">Usuários:</strong> aprovar cadastros, bloquear contas e revisar perfis.</li>
          <li><strong className="text-foreground">Campanhas:</strong> criar, editar e ativar/desativar campanhas.</li>
          <li><strong className="text-foreground">Provas:</strong> validar prints e liberar bonificações.</li>
          <li><strong className="text-foreground">Pacotes:</strong> configurar planos, valores e regras de renovação.</li>
          <li><strong className="text-foreground">Administradores:</strong> promover ou revogar acesso admin.</li>
        </ul>
      </Card>
    </div>
  );
}
