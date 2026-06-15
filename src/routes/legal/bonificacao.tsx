import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/legal/bonificacao")({ component: () => (
  <div className="space-y-3">
    <h1 className="text-2xl font-bold">Regras de bonificação</h1>
    <ul className="list-disc pl-5 space-y-2">
      <li>Bonificação diária: 0,26% sobre o valor do pacote, mediante 5 compartilhamentos aprovados por dia.</li>
      <li>Indicação direta (Nível 1): 20%. Níveis 2 a 5: 5% por nível, sobre entrada de novos pacotes ($300, $600, $1200).</li>
      <li>Mensalidade recorrente de $120 paga a mesma estrutura 20% / 5×4%.</li>
      <li>Equipe (Nível 1 a 10): 1% sobre os 0,26% diários gerados pela rede.</li>
      <li>Bonificações ficam pendentes até aprovação manual da prova.</li>
    </ul>
  </div>
)});
