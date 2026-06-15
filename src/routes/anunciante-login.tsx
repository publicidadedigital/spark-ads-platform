import { Logo } from "@/components/Logo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/anunciante-login")({ component: AnuncianteLoginPage });

function AnuncianteLoginPage() {
  const { supabase } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    const authUserId = data.user?.id;
    const { data: advertiser } = await supabase
      .from("advertiser_profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (advertiser) {
      setLoading(false);
      toast.success("Bem-vindo de volta!");
      return navigate({ to: "/anunciante-painel" });
    }

    await supabase.auth.signOut();
    setLoading(false);
    toast.error("Esta conta nao e de anunciante. Acesse o login de clientes.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-noir-gradient px-4">
      <Card className="w-full max-w-md p-8 bg-card/80 border-border/50">
        <Link to="/" className="flex items-center justify-center mb-6">
          <Logo className="h-10 w-auto max-w-[170px]" textClassName="text-lg" />
        </Link>

        <h1 className="text-2xl font-bold text-center mb-2">Entrar como Anunciante</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Acesse o painel da sua empresa</p>
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
        <p className="text-sm text-center text-muted-foreground mt-6">
          Nao tem conta? <Link to="/cadastro" search={{ tipo: "anunciante", ref: "" }} className="text-gold hover:underline">Crie sua conta PJ</Link>
        </p>
        <p className="text-sm text-center text-muted-foreground mt-2">
          E cliente da Viral Hub? <Link to="/login" className="text-gold hover:underline">Entrar como cliente</Link>
        </p>
      </Card>
    </div>
  );
}
