import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, RefreshCcw, Search, Zap, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/ativacao")({ component: AdminAtivacao });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type UserProfile = {
  id: string;
  nome: string | null;
  email: string | null;
  status: string;
  pacote_ativo_id: string | null;
  package?: { nome: string; valor: string } | null;
};

type Package = {
  id: string;
  nome: string;
  valor: string;
  bonusable_amount: string;
  daily_bonus: string;
};

function AdminAtivacao() {
  const { supabase } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("packages")
      .select("id,nome,valor,bonusable_amount,daily_bonus")
      .eq("status", "ativo")
      .order("valor")
      .then(({ data }) => setPackages(data ?? []));
  }, [supabase]);

  async function searchUsers() {
    if (!supabase || !search.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("users_profile")
      .select("id,nome,email,status,pacote_ativo_id,package:pacote_ativo_id(nome,valor)")
      .or(`nome.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`)
      .limit(20);
    if (error) toast.error(error.message);
    setUsers((data ?? []) as unknown as UserProfile[]);
    setLoading(false);
  }

  async function activate(userId: string) {
    const pkgId = selected[userId];
    if (!pkgId) { toast.error("Selecione um pacote"); return; }
    if (!supabase) return;
    setActivating(userId);
    const { data, error } = await supabase.rpc("admin_activate_package", {
      p_user_profile_id: userId,
      p_package_id: pkgId,
      p_notes: notes[userId]?.trim() || "Ativação manual pelo administrador",
    });
    setActivating(null);
    if (error) { toast.error(error.message); return; }
    const result = data as { ok: boolean; package: string; valor: string };
    toast.success(`Plano ${result.package} ativado com sucesso!`);
    searchUsers();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Admin</p>
        <h1 className="text-3xl font-bold">Ativação Manual de Plano</h1>
        <p className="text-sm text-muted-foreground">
          Ative ou troque o plano de um usuário manualmente. O ciclo anterior é bloqueado e um novo é criado.
        </p>
      </div>

      {/* Pacotes disponíveis */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pacotes disponíveis</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-lg border border-border/60 p-3">
                <p className="font-semibold">{pkg.nome}</p>
                <p className="text-xl font-bold text-gold">{usd.format(Number(pkg.valor))}</p>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  <p>Bonificável: {usd.format(Number(pkg.bonusable_amount))}</p>
                  <p>Bônus diário: {usd.format(Number(pkg.daily_bonus))}</p>
                  <p>Teto 200%: {usd.format(Number(pkg.bonusable_amount) * 2)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Busca de usuário */}
      <Card>
        <CardHeader><CardTitle className="text-base">Buscar usuário</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Nome ou e-mail do usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUsers()}
              className="max-w-md"
            />
            <Button onClick={searchUsers} disabled={loading}>
              {loading ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {users.length > 0 && (
        <div className="space-y-3">
          {users.map((u) => {
            const pkg = u.package as any;
            const pkgName = Array.isArray(pkg) ? pkg[0]?.nome : pkg?.nome;
            const pkgValor = Array.isArray(pkg) ? pkg[0]?.valor : pkg?.valor;
            return (
              <Card key={u.id} className="border-border/60">
                <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{u.nome || "—"}</p>
                      <Badge variant="outline" className={u.status === "ativo" ? "border-success/40 text-success" : "border-amber-400/40 text-amber-300"}>
                        {u.status}
                      </Badge>
                      {pkgName && (
                        <Badge className="border-primary/30 bg-primary/15 text-primary hover:bg-primary/15">
                          {pkgName} {pkgValor ? `· ${usd.format(Number(pkgValor))}` : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>

                  <div className="flex flex-col gap-3 lg:min-w-[340px]">
                    <div>
                      <Label className="text-xs">Selecionar pacote</Label>
                      <select
                        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        value={selected[u.id] ?? ""}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      >
                        <option value="">— escolha um pacote —</option>
                        {packages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.nome} — {usd.format(Number(pkg.valor))}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-xs">Observação (opcional)</Label>
                      <Textarea
                        className="mt-1 h-16 resize-none text-xs"
                        placeholder="Ex: pagamento confirmado via pix #1234"
                        value={notes[u.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      />
                    </div>
                    <Button
                      onClick={() => activate(u.id)}
                      disabled={activating === u.id || !selected[u.id]}
                      className="bg-gold-gradient text-primary-foreground"
                    >
                      {activating === u.id ? (
                        <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="mr-2 h-4 w-4" />
                      )}
                      Ativar plano
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {users.length === 0 && search && !loading && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <XCircle className="mx-auto mb-3 h-8 w-8 opacity-40" />
            Nenhum usuário encontrado para "{search}"
          </CardContent>
        </Card>
      )}
    </div>
  );
}
