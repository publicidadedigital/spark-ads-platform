import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useLanguage } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Package, Clock } from "lucide-react";

export const Route = createFileRoute("/app/pacotes")({ component: PacotesPage });

type Pkg = {
  id: string;
  nome: string;
  valor: number | string;
  cakto_checkout_url: string | null;
  descricao: string | null;
};

type Payment = {
  id: string;
  created_at: string;
  amount_usd: number | string;
  status: string;
  method: string | null;
  packages?: { nome: string | null } | null;
};

type Tab = "pacotes" | "historico";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function getPaymentStatusMeta(t: (key: string) => string): Record<string, { label: string; className: string }> {
  return {
    approved: { label: t("packages.statusApproved"), className: "border-success/30 bg-success/15 text-success" },
    pending: { label: t("packages.statusPending"), className: "border-amber-400/30 bg-amber-500/15 text-amber-300" },
    failed: { label: t("packages.statusFailed"), className: "border-destructive/30 bg-destructive/15 text-destructive" },
    expired: { label: t("packages.statusExpired"), className: "border-destructive/30 bg-destructive/15 text-destructive" },
    cancelled: { label: t("packages.statusCancelled"), className: "border-destructive/30 bg-destructive/15 text-destructive" },
  };
}

function getFeatures(t: (key: string) => string): string[] {
  return [
    t("packages.featureCampaigns"),
    t("packages.featureDailyBonus"),
    t("packages.featureDashboard"),
    t("packages.featureReferral"),
  ];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " às " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function PacotesPage() {
  const { t } = useLanguage();
  const paymentStatusMeta = getPaymentStatusMeta(t);
  const FEATURES = getFeatures(t);
  const { supabase, user } = useAuth();
  const [tab, setTab] = useState<Tab>("pacotes");
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [profile, setProfile] = useState<{ nome: string | null; email: string | null; id: string } | null>(null);
  const [activePackageName, setActivePackageName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data: prof } = await supabase
        .from("users_profile")
        .select("id,nome,email")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      setProfile(prof ?? null);

      const [{ data: pkgs }, { data: payRows }, { data: cycle }] = await Promise.all([
        supabase.from("packages").select("id,nome,valor,cakto_checkout_url,descricao").eq("status", "ativo").order("valor"),
        prof
          ? supabase
              .from("payment_orders")
              .select("id,created_at,amount_usd,status,method,packages:package_id(nome)")
              .eq("user_id", prof.id)
              .order("created_at", { ascending: false })
              .limit(50)
          : { data: [] },
        prof
          ? supabase
              .from("user_cycles")
              .select("packages:package_id(nome)")
              .eq("user_id", prof.id)
              .eq("status", "ativo")
              .order("started_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          : { data: null },
      ]);

      setPackages((pkgs ?? []) as Pkg[]);
      setPayments((payRows ?? []) as unknown as Payment[]);
      setActivePackageName((cycle as any)?.packages?.nome ?? null);
      setLoading(false);
    })();
  }, [supabase, user]);

  function buildCheckoutUrl(pkg: Pkg) {
    if (!pkg.cakto_checkout_url) return null;
    try {
      const u = new URL(pkg.cakto_checkout_url);
      if (profile?.email) u.searchParams.set("email", profile.email);
      if (profile?.nome) u.searchParams.set("name", profile.nome);
      return u.toString();
    } catch {
      return pkg.cakto_checkout_url;
    }
  }

  if (loading) return <p className="text-muted-foreground">{t("packages.loading")}</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("packages.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("packages.subtitle")}</p>
      </div>

      {activePackageName && (
        <Card className="border-success/30 bg-success/5 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <div>
            <p className="font-semibold text-success text-sm">{t("packages.activePackage").replace("{name}", activePackageName)}</p>
            <p className="text-xs text-muted-foreground">{t("packages.activeAccess")}</p>
          </div>
        </Card>
      )}

      <div className="flex gap-2">
        <Button size="sm" variant={tab === "pacotes" ? "default" : "outline"} onClick={() => setTab("pacotes")}>
          <Package className="mr-2 h-4 w-4" /> {t("packages.availablePackages")}
        </Button>
        <Button size="sm" variant={tab === "historico" ? "default" : "outline"} onClick={() => setTab("historico")}>
          <CreditCard className="mr-2 h-4 w-4" /> {t("packages.paymentHistory")} {payments.length > 0 && <span className="ml-1 opacity-70 text-xs">({payments.length})</span>}
        </Button>
      </div>

      {tab === "pacotes" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
          {packages.map((pkg) => {
            const checkoutUrl = buildCheckoutUrl(pkg);
            const isActive = activePackageName === pkg.nome;
            return (
              <Card key={pkg.id} className={`flex flex-col p-6 gap-0 ${isActive ? "border-success/40 bg-success/5" : "border-border/50 bg-card/60"}`}>
                <div className="mb-4 flex items-center justify-center rounded-2xl bg-primary/10 w-14 h-14 shrink-0">
                  <Package className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-lg leading-snug mb-1">{pkg.nome}</h3>
                <p className="text-3xl font-bold text-primary mb-4">{usd.format(Number(pkg.valor))}</p>
                <ul className="space-y-2 mb-4 flex-1">
                  {FEATURES.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-300 mb-4 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2">
                  {t("packages.afterPayment")}
                </p>
                {isActive ? (
                  <Button className="w-full" disabled>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> {t("packages.currentPackage")}
                  </Button>
                ) : checkoutUrl ? (
                  <a href={checkoutUrl} target="_blank" rel="noreferrer">
                    <Button className="w-full bg-primary text-primary-foreground">{t("packages.hireNow")}</Button>
                  </a>
                ) : (
                  <Button className="w-full" disabled>{t("packages.unavailable")}</Button>
                )}
              </Card>
            );
          })}
          {packages.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">{t("packages.noPackagesAvailable")}</p>
          )}
        </div>
      )}

      {tab === "historico" && (
        <Card className="bg-card/50 border-border/50 overflow-auto">
          {payments.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Clock className="mx-auto h-8 w-8 mb-3 opacity-40" />
              <p>{t("packages.noPaymentsYet")}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">{t("packages.dateTime")}</th>
                  <th className="text-left p-3">{t("packages.package")}</th>
                  <th className="text-left p-3">{t("packages.value")}</th>
                  <th className="text-left p-3">{t("packages.method")}</th>
                  <th className="text-left p-3">{t("packages.status")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const pkg = p.packages as any;
                  const meta = paymentStatusMeta[p.status] ?? { label: p.status, className: "border-border/50 text-muted-foreground" };
                  return (
                    <tr key={p.id} className="border-b border-border/30">
                      <td className="p-3 text-muted-foreground">{fmtDate(p.created_at)}</td>
                      <td className="p-3">{pkg?.nome ?? "—"}</td>
                      <td className="p-3 font-semibold">{p.amount_usd != null ? usd.format(Number(p.amount_usd)) : "—"}</td>
                      <td className="p-3 text-muted-foreground uppercase">{p.method ?? "—"}</td>
                      <td className="p-3"><Badge className={meta.className}>{meta.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
