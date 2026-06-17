import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { activateDepositManually } from "@/lib/payments/admin-deposits.functions";

export const Route = createFileRoute("/admin/pagamentos")({ component: AdminPagamentos });

type Tab = "clientes" | "anunciantes";

type ClientPayment = {
  id: string;
  created_at: string;
  amount_usd: number | string;
  status: string;
  method: string | null;
  users_profile?: { nome: string | null; email: string | null } | null;
};

type AdvertiserPayment = {
  id: string;
  created_at: string;
  amount_usd: number | string | null;
  status: string;
  method: string | null;
  provider_payment_id: string | null;
  advertiser_profile?: { company_name: string | null; email: string | null; status: string } | null;
  advertising_package?: { name: string | null; duration_days: number | null } | null;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const statusMeta: Record<string, { label: string; className: string }> = {
  approved: { label: "Aprovado", className: "border-success/30 bg-success/15 text-success hover:bg-success/15" },
  pending: { label: "Pendente", className: "border-amber-400/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/15" },
  failed: { label: "Falhou", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
  expired: { label: "Expirado", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
  cancelled: { label: "Cancelado", className: "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/15" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function AdminPagamentos() {
  const { supabase } = useAuth();
  const [tab, setTab] = useState<Tab>("clientes");
  const [clients, setClients] = useState<ClientPayment[]>([]);
  const [advertisers, setAdvertisers] = useState<AdvertiserPayment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [{ data: clientRows }, { data: advRows }] = await Promise.all([
      supabase
        .from("payment_orders")
        .select("id,created_at,amount_usd,status,method,users_profile:user_id(nome,email)")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("advertiser_payment_orders")
        .select("id,created_at,amount_usd,status,method,provider_payment_id,advertiser_profile:advertiser_profile_id(company_name,email,status),advertising_package:advertising_package_id(name,duration_days)")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    setClients((clientRows ?? []) as unknown as ClientPayment[]);
    setAdvertisers((advRows ?? []) as unknown as AdvertiserPayment[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function activateClient(id: string) {
    if (!supabase) return;
    if (!window.confirm("Ativar este pagamento manualmente?")) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error("Sessão expirada");
      await activateDepositManually({ data: { accessToken, paymentOrderId: id } });
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

  const pendingClients = clients.filter((c) => c.status === "pending").length;
  const pendingAdvertisers = advertisers.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Pagamentos</h1>

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant={tab === "clientes" ? "default" : "outline"} onClick={() => setTab("clientes")}>
          Associados ({clients.length}){pendingClients > 0 && <span className="ml-2 rounded-full bg-amber-500 text-black text-xs px-1.5">{pendingClients}</span>}
        </Button>
        <Button size="sm" variant={tab === "anunciantes" ? "default" : "outline"} onClick={() => setTab("anunciantes")}>
          Anunciantes ({advertisers.length}){pendingAdvertisers > 0 && <span className="ml-2 rounded-full bg-amber-500 text-black text-xs px-1.5">{pendingAdvertisers}</span>}
        </Button>
      </div>

      {tab === "clientes" ? (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {loading ? <p className="p-6 text-muted-foreground">Carregando...</p> : clients.length === 0 ? (
            <p className="p-6 text-muted-foreground">Nenhum pagamento de associado.</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Associado</th>
                  <th className="text-left p-3">E-mail</th>
                  <th className="text-left p-3">Método</th>
                  <th className="text-left p-3">Valor</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const meta = statusMeta[c.status] ?? { label: c.status, className: "" };
                  return (
                    <tr key={c.id} className="border-b border-border/30">
                      <td className="p-3">{(c.users_profile as any)?.nome ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{(c.users_profile as any)?.email ?? "—"}</td>
                      <td className="p-3 text-muted-foreground uppercase">{c.method ?? "—"}</td>
                      <td className="p-3 font-semibold">{usd.format(Number(c.amount_usd ?? 0))}</td>
                      <td className="p-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
                      <td className="p-3"><Badge className={meta.className}>{meta.label}</Badge></td>
                      <td className="p-3 text-right">
                        {c.status !== "approved" && (
                          <Button size="sm" variant="outline" onClick={() => activateClient(c.id)}>Ativar manualmente</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </Card>
      ) : (
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          {loading ? <p className="p-6 text-muted-foreground">Carregando...</p> : advertisers.length === 0 ? (
            <p className="p-6 text-muted-foreground">Nenhum pagamento de anunciante ainda.</p>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Empresa</th>
                  <th className="text-left p-3">E-mail</th>
                  <th className="text-left p-3">Pacote</th>
                  <th className="text-left p-3">Valor</th>
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Status Pgto</th>
                  <th className="text-left p-3">Status Conta</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {advertisers.map((a) => {
                  const meta = statusMeta[a.status] ?? { label: a.status, className: "" };
                  const advProfile = a.advertiser_profile as any;
                  const pkg = a.advertising_package as any;
                  const pkgLabel = pkg ? `${pkg.name}${pkg.duration_days ? ` (${pkg.duration_days}d)` : ""}` : "—";
                  const needsActivation = a.status !== "approved" || advProfile?.status !== "ativo";
                  return (
                    <tr key={a.id} className="border-b border-border/30">
                      <td className="p-3">{advProfile?.company_name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{advProfile?.email ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{pkgLabel}</td>
                      <td className="p-3 font-semibold">{a.amount_usd != null ? usd.format(Number(a.amount_usd)) : "—"}</td>
                      <td className="p-3 text-muted-foreground">{fmtDate(a.created_at)}</td>
                      <td className="p-3"><Badge className={meta.className}>{meta.label}</Badge></td>
                      <td className="p-3">
                        <Badge variant="outline">{advProfile?.status ?? "—"}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        {needsActivation && advProfile?.id && (
                          <Button size="sm" variant="outline" onClick={() => activateAdvertiser(a.id, advProfile.id)}>
                            Ativar manualmente
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </Card>
      )}
    </div>
  );
}
