import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ImagePlus, Loader2, CheckCircle2, ArrowLeft, Send, Heart, MessageCircle, Share2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/anunciante-painel/nova-campanha")({
  validateSearch: (s: Record<string, unknown>) => ({
    packageId: (s.packageId as string) || "",
  }),
  component: NovaCampanha,
});

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type Pkg = {
  id: string;
  name: string;
  price_usd: number | string;
  estimated_views: number;
  duration_days: number | null;
  description: string | null;
};

function NovaCampanha() {
  const { supabase, user } = useAuth();
  const navigate = useNavigate();
  const { packageId: selectedPackageId } = Route.useSearch();

  const [packages, setPackages] = useState<Pkg[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [packageId, setPackageId] = useState(selectedPackageId);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const [{ data: pkgs }, { data: prof }] = await Promise.all([
        supabase.from("advertising_packages").select("*").eq("status", "ativo").order("price_usd"),
        supabase.from("advertiser_profiles").select("id,status").eq("auth_user_id", user.id).maybeSingle(),
      ]);
      const list = (pkgs ?? []) as Pkg[];
      setPackages(list);
      setProfile(prof);
      // If no packageId from URL, fall back to default
      if (!selectedPackageId) {
        if (list[1]) setPackageId(list[1].id);
        else if (list[0]) setPackageId(list[0].id);
      }
      setLoading(false);
    })();
  }, [supabase, user]);

  function handleFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
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
    if (f && (f.type.startsWith("image/") || f.type.startsWith("video/"))) {
      handleFile(f);
    }
  }

  async function submit() {
    if (!supabase || !user || !profile) return;
    if (profile.status !== "ativo") return toast.error("Seu cadastro precisa estar ativo para criar campanhas.");
    if (!title.trim()) return toast.error("Informe o titulo da campanha");
    if (!caption.trim()) return toast.error("Informe a descricao e o texto de compartilhamento");
    if (!destinationUrl.trim()) return toast.error("Informe o link de destino");
    if (!file) return toast.error("Envie uma imagem para a campanha");

    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return toast.error("Selecione um pacote");

    setSubmitting(true);
    try {
      const path = `${profile.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("advertiser-media").upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("advertiser-media").getPublicUrl(path);

      const { data: order, error: orderErr } = await supabase
        .from("advertiser_campaign_orders")
        .insert({
          advertiser_id: profile.id,
          advertising_package_id: pkg.id,
          price_usd: pkg.price_usd,
          estimated_views: pkg.estimated_views,
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      const { error: campErr } = await supabase.from("advertiser_campaigns").insert({
        order_id: order.id,
        advertiser_id: profile.id,
        title: title.trim(),
        media_url: pub.publicUrl,
        media_type: file.type.startsWith("video") ? "video" : "imagem",
        caption: caption.trim(),
        destination_url: destinationUrl.trim(),
      });
      if (campErr) throw campErr;

      toast.success("Campanha enviada para analise!");
      navigate({ to: "/anunciante-painel/campanhas" });
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar campanha");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  if (profile && profile.status !== "ativo") {
    return (
      <Card className="border-amber-400/30 bg-amber-500/10 p-8 text-center">
        <h1 className="text-xl font-bold mb-2">Cadastro em analise</h1>
        <p className="text-sm text-muted-foreground">
          Seu cadastro de anunciante ainda esta sendo analisado pela nossa equipe. Voce podera criar campanhas assim que sua conta for ativada.
        </p>
      </Card>
    );
  }

  const selectedPkg = packages.find((p) => p.id === packageId);

  return (
    <div className="space-y-5 pb-24 lg:pb-6">
      {/* Back link */}
      <Link to="/anunciante-painel" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Voltar para Dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Submeter nova campanha</h1>
        <p className="text-sm text-muted-foreground mt-1">Envie os detalhes da sua campanha para análise da nossa equipe.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: form */}
        <Card className="p-6 bg-card/50 border-border/50 space-y-5">

          {/* Selected package summary */}
          {selectedPkg && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pacote selecionado</p>
                <p className="font-semibold text-sm">
                  {selectedPkg.duration_days ? `${selectedPkg.duration_days} Dias de compartilhamentos` : selectedPkg.name}
                </p>
              </div>
              <p className="text-primary font-bold">{usd.format(Number(selectedPkg.price_usd))}</p>
            </div>
          )}

          {/* Image upload */}
          <div>
            <Label className="mb-2 block">Imagem da campanha</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex min-h-[180px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed transition ${
                dragging ? "border-primary bg-primary/10" : "border-border/60 bg-background/40 hover:border-primary/50"
              } overflow-hidden`}
            >
              {preview ? (
                <img src={preview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                  <ImagePlus className="h-10 w-10 opacity-60" />
                  <p className="text-sm font-medium">Clique para enviar ou arraste a imagem aqui</p>
                  <p className="text-xs opacity-70">PNG, JPG ou WEBP até 10MB</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={onFileInput} />
          </div>

          {/* Title */}
          <div>
            <Label className="mb-1 block">Titulo da campanha *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lancamento da coleção verão" />
          </div>

          {/* Destination URL */}
          <div>
            <Label className="mb-1 block">Link de destino *</Label>
            <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://" />
          </div>

          {/* Caption textarea */}
          <div>
            <Label className="mb-1 block">Texto para compartilhamento no Instagram *</Label>
            <div className="relative">
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 2200))}
                placeholder="Texto que os afiliados irão usar ao compartilhar, instruções obrigatórias e hashtags."
                rows={5}
                className="resize-none"
              />
              <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">{caption.length}/2200</span>
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

          {/* Extra info (optional) */}
          <div>
            <Label className="mb-1 block">Informações adicionais (opcional)</Label>
            <div className="relative">
              <Textarea
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value.slice(0, 1000))}
                placeholder="Informações extras para nossa equipe..."
                rows={3}
                className="resize-none"
              />
              <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">{extraInfo.length}/1000</span>
            </div>
          </div>

          {/* Submit button */}
          <Button onClick={submit} disabled={submitting} className="w-full bg-primary text-primary-foreground">
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Enviar para análise</>
            )}
          </Button>
        </Card>

        {/* Right: Instagram preview */}
        <div className="space-y-4">
          <Card className="p-5 bg-card/50 border-border/50">
            <p className="font-semibold mb-4 text-sm">Prévia do compartilhamento</p>

            {/* Instagram mockup */}
            <div className="rounded-xl border border-border/60 bg-background overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="space-y-1 flex-1">
                  <div className="h-2.5 w-24 rounded bg-muted" />
                  <div className="h-2 w-16 rounded bg-muted/60" />
                </div>
              </div>

              {/* Image area */}
              <div className="aspect-square bg-muted/30 flex items-center justify-center overflow-hidden">
                {preview ? (
                  <img src={preview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <ImagePlus className="h-12 w-12 text-muted-foreground/30" />
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 px-3 py-2.5">
                <Heart className="h-5 w-5 text-muted-foreground" />
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
                <Share2 className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Caption preview */}
              <div className="px-3 pb-3 space-y-1">
                {caption ? (
                  <p className="text-xs text-foreground line-clamp-3">{caption}</p>
                ) : (
                  <>
                    <div className="h-2 w-full rounded bg-muted/60" />
                    <div className="h-2 w-3/4 rounded bg-muted/60" />
                    <div className="h-2 w-1/2 rounded bg-muted/40" />
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
