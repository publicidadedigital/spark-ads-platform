import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildPackageAccounting } from "@/lib/business/rules";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/pacotes")({ component: AdminPacotes });

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function AdminPacotes() {
  const { supabase } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ nome: "", packageValue: "", descricao: "" });

  const preview = useMemo(() => buildPackageAccounting(Number(form.packageValue || 0)), [form.packageValue]);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from("packages").select("*").eq("status", "ativo").order("valor");
    setItems(data ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function create() {
    if (!supabase) return;
    const accounting = buildPackageAccounting(Number(form.packageValue));

    const fullPayload = {
      nome: form.nome,
      valor: accounting.total_paid,
      descricao: form.descricao,
      package_value: accounting.package_value,
      course_fee: accounting.course_fee,
      total_paid: accounting.total_paid,
      bonusable_amount: accounting.bonusable_amount,
      cycle_limit_200: accounting.cycle_limit_200,
      amount_counted_for_rewards: accounting.amount_counted_for_rewards,
      daily_bonus: accounting.daily_bonus,
      status: "ativo",
    };

    let result = await supabase.from("packages").insert(fullPayload);

    if (result.error && /column|schema|cache/i.test(result.error.message)) {
      result = await supabase.from("packages").insert({
        nome: form.nome,
        valor: accounting.total_paid,
        descricao: `${form.descricao || ""}\nValor bonificavel: ${usd.format(accounting.bonusable_amount)}. Curso: ${usd.format(accounting.course_fee)}.`,
        status: "ativo",
      });
    }

    if (result.error) return toast.error(result.error.message);
    setForm({ nome: "", packageValue: "", descricao: "" });
    load();
  }

  async function remove(id: string) {
    if (!supabase) return;
    if (!window.confirm("Excluir este pacote? Essa acao nao pode ser desfeita.")) return;

    const { error } = await supabase.from("packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pacote excluido");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Admin</p>
        <h1 className="text-2xl font-bold">Pacotes</h1>
        <p className="text-sm text-muted-foreground">O usuario paga pacote + US$10 do curso. Apenas o valor do pacote bonifica, pontua e entra no ciclo de 200%.</p>
      </div>

      <Card className="p-6 bg-card/50 border-border/50">
        <h3 className="font-semibold mb-3">Criar pacote</h3>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_1.5fr]">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} placeholder="Start, Plus, Pro..." /></div>
          <div><Label>Valor bonificavel (US$)</Label><Input type="number" value={form.packageValue} onChange={(e) => setForm({...form, packageValue: e.target.value})} placeholder="50" /></div>
          <div><Label>Descricao</Label><Textarea value={form.descricao} onChange={(e) => setForm({...form, descricao: e.target.value})} /></div>
        </div>
        <div className="mt-4 grid gap-3 rounded-lg border border-border/60 p-4 text-sm md:grid-cols-5">
          <div><span className="text-muted-foreground">Pacote</span><strong className="block">{usd.format(preview.bonusable_amount)}</strong></div>
          <div><span className="text-muted-foreground">Curso</span><strong className="block">{usd.format(preview.course_fee)}</strong></div>
          <div><span className="text-muted-foreground">Total pago</span><strong className="block">{usd.format(preview.total_paid)}</strong></div>
          <div><span className="text-muted-foreground">Teto 200%</span><strong className="block">{usd.format(preview.cycle_limit_200)}</strong></div>
          <div><span className="text-muted-foreground">Bonus diario</span><strong className="block">{usd.format(preview.daily_bonus)}</strong></div>
        </div>
        <Button onClick={create} className="mt-3 bg-gold-gradient text-primary-foreground">Criar</Button>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {items.map((p) => {
          const accounting = buildPackageAccounting(Number(p.package_value ?? p.valor));
          return (
            <Card key={p.id} className="p-5 bg-card/50 border-border/50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">{p.nome}</div>
                <span className={`text-xs rounded px-2 py-0.5 ${p.status === "ativo" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>{p.status}</span>
              </div>
              <div className="text-2xl font-bold gold-text-gradient mt-1">{usd.format(Number(p.total_paid ?? accounting.total_paid))}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Bonificavel</span><strong className="text-foreground">{usd.format(Number(p.bonusable_amount ?? accounting.bonusable_amount))}</strong>
                <span>Curso</span><strong className="text-foreground">{usd.format(Number(p.course_fee ?? accounting.course_fee))}</strong>
                <span>Teto 200%</span><strong className="text-foreground">{usd.format(Number(p.cycle_limit_200 ?? accounting.cycle_limit_200))}</strong>
                <span>Bonus diario</span><strong className="text-foreground">{usd.format(Number(p.daily_bonus ?? accounting.daily_bonus))}</strong>
              </div>
              <p className="text-xs text-muted-foreground mt-3 whitespace-pre-line">{p.descricao}</p>
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="destructive" onClick={() => remove(p.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
