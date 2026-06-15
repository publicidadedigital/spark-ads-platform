import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { requestWithdrawal } from "@/lib/withdrawals/withdrawal.functions";
import { getTwoFactorStatus } from "@/lib/security/totp.functions";
import { TwoFactorReminderBanner } from "@/components/TwoFactorSetup";
import { MIN_WITHDRAWAL_USD, MAX_WITHDRAWAL_USD } from "@/lib/business/rules";
import { Info, Wallet } from "lucide-react";

export const Route = createFileRoute("/app/saque")({ component: SaquePage });

type WithdrawalRequest = {
  id: string;
  created_at: string;
  amount_usd: number | string;
  method: string;
  destination_key: string;
  status: string;
  admin_notes: string | null;
};

const statusLabels: Record<string, string> = {
  solicitado: "Solicitado",
  em_analise: "Em analise",
  aprovado: "Aprovado",
  em_processamento: "Em processamento",
  pago: "Pago",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

const statusStyles: Record<string, string> = {
  solicitado: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  em_analise: "border-amber-400/30 bg-amber-500/15 text-amber-300",
  aprovado: "border-sky-400/30 bg-sky-500/15 text-sky-300",
  em_processamento: "border-sky-400/30 bg-sky-500/15 text-sky-300",
  pago: "border-success/30 bg-success/15 text-success",
  recusado: "border-destructive/30 bg-destructive/15 text-destructive",
  cancelado: "border-destructive/30 bg-destructive/15 text-destructive",
};

function SaquePage() {
  const { supabase, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [cpf, setCpf] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);

  async function load() {
    if (!supabase || !user) return;
    setLoading(true);

    const { data: prof } = await supabase
      .from("users_profile")
      .select("id,cpf")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!prof) {
      setLoading(false);
      return;
    }

    setCpf(prof.cpf ?? null);

    const { data: session } = await supabase.auth.getSession();
    const accessToken = session.session?.access_token;
    if (accessToken) {
      getTwoFactorStatus({ data: { accessToken } })
        .then((status) => setTwoFactorEnabled(status.enabled))
        .catch(() => {});
    }

    const [{ data: cycle }, { data: withdrawals }] = await Promise.all([
      supabase
        .from("user_cycles")
        .select("saldo_bonificacoes")
        .eq("user_id", prof.id)
        .eq("status", "ativo")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("withdrawal_requests")
        .select("id,created_at,amount_usd,method,destination_key,status,admin_notes")
        .eq("user_id", prof.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setBalance(Number(cycle?.saldo_bonificacoes ?? 0));
    setRequests((withdrawals ?? []) as WithdrawalRequest[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase, user]);

  if (loading) return <p className="text-muted-foreground">Carregando saque...</p>;

  return (
    <div className="space-y-4">
      <Card className="border-primary/15 bg-card/50 p-4 md:p-5">
        <div>
          <h1 className="text-3xl font-bold tracking-normal">Saque</h1>
          <p className="mt-1 text-sm text-muted-foreground">Solicite a retirada do seu saldo disponivel e acompanhe suas solicitacoes.</p>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/15 bg-background/45 p-4">
          <div className="rounded-lg bg-primary/15 p-2 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo disponivel para saque</p>
            <p className="text-2xl font-bold">{formatMoney(balance)}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-primary/15 bg-card/50 p-5">
          <h2 className="font-semibold">Historico de solicitacoes</h2>
          <div className="mt-4 overflow-x-auto">
            {requests.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">Nenhuma solicitacao de saque ainda.</p>
            ) : (
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border/50">
                    <th className="px-3 py-3 text-left font-medium">Data</th>
                    <th className="px-3 py-3 text-left font-medium">Valor</th>
                    <th className="px-3 py-3 text-left font-medium">Chave</th>
                    <th className="px-3 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr key={item.id} className="border-b border-border/35 last:border-0">
                      <td className="px-3 py-3 text-muted-foreground">{formatDateTime(item.created_at)}</td>
                      <td className="px-3 py-3 font-semibold">{formatMoney(Number(item.amount_usd))}</td>
                      <td className="px-3 py-3 text-muted-foreground">{item.destination_key}</td>
                      <td className="px-3 py-3">
                        <Badge className={`${statusStyles[item.status] ?? ""} hover:bg-transparent`}>
                          {statusLabels[item.status] ?? item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <WithdrawalRequestCard balance={balance} cpf={cpf} twoFactorEnabled={twoFactorEnabled} onSubmitted={load} />
      </div>
    </div>
  );
}

function WithdrawalRequestCard({
  balance,
  cpf,
  twoFactorEnabled,
  onSubmitted,
}: {
  balance: number;
  cpf: string | null;
  twoFactorEnabled: boolean;
  onSubmitted: () => void;
}) {
  const { supabase } = useAuth();
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [documentCpf, setDocumentCpf] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!supabase) return;
    const amountUsd = Number(amount);
    if (!amountUsd || amountUsd <= 0) return toast.error("Informe um valor valido");
    if (amountUsd < MIN_WITHDRAWAL_USD) return toast.error(`O valor minimo para saque e de ${formatMoney(MIN_WITHDRAWAL_USD)}`);
    if (amountUsd > MAX_WITHDRAWAL_USD) return toast.error(`O valor maximo para saque e de ${formatMoney(MAX_WITHDRAWAL_USD)}`);
    if (amountUsd > balance) return toast.error("Saldo insuficiente para este saque");
    if (!pixKey.trim()) return toast.error("Informe a chave PIX");
    if (!documentCpf.trim()) return toast.error("Informe o CPF cadastrado na conta");
    if (!/^\d{6}$/.test(totpCode)) return toast.error("Informe o código de 6 dígitos do Google Authenticator");

    setSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error("Sessao expirada");

      await requestWithdrawal({
        data: {
          accessToken,
          amountUsd,
          method: "pix",
          destinationKey: pixKey.trim(),
          destinationDocument: documentCpf.trim(),
          totpCode,
        },
      });

      toast.success("Solicitacao de saque enviada para analise");
      setAmount("");
      setPixKey("");
      setDocumentCpf("");
      setTotpCode("");
      onSubmitted();
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao solicitar saque");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-primary/15 bg-card/50 p-5 space-y-3">
      <div>
        <h3 className="font-semibold">Solicitar saque</h3>
        <p className="text-xs text-muted-foreground">Saldo disponivel: {formatMoney(balance)}</p>
      </div>

      {!twoFactorEnabled && <TwoFactorReminderBanner to="/app/seguranca" />}

      <div className="flex items-start gap-2 rounded-lg border border-amber-400/35 bg-amber-500/10 p-3 text-xs text-amber-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          O valor minimo para solicitar saque e de <strong>{formatMoney(MIN_WITHDRAWAL_USD)}</strong> e o valor maximo
          por solicitacao e de <strong>{formatMoney(MAX_WITHDRAWAL_USD)}</strong>. O saque so pode ser realizado para
          o CPF cadastrado nesta conta e requer confirmacao via Google Authenticator.
        </p>
      </div>

      <div>
        <Label>Valor (US$)</Label>
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`${MIN_WITHDRAWAL_USD}`} min={MIN_WITHDRAWAL_USD} max={MAX_WITHDRAWAL_USD} />
      </div>
      <div>
        <Label>Chave PIX</Label>
        <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatoria" />
      </div>
      <div>
        <Label>CPF cadastrado na conta</Label>
        <Input value={documentCpf} onChange={(e) => setDocumentCpf(e.target.value)} placeholder={cpf ?? "Informe o CPF da sua conta"} />
        <p className="mt-1 text-xs text-muted-foreground">O saque so pode ser feito para o CPF cadastrado nesta conta.</p>
      </div>
      <div>
        <Label>Codigo do Google Authenticator</Label>
        <Input value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="000000" maxLength={6} />
      </div>
      <Button onClick={submit} disabled={submitting} className="w-full bg-gold-gradient text-primary-foreground">
        Solicitar saque
      </Button>
    </Card>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
