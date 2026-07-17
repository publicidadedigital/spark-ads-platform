import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MAX_WITHDRAWAL_USD, MIN_WITHDRAWAL_USD, isWithdrawalProcessingDay } from "@/lib/business/rules";
import { useAuth } from "@/lib/supabase/auth";
import { markApprovedWithdrawalsPaidBatch, markWithdrawalPaid, reviewWithdrawal } from "@/lib/withdrawals/withdrawal.functions";
import { getTwoFactorStatus } from "@/lib/security/totp.functions";
import { TwoFactorReminderBanner } from "@/components/TwoFactorSetup";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, Megaphone, RefreshCcw, Send, XCircle, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/saques")({ component: AdminWithdrawalsPage });

type AdvWithdrawalRequest = {
  id: string;
  created_at: string;
  amount_usd: number;
  method: string;
  destination_key: string;
  destination_holder: string | null;
  status: string;
  admin_notes: string | null;
  advertiser_profile?: { company_name: string | null; email: string | null } | null;
};

type AdvertiserBonus = {
  id: string;
  created_at: string;
  referrer_bonus: number;
  gross_amount: number;
  status: string;
  available_at: string | null;
  motivo: string | null;
  referrer: { nome: string | null; email: string | null } | null;
  advertiser: { company_name: string | null } | null;
};

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
  const [bonuses, setBonuses] = useState<AdvertiserBonus[]>([]);
  const [advWithdrawals, setAdvWithdrawals] = useState<AdvWithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [bonusLoading, setBonusLoading] = useState(true);
  const [advWdLoading, setAdvWdLoading] = useState(true);
  const [status, setStatus] = useState("todos");
  const [bonusStatus, setBonusStatus] = useState("todos");
  const [advWdStatus, setAdvWdStatus] = useState("todos");
  const [cancelMotivo, setCancelMotivo] = useState<Record<string, string>>({});
  const [reference, setReference] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  const canProcessToday = isWithdrawalProcessingDay();
  const filtered = useMemo(() => items.filter((item) => status === "todos" || item.status === status), [items, status]);
  const approvedCount = items.filter((item) => item.status === "aprovado").length;
  const approvedTotal = items.filter((item) => item.status === "aprovado").reduce((sum, item) => sum + Number(item.amount_usd ?? 0), 0);

  async function getToken() {
    if (!supabase) throw new Error("Sessao expirada");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessao expirada");
    return token;
  }

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("id,created_at,user_id,amount_usd,method,destination_key,destination_holder,status,requested_processing_day,admin_notes,users_profile:user_id(nome,email)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) toast.error(error.message);
    setItems((data ?? []) as unknown as Withdrawal[]);
    setLoading(false);
  }

  async function loadBonuses() {
    if (!supabase) return;
    setBonusLoading(true);
    await supabase.rpc("release_due_advertiser_bonuses");
    const { data, error } = await supabase
      .from("advertiser_bonus_events")
      .select("id,created_at,referrer_bonus,gross_amount,status,available_at,motivo,referrer:referrer_user_id(nome,email),advertiser:advertiser_id(company_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setBonuses((data ?? []) as unknown as AdvertiserBonus[]);
    setBonusLoading(false);
  }

  async function releaseBonus(id: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("admin_release_advertiser_bonus", { p_bonus_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão liberada com sucesso");
    loadBonuses();
  }

  async function cancelBonus(id: string) {
    if (!supabase) return;
    const motivo = cancelMotivo[id]?.trim() || "Cancelado pelo administrador";
    const { error } = await supabase.rpc("admin_cancel_advertiser_bonus", { p_bonus_id: id, p_motivo: motivo });
    if (error) { toast.error(error.message); return; }
    toast.success("Comissão cancelada");
    setCancelMotivo((prev) => { const n = { ...prev }; delete n[id]; return n; });
    loadBonuses();
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

  async function loadAdvWithdrawals() {
    if (!supabase) return;
    setAdvWdLoading(true);
    const { data, error } = await supabase
      .from("advertiser_withdrawal_requests")
      .select("id,created_at,amount_usd,method,destination_key,destination_holder,status,admin_notes,advertiser_profile:advertiser_profile_id(company_name,email)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setAdvWithdrawals((data ?? []) as unknown as AdvWithdrawalRequest[]);
    setAdvWdLoading(false);
  }

  async function reviewAdvWithdrawal(id: string, newStatus: string) {
    if (!supabase) return;
    const { error } = await supabase
      .from("advertiser_withdrawal_requests")
      .update({ status: newStatus, reviewed_at: newStatus !== "solicitado" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Saque ${newStatus === "aprovado" ? "aprovado" : newStatus === "recusado" ? "recusado" : "atualizado"}`);
    loadAdvWithdrawals();
  }

  async function payAdvWithdrawal(id: string) {
    if (!supabase) return;
    const { error } = await supabase
      .from("advertiser_withdrawal_requests")
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Saque de anunciante marcado como pago");
    loadAdvWithdrawals();
  }

  useEffect(() => { load(); loadBonuses(); loadTwoFactor(); loadAdvWithdrawals(); }, []);

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

      {/* ── Comissões de Indicação de Anunciante ── */}
      <div>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-primary/40 bg-primary/15 p-2 text-primary">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Comissões de Indicação de Anunciante</h2>
              <p className="text-sm text-muted-foreground">50% do lucro real · liberação manual ou após 7 dias sem cancelamento</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={bonusStatus}
              onChange={(e) => setBonusStatus(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="liberado">Liberado</option>
              <option value="cancelado">Cancelado</option>
            </select>
            <Button variant="outline" size="sm" onClick={loadBonuses} disabled={bonusLoading}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {bonusLoading ? (
            <Card><CardContent className="p-6 text-muted-foreground">Carregando comissões...</CardContent></Card>
          ) : bonuses.filter((b) => bonusStatus === "todos" || b.status === bonusStatus).length === 0 ? (
            <Card><CardContent className="p-6 text-muted-foreground">Nenhuma comissão encontrada.</CardContent></Card>
          ) : bonuses
              .filter((b) => bonusStatus === "todos" || b.status === bonusStatus)
              .map((b) => {
                const referrer = Array.isArray(b.referrer) ? b.referrer[0] : b.referrer;
                const advertiser = Array.isArray(b.advertiser) ? b.advertiser[0] : b.advertiser;
                const daysLeft = b.available_at
                  ? Math.max(0, Math.ceil((new Date(b.available_at).getTime() - Date.now()) / 86_400_000))
                  : null;
                return (
                  <Card key={b.id} className="border-border/70">
                    <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {b.status === "liberado" && (
                            <Badge className="border-success/30 bg-success/15 text-success hover:bg-success/15">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Liberado
                            </Badge>
                          )}
                          {b.status === "cancelado" && (
                            <Badge className="border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15">
                              <XCircle className="mr-1 h-3 w-3" /> Cancelado
                            </Badge>
                          )}
                          {b.status === "pendente" && (
                            <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15">
                              <Clock className="mr-1 h-3 w-3" />
                              {daysLeft !== null && daysLeft > 0 ? `Libera em ${daysLeft}d` : "Pronto para liberar"}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <h3 className="text-xl font-semibold text-success">{usd.format(Number(b.referrer_bonus ?? 0))}</h3>
                        <p className="text-sm text-muted-foreground">
                          Indicador: <span className="font-medium text-foreground">{referrer?.nome ?? "–"}</span>
                          {referrer?.email && <span className="ml-1 text-xs">({referrer.email})</span>}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Anunciante: <span className="font-medium text-foreground">{advertiser?.company_name ?? "–"}</span>
                          {" · "}Pacote: {usd.format(Number(b.gross_amount ?? 0))}
                        </p>
                        {b.motivo && (
                          <p className="text-sm italic text-muted-foreground">{b.motivo}</p>
                        )}
                        {b.status === "pendente" && (
                          <div className="flex items-center gap-2 pt-1">
                            <Input
                              placeholder="Motivo do cancelamento (opcional)"
                              value={cancelMotivo[b.id] ?? ""}
                              onChange={(e) => setCancelMotivo((prev) => ({ ...prev, [b.id]: e.target.value }))}
                              className="h-8 max-w-xs text-xs"
                            />
                          </div>
                        )}
                      </div>
                      {b.status === "pendente" && (
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Button size="sm" onClick={() => releaseBonus(b.id)} className="bg-success/20 text-success hover:bg-success/30 border border-success/30">
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Liberar agora
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => cancelBonus(b.id)} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                            <XCircle className="mr-2 h-4 w-4" /> Cancelar
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>
      {/* ── Saques de Anunciantes ── */}
      <div>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-amber-400/40 bg-amber-500/15 p-2 text-amber-300">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Saques de Anunciantes</h2>
              <p className="text-sm text-muted-foreground">Solicitações de retirada de comissão de indicação pelos anunciantes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={advWdStatus}
              onChange={(e) => setAdvWdStatus(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="solicitado">Solicitado</option>
              <option value="em_analise">Em análise</option>
              <option value="aprovado">Aprovado</option>
              <option value="pago">Pago</option>
              <option value="recusado">Recusado</option>
            </select>
            <Button variant="outline" size="sm" onClick={loadAdvWithdrawals} disabled={advWdLoading}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {advWdLoading ? (
            <Card><CardContent className="p-6 text-muted-foreground">Carregando saques de anunciantes...</CardContent></Card>
          ) : advWithdrawals.filter((w) => advWdStatus === "todos" || w.status === advWdStatus).length === 0 ? (
            <Card><CardContent className="p-6 text-muted-foreground">Nenhum saque de anunciante encontrado.</CardContent></Card>
          ) : advWithdrawals
              .filter((w) => advWdStatus === "todos" || w.status === advWdStatus)
              .map((w) => {
                const prof = Array.isArray(w.advertiser_profile) ? w.advertiser_profile[0] : w.advertiser_profile;
                return (
                  <Card key={w.id} className="border-border/70">
                    <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{w.status}</Badge>
                          <Badge variant="secondary">{w.method.toUpperCase()}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString("pt-BR")}</span>
                        </div>
                        <h2 className="text-xl font-semibold">{usd.format(Number(w.amount_usd))}</h2>
                        <p className="text-sm text-muted-foreground">Anunciante: {prof?.company_name ?? "—"} {prof?.email ? `(${prof.email})` : ""}</p>
                        <p className="text-sm text-muted-foreground break-all">Destino: {w.destination_key}</p>
                        {w.destination_holder && <p className="text-sm text-muted-foreground">Titular: {w.destination_holder}</p>}
                        {w.admin_notes && <p className="text-sm italic text-muted-foreground">{w.admin_notes}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button size="sm" variant="outline" onClick={() => reviewAdvWithdrawal(w.id, "aprovado")} disabled={!["solicitado", "em_analise"].includes(w.status)}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reviewAdvWithdrawal(w.id, "recusado")} disabled={!["solicitado", "em_analise"].includes(w.status)} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                          <XCircle className="mr-2 h-4 w-4" /> Recusar
                        </Button>
                        <Button size="sm" onClick={() => payAdvWithdrawal(w.id)} disabled={w.status !== "aprovado"}>
                          <Send className="mr-2 h-4 w-4" /> Pagar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>
    </div>
  );
}
