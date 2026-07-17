import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

export const Route = createFileRoute("/app/pontos")({ component: PontosPage });

type PointEvent = {
  id: string;
  source_event: string;
  points: string | number;
  financial_amount: string | number | null;
  status: string;
  created_at: string;
};

const EVENT_LABELS: Record<string, string> = {
  compra_pacote: "Ativação de pacote",
  compra_pacote_rede: "Pacote da rede",
  renovacao_pacote: "Renovação de pacote",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function PontosPage() {
  const { supabase, user } = useAuth();
  const [events, setEvents] = useState<PointEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    async function load() {
      const { data: prof } = await supabase!
        .from("users_profile")
        .select("id")
        .eq("auth_user_id", user!.id)
        .maybeSingle();
      if (!prof) { setLoading(false); return; }

      const { data } = await supabase!
        .from("point_events")
        .select("id,source_event,points,financial_amount,status,created_at")
        .eq("user_id", prof.id)
        .eq("status", "valid")
        .order("created_at", { ascending: false })
        .limit(100);

      const rows = (data ?? []) as PointEvent[];
      setEvents(rows);
      setTotal(rows.reduce((s, r) => s + Number(r.points ?? 0), 0));
      setLoading(false);
    }
    load();
  }, [supabase, user]);

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6 text-amber-300" /> Histórico de Pontos</h1>
        <p className="text-sm text-muted-foreground mt-1">Pontos acumulados por ativação e renovação de pacote.</p>
      </div>

      <Card className="bg-card/50 border-border/50 p-5 flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-violet-400/40 bg-violet-500/15 text-amber-300">
          <Star className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total acumulado</p>
          <p className="text-3xl font-bold">{total.toLocaleString("pt-BR")} <span className="text-base font-normal text-muted-foreground">pts</span></p>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : events.length === 0 ? (
        <Card className="bg-card/50 border-border/50 p-8 text-center text-muted-foreground text-sm">
          Nenhum evento de pontuação encontrado.
        </Card>
      ) : (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          <div className="divide-y divide-border/30">
            {events.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-500/15 text-violet-300">
                    <Star className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{EVENT_LABELS[e.source_event] ?? e.source_event}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</p>
                  </div>
                </div>
                <Badge className="shrink-0 border-violet-400/30 bg-violet-500/15 text-violet-300 font-semibold">
                  +{Number(e.points).toLocaleString("pt-BR")} pts
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
