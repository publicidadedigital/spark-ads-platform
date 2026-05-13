import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/renovacao")({ component: RenovacaoPage });

function RenovacaoPage() {
  const { supabase, user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [cycle, setCycle] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: prof } = await supabase.from("users_profile").select("*").eq("auth_user_id", user.id).maybeSingle();
      setProfile(prof);
      if (prof) {
        const { data: cy } = await supabase.from("user_cycles").select("*").eq("user_id", prof.id).order("started_at", { ascending: false }).limit(1).maybeSingle();
        setCycle(cy);
      }
      const { data: pks } = await supabase.from("packages").select("*").eq("status", "ativo").order("valor");
      setPackages(pks ?? []);
      setLoading(false);
    })();
  }, [supabase, user]);

  async function escolher(pkg: any) {
    if (!supabase || !profile) return;
    // Em produção, deve passar por gateway de pagamento e webhook ativar o ciclo.
    // Aqui registramos a intenção para o admin liberar.
    const { error } = await supabase.from("user_cycles").insert({
      user_id: profile.id,
      package_id: pkg.id,
      valor_pacote: pkg.valor,
      status: "aguardando_renovacao",
    });
    if (error) return toast.error(error.message);
    toast.success("Pedido registrado. Aguarde aprovação do admin.");
  }

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  const podeRenovar = !cycle || cycle.percentual_atual >= 200 || cycle.status === "concluido";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Renovação de pacote</h1>
        <p className="text-sm text-muted-foreground">Ciclo termina ao atingir 200% do valor do pacote</p>
      </div>

      {cycle && (
        <Card className="p-6 bg-card/50 border-border/50">
          <div className="text-sm text-muted-foreground mb-1">Ciclo atual</div>
          <div className="text-2xl font-bold gold-text-gradient mb-3">{Number(cycle.percentual_atual).toFixed(2)}% / 200%</div>
          <Progress value={Math.min(100, Number(cycle.percentual_atual) / 2)} className="h-3" />
        </Card>
      )}

      {!podeRenovar && (
        <Card className="p-6 bg-warning/10 border-warning/30">
          <p className="text-sm">Seu ciclo ainda está em andamento. A renovação fica disponível ao atingir 200%.</p>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {packages.map((p) => (
          <Card key={p.id} className="p-6 bg-card/50 border-border/50">
            <div className="text-xs text-muted-foreground">{p.nome}</div>
            <div className="text-3xl font-bold gold-text-gradient mt-1">R$ {Number(p.valor).toFixed(2)}</div>
            <p className="text-sm text-muted-foreground mt-2">{p.descricao}</p>
            <Button className="w-full mt-4 bg-gold-gradient text-primary-foreground" disabled={!podeRenovar} onClick={() => escolher(p)}>
              Escolher
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
