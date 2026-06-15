import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { confirmTwoFactor, disableTwoFactor, getTwoFactorStatus, setupTwoFactor } from "@/lib/security/totp.server";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";

export function TwoFactorSetup() {
  const { supabase } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");

  async function getToken() {
    if (!supabase) throw new Error("Sessao indisponivel");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sessao expirada");
    return token;
  }

  async function load() {
    if (!supabase) return;
    setLoading(true);
    try {
      const accessToken = await getToken();
      const status = await getTwoFactorStatus({ data: { accessToken } });
      setEnabled(status.enabled);
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao carregar status do 2FA");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function startSetup() {
    try {
      const accessToken = await getToken();
      const result = await setupTwoFactor({ data: { accessToken } });
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setSecret(result.secret);
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao gerar QR Code");
    }
  }

  async function confirm() {
    try {
      const accessToken = await getToken();
      await confirmTwoFactor({ data: { accessToken, code } });
      toast.success("Autenticação em dois fatores ativada");
      setQrCodeDataUrl(null);
      setSecret(null);
      setCode("");
      load();
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao confirmar código");
    }
  }

  async function disable() {
    try {
      const accessToken = await getToken();
      await disableTwoFactor({ data: { accessToken, code: disableCode } });
      toast.success("Autenticação em dois fatores desativada");
      setDisableCode("");
      load();
    } catch (error: any) {
      toast.error(error.message ?? "Erro ao desativar 2FA");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldOff className="h-4 w-4 text-amber-400" />}
          Autenticação em dois fatores (Google Authenticator)
        </CardTitle>
        <CardDescription>
          Necessária para confirmar solicitações de saque. Use um app como Google Authenticator, Authy ou Microsoft Authenticator.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : enabled ? (
          <div className="space-y-3">
            <Badge className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/15">Ativado</Badge>
            <p className="text-sm text-muted-foreground">Para desativar, informe um código atual do seu aplicativo autenticador.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="Código de 6 dígitos" className="max-w-[180px]" maxLength={6} />
              <Button variant="destructive" onClick={disable}>Desativar 2FA</Button>
            </div>
          </div>
        ) : qrCodeDataUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Escaneie o QR Code com seu aplicativo autenticador e digite o código gerado para confirmar.</p>
            <img src={qrCodeDataUrl} alt="QR Code 2FA" className="h-48 w-48 rounded-lg border border-border/60 bg-white p-2" />
            {secret && <p className="text-xs text-muted-foreground break-all">Chave manual: {secret}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Código de 6 dígitos" className="max-w-[180px]" maxLength={6} />
              <Button onClick={confirm} className="bg-gold-gradient text-primary-foreground">Confirmar e ativar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Badge variant="outline">Não configurado</Badge>
            <Button onClick={startSetup} className="bg-gold-gradient text-primary-foreground">Configurar 2FA</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TwoFactorReminderBanner({ to }: { to: string }) {
  return (
    <div className="rounded-lg border border-amber-400/35 bg-amber-500/10 p-4 text-sm text-amber-200">
      Configure a autenticação em dois fatores (Google Authenticator) em{" "}
      <a href={to} className="underline font-medium">Segurança</a> para poder confirmar saques.
    </div>
  );
}
