import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { CreditCard, QrCode, Receipt, ShieldCheck, Loader2 } from "lucide-react";
import { createCheckout, PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments/provider";
import { createCheckoutOrder } from "@/lib/payments/checkout.functions";

export const Route = createFileRoute("/app/checkout/$packageId")({ component: CheckoutPage });

function CheckoutPage() {
  const { packageId } = Route.useParams();
  const { supabase, user } = useAuth();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const [{ data: p }, { data: prof }] = await Promise.all([
        supabase.from("packages").select("*").eq("id", packageId).maybeSingle(),
        supabase.from("users_profile").select("*").eq("auth_user_id", user.id).maybeSingle(),
      ]);
      setPkg(p);
      setProfile(prof);
      setLoading(false);
    })();
  }, [supabase, user, packageId]);

  async function confirmar() {
    if (!supabase || !pkg || !profile || !user) return;
    setSubmitting(true);
    try {
      // 1) Cria a intenção de ciclo no servidor (server fn valida usuário e pacote).
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada");
      const order = await createCheckoutOrder({ data: { packageId: pkg.id, accessToken } });

      // 2) Inicia o pagamento no gateway (stub por enquanto).
      const result = await createCheckout({
        packageId: pkg.id,
        packageNome: pkg.nome,
        valor: order.valor,
        method,
        userId: profile.id,
        userEmail: user.email ?? "",
        cycleId: order.cycleId,
      });

      toast.success("Pagamento iniciado! Aguarde a confirmação.", {
        description: `ID: ${result.paymentId}`,
      });
      navigate({ to: "/app" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao iniciar pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!pkg) return <p className="text-muted-foreground">Pacote não encontrado.</p>;

  const icons: Record<PaymentMethod, any> = { pix: QrCode, card: CreditCard, boleto: Receipt };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="text-sm text-muted-foreground">Escolha a forma de pagamento</p>
      </div>

      <Card className="p-6 bg-card/50 border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Pacote selecionado</div>
            <div className="text-lg font-semibold">{pkg.nome}</div>
            {pkg.descricao && <p className="text-xs text-muted-foreground mt-1">{pkg.descricao}</p>}
          </div>
          <div className="text-3xl font-bold gold-text-gradient">R$ {Number(pkg.valor).toFixed(2)}</div>
        </div>
      </Card>

      <Card className="p-6 bg-card/50 border-border/50">
        <h3 className="font-semibold mb-4">Forma de pagamento</h3>
        <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="space-y-2">
          {PAYMENT_METHODS.map((m) => {
            const Icon = icons[m.value];
            return (
              <Label
                key={m.value}
                htmlFor={m.value}
                className={`flex items-center gap-3 rounded-md border p-4 cursor-pointer transition ${
                  method === m.value ? "border-gold bg-gold/5" : "border-border/50 hover:bg-card"
                }`}
              >
                <RadioGroupItem id={m.value} value={m.value} />
                <Icon className="h-5 w-5 text-gold" />
                <div className="flex-1">
                  <div className="font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
              </Label>
            );
          })}
        </RadioGroup>
      </Card>

      <Card className="p-4 bg-card/30 border-border/50 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-gold shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Ambiente preparado para integração com gateway de pagamento. A confirmação do pagamento ativará automaticamente
          seu ciclo via webhook quando a API for conectada.
        </p>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate({ to: "/app/renovacao" })} disabled={submitting}>
          Voltar
        </Button>
        <Button
          onClick={confirmar}
          disabled={submitting}
          className="flex-1 bg-gold-gradient text-primary-foreground"
        >
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</> : `Pagar R$ ${Number(pkg.valor).toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
