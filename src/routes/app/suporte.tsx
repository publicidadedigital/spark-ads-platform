import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useLanguage } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/suporte")({ component: SuportePage });

const CATEGORIES = [
  { value: "pagamento", labelKey: "support.catPayment" },
  { value: "saque", labelKey: "support.catWithdrawal" },
  { value: "campanha", labelKey: "support.catCampaign" },
  { value: "conta", labelKey: "support.catAccount" },
  { value: "tecnico", labelKey: "support.catTechnical" },
  { value: "outro", labelKey: "support.catOther" },
];

function SuportePage() {
  const { t } = useLanguage();
  const { supabase, user } = useAuth();
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !subject.trim() || !message.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const session = (await supabase?.auth.getSession())?.data.session;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contact`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ category, subject: subject.trim(), message: message.trim() }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setStatus("success");
      setCategory("");
      setSubject("");
      setMessage("");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg((err as Error).message ?? t("support.errorGeneric"));
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{t("support.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("support.subtitle")}</p>
      </div>

      {status === "success" ? (
        <Card className="border-success/30 bg-success/5 p-8 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="font-semibold text-success">{t("support.successTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("support.successText")}</p>
          <Button variant="outline" className="mt-2" onClick={() => setStatus("idle")}>
            {t("support.sendAnother")}
          </Button>
        </Card>
      ) : (
        <Card className="bg-card/50 border-border/50 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("support.category")}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">{t("support.selectCategory")}</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("support.subject")}</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
                required
                placeholder={t("support.subjectPlaceholder")}
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("support.message")}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                maxLength={2000}
                placeholder={t("support.messagePlaceholder")}
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/2000</p>
            </div>

            {status === "error" && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg || t("support.errorGeneric")}</span>
              </div>
            )}

            <Button type="submit" disabled={status === "loading"} className="w-full">
              {status === "loading" ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("support.sending")}</>
              ) : (
                <><MessageCircle className="mr-2 h-4 w-4" /> {t("support.send")}</>
              )}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
