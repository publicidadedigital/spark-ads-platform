import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/campanhas")({ component: AdminCampaigns });

function AdminCampaigns() {
  const { supabase } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ titulo: "", tipo_midia: "imagem", media_url: "", texto_sugerido: "", link_campanha: "", rede_permitida: "instagram", instrucoes_obrigatorias: "" });
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  async function create() {
    if (!supabase) return;
    let media_url = form.media_url;
    if (file) {
      const path = `${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("campaign-media").upload(path, file);
      if (upErr) return toast.error(upErr.message);
      const { data: pub } = supabase.storage.from("campaign-media").getPublicUrl(path);
      media_url = pub.publicUrl;
    }
    if (!media_url) return toast.error("Envie um arquivo ou cole uma URL de mídia");
    const { error } = await supabase.from("campaigns").insert({ ...form, media_url });
    if (error) return toast.error(error.message);
    toast.success("Campanha criada");
    setForm({ titulo: "", tipo_midia: "imagem", media_url: "", texto_sugerido: "", link_campanha: "", rede_permitida: "instagram", instrucoes_obrigatorias: "" });
    setFile(null);
    load();
  }

  async function toggle(id: string, status: string) {
    if (!supabase) return;
    await supabase.from("campaigns").update({ status: status === "ativa" ? "inativa" : "ativa" }).eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Campanhas</h1>
      <Card className="p-6 bg-card/50 border-border/50">
        <h3 className="font-semibold mb-4">Criar nova campanha</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({...form, titulo: e.target.value})} /></div>
          <div><Label>Link da campanha</Label><Input value={form.link_campanha} onChange={(e) => setForm({...form, link_campanha: e.target.value})} /></div>
          <div><Label>Tipo de mídia</Label>
            <Select value={form.tipo_midia} onValueChange={(v) => setForm({...form, tipo_midia: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="imagem">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Rede permitida</Label><Input value={form.rede_permitida} onChange={(e) => setForm({...form, rede_permitida: e.target.value})} /></div>
          <div className="md:col-span-2"><Label>Upload de mídia (ou URL abaixo)</Label><Input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <div className="md:col-span-2"><Label>URL de mídia (alternativa)</Label><Input value={form.media_url} onChange={(e) => setForm({...form, media_url: e.target.value})} /></div>
          <div className="md:col-span-2"><Label>Texto sugerido</Label><Textarea rows={3} value={form.texto_sugerido} onChange={(e) => setForm({...form, texto_sugerido: e.target.value})} /></div>
          <div className="md:col-span-2"><Label>Instruções obrigatórias</Label><Textarea rows={2} value={form.instrucoes_obrigatorias} onChange={(e) => setForm({...form, instrucoes_obrigatorias: e.target.value})} /></div>
        </div>
        <Button onClick={create} className="mt-4 bg-gold-gradient text-primary-foreground">Criar campanha</Button>
      </Card>

      <div className="space-y-2">
        {items.map((c) => (
          <Card key={c.id} className="p-4 bg-card/50 border-border/50 flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2"><span className="font-medium">{c.titulo}</span><Badge variant="outline">{c.status}</Badge></div>
              <div className="text-xs text-muted-foreground mt-1">{c.link_campanha}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => toggle(c.id, c.status)}>
              {c.status === "ativa" ? "Inativar" : "Ativar"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
