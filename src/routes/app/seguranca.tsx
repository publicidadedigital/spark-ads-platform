import { createFileRoute } from "@tanstack/react-router";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";

export const Route = createFileRoute("/app/seguranca")({ component: SegurancaPage });

function SegurancaPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Conta</p>
        <h1 className="text-2xl font-bold">Segurança</h1>
        <p className="text-sm text-muted-foreground">
          Configure a autenticação em dois fatores. Ela é exigida para confirmar solicitações de saque.
        </p>
      </div>

      <TwoFactorSetup />
    </div>
  );
}
