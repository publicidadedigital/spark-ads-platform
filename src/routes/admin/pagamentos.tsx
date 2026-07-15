import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { activateDepositManually } from "@/lib/payments/admin-deposits.functions";

export const Route = createFileRoute("/admin/pagamentos")({ component: AdminPagamentos });

type UnifiedPayment = {
  id: string;
  tipo: "associado" | "anunciante";
  nome: string;
  email: string;
  method: string | null;
  amount_usd: number;
  created_at: string;
  status: string;
  // associado only
  paymentOrderId?: string;
  // anunciante only
  advertiserProfileId?: string;
  advertiserProfileStatus?: string;
  pacote?: string;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const statusMeta: Record<string, { label: string; className: string }> = {
  approved: { label: "Aprovado", className: "border-success/30 bg-success/15 text-success hover:bg-success/15" },
  pending:  { label: "Pendente",  className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  failed:   { label: "Falhou",    className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
  expired:  { label: "Expirado",  className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
  cancelled:{ label: "Cancelado", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

const methodLabel: Record<string, string> = {
  pix:              "PIX",
  cartao:           "Cartão",
  cakto:            "Cakto",
  crypto:           "Cripto",
  internal_balance: "Saldo",
};

function fmtMethod(m: string | null) {
  if (!m) return "—";
  return methodLabel[m] ?? m;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function AdminPagamentos() {
  const { supabase } = useAuth();
  const [rows, setRows] = useState<UnifiedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [{ data: clientRows }, { data: advRows }] = await Promise.all([
      supabase
        .from("payment_orders")
        .select("id,created_at,amount_usd,status,method,users_profile:user_id(nome,email)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("advertiser_payment_orders")
        .select("id,created_at,amount_usd,status,method,advertiser_profile:advertiser_profile_id(id,company_name,email,status),advertising_package:advertising_package_id(name,duration_days)")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const unified: UnifiedPayment[] = [];

    for (const c of clientRows ?? []) {
      const prof = (c as any).users_profile;
      unified.push({
        id: c.id,
        tipo: "associado",
        nome: prof?.nome ?? "—",
        email: prof?.email ?? "—",
        method: (c as any).method ?? null,
        amount_usd: Number((c as any).amount_usd ?? 0),
        created_at: c.created_at,
        status: (c as any).status,
        paymentOrderId: c.id,
      });
    }

    for (const a of advRows ?? []) {
      const prof = (a as any).advertiser_profile;
      const pkg  = (a as any).advertising_package;
      unified.push({
        id: a.id,
        tipo: "anunciante",
        nome: prof?.company_name ?? "—",
        email: prof?.email ?? "—",
        method: (a as any).method ?? null,
        amount_usd: Number((a as any).amount_usd ?? 0),
        created_at: a.created_at,
        status: (a as any).status,
        advertiserProfileId: prof?.id,
        advertiserProfileStatus: prof?.status,
        pacote: pkg ? `${pkg.name}${pkg.duration_days ? ` (${pkg.duration_days}d)` : ""}` : undefined,
      });
    }

    unified.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRows(unified);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function activateClient(paymentOrderId: string) {
    if (!supabase) return;
    if (!window.confirm("Ativar este pagamento manualmente?")) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada");
      await activateDepositManually({ data: { accessToken, paymentOrderId } });
      toast.success("Pagamento ativado");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao ativar");
    }
  }

  async function activateAdvertiser(paymentId: string, advertiserProfileId: string) {
    if (!supabase) return;
    if (!window.confirm("Ativar este pagamento de anunciante manualmente?")) return;
    const [{ error: payErr }, { error: advErr }] = await Promise.all([
      supabase.from("advertiser_payment_orders").update({ status: "approved", paid_at: new Date().toISOString() }).eq("id", paymentId),
      supabase.from("advertiser_profiles").update({ status: "ativo" }).eq("id", advertiserProfileId),
    ]);
    if (payErr || advErr) return toast.error(payErr?.message ?? advErr?.message ?? "Erro");
    toast.success("Anunciante ativado");
    load();
  }

  const q = search.toLowerCase();
  const filtered = q
    ? rows.filter((r) => r.nome.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    : rows;

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Pagamentos</h1>
          <p className="text-sm text-muted-foreground">{rows.length} registros{pendingCount > 0 && <span className="ml-2 text-amber-400 font-semibold">• {pendingCount} pendente{pendingCount > 1 ? "s" : ""}</span>}</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou e-mail…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card className="bg-card/50 border-border/50 overflow-hidden">
        {loading ? (
          <p className="p-6 text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-muted-foreground">Nenhum pagamento encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Nome</th>
                  <th className="text-left p-3">E-mail</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Forma Pgto</th>
                  <th className="text-left p-3">Valor</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = statusMeta[r.status] ?? { label: r.status, className: "" };
                  const needsAction =
                    r.tipo === "associado"
                      ? r.status !== "approved"
                      : r.status !== "approved" || r.advertiserProfileStatus !== "ativo";
                  return (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-card/40">
                      <td className="p-3 font-medium">
                        {r.nome}
                        {r.pacote && <div className="text-xs text-muted-foreground">{r.pacote}</div>}
                      </td>
                      <td className="p-3 text-muted-foreground">{r.email}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={r.tipo === "associado" ? "border-blue-400/40 text-blue-300" : "border-violet-400/40 text-violet-300"}>
                          {r.tipo === "associado" ? "Associado" : "Anunciante"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-foreground">{fmtMethod(r.method)}</span>
                      </td>
                      <td className="p-3 font-semibold">{usd.format(r.amount_usd)}</td>
                      <td className="p-3 text-muted-foreground">{fmtDate(r.created_at)}</td>
                      <td className="p-3"><Badge className={meta.className}>{meta.label}</Badge></td>
                      <td className="p-3 text-right">
                        {needsAction && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              r.tipo === "associado"
                                ? activateClient(r.paymentOrderId!)
                                : activateAdvertiser(r.id, r.advertiserProfileId!)
                            }
                          >
                            Ativar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
