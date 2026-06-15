import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cadastro-anunciante")({
  beforeLoad: () => {
    throw redirect({ to: "/cadastro", search: { tipo: "anunciante", ref: "" } });
  },
});
