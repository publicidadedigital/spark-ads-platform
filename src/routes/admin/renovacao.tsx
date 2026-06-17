import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/renovacao")({ component: AdminRenovacao });

type Settings = {
  id: string;
  cycle_duration_days: number;
  cycle_goal_percent: number;
};

type BonusLevel = {
  id: string;
  level: number;
  rate: number;
};

function AdminRenovacao() {
  const { supabase } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsForm, setSettingsForm] = useState({ cycle_duration_days: "", cycle_goal_percent: "" });
  const [levels, setLevels] = useState<BonusLevel[]>([]);
  const [newLevel, setNewLevel] = useState({ level: "", rate: "" });

  async function load() {
    if (!supabase) return;
    const [{ data: s }, { data: lv }] = await Promise.all([
      supabase.from("renewal_settings").select("*").maybeSingle(),
      supabase.from("renewal_bonus_levels").select("*").order("level"),
    ]);
    setSettings(s ?? null);
    if (s) {
      setSettingsForm({
        cycle_duration_days: String(s.cycle_duration_days ?? ""),
        cycle_goal_percent: String(s.cycle_goal_percent ?? ""),
      });
    }
    setLevels(lv ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function saveSettings() {
    if (!supabase || !settings) return;
    const { error } = await supabase.from("renewal_settings").update({
      cycle_duration_days: Number(settingsForm.cycle_duration_days),
      cycle_goal_percent: Number(settingsForm.cycle_goal_percent),
      updated_at: new Date().toISOString(),
    }).eq("id", settings.id);
    if (error) return toast.error(error.message);
    toast.success("Configurações de renovação atualizadas");
    load();
  }

  async function addLevel() {
    if (!supabase) return;
    const level = Number(newLevel.level);
    const rate = Number(newLevel.rate);
    if (!level || !Number.isFinite(rate)) return toast.error("Informe nível e percentual válidos");

    const { error } = await supabase.from("renewal_bonus_levels").insert({ level, rate });
    if (error) return toast.error(error.message);
    setNewLevel({ level: "", rate: "" });
    toast.success("Nível adicionado");
    load();
  }

  async function updateLevelRate(id: string, rate: string) {
    if (!supabase) return;
    const value = Number(rate);
    if (!Number.isFinite(value)) return;
    setLevels((prev) => prev.map((l) => (l.id === id ? { ...l, rate: value } : l)));

    const { error } = await supabase.from("renewal_bonus_levels").update({ rate: value }).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function removeLevel(id: string) {
    if (!supabase) return;
    if (!window.confirm("Remover este nível de bônus de renovação?")) return;
    const { error } = await supabase.from("renewal_bonus_levels").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Nível removido");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Admin</p>
        <h1 className="text-2xl font-bold">Renovação</h1>
        <p className="text-sm text-muted-foreground">
          Configurações exibidas na página de renovação do associado (duração do ciclo, meta e bônus de renovação por indicação).
        </p>
      </div>

      <Card className="p-6 bg-card/50 border-border/50">
        <h3 className="font-semibold mb-3">Ciclo de renovação</h3>
        <div className="grid gap-3 md:grid-cols-2 max-w-md">
          <div>
            <Label>Duração do ciclo (dias)</Label>
            <Input
              type="number"
              value={settingsForm.cycle_duration_days}
              onChange={(e) => setSettingsForm({ ...settingsForm, cycle_duration_days: e.target.value })}
            />
          </div>
          <div>
            <Label>Meta do ciclo (%)</Label>
            <Input
              type="number"
              value={settingsForm.cycle_goal_percent}
              onChange={(e) => setSettingsForm({ ...settingsForm, cycle_goal_percent: e.target.value })}
            />
          </div>
        </div>
        <Button onClick={saveSettings} className="mt-4 bg-gold-gradient text-primary-foreground">Salvar</Button>
      </Card>

      <Card className="p-6 bg-card/50 border-border/50">
        <h3 className="font-semibold mb-1">Bônus de renovação por indicação</h3>
        <p className="text-sm text-muted-foreground mb-3">Percentual pago a cada nível da rede quando um indicado renova o pacote.</p>

        <div className="space-y-2">
          {levels.map((lvl) => (
            <div key={lvl.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
              <span className="text-sm font-medium w-24">Nível {lvl.level}</span>
              <Input
                type="number"
                step="0.01"
                value={lvl.rate}
                onChange={(e) => updateLevelRate(lvl.id, e.target.value)}
                className="max-w-[140px]"
              />
              <span className="text-sm text-muted-foreground">({(Number(lvl.rate) * 100).toFixed(2)}%)</span>
              <Button size="sm" variant="destructive" className="ml-auto" onClick={() => removeLevel(lvl.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {levels.length === 0 && <p className="text-sm text-muted-foreground">Nenhum nível cadastrado.</p>}
        </div>

        <div className="mt-4 flex items-end gap-3 rounded-lg border border-border/60 p-3">
          <div>
            <Label>Nível</Label>
            <Input type="number" value={newLevel.level} onChange={(e) => setNewLevel({ ...newLevel, level: e.target.value })} className="max-w-[100px]" />
          </div>
          <div>
            <Label>Taxa (ex: 0.03 = 3%)</Label>
            <Input type="number" step="0.01" value={newLevel.rate} onChange={(e) => setNewLevel({ ...newLevel, rate: e.target.value })} className="max-w-[140px]" />
          </div>
          <Button onClick={addLevel} className="bg-gold-gradient text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" /> Adicionar nível
          </Button>
        </div>
      </Card>
    </div>
  );
}
