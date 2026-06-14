import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function publicLandingPage(): Response {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Viral Hub</title>
  <meta name="description" content="Viral Hub conecta campanhas digitais a divulgadores ativos." />
  <style>
    :root { color-scheme: dark; --bg: #030712; --panel: #070d1b; --line: rgba(77, 126, 255, .22); --blue: #2f7dff; --cyan: #58c8ff; --muted: #94a3b8; --text: #f8fafc; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: radial-gradient(circle at 70% 20%, rgba(47, 125, 255, .18), transparent 34%), linear-gradient(180deg, #020617 0%, #071020 52%, #030712 100%); color: var(--text); min-height: 100vh; }
    a { color: inherit; text-decoration: none; }
    .top { height: 88px; display: flex; align-items: center; border-bottom: 1px solid rgba(148, 163, 184, .14); background: rgba(1, 5, 14, .88); backdrop-filter: blur(16px); }
    .wrap { width: min(1280px, calc(100% - 40px)); margin: 0 auto; }
    .nav { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
    .brand { display: flex; align-items: center; gap: 12px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; }
    .mark { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: linear-gradient(135deg, rgba(47,125,255,.28), rgba(88,200,255,.12)); border: 1px solid rgba(88,200,255,.35); box-shadow: 0 0 28px rgba(47,125,255,.24); }
    .mark span { font-weight: 950; font-size: 17px; color: white; }
    .brand b { color: var(--cyan); }
    .links { display: flex; align-items: center; gap: 14px; font-weight: 700; }
    .button { min-height: 44px; padding: 0 22px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(148, 163, 184, .24); background: rgba(15, 23, 42, .45); }
    .primary { border: 0; background: linear-gradient(135deg, #1d62f0, #63c8ff); color: white; box-shadow: 0 16px 38px rgba(47, 125, 255, .26); }
    .hero { padding: 112px 0 96px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 560px); align-items: center; gap: 72px; }
    h1 { margin: 0; font-size: clamp(48px, 6vw, 84px); line-height: .98; letter-spacing: 0; text-align: center; }
    h1 span { color: var(--blue); display: block; }
    .copy { max-width: 660px; margin: 28px auto 0; color: var(--muted); font-size: clamp(18px, 2vw, 22px); line-height: 1.55; text-align: center; }
    .actions { margin-top: 34px; display: flex; justify-content: center; flex-wrap: wrap; gap: 14px; }
    .visual { min-height: 360px; border-radius: 26px; border: 1px solid rgba(148,163,184,.2); background: radial-gradient(circle at 50% 35%, rgba(88,200,255,.32), transparent 26%), linear-gradient(135deg, rgba(15,23,42,.94), rgba(2,6,23,.96)); display: grid; place-items: center; overflow: hidden; box-shadow: inset 0 0 80px rgba(47,125,255,.12), 0 28px 90px rgba(0,0,0,.35); }
    .visual-card { width: min(74%, 360px); aspect-ratio: 1; border-radius: 50%; border: 1px solid rgba(88,200,255,.36); display: grid; place-items: center; background: radial-gradient(circle, rgba(47,125,255,.38), rgba(3,7,18,.15) 58%, transparent 59%); box-shadow: 0 0 80px rgba(47,125,255,.28); }
    .visual-card strong { font-size: clamp(70px, 9vw, 120px); letter-spacing: -.08em; color: #fff; text-shadow: 0 0 32px rgba(88,200,255,.5); }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; padding-bottom: 72px; }
    .stat { border: 1px solid rgba(148,163,184,.18); background: rgba(2,6,23,.68); border-radius: 20px; padding: 28px 18px; text-align: center; min-height: 124px; }
    .stat strong { color: var(--blue); display: block; font-size: clamp(30px, 3vw, 42px); line-height: 1; }
    .stat span { display: block; color: var(--muted); margin-top: 12px; }
    .plans { padding: 12px 0 96px; }
    .section-title { text-align: center; font-size: clamp(30px, 4vw, 46px); margin: 0 0 28px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
    .plan { border: 1px solid var(--line); background: linear-gradient(180deg, rgba(15,23,42,.76), rgba(2,6,23,.84)); border-radius: 20px; padding: 24px; min-height: 210px; }
    .plan h3 { margin: 0 0 12px; font-size: 22px; }
    .plan .price { font-size: 34px; color: var(--cyan); font-weight: 900; }
    .plan p { color: var(--muted); line-height: 1.5; margin: 12px 0 0; }
    @media (max-width: 900px) { .hero { grid-template-columns: 1fr; padding-top: 64px; gap: 40px; } .visual { min-height: 280px; } .stats, .grid { grid-template-columns: 1fr 1fr; } .top { height: auto; padding: 16px 0; } }
    @media (max-width: 560px) { .wrap { width: min(100% - 28px, 1280px); } .nav { align-items: flex-start; } .links { gap: 8px; } .button { padding: 0 14px; } .stats, .grid { grid-template-columns: 1fr; } h1 { text-align: left; } .copy, .actions { text-align: left; justify-content: flex-start; } }
  </style>
</head>
<body>
  <header class="top">
    <div class="wrap nav">
      <a class="brand" href="/"><span class="mark"><span>VH</span></span><span>Viral <b>Hub</b></span></a>
      <nav class="links"><a class="button" href="/login">Entrar</a><a class="button primary" href="/cadastro">Cadastrar</a></nav>
    </div>
  </header>
  <main class="wrap">
    <section class="hero">
      <div>
        <h1>Compartilhe.<span>Monetize.</span>Construa renda.</h1>
        <p class="copy">Viral Hub conecta voce as melhores campanhas digitais. Compartilhe 5 publicidades por dia, receba bonificacoes diarias, indicacoes multinivel e rentabilidade de equipe.</p>
        <div class="actions"><a class="button primary" href="/cadastro">Comecar agora</a><a class="button" href="/login">Entrar no escritorio</a></div>
      </div>
      <div class="visual" aria-label="Viral Hub"><div class="visual-card"><strong>VH</strong></div></div>
    </section>
    <section class="stats" aria-label="Resumo da plataforma">
      <div class="stat"><strong>200%</strong><span>Limite por ciclo de pacote</span></div>
      <div class="stat"><strong>5+10</strong><span>Niveis de indicacao e equipe</span></div>
      <div class="stat"><strong>5/dia</strong><span>Compartilhamentos por dia</span></div>
      <div class="stat"><strong>US$</strong><span>Moeda principal do sistema</span></div>
    </section>
    <section class="plans">
      <h2 class="section-title">Planos de entrada</h2>
      <div class="grid">
        <article class="plan"><h3>Start</h3><div class="price">US$ 70</div><p>US$ 60 de pacote bonificavel + US$ 10 do curso.</p></article>
        <article class="plan"><h3>Plus</h3><div class="price">US$ 130</div><p>US$ 120 de pacote bonificavel + US$ 10 do curso.</p></article>
        <article class="plan"><h3>Pro</h3><div class="price">US$ 310</div><p>US$ 300 de pacote bonificavel + US$ 10 do curso.</p></article>
        <article class="plan"><h3>Elite</h3><div class="price">US$ 1.010</div><p>US$ 1.000 de pacote bonificavel + US$ 10 do curso.</p></article>
      </div>
    </section>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}

function formatServerError(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}\n${error.stack ?? ""}`;
  }

  try {
    return typeof error === "string" ? error : JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function logServerError(error: unknown, context: string) {
  console.error(`[viral-hub:ssr:${context}] ${formatServerError(error)}`);
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} - try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  logServerError(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`), "swallowed");
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return publicLandingPage();
    }

    if (request.method === "GET" && url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      logServerError(error, "fetch");
      return brandedErrorResponse();
    }
  },
};