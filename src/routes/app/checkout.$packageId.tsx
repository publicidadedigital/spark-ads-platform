import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { buildPackageAccounting } from "@/lib/business/rules";
import { toast } from "sonner";
import { QrCode, ShieldCheck, Loader2, CreditCard, Wallet, ExternalLink, AlertTriangle } from "lucide-react";
import { createCheckout, PAYMENT_METHODS, type CheckoutResult, type PaymentMethod } from "@/lib/payments/provider";
import { createCheckoutOrder } from "@/lib/payments/checkout.functions";

export const Route = createFileRoute("/app/checkout/$packageId")({ component: CheckoutPage });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function CheckoutPage() {
  const { packageId } = Route.useParams();
  const { supabase, user } = useAuth();
  const navigate = useNavigate();
  const [pkg, setPkg] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(null);

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
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("Sessao expirada");
      const order = await createCheckoutOrder({ data: { packageId: pkg.id, accessToken } });

      if (method === "internal_balance") {
        const result = await createCheckout({
          packageId: pkg.id,
          packageNome: pkg.nome,
          valor: order.valor,
          method,
          userId: profile.id,
          userEmail: user.email ?? "",
          cycleId: order.cycleId,
          accessToken,
        });

        setCheckoutResult(result);
        toast.success("Pagamento iniciado.", { description: `ID: ${result.paymentId}` });
        return;
      }

      if (!pkg.cakto_checkout_url) throw new Error("Checkout indisponivel para este pacote. Entre em contato com o suporte.");

      window.open(buildCaktoCheckoutUrl(pkg.cakto_checkout_url, profile, user), "_blank", "noopener,noreferrer");
      toast.success("Checkout Cakto aberto em uma nova aba.", {
        description: "Nao altere o e-mail preenchido: ele e usado para identificar e ativar seu pagamento automaticamente.",
      });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao iniciar pagamento");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!pkg) return <p className="text-muted-foreground">Pacote nao encontrado.</p>;

  const accounting = buildPackageAccounting(Number(pkg.package_value ?? pkg.valor));
  const icons: Record<PaymentMethod, any> = { pix: QrCode, cartao: CreditCard, internal_balance: Wallet };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Checkout</h1>
        <p className="text-sm text-muted-foreground">Escolha a forma de pagamento</p>
      </div>

      <Card className="p-6 bg-card/50 border-border/50">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Pacote selecionado</div>
            <div className="text-lg font-semibold">{pkg.nome}</div>
            {pkg.descricao && <p className="text-xs text-muted-foreground mt-1">{pkg.descricao}</p>}
          </div>
          <div className="text-left md:text-right">
            <div className="text-3xl font-bold gold-text-gradient">{usd.format(accounting.total_paid)}</div>
            <p className="text-xs text-muted-foreground">Pacote {usd.format(accounting.bonusable_amount)} + curso {usd.format(accounting.course_fee)}</p>
          </div>
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

      {pkg.cakto_checkout_url && method !== "internal_balance" && (
        <Card className="p-4 bg-amber-500/10 border-amber-400/35 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-300 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200">
            Ao abrir o checkout da Cakto, o campo de e-mail vira preenchido com o e-mail da sua conta.
            <strong> Nao altere esse e-mail</strong>: ele e usado para identificar sua compra e ativar seu pacote automaticamente.
          </p>
        </Card>
      )}

      {checkoutResult?.status === "pending" && method === "internal_balance" && (
        <Card className="space-y-2 p-6 bg-card/50 border-primary/30">
          <h3 className="font-semibold">Pagamento iniciado</h3>
          <p className="text-sm text-muted-foreground">ID: {checkoutResult.paymentId}</p>
        </Card>
      )}

      <Card className="p-4 bg-card/30 border-border/50 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-gold shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">
          Pagamentos Pix e Cartão usam Cakto. A ativacao ocorre automaticamente apos confirmacao do pagamento.
          Saques nunca sao automaticos: sempre passam por solicitacao, revisao administrativa e disparo manual individual ou em massa.
        </p>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate({ to: "/app/renovacao" })} disabled={submitting}>
          Voltar
        </Button>
        <Button onClick={confirmar} disabled={submitting} className="flex-1 bg-gold-gradient text-primary-foreground">
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando...</> : `Gerar pagamento ${usd.format(accounting.total_paid)}`}
        </Button>
      </div>
    </div>
  );
}

function buildCaktoCheckoutUrl(baseUrl: string, profile: any, user: { email?: string | null } | null) {
  const email = profile?.email || user?.email;
  if (!email) return baseUrl;

  const params = new URLSearchParams();
  params.set("email", email);
  params.set("confirmEmail", email);
  if (profile?.nome) params.set("name", profile.nome);

  const cpfDigits = String(profile?.cpf ?? "").replace(/\D/g, "");
  if (cpfDigits) params.set("cpf", cpfDigits);

  const phoneDigits = String(profile?.telefone ?? "").replace(/\D/g, "");
  if (phoneDigits) params.set("phone", phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`);

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${params.toString()}`;
}