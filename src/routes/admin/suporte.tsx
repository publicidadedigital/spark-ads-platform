import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronDown, ChevronUp, Clock } from "lucide-react";

export const Route = createFileRoute("/admin/suporte")({ component: AdminSuportePage });

type Ticket = {
  id: string;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  category: string;
  subject: string;
  message: string;
  status: "aberto" | "respondido" | "fechado";
  admin_notes: string | null;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  aberto: { label: "Aberto", className: "border-amber-400/30 bg-amber-500/15 text-amber-300" },
  respondido: { label: "Respondido", className: "border-blue-400/30 bg-blue-500/15 text-blue-300" },
  fechado: { label: "Fechado", className: "border-border/40 bg-muted/20 text-muted-foreground" },
};

const CATEGORY_LABELS: Record<string, string> = {
  pagamento: "Pagamento",
  saque: "Saque",
  campanha: "Campanha",
  conta: "Conta",
  tecnico: "Problema técnico",
  outro: "Outro",
};

const STATUS_OPTIONS = ["aberto", "respondido", "fechado"] as const;

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function AdminSuportePage() {
  const { supabase } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("aberto");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function load(status: string) {
    if (!supabase) return;
    setLoading(true);
    let q = supabase
      .from("support_tickets")
      .select("id,created_at,user_name,user_email,category,subject,message,status,admin_notes")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status !== "todos") q = q.eq("status", status);
    const { data } = await q;
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  }

  useEffect(() => { load(filterStatus); }, [supabase, filterStatus]);

  async function updateTicket(id: string, status: string, adminNotes: string) {
    if (!supabase) return;
    setSaving(id);
    await supabase.from("support_tickets").update({ status, admin_notes: adminNotes || null }).eq("id", id);
    setSaving(null);
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: status as Ticket["status"], admin_notes: adminNotes || null } : t));
  }

  const counts = { aberto: 0, respondido: 0, fechado: 0, todos: tickets.length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageCircle className="h-6 w-6" /> Suporte</h1>
          <p className="text-sm text-muted-foreground mt-1">Mensagens enviadas pelos usuários via Fale Conosco.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["aberto", "respondido", "fechado", "todos"] as const).map((s) => (
            <Button key={s} size="sm" variant={filterStatus === s ? "default" : "outline"} onClick={() => setFilterStatus(s)}>
              {s === "todos" ? "Todos" : STATUS_META[s]?.label ?? s}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : tickets.length === 0 ? (
        <Card className="bg-card/50 border-border/50 p-8 text-center text-muted-foreground">
          <Clock className="mx-auto h-8 w-8 mb-3 opacity-40" />
          <p>Nenhum ticket {filterStatus !== "todos" ? `com status "${STATUS_META[filterStatus]?.label}"` : ""} encontrado.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => {
            const isOpen = expanded === t.id;
            const meta = STATUS_META[t.status] ?? STATUS_META.aberto;
            const noteVal = notes[t.id] ?? t.admin_notes ?? "";
            return (
              <Card key={t.id} className="bg-card/50 border-border/50 overflow-hidden">
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-card/80 transition"
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{t.subject}</span>
                      <Badge className={meta.className + " text-xs"}>{meta.label}</Badge>
                      <span className="text-xs text-muted-foreground border border-border/40 rounded px-1.5 py-0.5">
                        {CATEGORY_LABELS[t.category] ?? t.category}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {t.user_name ?? "—"} · {t.user_email ?? "—"} · {fmtDate(t.created_at)}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <div className="border-t border-border/40 px-4 py-4 space-y-4">
                    <div className="rounded-lg bg-muted/20 border border-border/40 p-3 text-sm whitespace-pre-wrap">
                      {t.message}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notas internas</label>
                      <textarea
                        rows={3}
                        value={noteVal}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        placeholder="Anotações internas (não visíveis ao usuário)"
                        className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      {STATUS_OPTIONS.map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant={t.status === s ? "default" : "outline"}
                          disabled={saving === t.id}
                          onClick={() => updateTicket(t.id, s, noteVal)}
                        >
                          {STATUS_META[s].label}
                        </Button>
                      ))}
                      {t.user_email && (
                        <a href={`mailto:${t.user_email}?subject=Re: ${encodeURIComponent(t.subject)}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline">Responder por e-mail</Button>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
