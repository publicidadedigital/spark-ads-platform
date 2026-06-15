import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_WITHDRAWAL_USD, MIN_WITHDRAWAL_USD, isWithdrawalProcessingDay } from "@/lib/business/rules";
import { useAuth } from "@/lib/supabase/auth";
import { markApprovedWithdrawalsPaidBatch, markWithdrawalPaid, reviewWithdrawal } from "@/lib/withdrawals/withdrawal.functions";
import { getTwoFactorStatus } from "@/lib/security/totp.server";
import { TwoFactorReminderBanner } from "@/components/TwoFactorSetup";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, RefreshCcw, Send, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/saques")({ component: AdminWithdrawalsPage });

type Withdrawal = {
  id: string;
  created_at: string;
  user_id: string;
  amount_usd: number | string;
  method: "pix" | "crypto";
  destination_key: string;
  destination_holder: string | null;
  status: string;
  requested_processing_day: number | null;
  admin_notes: string | null;
  users_profile?: { nome: string | null; email: string | null } | null;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function AdminWithdrawalsPage() {
  const { supabase } = useAuth();
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("todos");
  const [reference, setReference] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  const canProcessToday = isWithdrawalProcessingDay();
  const filtered = useMemo(() => items.filter((item) => status === "todos" || item.status === status), [items, status]);
  const approvedCount = items.filter((item) => item.status === "aprovado").length;
  const approvedTotal = items.filter((item) => item.status === "aprovado").reduce((sum, item) => sum + Number(item.amount_usd ?? 0), 0);

  async function getToken() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessao expirada");
    return token;
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("id,created_at,user_id,amount_usd,method,destination_key,destination_holder,status,requested_processing_day,admin_notes,users_profile:user_id(nome,email)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) toast.error(error.message);
    setItems((data ?? []) as Withdrawal[]);
    setLoading(false);
  }

  function requireTotp() {
    if (!/^\d{6}$/.test(totpCode)) {
      toast.error("Informe o código de 6 dígitos do Google Authenticator");
      return null;
    }
    return totpCode;
  }

  async function review(id: string, action: "approve" | "reject") {
    const code = requireTotp();
    if (!code) return;
    try {
      const accessToken = await getToken();
      await reviewWithdrawal({ data: { accessToken, withdrawalId: id, action, totpCode: code } });
      toast.success(action === "approve" ? "Saque aprovado" : "Saque recusado");
      setTotpCode("");
      load();
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao revisar saque");
    }
  }

  async function payOne(id: string) {
    const code = requireTotp();
    if (!code) return;
    try {
      const accessToken = await getToken();
      await markWithdrawalPaid({ data: { accessToken, withdrawalId: id, providerReference: reference || undefined, totpCode: code } });
      toast.success("Saque marcado como pago");
      setReference("");
      setTotpCode("");
      load();
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao pagar saque");
    }
  }

  async function payBatch() {
    const code = requireTotp();
    if (!code) return;
    try {
      const accessToken = await getToken();
      const result = await markApprovedWithdrawalsPaidBatch({ data: { accessToken, notes: "Disparo em massa manual", totpCode: code } });
      toast.success(`Lote processado: ${result.paid} saque(s)`);
      setTotpCode("");
      load();
    } catch (error: any) {
      toast.error(error.message ?? "Erro no disparo em massa");
    }
  }

  async function loadTwoFactor() {
    try {
      const accessToken = await getToken();
      const result = await getTwoFactorStatus({ data: { accessToken } });
      setTwoFactorEnabled(result.enabled);
    } catch {
      // ignore
    }
  }

  useEffect(() => { load(); loadTwoFactor(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Financeiro</p>
          <h1 className="text-3xl font-bold">Saques</h1>
          <p className="text-sm text-muted-foreground">
            Saques entre {usd.format(MIN_WITHDRAWAL_USD)} e {usd.format(MAX_WITHDRAWAL_USD)}. Disparo manual somente nos dias 15 e 30.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}><RefreshCcw className="mr-2 h-4 w-4" />Atualizar</Button>
          <Button onClick={payBatch} disabled={!canProcessToday || approvedCount === 0} className="bg-primary text-primary-foreground">
            <Send className="mr-2 h-4 w-4" /> Pagar aprovados em massa
          </Button>
        </div>
      </div>

      {!twoFactorEnabled && <TwoFactorReminderBanner to="/admin/seguranca" />}

      {!canProcessToday && (
        <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-200">
          Hoje nao e dia 15 nem 30. O sistema bloqueia o disparo de pagamentos para preservar a regra operacional.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Aprovados para pagamento</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{approvedCount}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total aprovado</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{usd.format(approvedTotal)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Proximo processamento</CardTitle></CardHeader><CardContent className="text-3xl font-bold">15/30</CardContent></Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="solicitado">Solicitado</option>
            <option value="em_analise">Em analise</option>
            <option value="aprovado">Aprovado</option>
            <option value="pago">Pago</option>
            <option value="recusado">Recusado</option>
          </select>
          <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia manual do comprovante/pagamento" />
          <Input value={totpCode} onChange={(event) => setTotpCode(event.target.value)} placeholder="Código 2FA (6 dígitos)" maxLength={6} className="max-w-[200px]" />
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <Card><CardContent className="p-6 text-muted-foreground">Carregando saques...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-6 text-muted-foreground">Nenhum saque encontrado.</CardContent></Card>
        ) : filtered.map((item) => (
          <Card key={item.id} className="border-border/70">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{item.status}</Badge>
                  <Badge variant="secondary">{item.method.toUpperCase()}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("pt-BR")}</span>
                </div>
                <h2 className="text-xl font-semibold">{usd.format(Number(item.amount_usd ?? 0))}</h2>
                <p className="text-sm text-muted-foreground">Usuario: {item.users_profile?.nome ?? item.user_id}</p>
                <p className="text-sm text-muted-foreground break-all">Destino: {item.destination_key}</p>
                {item.destination_holder && <p className="text-sm text-muted-foreground">Titular: {item.destination_holder}</p>}
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button size="sm" variant="outline" onClick={() => review(item.id, "approve")} disabled={!['solicitado','em_analise'].includes(item.status)}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                </Button>
                <Button size="sm" variant="outline" onClick={() => review(item.id, "reject")} disabled={!['solicitado','em_analise'].includes(item.status)}>
                  <XCircle className="mr-2 h-4 w-4" /> Recusar
                </Button>
                <Button size="sm" onClick={() => payOne(item.id)} disabled={!canProcessToday || item.status !== 'aprovado'}>
                  <Send className="mr-2 h-4 w-4" /> Pagar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
