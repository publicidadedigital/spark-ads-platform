import { Logo } from "@/components/Logo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Share2, TrendingUp, Shield, Users, Wallet, CheckCircle2, ArrowRight, Star,
} from "lucide-react";
import heroImg from "@/assets/hero-influencer.jpg";
import teamImg from "@/assets/creators-team.jpg";
import phoneImg from "@/assets/phone-dashboard.jpg";


export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  return (
    <div className="min-h-screen bg-noir-gradient">
      <Header />
      <Hero />
      <Stats />
      <Features />
      <Showcase />
      <Testimonials />
      <Plans />
      <Compliance />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50 bg-background/70">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center">
          <Logo className="h-8 w-8" textClassName="text-xl" />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#como-funciona" className="hover:text-foreground transition">Como funciona</a>
          <a href="#planos" className="hover:text-foreground transition">Planos</a>
          <a href="#compliance" className="hover:text-foreground transition">Compliance</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
          <Link to="/cadastro"><Button size="sm" className="bg-gold-gradient text-primary-foreground">Cadastrar</Button></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div className="text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Compartilhe. <span className="gold-text-gradient">Monetize.</span><br /> Construa renda.
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Viralink conecta você às melhores campanhas digitais. Compartilhe 5 publicidades por dia
            no seu Instagram e receba bonificações diárias, indicações multinível e rentabilidade de equipe.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Link to="/cadastro">
              <Button size="lg" className="bg-gold-gradient text-primary-foreground shadow-gold">
                Começar agora <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" variant="outline">Ver como funciona</Button>
            </a>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 bg-gold-gradient opacity-30 blur-3xl rounded-full" />
          <img
            src={heroImg}
            alt="Criadora de conteúdo compartilhando campanhas no Instagram"
            width={1600}
            height={1200}
            className="relative rounded-2xl shadow-elegant border border-border/50 w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}


function Stats() {
  const items = [
    { v: "200%", l: "Limite por ciclo de pacote" },
    { v: "5+10", l: "Níveis de indicação e equipe" },
    { v: "5/dia", l: "Compartilhamentos por dia" },
    { v: "385 dias", l: "Tempo médio para dobrar o pacote" },
  ];
  return (
    <section className="container mx-auto px-4 py-12 grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((i) => (
        <Card key={i.l} className="p-6 bg-card/50 border-border/50 text-center">
          <div className="text-3xl font-bold gold-text-gradient">{i.v}</div>
          <div className="text-xs text-muted-foreground mt-2">{i.l}</div>
        </Card>
      ))}
    </section>
  );
}

function Features() {
  const items = [
    { icon: Share2, t: "Campanhas curadas", d: "Receba diariamente publicidades aprovadas, com texto sugerido e instruções claras." },
    { icon: Wallet, t: "Bonificação diária", d: "Receba ganhos diários ao cumprir os 5 compartilhamentos do dia." },
    { icon: Users, t: "Programa de afiliados", d: "Indicação 20% no 1º nível, 5% do 2º ao 5º; rentabilidade de equipe 1% até o 10º nível." },
    { icon: TrendingUp, t: "Ciclo até 200%", d: "Acompanhe seu progresso até atingir o limite e renove para iniciar um novo ciclo." },
    { icon: Shield, t: "Antifraude robusto", d: "Validação de CPF, e-mail, telefone e Instagram únicos, fingerprint de dispositivo e análise manual." },
    { icon: CheckCircle2, t: "Aprovação manual", d: "Cada compartilhamento passa por análise para garantir qualidade e conformidade." },
  ];
  return (
    <section id="como-funciona" className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Tudo que você precisa para crescer</h2>
        <p className="text-muted-foreground">Plataforma completa, segura e transparente.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {items.map(({ icon: Icon, t, d }) => (
          <Card key={t} className="p-6 bg-card/50 border-border/50 hover:border-gold/40 transition">
            <Icon className="h-8 w-8 text-gold mb-4" />
            <h3 className="font-semibold mb-2">{t}</h3>
            <p className="text-sm text-muted-foreground">{d}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div className="relative order-2 md:order-1">
          <div className="absolute -inset-6 bg-gold-gradient opacity-20 blur-3xl rounded-full" />
          <img
            src={phoneImg}
            alt="Painel de ganhos do aplicativo Viralink"
            width={1200}
            height={1400}
            loading="lazy"
            className="relative rounded-2xl shadow-elegant border border-border/50 w-full object-cover"
          />
        </div>
        <div className="order-1 md:order-2">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Acompanhe seus ganhos <span className="gold-text-gradient">em tempo real</span>
          </h2>
          <p className="text-muted-foreground mb-6">
            Visualize a evolução do seu ciclo, bonificações diárias, indicações e rentabilidade de equipe
            num painel transparente, no celular ou no desktop.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> Painel diário com progresso do ciclo</li>
            <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> Extrato detalhado de bônus e indicações</li>
            <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> Solicitação de saque rápida e segura</li>
          </ul>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-10 items-center mt-24">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Uma comunidade de <span className="gold-text-gradient">criadores reais</span>
          </h2>
          <p className="text-muted-foreground mb-6">
            Milhares de criadores já fazem parte da rede Viralink, transformando o tempo nas redes sociais
            em uma nova fonte de renda — com transparência, suporte e regras claras.
          </p>
          <Link to="/cadastro">
            <Button size="lg" className="bg-gold-gradient text-primary-foreground shadow-gold">
              Fazer parte agora <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 bg-gold-gradient opacity-20 blur-3xl rounded-full" />
          <img
            src={teamImg}
            alt="Criadores de conteúdo brasileiros usando a plataforma"
            width={1600}
            height={1000}
            loading="lazy"
            className="relative rounded-2xl shadow-elegant border border-border/50 w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const depoimentos = [
    {
      nome: "Ana Clara M.",
      funcao: "Criadora de conteúdo — São Paulo",
      texto: "Entrei no Viralink há 3 meses e já recuperei o valor do pacote. Compartilho no meu Instagram de moda e o painel mostra tudo em tempo real. Super transparente!",
      nota: 5,
    },
    {
      nome: "Lucas Ribeiro",
      funcao: "Digital creator — Rio de Janeiro",
      texto: "A plataforma mudou minha rotina. Antes só postava por hobby, agora tenho uma renda extra consistente todos os dias. O suporte também é excelente.",
      nota: 5,
    },
    {
      nome: "Mariana Souza",
      funcao: "Influencer — Belo Horizonte",
      texto: "Fiquei no Inicial por 2 ciclos, depois fiz o upgrade. Hoje ganho por compartilhamento, indicação e equipe. A melhor decisão que tomei no digital.",
      nota: 5,
    },
  ];

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Quem já usa, recomenda</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Depoimentos de criadores reais que transformaram seu tempo nas redes em renda.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {depoimentos.map((d) => (
          <Card key={d.nome} className="p-6 bg-card/50 border-border/50 hover:border-primary/30 transition flex flex-col">
            <div className="mb-4">
              <div className="font-semibold">{d.nome}</div>
              <div className="text-xs text-muted-foreground">{d.funcao}</div>
              <div className="flex gap-0.5 mt-1">
                {Array.from({ length: d.nota }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 text-primary fill-primary" />
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed flex-1">
              "{d.texto}"
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Plans() {
  const items = [
    { n: "Start", v: "R$ 300", diario: "R$ 0,78", desc: "Comece a divulgar e ganhar." },
    { n: "Plus", v: "R$ 600", diario: "R$ 1,56", desc: "Mais bonificação por ciclo." },
    { n: "Pro", v: "R$ 1.200", diario: "R$ 3,12", desc: "Retorno acelerado por compartilhamento." },
    { n: "Elite", v: "R$ 5.000", diario: "R$ 13,00", desc: "Máximo potencial de ganhos." },
  ];
  return (
    <section id="planos" className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">Pacotes disponíveis</h2>
        <p className="text-muted-foreground">Escolha o pacote ideal para o seu objetivo.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {items.map((p, i) => (
          <Card key={p.n} className={`p-8 bg-card/50 border-border/50 ${i === 3 ? "border-gold/60 shadow-gold" : ""}`}>
            <div className="text-sm text-muted-foreground">Pacote {p.n}</div>
            <div className="text-4xl font-bold gold-text-gradient mt-2">{p.v}</div>
            <p className="text-sm text-muted-foreground mt-3">{p.desc}</p>
            <ul className="mt-6 space-y-2 text-sm">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold" /> Ganho diário {p.diario}</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold" /> Ciclo até 200% (≈385 dias)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold" /> 1.925 compartilhamentos para dobrar</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold" /> Programa de afiliados</li>
            </ul>
            <Link to="/cadastro" className="block mt-6">
              <Button className="w-full bg-gold-gradient text-primary-foreground">Quero esse</Button>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Compliance() {
  return (
    <section id="compliance" className="container mx-auto px-4 py-20">
      <Card className="p-8 md:p-12 bg-card/50 border-gold/30 max-w-4xl mx-auto">
        <Shield className="h-10 w-10 text-gold mb-4" />
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Transparência e regras claras</h2>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>• Bonificações dependem do cumprimento integral das regras de compartilhamento.</li>
          <li>• Não há promessa de renda garantida — ganhos variam conforme engajamento.</li>
          <li>• Cadastros falsos, múltiplas contas ou compartilhamentos fora do perfil cadastrado podem gerar bloqueio.</li>
          <li>• Você deve usar apenas o perfil Instagram cadastrado em sua conta.</li>
          <li>• A plataforma pode rejeitar compartilhamentos que não cumpram as regras.</li>
        </ul>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link to="/legal/termos"><Button variant="outline" size="sm">Termos de uso</Button></Link>
          <Link to="/legal/privacidade"><Button variant="outline" size="sm">Privacidade</Button></Link>
          <Link to="/legal/bonificacao"><Button variant="outline" size="sm">Regras de bonificação</Button></Link>
          <Link to="/legal/antifraude"><Button variant="outline" size="sm">Política antifraude</Button></Link>
        </div>
      </Card>
    </section>
  );
}

function CTA() {
  return (
    <section className="container mx-auto px-4 py-20 text-center">
      <h2 className="text-3xl md:text-5xl font-bold mb-4">Pronto para começar?</h2>
      <p className="text-muted-foreground mb-8">Crie sua conta em menos de 2 minutos.</p>
      <Link to="/cadastro">
        <Button size="lg" className="bg-gold-gradient text-primary-foreground shadow-gold">
          Criar minha conta <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50 mt-12">
      <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Viralink. Todos os direitos reservados.
      </div>
    </footer>
  );
}
