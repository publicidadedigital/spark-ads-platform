import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Package, Users } from "lucide-react";

export const Route = createFileRoute("/app/pontos")({ component: PontosPage });

type PointEvent = {
  id: string;
  source_event: string;
  points: string | number;
  status: string;
  created_at: string;
  source_nome: string | null;
  source_instagram: string | null;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function EventIcon({ event }: { event: string }) {
  if (event === "compra_pacote" || event === "renovacao_pacote") return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300">
      <Package className="h-4 w-4" />
    </div>
  );
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-500/15 text-violet-300">
      <Users className="h-4 w-4" />
    </div>
  );
}

function EventLabel({ event, nome, instagram }: { event: string; nome: string | null; instagram: string | null }) {
  if (event === "compra_pacote" || event === "renovacao_pacote") {
    return (
      <div>
        <p className="text-sm font-medium">{event === "renovacao_pacote" ? "Renovação do seu pacote" : "Ativação do seu pacote"}</p>
        <p className="text-xs text-muted-foreground">Pontuação pelo seu próprio pacote</p>
      </div>
    );
  }
  const displayName = nome ?? (instagram ? `@${instagram}` : "Indicado da rede");
  const displaySub = instagram && nome ? `@${instagram}` : null;
  return (
    <div>
      <p className="text-sm font-medium">Pacote da rede</p>
      <p className="text-xs text-muted-foreground">
        {displayName}{displaySub ? ` · ${displaySub}` : ""} ativou um pacote
      </p>
    </div>
  );
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
        .select("id,source_event,points,status,created_at,source_user:source_user_id(nome,instagram)")
        .eq("user_id", prof.id)
        .eq("status", "valid")
        .order("created_at", { ascending: false })
        .limit(100);

      const rows = ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        source_event: r.source_event,
        points: r.points,
        status: r.status,
        created_at: r.created_at,
        source_nome: r.source_user?.nome ?? null,
        source_instagram: r.source_user?.instagram ?? null,
      })) as PointEvent[];

      setEvents(rows);
      setTotal(rows.reduce((s, r) => s + Number(r.points ?? 0), 0));
      setLoading(false);
    }
    load();
  }, [supabase, user]);

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Star className="h-6 w-6 text-amber-300" /> Histórico de Pontos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Pontuação por ativação/renovação de pacote próprio e da sua rede.</p>
      </div>

      <Card className="bg-card/50 border-border/50 p-5 flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-full border border-violet-400/40 bg-violet-500/15 text-amber-300">
          <Star className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Total acumulado</p>
          <p className="text-3xl font-bold">
            {total.toLocaleString("pt-BR")} <span className="text-base font-normal text-muted-foreground">pts</span>
          </p>
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
                  <EventIcon event={e.source_event} />
                  <div className="min-w-0">
                    <EventLabel event={e.source_event} nome={e.source_nome} instagram={e.source_instagram} />
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(e.created_at)}</p>
                  </div>
                </div>
                <Badge className="shrink-0 border-violet-400/30 bg-violet-500/15 text-violet-300 font-semibold whitespace-nowrap">
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
