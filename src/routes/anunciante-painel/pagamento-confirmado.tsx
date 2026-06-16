import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Megaphone } from "lucide-react";

export const Route = createFileRoute("/anunciante-painel/pagamento-confirmado")({
  component: PagamentoConfirmado,
});

function PagamentoConfirmado() {
  const { supabase, user } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    let attempts = 0;
    const check = async () => {
      const { data } = await supabase
        .from("advertiser_profiles")
        .select("status")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      setStatus(data?.status ?? null);
      setLoading(false);
      if (data?.status !== "ativo" && attempts < 5) {
        attempts++;
        setTimeout(check, 3000);
      }
    };
    check();
  }, [supabase, user]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Card className="max-w-md w-full text-center bg-card/60 border-border/50 p-8 space-y-5">
        {loading ? (
          <>
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
            <h1 className="text-xl font-bold">Verificando pagamento...</h1>
            <p className="text-sm text-muted-foreground">Aguarde enquanto confirmamos sua compra.</p>
          </>
        ) : status === "ativo" ? (
          <>
            <div className="flex items-center justify-center rounded-full bg-success/15 w-20 h-20 mx-auto">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
            <p className="text-sm text-muted-foreground">
              Sua conta foi ativada com sucesso. Agora você pode criar sua primeira campanha e começar a divulgar sua marca.
            </p>
            <Link to="/anunciante-painel/nova-campanha" search={{ packageId: "" }}>
              <Button className="w-full bg-primary text-primary-foreground gap-2">
                <Megaphone className="h-4 w-4" /> Criar primeira campanha
              </Button>
            </Link>
            <Link to="/anunciante-painel/">
              <Button variant="ghost" className="w-full">Ir para o dashboard</Button>
            </Link>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center rounded-full bg-amber-500/15 w-20 h-20 mx-auto">
              <Loader2 className="h-10 w-10 text-amber-300 animate-spin" />
            </div>
            <h1 className="text-xl font-bold">Aguardando confirmação</h1>
            <p className="text-sm text-muted-foreground">
              Seu pagamento está sendo processado. Assim que for confirmado, sua conta será ativada automaticamente. Isso pode levar alguns minutos.
            </p>
            <Link to="/anunciante-painel/">
              <Button variant="outline" className="w-full">Voltar ao dashboard</Button>
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
