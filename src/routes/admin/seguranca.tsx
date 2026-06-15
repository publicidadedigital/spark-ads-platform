import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/lib/supabase/auth";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCcw, ShieldAlert, KeyRound, Flag } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin/seguranca")({ component: AdminSeguranca });

type FraudLog = {
  id: string;
  created_at: string;
  user_id: string | null;
  tipo_evento: string;
  descricao: string | null;
  ip: string | null;
  risk_score_gerado: number | null;
};

type AccessLog = {
  id: string;
  created_at: string;
  email: string | null;
  event_type: string;
  success: boolean;
  reason: string | null;
  ip_address: string | null;
};

type ShareLog = {
  id: string;
  created_at: string;
  user_id: string | null;
  status: string;
  reason: string | null;
};

function AdminSeguranca() {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [fraudLogs, setFraudLogs] = useState<FraudLog[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [shareLogs, setShareLogs] = useState<ShareLog[]>([]);

  async function load() {
    if (!supabase) return;
    setLoading(true);

    const [fraud, access, shares] = await Promise.all([
      supabase.from("fraud_logs").select("id,created_at,user_id,tipo_evento,descricao,ip,risk_score_gerado").order("created_at", { ascending: false }).limit(50),
      supabase.from("admin_access_logs").select("id,created_at,email,event_type,success,reason,ip_address").order("created_at", { ascending: false }).limit(50),
      supabase.from("share_validation_logs").select("id,created_at,user_id,status,reason").eq("status", "rejeitado").order("created_at", { ascending: false }).limit(50),
    ]);

    setFraudLogs((fraud.data ?? []) as FraudLog[]);
    setAccessLogs((access.data ?? []) as AccessLog[]);
    setShareLogs((shares.data ?? []) as ShareLog[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  const failedLogins = accessLogs.filter((log) => !log.success);
  const highRiskFraud = fraudLogs.filter((log) => (log.risk_score_gerado ?? 0) >= 70);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Monitoramento</p>
          <h1 className="text-3xl font-bold">Segurança</h1>
          <p className="text-sm text-muted-foreground">Acessos administrativos, fraudes detectadas e compartilhamentos rejeitados.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}><RefreshCcw className="mr-2 h-4 w-4" />Atualizar</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Logins admin com falha</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-red-400">{failedLogins.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Eventos de fraude alto risco</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold text-amber-400">{highRiskFraud.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Compartilhamentos rejeitados</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{shareLogs.length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Acessos administrativos</CardTitle>
          <CardDescription>Tentativas de login no painel admin (sucesso e falha).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : accessLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum acesso registrado.</p>
          ) : accessLogs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 p-3 text-sm">
              <Badge variant={log.success ? "secondary" : "destructive"}>{log.success ? "Sucesso" : "Falha"}</Badge>
              <span className="font-medium">{log.email ?? "—"}</span>
              <span className="text-muted-foreground">{log.event_type}</span>
              {log.reason && <span className="text-muted-foreground">· {log.reason}</span>}
              {log.ip_address && <span className="text-muted-foreground">· IP {log.ip_address}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Logs de fraude</CardTitle>
          <CardDescription>Eventos suspeitos detectados automaticamente (dispositivo, IP, score de risco).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : fraudLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento de fraude registrado.</p>
          ) : fraudLogs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 p-3 text-sm">
              <Badge variant={(log.risk_score_gerado ?? 0) >= 70 ? "destructive" : "outline"}>Risco {log.risk_score_gerado ?? 0}</Badge>
              <span className="font-medium">{log.tipo_evento}</span>
              {log.descricao && <span className="text-muted-foreground">· {log.descricao}</span>}
              {log.ip && <span className="text-muted-foreground">· IP {log.ip}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Flag className="h-4 w-4" /> Compartilhamentos rejeitados</CardTitle>
          <CardDescription>Provas de compartilhamento que falharam na validação automática.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : shareLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum compartilhamento rejeitado.</p>
          ) : shareLogs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border/50 p-3 text-sm">
              <Badge variant="outline">{log.status}</Badge>
              {log.reason && <span className="text-muted-foreground">{log.reason}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
