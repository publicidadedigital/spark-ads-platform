import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/rede")({ component: RedePage });

function RedePage() {
  const { supabase, user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [byLevel, setByLevel] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: prof } = await supabase.from("users_profile").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (!prof) { setLoading(false); return; }
      setProfileId(prof.id);
      const { data: refs } = await supabase
        .from("referrals")
        .select("nivel, indicado:indicado_id(id, nome, status, created_at)")
        .eq("indicador_id", prof.id);
      const grouped: Record<number, any[]> = {};
      (refs ?? []).forEach((r: any) => {
        grouped[r.nivel] ??= [];
        grouped[r.nivel].push(r.indicado);
      });
      setByLevel(grouped);
      setLoading(false);
    })();
  }, [supabase, user]);

  const link = profileId && typeof window !== "undefined"
    ? `${window.location.origin}/cadastro?ref=${profileId}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Minha Rede</h1>
        <p className="text-sm text-muted-foreground">Indicações multinível (até 10 níveis para equipe)</p>
      </div>

      <Card className="p-6 bg-card/50 border-gold/30">
        <h3 className="font-semibold mb-2">Seu link de indicação</h3>
        <div className="flex gap-2">
          <input readOnly value={link} className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm" />
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Bônus: <strong>20% no 1º nível</strong>, <strong>5% do 2º ao 5º</strong>. Equipe: <strong>1% do 1º ao 10º</strong>.
        </p>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Carregando rede...</p>
      ) : (
        Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <Card key={n} className="p-5 bg-card/50 border-border/50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Nível {n}</h4>
              <span className="text-sm text-muted-foreground">{(byLevel[n] ?? []).length} membro(s)</span>
            </div>
            {(byLevel[n] ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum indicado neste nível.</p>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {byLevel[n].map((m) => (
                  <div key={m.id} className="border border-border/50 rounded-md p-2 text-sm">
                    <div className="font-medium">{m.nome}</div>
                    <div className="text-xs text-muted-foreground">{m.status}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
