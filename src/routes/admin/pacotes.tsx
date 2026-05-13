import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/pacotes")({ component: AdminPacotes });

function AdminPacotes() {
  const { supabase } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ nome: "", valor: "", descricao: "" });

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from("packages").select("*").order("valor");
    setItems(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function create() {
    if (!supabase) return;
    const { error } = await supabase.from("packages").insert({ nome: form.nome, valor: Number(form.valor), descricao: form.descricao });
    if (error) return toast.error(error.message);
    setForm({ nome: "", valor: "", descricao: "" });
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pacotes</h1>
      <Card className="p-6 bg-card/50 border-border/50">
        <h3 className="font-semibold mb-3">Criar pacote</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} /></div>
          <div><Label>Valor (R$)</Label><Input type="number" value={form.valor} onChange={(e) => setForm({...form, valor: e.target.value})} /></div>
          <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} /></div>
        </div>
        <Button onClick={create} className="mt-3 bg-gold-gradient text-primary-foreground">Criar</Button>
      </Card>
      <div className="grid md:grid-cols-3 gap-3">
        {items.map((p) => (
          <Card key={p.id} className="p-5 bg-card/50 border-border/50">
            <div className="text-sm text-muted-foreground">{p.nome}</div>
            <div className="text-2xl font-bold gold-text-gradient mt-1">R$ {Number(p.valor).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-2">{p.descricao}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
