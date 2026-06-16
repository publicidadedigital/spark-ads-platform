import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/supabase/auth";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCcw, Trophy } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/pontuacao")({ component: AdminPontuacao });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const num = new Intl.NumberFormat("pt-BR");

const IPHONE_GOAL = 10000;
const TRIP_GOAL = 30000;

type Row = {
  id: string;
  nome: string | null;
  email: string | null;
  instagram: string | null;
  points: number;
  totalPago: number;
  pedidosPagos: number;
  renovacoes: number;
  manuais: number;
  valorManual: number;
};

function AdminPontuacao() {
  const { supabase } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!supabase) return;
    setLoading(true);

    const [{ data: users }, { data: pointRows }, { data: orders }, { data: manualCycles }] = await Promise.all([
      supabase.from("users_profile").select("id,nome,email,instagram").order("created_at", { ascending: false }).limit(500),
      supabase.from("point_events").select("user_id,points").eq("status", "valid"),
      supabase.from("package_orders").select("user_id,valor,status").eq("status", "pago"),
      supabase.from("user_cycles").select("user_id,valor_pacote").eq("activation_source", "manual"),
    ]);

    const pointsByUser = new Map<string, number>();
    for (const row of pointRows ?? []) {
      pointsByUser.set(row.user_id, (pointsByUser.get(row.user_id) ?? 0) + Number(row.points ?? 0));
    }

    const ordersByUser = new Map<string, { total: number; count: number }>();
    for (const order of orders ?? []) {
      const current = ordersByUser.get(order.user_id) ?? { total: 0, count: 0 };
      current.total += Number(order.valor ?? 0);
      current.count += 1;
      ordersByUser.set(order.user_id, current);
    }

    const manualByUser = new Map<string, { count: number; total: number }>();
    for (const c of manualCycles ?? []) {
      const cur = manualByUser.get(c.user_id) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(c.valor_pacote ?? 0);
      manualByUser.set(c.user_id, cur);
    }

    const result: Row[] = (users ?? []).map((u: any) => {
      const orderInfo = ordersByUser.get(u.id) ?? { total: 0, count: 0 };
      const manualInfo = manualByUser.get(u.id) ?? { count: 0, total: 0 };
      return {
        id: u.id,
        nome: u.nome,
        email: u.email,
        instagram: u.instagram,
        points: pointsByUser.get(u.id) ?? 0,
        totalPago: orderInfo.total,
        pedidosPagos: orderInfo.count,
        renovacoes: Math.max(0, orderInfo.count - 1),
        manuais: manualInfo.count,
        valorManual: manualInfo.total,
      };
    });

    result.sort((a, b) => b.points - a.points);

    setRows(result);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Rede</p>
          <h1 className="text-3xl font-bold">Pontuação dos usuários</h1>
          <p className="text-sm text-muted-foreground">
            Pontos acumulados (1 ponto a cada US$10 bonificável em compra/renovação de pacote, propagado para toda a linha de indicação).
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCcw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>

      <Card className="bg-card/50 border-border/50 overflow-hidden">
        {loading ? (
          <p className="p-6 text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-muted-foreground">Nenhum usuário encontrado.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">#</th>
                <th className="text-left p-3">Usuário</th>
                <th className="text-left p-3">Pontos</th>
                <th className="text-left p-3">Meta alcançada</th>
                <th className="text-left p-3">Total pago</th>
                <th className="text-left p-3">Pedidos pagos</th>
                <th className="text-left p-3">Renovações</th>
                <th className="text-left p-3">Ativação manual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, index) => (
                <tr key={r.id} className="border-b border-border/30">
                  <td className="p-3 text-muted-foreground">{index + 1}</td>
                  <td className="p-3">
                    <p className="font-medium">{r.nome || "-"}</p>
                    <p className="text-xs text-muted-foreground">{r.email}{r.instagram ? ` · @${r.instagram}` : ""}</p>
                  </td>
                  <td className="p-3 font-semibold">{num.format(r.points)}</td>
                  <td className="p-3 space-x-1">
                    {r.points >= TRIP_GOAL ? (
                      <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15">
                        <Trophy className="mr-1 h-3 w-3" /> Viagem alcançada
                      </Badge>
                    ) : r.points >= IPHONE_GOAL ? (
                      <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15">
                        <Trophy className="mr-1 h-3 w-3" /> iPhone alcançado
                      </Badge>
                    ) : (
                      <Badge variant="outline">-</Badge>
                    )}
                  </td>
                  <td className="p-3">{usd.format(r.totalPago)}</td>
                  <td className="p-3 text-muted-foreground">{r.pedidosPagos}</td>
                  <td className="p-3 text-muted-foreground">{r.renovacoes}</td>
                  <td className="p-3">
                    {r.manuais > 0 ? (
                      <span className="inline-flex flex-col">
                        <span className="text-amber-300 font-medium">{r.manuais}x</span>
                        <span className="text-xs text-muted-foreground">{usd.format(r.valorManual)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
