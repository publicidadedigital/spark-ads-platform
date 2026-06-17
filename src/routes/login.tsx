import { Logo } from "@/components/Logo";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/supabase/auth-errors";
import { checkEmailExists } from "@/lib/auth/email-check.functions";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/login")({
  validateSearch: (s) => ({
    email_confirmed: (s.email_confirmed as string) || "",
    reason: (s.reason as string) || "",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { supabase } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (search.email_confirmed === "1") {
      toast.success("E-mail confirmado com sucesso. Voce ja pode entrar.");
    }
    if (search.email_confirmed === "0") {
      const messageByReason: Record<string, string> = {
        missing_token: "Link de confirmacao incompleto.",
        invalid_token: "Link de confirmacao invalido.",
        expired_token: "Link de confirmacao expirado. Solicite um novo envio.",
        server_error: "Nao foi possivel confirmar o e-mail agora.",
      };
      toast.error(messageByReason[search.reason] || "Nao foi possivel confirmar o e-mail.");
      setShowResend(true);
    }
  }, [search.email_confirmed, search.reason]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (/invalid login credentials/i.test(error.message)) {
        try {
          const { exists } = await checkEmailExists({ data: { email } });
          if (!exists) {
            setLoading(false);
            toast.error("Conta não existe, favor realizar o cadastro.");
            return;
          }
        } catch {
          // segue com a mensagem genérica abaixo se a verificação falhar
        }
      }
      setLoading(false);
      toast.error(translateAuthError(error.message));
      if (error.message.toLowerCase().includes("confirm") || error.message.toLowerCase().includes("verif")) {
        setResendEmail(email);
        setShowResend(true);
      }
      return;
    }

    const authUserId = data.user?.id;
    const { data: profile } = await supabase
      .from("users_profile")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (profile) {
      toast.success("Bem-vindo de volta!");
      setLoading(false);
      return navigate({ to: "/app" });
    }

    const { data: advertiser } = await supabase
      .from("advertiser_profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    setLoading(false);

    if (advertiser) {
      await supabase.auth.signOut();
      toast.error("Esta conta e de anunciante. Acesse o login de anunciantes.");
      return;
    }

    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app" });
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!resendEmail || !supabase) return;
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: resendEmail,
      });
      if (error) throw error;
      toast.success("E-mail de confirmação reenviado! Verifique sua caixa de entrada.");
      setShowResend(false);
    } catch (err: any) {
      toast.error(err.message || "Não foi possível reenviar o e-mail.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-noir-gradient px-4">
      <Card className="w-full max-w-md p-8 bg-card/80 border-border/50">
        <Link to="/" className="flex items-center justify-center mb-6">
          <Logo className="h-10 w-auto max-w-[170px]" textClassName="text-lg" />
        </Link>

        <h1 className="text-2xl font-bold text-center mb-2">Entrar</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Acesse sua conta</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full bg-gold-gradient text-primary-foreground" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        {showResend && (
          <div className="mt-5 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 space-y-3">
            <p className="text-sm text-amber-200 font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" /> Não recebeu o e-mail de confirmação?
            </p>
            <form onSubmit={handleResend} className="flex gap-2">
              <Input
                type="email"
                placeholder="Seu e-mail de cadastro"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                required
                className="flex-1 h-8 text-sm"
              />
              <Button type="submit" size="sm" variant="outline" disabled={resendLoading} className="border-amber-400/40 text-amber-200 hover:bg-amber-500/20">
                {resendLoading ? "Enviando..." : "Reenviar"}
              </Button>
            </form>
          </div>
        )}

        <p className="text-sm text-center text-muted-foreground mt-6">
          Nao tem conta? <Link to="/cadastro" className="text-gold hover:underline">Cadastre-se</Link>
        </p>
        <p className="text-sm text-center text-muted-foreground mt-2">
          Nao recebeu o e-mail?{" "}
          <button type="button" className="text-gold hover:underline" onClick={() => { setShowResend((v) => !v); setResendEmail(email); }}>
            Reenviar confirmação
          </button>
        </p>
        <p className="text-sm text-center text-muted-foreground mt-2">
          E anunciante? <Link to="/anunciante-login" className="text-gold hover:underline">Entrar como anunciante</Link>
        </p>
      </Card>
    </div>
  );
}
