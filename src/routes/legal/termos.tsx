import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/legal/termos")({ component: () => (
  <div className="space-y-3">
    <h1 className="text-2xl font-bold">Termos de uso</h1>
    <p>Ao usar a plataforma Viral Hub você concorda com as condições aqui descritas. As bonificações dependem do cumprimento integral das regras de compartilhamento e das políticas internas. A plataforma pode rejeitar compartilhamentos que não cumpram as instruções obrigatórias e aplicar bloqueio em caso de fraude.</p>
    <p>Cadastros falsos, múltiplas contas e compartilhamentos fora do perfil cadastrado são proibidos. Não há promessa de renda garantida.</p>
  </div>
)});
