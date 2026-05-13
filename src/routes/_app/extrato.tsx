import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/extrato")({ component: ExtratoPage });

function ExtratoPage() {
  const { supabase, user } = useAuth();
  const [tx, setTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: prof } = await supabase.from("users_profile").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (!prof) { setLoading(false); return; }
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", prof.id)
        .order("created_at", { ascending: false })
        .limit(100);
      setTx(data ?? []);
      setLoading(false);
    })();
  }, [supabase, user]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Extrato</h1>
        <p className="text-sm text-muted-foreground">Histórico completo de movimentações</p>
      </div>
      <Card className="p-0 bg-card/50 border-border/50 overflow-hidden">
        {loading ? (
          <p className="p-6 text-muted-foreground">Carregando...</p>
        ) : tx.length === 0 ? (
          <p className="p-6 text-muted-foreground">Sem movimentações ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Data</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Descrição</th><th className="text-right p-3">Valor</th><th className="text-right p-3">Saldo</th></tr>
            </thead>
            <tbody>
              {tx.map((t) => (
                <tr key={t.id} className="border-b border-border/30">
                  <td className="p-3 text-muted-foreground">{new Date(t.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3"><Badge variant="outline">{t.tipo}</Badge></td>
                  <td className="p-3">{t.descricao}</td>
                  <td className={`p-3 text-right font-medium ${t.tipo === "credito" ? "text-success" : "text-destructive"}`}>
                    {t.tipo === "credito" ? "+" : "-"}R$ {Number(t.valor).toFixed(2)}
                  </td>
                  <td className="p-3 text-right text-muted-foreground">R$ {Number(t.saldo_depois).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
