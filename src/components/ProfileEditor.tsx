import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Instagram, KeyRound, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

type ProfileTable = "users_profile" | "advertiser_profiles";

type InfoField = {
  label: string;
  value: string | null | undefined;
};

export function ProfileEditor({
  table,
  nameField,
  fields,
}: {
  table: ProfileTable;
  nameField: string;
  fields: InfoField[];
}) {
  const { supabase, user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const { data } = await supabase
        .from(table)
        .select(`avatar_url,${nameField}`)
        .eq("auth_user_id", user.id)
        .maybeSingle();

      setAvatarUrl((data as any)?.avatar_url ?? null);
      setDisplayName((data as any)?.[nameField] ?? "");
      setLoading(false);
    })();
  }, [supabase, user, table, nameField]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !supabase || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${publicUrl.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from(table)
        .update({ avatar_url: url })
        .eq("auth_user_id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(url);
      toast.success("Foto atualizada");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível atualizar a foto");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-card/50 p-5">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <UserIcon className="h-5 w-5 text-primary" /> Dados do perfil
        </h2>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative">
            <Avatar className="h-20 w-20 border border-border/60">
              <AvatarImage src={avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="text-xl">{(displayName || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
            >
              <Camera className="h-3.5 w-3.5" />
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={uploading}
            />
          </div>

          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : (
              fields.map((field) => (
                <div key={field.label}>
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="text-sm font-medium">{field.value || "-"}</p>
                </div>
              ))
            )}
          </div>
        </div>
        {uploading && <p className="mt-3 text-xs text-muted-foreground">Enviando foto...</p>}
      </Card>

      {table === "users_profile" && <InstagramCard />}
      <PasswordCard />
    </div>
  );
}

function InstagramCard() {
  const { supabase, user } = useAuth();
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("users_profile")
      .select("instagram")
      .eq("auth_user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setHandle((data as any)?.instagram ?? ""));
  }, [supabase, user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    const cleaned = handle.replace(/^@+/, "").trim();
    if (!cleaned) { toast.error("Digite um @ do Instagram válido"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("users_profile")
        .update({ instagram: cleaned })
        .eq("auth_user_id", user.id);
      if (error) throw error;
      setHandle(cleaned);
      toast.success("Instagram atualizado");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível atualizar o Instagram");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-card/50 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Instagram className="h-5 w-5 text-pink-400" /> Instagram
      </h2>
      <form onSubmit={handleSave} className="grid gap-4 sm:max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="instagram-handle">@ do Instagram</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">@</span>
            <Input
              id="instagram-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@+/, ""))}
              placeholder="seu_usuario"
              autoComplete="off"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">Digite sem o @. Ex: meu_perfil</p>
        </div>
        <Button type="submit" disabled={saving} className="bg-gold-gradient text-primary-foreground">
          {saving ? "Salvando..." : "Salvar Instagram"}
        </Button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const { supabase, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user?.email) return;

    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setSubmitting(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthError) {
        toast.error("Senha atual incorreta");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      toast.success("Senha alterada com sucesso");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível alterar a senha");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-card/50 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <KeyRound className="h-5 w-5 text-primary" /> Alterar senha
      </h2>

      <form onSubmit={handleSubmit} className="grid gap-4 sm:max-w-md">
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Senha atual</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <Button type="submit" disabled={submitting} className="bg-gold-gradient text-primary-foreground">
          {submitting ? "Salvando..." : "Alterar senha"}
        </Button>
      </form>
    </Card>
  );
}
