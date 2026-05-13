import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/campanhas")({ component: CampanhasPage });

function CampanhasPage() {
  const { supabase, user } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [sharedToday, setSharedToday] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !user) return;
    refresh();
    // eslint-disable-next-line
  }, [supabase, user]);

  async function refresh() {
    if (!supabase || !user) return;
    setLoading(true);
    const { data: prof } = await supabase
      .from("users_profile")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!prof) { setLoading(false); return; }
    setProfileId(prof.id);

    const { data: cycle } = await supabase
      .from("user_cycles")
      .select("id")
      .eq("user_id", prof.id)
      .eq("status", "ativo")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setCycleId(cycle?.id ?? null);

    const { data: cs } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "ativa")
      .order("created_at", { ascending: false });
    setCampaigns(cs ?? []);

    const today = new Date(); today.setHours(0,0,0,0);
    const { data: shares } = await supabase
      .from("campaign_shares")
      .select("campaign_id")
      .eq("user_id", prof.id)
      .gte("created_at", today.toISOString());
    setSharedToday(new Set((shares ?? []).map((s: any) => s.campaign_id)));
    setLoading(false);
  }

  if (loading) return <p className="text-muted-foreground">Carregando campanhas...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Publicidades disponíveis</h1>
        <p className="text-sm text-muted-foreground">Compartilhe 5 publicidades por dia no seu Instagram cadastrado.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((c) => (
          <CampaignCard
            key={c.id}
            c={c}
            alreadyShared={sharedToday.has(c.id)}
            profileId={profileId}
            cycleId={cycleId}
            onSubmitted={refresh}
          />
        ))}
        {campaigns.length === 0 && (
          <Card className="p-8 col-span-full text-center text-muted-foreground bg-card/50 border-border/50">
            Nenhuma campanha ativa no momento.
          </Card>
        )}
      </div>
    </div>
  );
}

function CampaignCard({ c, alreadyShared, profileId, cycleId, onSubmitted }: any) {
  return (
    <Card className="overflow-hidden bg-card/50 border-border/50 flex flex-col">
      {c.tipo_midia === "video" ? (
        <video src={c.media_url} controls className="aspect-video w-full bg-black" />
      ) : (
        <img src={c.media_url} alt={c.titulo} className="aspect-video w-full object-cover" />
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold">{c.titulo}</h3>
          <Badge variant="outline" className="text-xs">{c.rede_permitida}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{c.texto_sugerido}</p>
        {c.instrucoes_obrigatorias && (
          <p className="text-xs text-warning mb-3">⚠ {c.instrucoes_obrigatorias}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-auto">
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(c.texto_sugerido); toast.success("Texto copiado"); }}>
            <Copy className="h-3 w-3 mr-1" /> Copiar texto
          </Button>
          <a href={c.link_campanha} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline"><ExternalLink className="h-3 w-3 mr-1" /> Abrir</Button>
          </a>
          {alreadyShared ? (
            <Badge className="bg-success/20 text-success border-success/30" variant="outline">Compartilhada hoje</Badge>
          ) : (
            <ShareDialog c={c} profileId={profileId} cycleId={cycleId} onSubmitted={onSubmitted} />
          )}
        </div>
      </div>
    </Card>
  );
}

function ShareDialog({ c, profileId, cycleId, onSubmitted }: any) {
  const { supabase, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [insta, setInsta] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!supabase || !user || !profileId) return;
    if (!link.trim()) return toast.error("Informe o link do compartilhamento");
    setBusy(true);
    let proofUrl: string | null = null;
    try {
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("share-proofs").upload(path, file);
        if (upErr) throw upErr;
        proofUrl = path;
      }
      const { error } = await supabase.from("campaign_shares").insert({
        user_id: profileId,
        campaign_id: c.id,
        cycle_id: cycleId,
        proof_url: proofUrl,
        shared_link: link.trim(),
        instagram_usado: insta.trim() || null,
      });
      if (error) throw error;
      toast.success("Compartilhamento enviado para análise");
      setOpen(false); setLink(""); setInsta(""); setFile(null);
      onSubmitted();
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gold-gradient text-primary-foreground">
          <Upload className="h-3 w-3 mr-1" /> Enviar prova
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Enviar prova: {c.titulo}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Link do post compartilhado *</Label><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://instagram.com/p/..." /></div>
          <div><Label>Instagram usado</Label><Input value={insta} onChange={(e) => setInsta(e.target.value)} placeholder="@seuusuario" /></div>
          <div><Label>Print da publicação (opcional)</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <Button onClick={submit} disabled={busy} className="w-full bg-gold-gradient text-primary-foreground">
            {busy ? "Enviando..." : "Enviar para análise"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
