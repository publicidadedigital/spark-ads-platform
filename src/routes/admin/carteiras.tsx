import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Search, Wallet, TrendingUp, ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/carteiras")({ component: AdminCarteiras });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR") + " " + new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

type WalletRow = {
  user_id: string;
  saldo_disponivel: number;
  saldo_a_liberar: number;
  updated_at: string;
  users_profile: { nome: string | null; email: string | null } | null;
};

type TxRow = {
  id: string;
  tipo: string;
  valor: number;
  saldo_depois: number;
  created_at: string;
  descricao: string | null;
};

type HoldRow = {
  id: string;
  valor: number;
  release_at: string;
  status: string;
  created_at: string;
};

const TX_TIPO_LABEL: Record<string, string> = {
  bonus_credit: "Bônus creditado",
  bonus_release: "Bônus liberado",
  saque: "Saque",
  ajuste: "Ajuste",
  estorno: "Estorno",
};

function AdminCarteiras() {
  const { supabase } = useAuth();
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WalletRow | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [holds, setHolds] = useState<HoldRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"tx" | "holds" | null>("holds");

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("wallet_balances")
      .select("user_id,saldo_disponivel,saldo_a_liberar,updated_at,users_profile:user_id(nome,email)")
      .order("saldo_disponivel", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setWallets((data ?? []) as unknown as WalletRow[]);
    setLoading(false);
  }

  async function loadDetail(wallet: WalletRow) {
    if (!supabase) return;
    setSelected(wallet);
    setLoadingDetail(true);
    setTxs([]);
    setHolds([]);
    const [txRes, holdRes] = await Promise.all([
      supabase
        .from("wallet_transactions")
        .select("id,tipo,valor,saldo_depois,created_at,descricao")
        .eq("user_id", wallet.user_id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("balance_holds")
        .select("id,valor,release_at,status,created_at")
        .eq("user_id", wallet.user_id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (txRes.error) toast.error(txRes.error.message);
    if (holdRes.error) toast.error(holdRes.error.message);
    setTxs((txRes.data ?? []) as TxRow[]);
    setHolds((holdRes.data ?? []) as HoldRow[]);
    setLoadingDetail(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  const totals = useMemo(() => ({
    disponivel: wallets.reduce((s, w) => s + Number(w.saldo_disponivel), 0),
    aLiberar: wallets.reduce((s, w) => s + Number(w.saldo_a_liberar), 0),
    usersWithBalance: wallets.filter((w) => Number(w.saldo_disponivel) > 0 || Number(w.saldo_a_liberar) > 0).length,
  }), [wallets]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (!term) return wallets;
    return wallets.filter((w) => {
      const p = w.users_profile as any;
      return (p?.nome ?? "").toLowerCase().includes(term) || (p?.email ?? "").toLowerCase().includes(term);
    });
  }, [wallets, search]);

  if (selected) {
    const profile = selected.users_profile as any;
    const pendingHolds = holds.filter((h) => h.status === "pendente");
    const releasedHolds = holds.filter((h) => h.status === "liberado");

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold">{profile?.nome ?? "Usuário"}</h1>
            <p className="text-xs text-muted-foreground">{profile?.email ?? "—"}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-success/10 border-success/30 p-4">
            <p className="text-xs text-muted-foreground">Saldo disponível</p>
            <p className="text-2xl font-bold text-success">{usd.format(Number(selected.saldo_disponivel))}</p>
          </Card>
          <Card className="bg-amber-500/10 border-amber-400/30 p-4">
            <p className="text-xs text-muted-foreground">Aguardando liberação</p>
            <p className="text-2xl font-bold text-amber-300">{usd.format(Number(selected.saldo_a_liberar))}</p>
            <p className="text-xs text-muted-foreground">{pendingHolds.length} retenção(ões)</p>
          </Card>
          <Card className="bg-primary/10 border-primary/30 p-4">
            <p className="text-xs text-muted-foreground">Total na carteira</p>
            <p className="text-2xl font-bold text-primary">{usd.format(Number(selected.saldo_disponivel) + Number(selected.saldo_a_liberar))}</p>
          </Card>
        </div>

        {/* Retenções pendentes */}
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 text-sm font-semibold hover:bg-muted/5 transition-colors"
            onClick={() => setExpandedSection(expandedSection === "holds" ? null : "holds")}
          >
            <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-300" /> Retenções de 7 dias {pendingHolds.length > 0 && <span className="rounded-full bg-amber-500 text-black text-xs px-1.5">{pendingHolds.length}</span>}</span>
            {expandedSection === "holds" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {expandedSection === "holds" && (
            loadingDetail ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Carregando...</p>
            ) : holds.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma retenção.</p>
            ) : (
              <div className="overflow-x-auto border-t border-border/30">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/10">
                    <tr>
                      <th className="text-left p-3">Criado em</th>
                      <th className="text-left p-3">Valor</th>
                      <th className="text-left p-3">Libera em</th>
                      <th className="text-left p-3">Restam</th>
                      <th className="text-left p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holds.map((h) => {
                      const days = daysUntil(h.release_at);
                      return (
                        <tr key={h.id} className="border-t border-border/30 hover:bg-muted/5">
                          <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(h.created_at)}</td>
                          <td className="p-3 font-semibold">{usd.format(Number(h.valor))}</td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">{new Date(h.release_at).toLocaleDateString("pt-BR")}</td>
                          <td className="p-3">
                            {h.status === "pendente" ? (
                              <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300 text-xs">
                                <Clock className="h-3 w-3 mr-1" />{days > 0 ? `${days}d` : "Liberando..."}
                              </Badge>
                            ) : "—"}
                          </td>
                          <td className="p-3">
                            {h.status === "pendente" ? (
                              <Badge className="border-amber-400/30 bg-amber-500/15 text-amber-300">Pendente</Badge>
                            ) : h.status === "liberado" ? (
                              <Badge className="border-success/30 bg-success/15 text-success">Liberado</Badge>
                            ) : (
                              <Badge variant="outline">{h.status}</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Card>

        {/* Histórico de transações */}
        <Card className="bg-card/50 border-border/50 overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 text-sm font-semibold hover:bg-muted/5 transition-colors"
            onClick={() => setExpandedSection(expandedSection === "tx" ? null : "tx")}
          >
            <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Histórico de transações ({txs.length})</span>
            {expandedSection === "tx" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {expandedSection === "tx" && (
            loadingDetail ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Carregando...</p>
            ) : txs.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">Nenhuma transação.</p>
            ) : (
              <div className="overflow-x-auto border-t border-border/30">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-xs uppercase text-muted-foreground bg-muted/10">
                    <tr>
                      <th className="text-left p-3">Data</th>
                      <th className="text-left p-3">Tipo</th>
                      <th className="text-left p-3">Descrição</th>
                      <th className="text-right p-3">Valor</th>
                      <th className="text-right p-3">Saldo após</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txs.map((tx) => (
                      <tr key={tx.id} className="border-t border-border/30 hover:bg-muted/5">
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(tx.created_at)}</td>
                        <td className="p-3">{TX_TIPO_LABEL[tx.tipo] ?? tx.tipo}</td>
                        <td className="p-3 text-muted-foreground text-xs">{tx.descricao ?? "—"}</td>
                        <td className={`p-3 text-right font-semibold ${Number(tx.valor) >= 0 ? "text-success" : "text-destructive"}`}>
                          {Number(tx.valor) >= 0 ? "+" : ""}{usd.format(Number(tx.valor))}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">{usd.format(Number(tx.saldo_depois))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-gold shrink-0" /> Carteiras
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Saldos disponíveis e em retenção de todos os usuários. Clique em um usuário para ver transações e retenções.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>Atualizar</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-success/10 border-success/30 p-4">
          <p className="text-xs text-muted-foreground">Total disponível (plataforma)</p>
          <p className="text-2xl font-bold text-success">{usd.format(totals.disponivel)}</p>
        </Card>
        <Card className="bg-amber-500/10 border-amber-400/30 p-4">
          <p className="text-xs text-muted-foreground">Total em retenção (7d)</p>
          <p className="text-2xl font-bold text-amber-300">{usd.format(totals.aLiberar)}</p>
        </Card>
        <Card className="bg-primary/10 border-primary/30 p-4">
          <p className="text-xs text-muted-foreground">Usuários com saldo</p>
          <p className="text-2xl font-bold text-primary">{totals.usersWithBalance}</p>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} carteiras</span>
      </div>

      <Card className="bg-card/50 border-border/50 overflow-hidden">
        {loading ? (
          <p className="p-6 text-muted-foreground text-sm">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">Nenhuma carteira encontrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground bg-muted/10">
                <tr>
                  <th className="text-left p-3">Usuário</th>
                  <th className="text-right p-3">Disponível</th>
                  <th className="text-right p-3">Aguardando</th>
                  <th className="text-right p-3">Total</th>
                  <th className="text-right p-3">Atualizado</th>
                  <th className="text-right p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w) => {
                  const p = w.users_profile as any;
                  const total = Number(w.saldo_disponivel) + Number(w.saldo_a_liberar);
                  return (
                    <tr key={w.user_id} className="border-b border-border/30 hover:bg-muted/5 transition-colors">
                      <td className="p-3">
                        <div className="font-medium">{p?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p?.email ?? "—"}</div>
                      </td>
                      <td className="p-3 text-right font-semibold text-success">{usd.format(Number(w.saldo_disponivel))}</td>
                      <td className="p-3 text-right">
                        {Number(w.saldo_a_liberar) > 0 ? (
                          <span className="text-amber-300 font-semibold">{usd.format(Number(w.saldo_a_liberar))}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold">{usd.format(total)}</td>
                      <td className="p-3 text-right text-muted-foreground text-xs whitespace-nowrap">{fmtDate(w.updated_at)}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => loadDetail(w)} className="text-xs">
                          Detalhes
                        </Button>
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
