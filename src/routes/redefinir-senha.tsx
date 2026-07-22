import { Logo } from "@/components/Logo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/redefinir-senha")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { supabase } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the token from the URL hash and fires onAuthStateChange with SIGNED_IN
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Não foi possível redefinir a senha.");
      return;
    }
    toast.success("Senha redefinida com sucesso! Faça login com a nova senha.");
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-noir-gradient px-4">
      <Card className="w-full max-w-md p-8 bg-card/80 border-border/50">
        <Link to="/" className="flex items-center justify-center mb-6">
          <Logo className="h-10 w-auto max-w-[170px]" textClassName="text-lg" />
        </Link>

        <h1 className="text-2xl font-bold text-center mb-2">Nova senha</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Crie uma nova senha para sua conta</p>

        {!ready ? (
          <p className="text-sm text-center text-muted-foreground">Verificando link de redefinição...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <Input
                id="confirm"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            <Button type="submit" className="w-full bg-gold-gradient text-primary-foreground" disabled={loading}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}

        <p className="text-sm text-center text-muted-foreground mt-6">
          Lembrou a senha? <Link to="/login" className="text-gold hover:underline">Voltar ao login</Link>
        </p>
      </Card>
    </div>
  );
}
