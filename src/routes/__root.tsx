import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/supabase/auth";
import { Toaster } from "@/components/ui/sonner";
import { viralHubLogo } from "@/assets/viral-hub-logo";

const criticalCss = `
  *,::before,::after{box-sizing:border-box;border-color:#1f2937}html,body,#root{min-height:100%;width:100%;margin:0;overflow-x:hidden}body{background:#020617;color:#f8fafc;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}a{color:inherit;text-decoration:none}img,video,canvas,svg{display:block;max-width:100%;height:auto}button,input,textarea,select{font:inherit;min-width:0}.min-h-screen{min-height:100vh}.flex{display:flex}.grid{display:grid}.hidden{display:none}.inline-flex{display:inline-flex;align-items:center;justify-content:center}.items-center{align-items:center}.items-start{align-items:flex-start}.justify-center{justify-content:center}.justify-between{justify-content:space-between}.flex-col{flex-direction:column}.flex-wrap{flex-wrap:wrap}.shrink-0{flex-shrink:0}.min-w-0{min-width:0}.w-full{width:100%}.h-full{height:100%}.h-4{height:1rem}.w-4{width:1rem}.h-5{height:1.25rem}.w-5{width:1.25rem}.h-7{height:1.75rem}.w-7{width:1.75rem}.h-9{height:2.25rem}.w-9{width:2.25rem}.h-10{height:2.5rem}.w-10{width:2.5rem}.h-12{height:3rem}.w-12{width:3rem}.max-w-md{max-width:28rem}.container{width:100%;max-width:1200px;margin-inline:auto}.app-container{width:100%;max-width:min(1480px,calc(100vw - 32px));margin-inline:auto}.object-contain{object-fit:contain}.overflow-hidden{overflow:hidden}.overflow-x-auto{overflow-x:auto;-webkit-overflow-scrolling:touch}.relative{position:relative}.absolute{position:absolute}.sticky{position:sticky}.top-0{top:0}.z-40{z-index:40}.gap-1{gap:.25rem}.gap-2{gap:.5rem}.gap-3{gap:.75rem}.gap-4{gap:1rem}.gap-5{gap:1.25rem}.gap-6{gap:1.5rem}.space-y-1>*+*{margin-top:.25rem}.space-y-2>*+*{margin-top:.5rem}.space-y-3>*+*{margin-top:.75rem}.space-y-4>*+*{margin-top:1rem}.space-y-6>*+*{margin-top:1.5rem}.mx-auto{margin-inline:auto}.mt-1{margin-top:.25rem}.mt-2{margin-top:.5rem}.mt-3{margin-top:.75rem}.mt-4{margin-top:1rem}.mt-6{margin-top:1.5rem}.mb-1{margin-bottom:.25rem}.mb-2{margin-bottom:.5rem}.mb-3{margin-bottom:.75rem}.mb-4{margin-bottom:1rem}.mb-6{margin-bottom:1.5rem}.ml-auto{margin-left:auto}.mr-2{margin-right:.5rem}.p-3{padding:.75rem}.p-4{padding:1rem}.p-5{padding:1.25rem}.p-6{padding:1.5rem}.p-8{padding:2rem}.px-3{padding-inline:.75rem}.px-4{padding-inline:1rem}.px-6{padding-inline:1.5rem}.py-1{padding-block:.25rem}.py-2{padding-block:.5rem}.py-3{padding-block:.75rem}.py-4{padding-block:1rem}.py-6{padding-block:1.5rem}.rounded-md{border-radius:.5rem}.rounded-lg{border-radius:.75rem}.rounded-xl{border-radius:1rem}.rounded-2xl{border-radius:1.25rem}.rounded-full{border-radius:9999px}.border{border:1px solid #1e293b}.border-b{border-bottom:1px solid #1e293b}.border-t{border-top:1px solid #1e293b}.bg-background\/80{background:rgba(2,6,23,.8)}.bg-card\/80{background:rgba(15,23,42,.82)}.bg-card{background:#0f172a}.bg-transparent{background:transparent}.bg-noir-gradient{background:linear-gradient(180deg,#030712,#020617)}.bg-gold-gradient{background:linear-gradient(135deg,#2563eb,#38bdf8)}.bg-gold\/10{background:rgba(37,99,235,.12)}.text-gold,.text-primary{color:#3b82f6}.text-foreground{color:#f8fafc}.text-card-foreground{color:#f8fafc}.text-muted-foreground{color:#94a3b8}.text-primary-foreground{color:#fff}.text-xs{font-size:.75rem;line-height:1rem}.text-sm{font-size:.875rem;line-height:1.25rem}.text-base{font-size:1rem;line-height:1.5rem}.text-lg{font-size:1.125rem;line-height:1.75rem}.text-xl{font-size:1.25rem;line-height:1.75rem}.text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}.text-7xl{font-size:4.5rem;line-height:1}.font-medium{font-weight:500}.font-semibold{font-weight:600}.font-bold{font-weight:700}.text-center{text-align:center}.uppercase{text-transform:uppercase}.tracking-tight{letter-spacing:-.025em}.tracking-wider{letter-spacing:.05em}.leading-none{line-height:1}.shadow{box-shadow:0 12px 34px rgba(0,0,0,.35)}.shadow-lg{box-shadow:0 20px 50px rgba(0,0,0,.4)}.backdrop-blur-md{backdrop-filter:blur(12px)}.transition,.transition-colors{transition:all .15s ease}.cursor-pointer{cursor:pointer}.hover\:opacity-90:hover{opacity:.9}.hover\:underline:hover{text-decoration:underline}.hover\:bg-card:hover{background:#0f172a}.hover\:text-foreground:hover{color:#f8fafc}input,textarea{border:1px solid #1e293b;background:transparent;color:#f8fafc;border-radius:.5rem;padding:.5rem .75rem;width:100%;outline:none}input:focus,textarea:focus{box-shadow:0 0 0 1px #2563eb}.app-shell-grid{display:grid;grid-template-columns:240px minmax(0,1fr);gap:1.5rem}.app-shell-grid>*,.dashboard-page>*,main>*{min-width:0}.app-sidebar{display:block}.app-mobile-menu{display:none}.dashboard-page{width:100%;max-width:none}.dashboard-stat-grid,.dashboard-earnings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1rem}.dashboard-stat-grid>*,.dashboard-earnings-grid>*{min-width:0}.line-clamp-2{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}@media (max-width:1180px){.app-shell-grid,.md\:grid-cols-\[240px_1fr\]{grid-template-columns:1fr!important}.app-sidebar{display:none!important}.app-mobile-menu{display:inline-flex!important}.grid[class*="xl:grid-cols-[minmax(0,1fr)_330px]"],.grid[class*="xl:grid-cols-[minmax(0,1fr)_304px]"],.grid[class*="lg:grid-cols-[1fr_420px_250px]"],.grid[class*="lg:grid-cols-[1.4fr_1fr_1fr]"]{grid-template-columns:1fr!important}}@media (max-width:920px){.app-container{max-width:calc(100vw - 24px)}.md\:grid-cols-2,.md\:grid-cols-3,.md\:grid-cols-4,.dashboard-stat-grid,.dashboard-earnings-grid{grid-template-columns:1fr!important}.flex.lg\:flex-row,.flex.md\:flex-row{flex-direction:column!important;align-items:stretch!important}.grid[class*="xl:grid-cols-[minmax(220px,1fr)_minmax(360px,420px)_minmax(190px,250px)]"]{grid-template-columns:1fr!important}}@media (max-width:640px){.app-container{max-width:calc(100vw - 16px)}.p-8{padding:1.25rem!important}.p-6{padding:1rem!important}.p-5{padding:.875rem!important}.text-3xl{font-size:1.55rem!important;line-height:2rem!important}.text-2xl{font-size:1.35rem!important;line-height:1.8rem!important}.text-xl{font-size:1.1rem!important;line-height:1.55rem!important}.sm\:grid-cols-2,.sm\:grid-cols-3,.xl\:grid-cols-5,.xl\:grid-cols-6,.grid[class*="xl:grid-cols-5"],.grid[class*="xl:grid-cols-6"]{grid-template-columns:1fr!important}.min-w-\[820px\]{min-width:680px!important}}@media (min-width:640px){.sm\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.sm\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}@media (min-width:768px){.md\:block{display:block}.md\:hidden{display:none}.md\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.md\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}.md\:grid-cols-4{grid-template-columns:repeat(4,minmax(0,1fr))}.md\:grid-cols-\[240px_1fr\]{grid-template-columns:240px minmax(0,1fr)}}@media (min-width:1280px){.xl\:grid-cols-5{grid-template-columns:repeat(5,minmax(0,1fr))}.xl\:grid-cols-6{grid-template-columns:repeat(6,minmax(0,1fr))}}
`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition">
            Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={reset} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Viral Hub" },
      { name: "description", content: "Compartilhe campanhas, monetize sua influência e construa renda recorrente com a Viral Hub." },
      { property: "og:title", content: "Viral Hub" },
      { property: "og:description", content: "Compartilhe campanhas, monetize sua influência e construa renda recorrente com a Viral Hub." },
      { property: "og:type", content: "website" },
      { property: "og:image", content: viralHubLogo },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Viral Hub" },
      { name: "twitter:description", content: "Compartilhe campanhas, monetize sua influência e construa renda recorrente com a Viral Hub." },
      { name: "twitter:image", content: viralHubLogo },
    ],
    links: [
      { rel: "icon", href: viralHubLogo },
      { rel: "apple-touch-icon", href: viralHubLogo },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
        <HeadContent />
      </head>
      <body><div id="root">{children}</div><Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
