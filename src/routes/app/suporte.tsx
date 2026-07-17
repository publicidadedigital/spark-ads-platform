import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { useLanguage } from "@/lib/i18n/context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, Clock } from "lucide-react";

export const Route = createFileRoute("/app/suporte" as any)({ component: SuportePage });

type Ticket = {
  id: string;
  created_at: string;
  category: string;
  subject: string;
  message: string;
  status: "aberto" | "respondido" | "fechado";
  admin_reply: string | null;
  admin_reply_at: string | null;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  aberto: { label: "Aberto", className: "bg-amber-500/15 text-amber-300 border border-amber-400/30" },
  respondido: { label: "Respondido", className: "bg-blue-500/15 text-blue-300 border border-blue-400/30" },
  fechado: { label: "Fechado", className: "bg-muted/20 text-muted-foreground border border-border/40" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type Ticket = {
  id: string;
  created_at: string;
  category: string;
  subject: string;
  message: string;
  status: "aberto" | "respondido" | "fechado";
  admin_reply: string | null;
  admin_reply_at: string | null;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  aberto: { label: "Aberto", className: "bg-amber-500/15 text-amber-300 border border-amber-400/30" },
  respondido: { label: "Respondido", className: "bg-blue-500/15 text-blue-300 border border-blue-400/30" },
  fechado: { label: "Fechado", className: "bg-muted/20 text-muted-foreground border border-border/40" },
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function loadTickets() {
    if (!supabase) return;
    setTicketsLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("id,created_at,category,subject,message,status,admin_reply,admin_reply_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setTickets((data ?? []) as Ticket[]);
    setTicketsLoading(false);
  }

  useEffect(() => { loadTickets(); }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !subject.trim() || !message.trim()) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const { error: fnError } = await supabase!.functions.invoke("send-contact", {
        body: { category, subject: subject.trim(), message: message.trim() },
      });
      if (fnError) throw fnError;
      setStatus("success");
      setCategory("");
      setSubject("");
      setMessage("");
      loadTickets();
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
      <div className="space-y-2">
        <h2 className="text-base font-semibold">{t("support.historyTitle")}</h2>
        {ticketsLoading ? (
          <p className="text-sm text-muted-foreground">{t("support.historyLoading")}</p>
        ) : tickets.length === 0 ? (
          <Card className="bg-card/50 border-border/50 p-6 text-center text-muted-foreground text-sm">
            <Clock className="mx-auto h-6 w-6 mb-2 opacity-40" />
            {t("support.historyEmpty")}
          </Card>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const isOpen = expanded === ticket.id;
              const meta = STATUS_META[ticket.status] ?? STATUS_META.aberto;
              return (
                <Card key={ticket.id} className="bg-card/50 border-border/50 overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-card/80 transition"
                    onClick={() => setExpanded(isOpen ? null : ticket.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{ticket.subject}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ticket.created_at)}</p>
                    </div>
                    {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />}
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/40 px-4 py-4 space-y-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">{t("support.yourMessage")}</p>
                        <div className="rounded-lg bg-muted/20 border border-border/40 p-3 text-sm whitespace-pre-wrap">{ticket.message}</div>
                      </div>
                      {ticket.admin_reply && (
                        <div>
                          <p className="text-xs font-medium text-blue-400 mb-1">
                            {t("support.adminReply")}
                            {ticket.admin_reply_at && <span className="text-muted-foreground ml-2 font-normal">{fmtDate(ticket.admin_reply_at)}</span>}
                          </p>
                          <div className="rounded-lg bg-blue-500/10 border border-blue-400/30 p-3 text-sm whitespace-pre-wrap text-blue-100">{ticket.admin_reply}</div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
