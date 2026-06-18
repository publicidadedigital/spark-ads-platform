import { createFileRoute } from "@tanstack/react-router";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { useLanguage } from "@/lib/i18n/context";

export const Route = createFileRoute("/app/seguranca")({ component: SegurancaPage });

function SegurancaPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">{t("profile.account")}</p>
        <h1 className="text-2xl font-bold">{t("security.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("security.subtitle")}
        </p>
      </div>

      <TwoFactorSetup />
    </div>
  );
}
