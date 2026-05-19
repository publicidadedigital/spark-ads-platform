import { Logo } from "@/components/Logo";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  cpf: z.string().trim().regex(/^\d{11}$/, "CPF deve ter 11 dígitos (apenas números)"),
  telefone: z.string().trim().min(10).max(15),
  instagram: z.string().trim().min(2).max(60).regex(/^[a-zA-Z0-9._]+$/, "Instagram inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

export const Route = createFileRoute("/cadastro")({
  validateSearch: (s) => ({ ref: (s.ref as string) || "" }),
  component: CadastroPage,
});

function CadastroPage() {
  const { supabase } = useAuth();
  const navigate = useNavigate();
  const { ref } = useSearch({ from: "/cadastro" });
  const [form, setForm] = useState({
    nome: "", email: "", cpf: "", telefone: "", instagram: "", password: "",
  });
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const parsed = schema.safeParse({ ...form, cpf: form.cpf.replace(/\D/g, "") });
    if (!parsed.success) {
      return toast.error(parsed.error.issues[0].message);
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          nome: parsed.data.nome,
          cpf: parsed.data.cpf,
          telefone: parsed.data.telefone,
          instagram: parsed.data.instagram.replace(/^@/, ""),
          indicador_id: ref || null,
        },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cadastro criado! Verifique seu e-mail e aguarde aprovação.");
    navigate({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-noir-gradient px-4 py-10">
      <Card className="w-full max-w-md p-8 bg-card/80 border-border/50">
        <Link to="/" className="flex items-center justify-center mb-6">
          <Logo className="h-9 w-9" textClassName="text-lg" />
        </Link>

        <h1 className="text-2xl font-bold text-center mb-2">Criar conta</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">Comece a compartilhar e ganhar.</p>
        {ref && <p className="text-xs text-gold text-center mb-4">Indicação detectada</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><Label>Nome completo</Label><Input value={form.nome} onChange={(e) => set("nome", e.target.value)} required /></div>
          <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required /></div>
          <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="Apenas números" maxLength={14} required /></div>
          <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" required /></div>
          <div><Label>Instagram (sem @)</Label><Input value={form.instagram} onChange={(e) => set("instagram", e.target.value)} required /></div>
          <div><Label>Senha</Label><Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} required /></div>
          <Button type="submit" className="w-full bg-gold-gradient text-primary-foreground" disabled={loading}>
            {loading ? "Criando..." : "Criar conta"}
          </Button>
        </form>
        <p className="text-sm text-center text-muted-foreground mt-6">
          Já tem conta? <Link to="/login" className="text-gold hover:underline">Entrar</Link>
        </p>
      </Card>
    </div>
  );
}
