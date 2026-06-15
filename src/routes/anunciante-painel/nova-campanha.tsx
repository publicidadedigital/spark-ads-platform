import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ImagePlus, Loader2, CheckCircle2, Eye, Clock } from "lucide-react";

export const Route = createFileRoute("/anunciante-painel/nova-campanha")({ component: NovaCampanha });

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
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [packageId, setPackageId] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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
      if (list[1]) setPackageId(list[1].id);
      else if (list[0]) setPackageId(list[0].id);
      setLoading(false);
    })();
  }, [supabase, user]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
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

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nova Campanha</h1>
        <p className="text-sm text-muted-foreground">Crie uma campanha para ser divulgada pela nossa rede de afiliados</p>
      </div>

      <Card className="p-6 bg-card/50 border-border/50 space-y-4">
        <h3 className="font-semibold">1. Conteudo da campanha</h3>

        <div>
          <Label>Imagem da campanha *</Label>
          <label className="mt-1 flex aspect-[16/9] max-w-md cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-border/60 bg-background/40 text-muted-foreground hover:border-primary/50">
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm">Clique para enviar uma imagem</span>
              </div>
            )}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={onFile} />
          </label>
        </div>

        <div>
          <Label>Titulo da campanha *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Lancamento da coleção verão" />
        </div>

        <div>
          <Label>Descricao / texto de compartilhamento *</Label>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Texto que os afiliados irao usar ao compartilhar, instrucoes obrigatorias e hashtags."
            rows={5}
          />
        </div>

        <div>
          <Label>Link de destino *</Label>
          <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://" />
        </div>
      </Card>

      <Card className="p-6 bg-card/50 border-border/50 space-y-4">
        <h3 className="font-semibold">2. Escolha o pacote</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg) => (
            <PackageOption key={pkg.id} pkg={pkg} selected={packageId === pkg.id} onSelect={() => setPackageId(pkg.id)} />
          ))}
          {packages.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground">Nenhum pacote disponivel no momento.</p>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={submitting} className="bg-gold-gradient text-primary-foreground">
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</> : "Enviar campanha para analise"}
        </Button>
      </div>
    </div>
  );
}

function PackageOption({ pkg, selected, onSelect }: { pkg: Pkg; selected: boolean; onSelect: () => void }) {
  const highlight = pkg.duration_days === 15 ? "MAIS POPULAR" : pkg.duration_days === 30 ? "MELHOR CUSTO BENEFÍCIO" : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex flex-col gap-3 rounded-lg border p-4 text-left transition ${
        selected ? "border-gold bg-gold/5 shadow-[0_0_24px_rgba(245,181,27,0.15)]" : "border-border/50 hover:bg-card"
      }`}
    >
      {highlight && (
        <Badge className="absolute -top-3 right-3 border-gold/40 bg-gold/15 text-gold hover:bg-gold/15">{highlight}</Badge>
      )}
      <div className="flex items-center justify-between">
        <span className="font-semibold">{pkg.name}</span>
        {selected && <CheckCircle2 className="h-5 w-5 text-gold" />}
      </div>
      <div className="text-2xl font-bold gold-text-gradient">{usd.format(Number(pkg.price_usd))}</div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {pkg.duration_days && (
          <div className="flex items-center gap-2"><Clock className="h-3 w-3" /> {pkg.duration_days} dias de exibição</div>
        )}
        <div className="flex items-center gap-2"><Eye className="h-3 w-3" /> ~{pkg.estimated_views.toLocaleString("pt-BR")} visualizações estimadas</div>
      </div>
      {pkg.description && <p className="text-xs text-muted-foreground">{pkg.description}</p>}
    </button>
  );
}
