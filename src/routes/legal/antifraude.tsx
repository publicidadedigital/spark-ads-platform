import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/legal/antifraude")({ component: () => (
  <div className="space-y-3">
    <h1 className="text-2xl font-bold">Política antifraude</h1>
    <ul className="list-disc pl-5 space-y-2">
      <li>CPF, e-mail, telefone e Instagram são únicos por conta.</li>
      <li>IP e device fingerprint são registrados para detectar múltiplas contas.</li>
      <li>Compartilhamentos feitos em perfil diferente do cadastrado são rejeitados.</li>
      <li>Links repetidos são automaticamente bloqueados.</li>
      <li>Usuários com múltiplas rejeições podem ser bloqueados automaticamente.</li>
      <li>Toda alteração sensível é registrada em log de auditoria.</li>
    </ul>
  </div>
)});
