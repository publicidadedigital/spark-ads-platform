import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/supabase/auth";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, RefreshCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/admin/logs")({ component: AdminSystemLogsPage });

type SystemLog = {
  id: string;
  created_at: string;
  user_id: string | null;
  module: string;
  error_type: string;
  description: string;
  probable_reason: string | null;
  recommended_action: string | null;
  status: "novo" | "em_analise" | "resolvido" | "ignorado";
  severity: "baixo" | "medio" | "alto" | "critico";
  metadata?: Record<string, unknown>;
};

const statusLabels: Record<SystemLog["status"], string> = {
  novo: "Novo",
  em_analise: "Em analise",
  resolvido: "Resolvido",
  ignorado: "Ignorado",
};

const severityLabels: Record<SystemLog["severity"], string> = {
  baixo: "Baixo",
  medio: "Medio",
  alto: "Alto",
  critico: "Critico",
};

function AdminSystemLogsPage() {
  const { supabase, user } = useAuth();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("todos");
  const [severity, setSeverity] = useState("todos");
  const [module, setModule] = useState("todos");
  const [search, setSearch] = useState("");

  const modules = useMemo(() => Array.from(new Set(logs.map((log) => log.module))).sort(), [logs]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesStatus = status === "todos" || log.status === status;
      const matchesSeverity = severity === "todos" || log.severity === severity;
      const matchesModule = module === "todos" || log.module === module;
      const matchesQuery = !query || [log.description, log.error_type, log.probable_reason, log.recommended_action, log.user_id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

      return matchesStatus && matchesSeverity && matchesModule && matchesQuery;
    });
  }, [logs, module, search, severity, status]);

  async function loadLogs() {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { data, error: loadError } = await supabase
      .from("system_error_logs")
      .select("id, created_at, user_id, module, error_type, description, probable_reason, recommended_action, status, severity, metadata")
      .order("created_at", { ascending: false })
      .limit(200);

    if (loadError) {
      setError(loadError.message);
      setLogs([]);
    } else {
      setLogs((data ?? []) as SystemLog[]);
    }
    setLoading(false);
  }

  async function markResolved(log: SystemLog) {
    if (!supabase) return;
    const { error: updateError } = await supabase
      .from("system_error_logs")
      .update({ status: "resolvido", resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
      .eq("id", log.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setLogs((current) => current.map((item) => (item.id === log.id ? { ...item, status: "resolvido" } : item)));
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const criticalCount = logs.filter((log) => log.severity === "critico" && log.status !== "resolvido").length;
  const openCount = logs.filter((log) => log.status === "novo" || log.status === "em_analise").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Monitoramento</p>
          <h1 className="text-3xl font-bold">Logs do Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Erros automaticos de pagamentos, pacotes, bonus, permissao, campanhas, banco e regras de 200%.
          </p>
        </div>
        <Button variant="outline" onClick={loadLogs} disabled={loading}>
          <RefreshCcw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Abertos</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{openCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Criticos</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-red-400">{criticalCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Modulos</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{modules.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtre por texto, modulo, gravidade e status.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar erro, usuario ou recomendacao" />
          </label>
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="todos">Todos os status</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={severity} onChange={(event) => setSeverity(event.target.value)}>
            <option value="todos">Todas as gravidades</option>
            {Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select className="rounded-md border border-border bg-background px-3 py-2 text-sm" value={module} onChange={(event) => setModule(event.target.value)}>
            <option value="todos">Todos os modulos</option>
            {modules.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Nao foi possivel carregar os logs: {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <Card><CardContent className="p-6 text-muted-foreground">Carregando logs...</CardContent></Card>
        ) : filteredLogs.length === 0 ? (
          <Card><CardContent className="p-6 text-muted-foreground">Nenhum log encontrado para os filtros atuais.</CardContent></Card>
        ) : (
          filteredLogs.map((log) => (
            <Card key={log.id} className="border-border/70">
              <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={log.severity === "critico" ? "destructive" : "secondary"}>{severityLabels[log.severity]}</Badge>
                    <Badge variant="outline">{statusLabels[log.status]}</Badge>
                    <Badge variant="outline">{log.module}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <AlertTriangle className="h-4 w-4 text-amber-400" /> {log.error_type}
                    </h2>
                    <p className="text-sm text-muted-foreground">{log.description}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Motivo provavel</p>
                      <p className="text-sm">{log.probable_reason || "Nao informado"}</p>
                    </div>
                    <div className="rounded-md border border-border/60 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Acao recomendada</p>
                      <p className="text-sm">{log.recommended_action || "Investigar no modulo relacionado"}</p>
                    </div>
                  </div>
                  {log.user_id && <p className="text-xs text-muted-foreground">Usuario relacionado: {log.user_id}</p>}
                </div>
                <div className="flex items-start justify-end">
                  <Button variant="outline" size="sm" onClick={() => markResolved(log)} disabled={log.status === "resolvido"}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar resolvido
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
