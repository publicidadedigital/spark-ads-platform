import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ImagePlus, Video, Loader2, CheckCircle2, Send, Heart, MessageCircle, Share2, ChevronDown, ChevronUp, ExternalLink, Users } from "lucide-react";

export const Route = createFileRoute("/admin/campanhas")({ component: AdminCampaigns });

const VIDEO_EXTS = ["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp"];

function isVideo(f: File) {
  if (f.type.startsWith("video/")) return true;
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTS.includes(ext);
}

const emptyForm = {
  titulo: "",
  tipo_midia: "imagem",
  media_url: "",
  texto_sugerido: "",
  link_campanha: "",
  rede_permitida: "instagram",
  instrucoes_obrigatorias: "",
};

function AdminCampaigns() {
  const { supabase } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [shares, setShares] = useState<Record<string, any[]>>({});
  const [loadingShares, setLoadingShares] = useState<string | null>(null);

  async function load() {
    if (!supabase) return;
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [supabase]);

  function handleFile(f: File | null) {
    setFile(f);
    if (!f) { setPreview(null); return; }
    setForm((current: any) => ({ ...current, tipo_midia: isVideo(f) ? "video" : "imagem" }));
    if (isVideo(f)) {
      setPreview(URL.createObjectURL(f));
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0] ?? null);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    if (f && (f.type.startsWith("image/") || isVideo(f))) {
      handleFile(f);
    }
  }

  async function create() {
    if (!supabase) return;
    if (!form.titulo.trim()) return toast.error("Informe o titulo da campanha");
    if (!form.texto_sugerido.trim()) return toast.error("Informe o texto sugerido");
    if (!form.link_campanha.trim()) return toast.error("Informe o link da campanha");

    setSubmitting(true);
    try {
      let media_url = form.media_url;
      if (file) {
        const path = `${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("campaign-media").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("campaign-media").getPublicUrl(path);
        media_url = pub.publicUrl;
      }
      if (!media_url) { toast.error("Envie um arquivo ou cole uma URL de mídia"); return; }

      const { error } = await supabase.from("campaigns").insert({ ...form, media_url });
      if (error) throw error;

      toast.success("Campanha criada");
      setForm(emptyForm);
      handleFile(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar campanha");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(id: string, status: string) {
    if (!supabase) return;
    await supabase.from("campaigns").update({ status: status === "ativa" ? "inativa" : "ativa" }).eq("id", id);
    load();
  }

  async function toggleTracking(campaignId: string) {
    if (expandedId === campaignId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(campaignId);
    if (shares[campaignId] || !supabase) return;
    setLoadingShares(campaignId);
    const { data, error } = await supabase
      .from("campaign_shares")
      .select("*, profile:user_id(nome, instagram, seguidores_instagram)")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    setLoadingShares(null);
    if (error) { toast.error(error.message); return; }
    setShares((current) => ({ ...current, [campaignId]: data ?? [] }));
  }

  function statusBadgeClass(status: string) {
    if (status === "aprovada") return "border-success/30 bg-success/15 text-success";
    if (status === "rejeitada" || status === "removida") return "border-destructive/30 bg-destructive/15 text-destructive";
    return "border-amber-400/30 bg-amber-500/15 text-amber-300";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Campanhas</h1>

      <div>
        <h2 className="text-lg font-semibold mb-3">Criar nova campanha</h2>
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left: form */}
          <Card className="p-6 bg-card/50 border-border/50 space-y-5">

            {/* Media upload */}
            <div>
              <Label className="mb-2 block">Imagem ou vídeo da campanha</Label>
              <div className="flex gap-2 mb-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click(); } }}>
                  <ImagePlus className="h-4 w-4" /> Escolher imagem
                </Button>
                <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "video/*"; fileInputRef.current.click(); } }}>
                  <Video className="h-4 w-4" /> Escolher vídeo
                </Button>
              </div>
              <div
                onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = "image/*,video/*"; fileInputRef.current.click(); } }}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`flex min-h-[180px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition ${
                  dragging ? "border-primary bg-primary/10" : "border-border/60 bg-background/40 hover:border-primary/50"
                } overflow-hidden`}
              >
                {preview ? (
                  file && isVideo(file) ? (
                    <video key={preview} src={preview} autoPlay loop playsInline muted className="h-full w-full object-cover max-h-64" />
                  ) : (
                    <img src={preview} alt="preview" className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                    <div className="flex gap-3">
                      <ImagePlus className="h-8 w-8 opacity-60" />
                      <Video className="h-8 w-8 opacity-60" />
                    </div>
                    <p className="text-sm font-medium">Clique para enviar ou arraste o arquivo aqui</p>
                    <p className="text-xs opacity-70">Imagem (PNG, JPG, WEBP) ou vídeo (MP4, MOV) até 50MB</p>
                  </div>
                )}
              </div>
              {file && (
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <button type="button" className="text-destructive hover:underline ml-2 shrink-0" onClick={() => handleFile(null)}>Remover</button>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFileInput} />
              <div className="mt-3">
                <Label className="mb-1 block text-xs text-muted-foreground">URL de mídia (alternativa ao upload)</Label>
                <Input value={form.media_url} onChange={(e) => setForm({ ...form, media_url: e.target.value })} placeholder="https://" />
              </div>
            </div>

            {/* Title */}
            <div>
              <Label className="mb-1 block">Título da campanha *</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Lançamento da coleção verão" />
            </div>

            {/* Link + rede permitida */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Link da campanha *</Label>
                <Input value={form.link_campanha} onChange={(e) => setForm({ ...form, link_campanha: e.target.value })} placeholder="https://" />
              </div>
              <div>
                <Label className="mb-1 block">Rede permitida</Label>
                <Input value={form.rede_permitida} onChange={(e) => setForm({ ...form, rede_permitida: e.target.value })} placeholder="instagram" />
              </div>
            </div>

            <div>
              <Label className="mb-1 block">Tipo de mídia</Label>
              <Select value={form.tipo_midia} onValueChange={(v) => setForm({ ...form, tipo_midia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="imagem">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem></SelectContent>
              </Select>
            </div>

            {/* Caption textarea */}
            <div>
              <Label className="mb-1 block">Texto sugerido para compartilhamento *</Label>
              <div className="relative">
                <Textarea
                  value={form.texto_sugerido}
                  onChange={(e) => setForm({ ...form, texto_sugerido: e.target.value.slice(0, 2200) })}
                  placeholder="Texto que os associados irão usar ao compartilhar, instruções obrigatórias e hashtags."
                  rows={5}
                  className="resize-none"
                />
                <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">{form.texto_sugerido.length}/2200</span>
              </div>

              {/* Tips box */}
              <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold mb-2">Dicas para um bom texto</p>
                <ul className="space-y-1.5">
                  {[
                    "Seja claro e objetivo",
                    "Inclua os principais benefícios",
                    "Use chamadas para ação",
                    "Evite letras maiúsculas em excesso",
                  ].map((tip) => (
                    <li key={tip} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Instrucoes obrigatorias */}
            <div>
              <Label className="mb-1 block">Instruções obrigatórias (opcional)</Label>
              <div className="relative">
                <Textarea
                  value={form.instrucoes_obrigatorias}
                  onChange={(e) => setForm({ ...form, instrucoes_obrigatorias: e.target.value.slice(0, 1000) })}
                  placeholder="Instruções extras que os associados devem seguir ao compartilhar..."
                  rows={3}
                  className="resize-none"
                />
                <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">{form.instrucoes_obrigatorias.length}/1000</span>
              </div>
            </div>

            {/* Submit button */}
            <Button onClick={create} disabled={submitting} className="w-full bg-gold-gradient text-primary-foreground">
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Criar campanha</>
              )}
            </Button>
          </Card>

          {/* Right: Instagram previews */}
          <div className="space-y-5">
            <Card className="p-4 bg-card/50 border-border/50">
              <p className="font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-sm bg-primary/70" />
                Feed (1:1)
              </p>
              <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
                <div className="flex items-center gap-2.5 px-3 py-2">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
                    <div className="h-full w-full rounded-full bg-background" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="h-2 w-20 rounded bg-muted" />
                  </div>
                  <div className="h-1 w-1 rounded-full bg-muted" />
                  <div className="h-1 w-1 rounded-full bg-muted" />
                  <div className="h-1 w-1 rounded-full bg-muted" />
                </div>
                <div className="aspect-square bg-muted/20 flex items-center justify-center overflow-hidden">
                  {preview ? (
                    file && isVideo(file) ? (
                      <video key={preview} src={preview} autoPlay loop playsInline muted className="h-full w-full object-cover" />
                    ) : (
                      <img src={preview} alt="feed preview" className="h-full w-full object-cover" />
                    )
                  ) : (
                    <ImagePlus className="h-10 w-10 text-muted-foreground/20" />
                  )}
                </div>
                <div className="flex items-center gap-3.5 px-3 py-2">
                  <Heart className="h-4.5 w-4.5 text-muted-foreground" />
                  <MessageCircle className="h-4.5 w-4.5 text-muted-foreground" />
                  <Share2 className="h-4.5 w-4.5 text-muted-foreground" />
                </div>
                <div className="px-3 pb-3 space-y-1">
                  {form.texto_sugerido ? (
                    <p className="text-[11px] text-foreground line-clamp-3">{form.texto_sugerido}</p>
                  ) : (
                    <>
                      <div className="h-1.5 w-full rounded bg-muted/60" />
                      <div className="h-1.5 w-3/4 rounded bg-muted/60" />
                      <div className="h-1.5 w-1/2 rounded bg-muted/40" />
                    </>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-card/50 border-border/50">
              <p className="font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="inline-block h-4 w-2.5 rounded-sm bg-primary/70" />
                Stories (9:16)
              </p>
              <div className="mx-auto w-[160px]">
                <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-black" style={{ aspectRatio: "9/16" }}>
                  {preview ? (
                    file && isVideo(file) ? (
                      <video key={preview} src={preview} autoPlay loop playsInline muted className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <img src={preview} alt="stories preview" className="absolute inset-0 h-full w-full object-cover" />
                    )
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImagePlus className="h-8 w-8 text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 top-0 p-2 flex items-center gap-1.5">
                    <div className="flex-1 h-0.5 rounded-full bg-white/60" />
                  </div>
                  <div className="absolute inset-x-0 top-4 px-2 flex items-center gap-1.5">
                    <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[1.5px]">
                      <div className="h-full w-full rounded-full bg-black/50" />
                    </div>
                    <div className="h-1.5 w-12 rounded bg-white/50" />
                  </div>
                  {form.texto_sugerido && (
                    <div className="absolute inset-x-0 bottom-6 px-3">
                      <p className="text-[9px] text-white line-clamp-3 drop-shadow">{form.texto_sugerido}</p>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-1 flex justify-center">
                    <div className="h-1.5 w-12 rounded-full bg-white/30" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Campanhas existentes</h2>
        {items.map((c) => {
          const campaignShares = shares[c.id] ?? [];
          const totalAlcance = campaignShares.reduce(
            (sum, s) => sum + Number(s.detected_followers || s.profile?.seguidores_instagram || 0),
            0
          );
          return (
            <Card key={c.id} className="p-4 bg-card/50 border-border/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2"><span className="font-medium">{c.titulo}</span><Badge variant="outline">{c.status}</Badge></div>
                  <div className="text-xs text-muted-foreground mt-1">{c.link_campanha}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toggleTracking(c.id)}>
                    <Users className="h-3.5 w-3.5" />
                    Acompanhamento
                    {expandedId === c.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggle(c.id, c.status)}>
                    {c.status === "ativa" ? "Inativar" : "Ativar"}
                  </Button>
                </div>
              </div>

              {expandedId === c.id && (
                <div className="mt-4 border-t border-border/50 pt-4">
                  {loadingShares === c.id ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
                  ) : campaignShares.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum usuário pegou esta campanha para divulgar ainda.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-4 mb-3 text-sm">
                        <span><strong>{campaignShares.length}</strong> participação(ões)</span>
                        <span><strong>{totalAlcance.toLocaleString("pt-BR")}</strong> alcance estimado (seguidores somados)</span>
                      </div>
                      <div className="space-y-2">
                        {campaignShares.map((s) => (
                          <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 p-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium">{s.profile?.nome ?? "Usuário"} {s.profile?.instagram && <span className="text-muted-foreground">(@{s.profile.instagram})</span>}</div>
                              {s.instagram_usado && s.instagram_usado !== s.profile?.instagram && (
                                <div className="text-xs text-muted-foreground">Insta usado no envio: @{s.instagram_usado}</div>
                              )}
                              <a href={s.shared_link} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 break-all">
                                {s.shared_link} <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <div className="text-xs text-muted-foreground">
                                {Number(s.detected_followers || s.profile?.seguidores_instagram || 0).toLocaleString("pt-BR")} seguidores
                              </div>
                              <Badge className={statusBadgeClass(s.status)}>{s.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
