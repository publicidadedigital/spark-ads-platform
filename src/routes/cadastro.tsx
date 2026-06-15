import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/supabase/auth";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

const commonSchema = {
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().min(10).max(20),
  password: z.string().min(8, "Minimo 8 caracteres").max(72),
};

const personSchema = z.object({
  ...commonSchema,
  nome: z.string().trim().min(2).max(120),
  cpf: z.string().trim().regex(/^\d{11}$/, "CPF deve ter 11 digitos"),
  instagram: z.string().trim().min(2).max(60).regex(/^[a-zA-Z0-9._]+$/, "Instagram invalido"),
});

const advertiserSchema = z.object({
  ...commonSchema,
  razaoSocial: z.string().trim().min(2).max(160),
  cnpj: z.string().trim().regex(/^\d{14}$/, "CNPJ deve ter 14 digitos"),
  responsavel: z.string().trim().min(2).max(120),
  pais: z.string().trim().min(2).max(80),
  cep: z.string().trim().min(4).max(12),
  estado: z.string().trim().min(2).max(80),
  cidade: z.string().trim().min(2).max(120),
});

export const Route = createFileRoute("/cadastro")({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : "",
    tipo: search.tipo === "anunciante" ? "anunciante" as const : "pessoa-fisica" as const,
  }),
  component: CadastroPage,
});

function CadastroPage() {
  const { supabase } = useAuth();
  const navigate = useNavigate();
  const { ref, tipo } = useSearch({ from: "/cadastro" });
  const isAdvertiser = tipo === "anunciante";
  const [form, setForm] = useState({
    nome: "", email: "", cpf: "", telefone: "", instagram: "", password: "",
    razaoSocial: "", cnpj: "", responsavel: "", pais: "Brasil", cep: "", estado: "", cidade: "",
  });
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function requestEmailConfirmation(userId: string, email: string, name: string) {
    const response = await fetch("/api/public/email-confirmation/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email, name }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "Nao foi possivel preparar a confirmacao de e-mail.");
    }
    return response.json() as Promise<{ resend_configured: boolean }>;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    const parsed = isAdvertiser
      ? advertiserSchema.safeParse({ ...form, cnpj: form.cnpj.replace(/\D/g, "") })
      : personSchema.safeParse({ ...form, cpf: form.cpf.replace(/\D/g, "") });

    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setLoading(true);
    const name = isAdvertiser ? form.responsavel.trim() : form.nome.trim();
    const metadata = isAdvertiser
      ? {
          tipo_conta: "anunciante",
          razao_social: form.razaoSocial.trim(),
          cnpj: form.cnpj.replace(/\D/g, ""),
          responsavel: name,
          telefone: form.telefone.trim(),
          pais: form.pais.trim(),
          cep: form.cep.trim(),
          estado: form.estado.trim(),
          cidade: form.cidade.trim(),
          indicador_id: ref || null,
        }
      : {
          tipo_conta: "pessoa_fisica",
          nome: name,
          cpf: form.cpf.replace(/\D/g, ""),
          telefone: form.telefone.trim(),
          instagram: form.instagram.replace(/^@/, ""),
          indicador_id: ref || null,
        };

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}${isAdvertiser ? "/anunciante" : "/app"}`,
        data: metadata,
      },
    });

    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    try {
      if (data.user?.id) {
        const confirmation = await requestEmailConfirmation(data.user.id, form.email.trim(), name);
        toast.success(confirmation.resend_configured
          ? "Cadastro criado! Enviamos um e-mail de confirmacao."
          : "Cadastro criado! A confirmacao por e-mail esta pronta para receber a chave do Resend.");
      } else {
        toast.success("Cadastro criado! Verifique seu e-mail.");
      }
    } catch (confirmationError: any) {
      toast.warning(confirmationError?.message || "Cadastro criado, mas o envio de confirmacao precisa ser revisado.");
    } finally {
      setLoading(false);
      navigate({ to: "/login" });
    }
  }

  const field = (label: string, key: keyof typeof form, props: React.ComponentProps<typeof Input> = {}) => (
    <div>
      <Label>{label}</Label>
      <Input value={form[key]} onChange={(event) => set(key, event.target.value)} required {...props} />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-noir-gradient px-4 py-10">
      <Card className={`w-full ${isAdvertiser ? "max-w-2xl" : "max-w-md"} p-6 sm:p-8 bg-card/80 border-border/50`}>
        <Link to="/" className="flex items-center justify-center mb-6">
          <Logo className="h-10 w-auto max-w-[170px]" textClassName="text-lg" />
        </Link>

        <h1 className="text-2xl font-bold text-center mb-2">
          {isAdvertiser ? "Criar conta de anunciante" : "Criar conta"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {isAdvertiser ? "Cadastre sua empresa para criar e acompanhar campanhas." : "Comece a compartilhar e ganhar."}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-6">
          <Link to="/cadastro" search={{ ref, tipo: "pessoa-fisica" }}>
            <Button type="button" variant={!isAdvertiser ? "default" : "outline"} className="w-full">Pessoa fisica</Button>
          </Link>
          <Link to="/cadastro" search={{ ref, tipo: "anunciante" }}>
            <Button type="button" variant={isAdvertiser ? "default" : "outline"} className="w-full">Anunciante PJ</Button>
          </Link>
        </div>

        {ref && <p className="text-xs text-gold text-center mb-4">Indicacao detectada</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          {isAdvertiser ? (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                {field("Razao social", "razaoSocial")}
                {field("CNPJ", "cnpj", { placeholder: "Apenas numeros", inputMode: "numeric" })}
              </div>
              {field("Responsavel", "responsavel")}
            </>
          ) : (
            <>
              {field("Nome completo", "nome")}
              {field("CPF", "cpf", { placeholder: "Apenas numeros", inputMode: "numeric" })}
              {field("Instagram (sem @)", "instagram")}
            </>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {field("E-mail", "email", { type: "email" })}
            {field("Telefone", "telefone", { placeholder: "(11) 99999-9999" })}
          </div>

          {isAdvertiser && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                {field("Pais", "pais")}
                {field("CEP / Codigo postal", "cep")}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {field("Estado / Regiao", "estado")}
                {field("Cidade", "cidade")}
              </div>
            </>
          )}

          {field("Senha", "password", { type: "password" })}
          <Button type="submit" className="w-full bg-gold-gradient text-primary-foreground" disabled={loading}>
            {loading ? "Criando..." : isAdvertiser ? "Criar conta PJ" : "Criar conta"}
          </Button>
        </form>

        <p className="text-sm text-center text-muted-foreground mt-6">
          Ja tem conta? <Link to="/login" className="text-gold hover:underline">Entrar</Link>
        </p>
      </Card>
    </div>
  );
}
