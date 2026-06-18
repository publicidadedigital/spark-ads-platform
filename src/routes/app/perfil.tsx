import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/supabase/auth";
import { ProfileEditor } from "@/components/ProfileEditor";
import { useLanguage } from "@/lib/i18n/context";

export const Route = createFileRoute("/app/perfil")({ component: PerfilPage });

type Profile = {
  nome: string | null;
  email: string | null;
  telefone: string | null;
  instagram: string | null;
  x_twitter: string | null;
  cidade: string | null;
  estado: string | null;
  country_code: string | null;
};

function PerfilPage() {
  const { t } = useLanguage();
  const { supabase, user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabase || !user) return;
    supabase
      .from("users_profile")
      .select("nome,email,telefone,instagram,x_twitter,cidade,estado,country_code")
      .eq("auth_user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as Profile | null));
  }, [supabase, user]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">{t("profile.account")}</p>
        <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <ProfileEditor
        table="users_profile"
        nameField="nome"
        fields={[
          { label: t("profile.name"), value: profile?.nome },
          { label: t("profile.email"), value: profile?.email },
          { label: t("profile.phone"), value: profile?.telefone },
          { label: t("profile.instagram"), value: profile?.instagram ? `@${profile.instagram}` : null },
          { label: t("profile.twitter"), value: profile?.x_twitter ? `@${profile.x_twitter}` : null },
          { label: t("profile.location"), value: [profile?.cidade, profile?.estado, profile?.country_code].filter(Boolean).join(" - ") },
        ]}
      />
    </div>
  );
}
