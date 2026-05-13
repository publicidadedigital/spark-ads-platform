import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/legal/renovacao")({ component: () => (
  <div className="space-y-3">
    <h1 className="text-2xl font-bold">Regras de renovação (200%)</h1>
    <p>Cada ciclo possui um teto de 200% do valor do pacote. Ao atingir esse limite, novas bonificações são bloqueadas e o usuário precisa renovar o pacote para iniciar um novo ciclo.</p>
    <p>A renovação cria um novo registro de ciclo e libera novamente as bonificações diárias e de equipe.</p>
  </div>
)});
