<title>Ajustes de Bônus</title>
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/supabase/auth";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle, RefreshCcw, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/ajustes-bonus")({ component: AjustesBonusPage });

type Adjustment = {
  id: string;
  user_id: string;
  operational_day: string;
  bonus_value: string;
  status: string;
  motivo: string | null;
  created_at: string;
  users_profile?: { nome: string | null; email: string | null } | null;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function fmtDate(v: string) {
  return new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtDay(v: string) {
  return new Date(v + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AjustesBonusPage() {
  const { supabase } = useAuth();
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from("bonus_adjustments")
      .select("*, users_profile(nome, email)")
      .order("created_at", { ascending: false })
      .limit(200);
    setAdjustments((data ?? []) as Adjustment[]);
    setLoading(false);
  }

  async function runNow() {
    if (!supabase) return;
    setRunning(true);
    setLastResult(null);
    const { data, error } = await supabase.rpc("auto_fix_missing_bonuses");
    if (error) {
      setLastResult(`Erro: ${error.message}`);
    } else {
      setLastResult(`${data} ajuste(s) aplicado(s)`);
      await load();
    }
    setRunning(false);
  }

  useEffect(() => { load(); }, [supabase]);

  const totalAplicados = adjustments.filter((a) => a.status === "aplicado").length;
  const totalErros = adjustments.filter((a) => a.status === "erro").length;
  const totalValor = adjustments.filter((a) => a.status === "aplicado").reduce((s, a) => s + Number(a.bonus_value), 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Ajustes Automáticos de Bônus</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Verificação automática a cada hora — corrige bônus diários não creditados</p>
        </div>
        <div className="flex items-center gap-3">
          {lastResult && (
            <span className="text-sm text-muted-foreground">{lastResult}</span>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
          </Button>
          <Button size="sm" onClick={runNow} disabled={running}>
            <Wrench className="h-4 w-4 mr-2" /> {running ? "Verificando..." : "Verificar agora"}
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-success">{totalAplicados}</p>
          <p className="text-xs text-muted-foreground mt-1">Ajustes aplicados</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{totalErros}</p>
          <p className="text-xs text-muted-foreground mt-1">Erros</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{usd.format(totalValor)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total creditado</p>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="border-primary/15 bg-card/50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border/40 text-muted-foreground text-xs">
              <tr>
                <th className="text-left p-3">Usuário</th>
                <th className="text-left p-3">Dia de referência</th>
                <th className="text-left p-3">Valor creditado</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Motivo</th>
                <th className="text-left p-3">Detectado em</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Carregando...</td></tr>
              )}
              {!loading && adjustments.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">Nenhum ajuste registrado — tudo certo! ✅</td></tr>
              )}
              {adjustments.map((a) => (
                <tr key={a.id} className="border-b border-border/20 hover:bg-muted/20">
                  <td className="p-3">
                    <p className="font-medium">{(a.users_profile as any)?.nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{(a.users_profile as any)?.email ?? a.user_id}</p>
                  </td>
                  <td className="p-3 text-muted-foreground">{fmtDay(a.operational_day)}</td>
                  <td className="p-3 font-medium text-success">{a.status === "aplicado" ? usd.format(Number(a.bonus_value)) : "—"}</td>
                  <td className="p-3">
                    {a.status === "aplicado" ? (
                      <Badge className="bg-success/15 text-success border-0 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Aplicado
                      </Badge>
                    ) : (
                      <Badge className="bg-destructive/15 text-destructive border-0 gap-1">
                        <XCircle className="h-3 w-3" /> Erro
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground max-w-[260px] truncate">{a.motivo ?? "—"}</td>
                  <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
