import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/legal/privacidade")({ component: () => (
  <div className="space-y-3">
    <h1 className="text-2xl font-bold">Política de privacidade</h1>
    <p>Coletamos dados estritamente necessários para operação da plataforma: nome, CPF, e-mail, telefone e Instagram. Os dados são armazenados de forma segura no Supabase com Row-Level Security e usados apenas para gestão de cadastros, bonificações e antifraude.</p>
    <p>O usuário pode solicitar exclusão dos dados a qualquer momento, desde que isso não conflite com obrigações legais.</p>
  </div>
)});
