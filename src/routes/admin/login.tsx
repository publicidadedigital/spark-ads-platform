import { Logo } from "@/components/Logo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { checkAdmin, useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({ component: AdminLoginPage });

function AdminLoginPage() {
  const { supabase, session, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session && isAdmin) navigate({ to: "/admin" });
  }, [loading, session, isAdmin, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }

      const uid = data.user?.id;
      const admin = uid ? await checkAdmin(supabase, uid) : false;
      if (!admin) {
        await supabase.auth.signOut();
        toast.error("Acesso restrito a administradores.");
        return;
      }

      toast.success("Bem-vindo ao painel administrativo");
      navigate({ to: "/admin" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-noir-gradient px-4">
      <Card className="w-full max-w-md p-8 bg-card/80 border-border/50">
        <div className="flex flex-col items-center justify-center mb-6 gap-2">
          <Logo className="h-10 w-auto max-w-[170px]" textClassName="text-lg" />
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.35em] text-primary">
            <ShieldCheck className="h-4 w-4" /> Painel Administrativo
          </span>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Esta área é exclusiva para administradores da plataforma.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail administrativo</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full bg-gold-gradient text-primary-foreground" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar no painel"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
