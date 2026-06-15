import { Logo } from "@/components/Logo";
import { ExchangeRateTicker } from "@/components/ExchangeRateTicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Building2, Globe2, MapPin, Megaphone, Users } from "lucide-react";

export const Route = createFileRoute("/anunciante")({ component: AdvertiserPage });

const packages = [
  { name: "Launch", value: "US$ 10", reach: "≈ 1.000 visualizacoes" },
  { name: "Boost", value: "US$ 100", reach: "≈ 10.000 visualizacoes" },
  { name: "Scale", value: "US$ 1.000", reach: "≈ 100.000 visualizacoes" },
  { name: "Dominance", value: "US$ 4.000", reach: "≈ 400.000 visualizacoes" },
  { name: "Viral", value: "US$ 10.000+", reach: "1.000.000+ visualizacoes" },
];

function AdvertiserPage() {
  return (
    <main className="min-h-screen bg-noir-gradient">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/"><Logo className="h-9 w-auto max-w-[155px]" textClassName="text-xl" /></Link>
          <div className="flex items-center gap-2">
            <ExchangeRateTicker />
            <Link to="/anunciante-login"><Button variant="ghost">Entrar</Button></Link>
            <Link to="/cadastro" search={{ tipo: "anunciante", ref: "" }}>
              <Button className="bg-gold-gradient text-primary-foreground">Criar conta PJ</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="grid lg:grid-cols-[1.45fr_.75fr] gap-6 items-stretch">
          <div>
            <p className="text-sm uppercase tracking-widest text-gold mb-4">Painel do anunciante</p>
            <h1 className="text-4xl md:text-6xl font-bold max-w-4xl">
              Impulsione sua marca com divulgacao social real
            </h1>
            <p className="text-lg text-muted-foreground mt-6 max-w-3xl">
              Compre campanhas em dolar, envie criativos para analise e acompanhe a expectativa estimada
              de entrega por regiao, Instagram e X/Twitter.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link to="/cadastro" search={{ tipo: "anunciante", ref: "" }}>
                <Button size="lg" className="bg-gold-gradient text-primary-foreground">Criar conta PJ</Button>
              </Link>
              <a href="#pacotes"><Button size="lg" variant="outline">Ver pacotes</Button></a>
            </div>
          </div>

          <Card className="p-6 bg-card/60 border-border/60">
            <h2 className="font-semibold text-xl mb-5">Como funciona</h2>
            {[
              "Crie sua conta de anunciante com CNPJ.",
              "Escolha um pacote publicitario.",
              "Pague e envie a campanha para analise.",
              "Acompanhe metricas e entregas estimadas.",
            ].map((step, index) => (
              <div key={step} className="flex gap-3 py-3 border-b border-border/40 last:border-0">
                <span className="h-8 w-8 shrink-0 grid place-items-center rounded bg-primary/15 text-gold font-semibold">{index + 1}</span>
                <p className="text-muted-foreground">{step}</p>
              </div>
            ))}
          </Card>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
          {[
            [Globe2, "Instagram + X", "Redes sociais suportadas"],
            [MapPin, "Segmentacao", "Entrega regional por CEP"],
            [Users, "50%", "Comissao para revendedores"],
            [BarChart3, "Tempo real", "Metricas de expectativa estimada"],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as typeof Globe2;
            return (
              <Card key={String(title)} className="p-5 bg-card/50 border-border/50">
                <FeatureIcon className="h-6 w-6 text-gold mb-4" />
                <strong className="text-xl block">{String(title)}</strong>
                <span className="text-sm text-muted-foreground">{String(text)}</span>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="pacotes" className="container mx-auto px-4 pb-20">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold">Pacotes publicitarios</h2>
            <p className="text-muted-foreground mt-2">Visualizacoes sao expectativas estimadas, nao garantia.</p>
          </div>
          <Megaphone className="h-8 w-8 text-gold hidden sm:block" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {packages.map((item) => (
            <Card key={item.name} className="p-5 bg-card/60 border-border/50 flex flex-col min-h-56">
              <h3 className="font-semibold text-lg">{item.name}</h3>
              <strong className="text-3xl gold-text-gradient mt-4">{item.value}</strong>
              <span className="text-sm text-muted-foreground mt-2">{item.reach}</span>
              <Link className="mt-auto" to="/cadastro" search={{ tipo: "anunciante", ref: "" }}>
                <Button className="w-full bg-gold-gradient text-primary-foreground">Comprar</Button>
              </Link>
            </Card>
          ))}
        </div>
        <Card className="mt-6 p-6 bg-card/50 border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-4">
            <Building2 className="h-7 w-7 text-gold shrink-0" />
            <div>
              <h3 className="font-semibold">Precisa de uma campanha maior?</h3>
              <p className="text-sm text-muted-foreground">Solicite um plano Enterprise personalizado ao suporte comercial.</p>
            </div>
          </div>
          <Link to="/cadastro" search={{ tipo: "anunciante", ref: "" }}><Button variant="outline">Falar com comercial</Button></Link>
        </Card>
      </section>
    </main>
  );
}
