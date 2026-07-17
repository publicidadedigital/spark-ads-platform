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
import { useLanguage } from "@/lib/i18n/context";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";


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
      <Disclaimer />
      <CTA />
      <Footer />
    </div>
  );
}

function Header() {
  const { t } = useLanguage();
  return (
    <header className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50 bg-background/70">
      <div className="container mx-auto flex items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center">
          <Logo className="h-8 w-auto max-w-[140px]" textClassName="text-xl" />
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <a href="#como-funciona" className="hover:text-foreground transition">{t("nav.comoFunciona")}</a>
          <a href="#planos" className="hover:text-foreground transition">{t("nav.planos")}</a>
          <Link to="/anunciante" className="hover:text-foreground transition">{t("nav.anunciantes")}</Link>
          <a href="#compliance" className="hover:text-foreground transition">{t("nav.compliance")}</a>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to={"/login" as any}><Button variant="ghost" size="sm">{t("nav.entrar")}</Button></Link>
          <Link to={"/cadastro" as any}><Button size="sm" className="bg-gold-gradient text-primary-foreground">{t("nav.cadastrar")}</Button></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { t } = useLanguage();
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div className="text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            {t("hero.title1")} <span className="gold-text-gradient">{t("hero.title2")}</span><br /> {t("hero.title3")}
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            {t("hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
            <Link to={"/cadastro" as any}>
              <Button size="lg" className="bg-gold-gradient text-primary-foreground shadow-gold">
                {t("hero.cta")} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <a href="#como-funciona">
              <Button size="lg" variant="outline">{t("hero.ctaSecondary")}</Button>
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
  const { t } = useLanguage();
  const items = [
    { v: "200%", l: t("stats.limite") },
    { v: "5+10", l: t("stats.niveis") },
    { v: "5/dia", l: t("stats.compartilhamentos") },
    { v: "385 dias", l: t("stats.tempo") },
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
  const { t } = useLanguage();
  const items = [
    { icon: Share2, t: t("features.campanhas.t"), d: t("features.campanhas.d") },
    { icon: Wallet, t: t("features.bonificacao.t"), d: t("features.bonificacao.d") },
    { icon: Users, t: t("features.afiliados.t"), d: t("features.afiliados.d") },
    { icon: TrendingUp, t: t("features.ciclo.t"), d: t("features.ciclo.d") },
    { icon: Shield, t: t("features.antifraude.t"), d: t("features.antifraude.d") },
    { icon: CheckCircle2, t: t("features.aprovacao.t"), d: t("features.aprovacao.d") },
  ];
  return (
    <section id="como-funciona" className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">{t("features.title")}</h2>
        <p className="text-muted-foreground">{t("features.subtitle")}</p>
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
  const { t } = useLanguage();
  return (
    <section className="container mx-auto px-4 py-20">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div className="relative order-2 md:order-1">
          <div className="absolute -inset-6 bg-gold-gradient opacity-20 blur-3xl rounded-full" />
          <img
            src={phoneImg}
            alt="Painel de ganhos do aplicativo Viral Hub"
            width={1200}
            height={1400}
            loading="lazy"
            className="relative rounded-2xl shadow-elegant border border-border/50 w-full object-cover"
          />
        </div>
        <div className="order-1 md:order-2">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t("showcase.ganhos.title1")} <span className="gold-text-gradient">{t("showcase.ganhos.title2")}</span>
          </h2>
          <p className="text-muted-foreground mb-6">
            {t("showcase.ganhos.text")}
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> {t("showcase.ganhos.li1")}</li>
            <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> {t("showcase.ganhos.li2")}</li>
            <li className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> {t("showcase.ganhos.li3")}</li>
          </ul>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-10 items-center mt-24">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t("showcase.comunidade.title1")} <span className="gold-text-gradient">{t("showcase.comunidade.title2")}</span>
          </h2>
          <p className="text-muted-foreground mb-6">
            {t("showcase.comunidade.text")}
          </p>
          <Link to={"/cadastro" as any}>
            <Button size="lg" className="bg-gold-gradient text-primary-foreground shadow-gold">
              {t("showcase.comunidade.cta")} <ArrowRight className="ml-2 h-4 w-4" />
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
  const { t } = useLanguage();
  const depoimentos = [
    {
      nome: t("testimonials.1.nome"),
      funcao: t("testimonials.1.funcao"),
      texto: t("testimonials.1.texto"),
      nota: 5,
    },
    {
      nome: t("testimonials.2.nome"),
      funcao: t("testimonials.2.funcao"),
      texto: t("testimonials.2.texto"),
      nota: 5,
    },
    {
      nome: t("testimonials.3.nome"),
      funcao: t("testimonials.3.funcao"),
      texto: t("testimonials.3.texto"),
      nota: 5,
    },
  ];

  return (
    <section className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">{t("testimonials.title")}</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          {t("testimonials.subtitle")}
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
  const { t } = useLanguage();
  const items = [
    { n: "Start", v: "$ 70", diario: "$ 0.18", desc: t("plans.start.desc") },
    { n: "Plus", v: "$ 130", diario: "$ 0.34", desc: t("plans.plus.desc") },
    { n: "Pro", v: "$ 310", diario: "$ 0.81", desc: t("plans.pro.desc") },
    { n: "Elite", v: "$ 1,010", diario: "$ 2.63", desc: t("plans.elite.desc") },
  ];
  return (
    <section id="planos" className="container mx-auto px-4 py-20">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-bold mb-3">{t("plans.title")}</h2>
        <p className="text-muted-foreground">{t("plans.subtitle")}</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {items.map((p, i) => (
          <Card key={p.n} className={`p-8 bg-card/50 border-border/50 ${i === 3 ? "border-gold/60 shadow-gold" : ""}`}>
            <div className="text-sm text-muted-foreground">{t("plans.pacote")} {p.n}</div>
            <div className="text-4xl font-bold gold-text-gradient mt-2">{p.v}</div>
            <p className="text-sm text-muted-foreground mt-3">{p.desc}</p>
            <ul className="mt-6 space-y-2 text-sm">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold" /> {t("plans.ganhoDiario")} {p.diario}</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold" /> {t("plans.bonusAte")}</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold" /> {t("plans.cursoExclusivo")} {p.n}</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold" /> {t("plans.afiliados")}</li>
            </ul>
            <Link to={"/cadastro" as any} className="block mt-6">
              <Button className="w-full bg-gold-gradient text-primary-foreground">{t("plans.cta")}</Button>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Compliance() {
  const { t } = useLanguage();
  return (
    <section id="compliance" className="container mx-auto px-4 py-20">
      <Card className="p-8 md:p-12 bg-card/50 border-gold/30 max-w-4xl mx-auto">
        <Shield className="h-10 w-10 text-gold mb-4" />
        <h2 className="text-2xl md:text-3xl font-bold mb-4">{t("compliance.title")}</h2>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>• {t("compliance.li1")}</li>
          <li>• {t("compliance.li2")}</li>
          <li>• {t("compliance.li3")}</li>
          <li>• {t("compliance.li4")}</li>
          <li>• {t("compliance.li5")}</li>
        </ul>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link to="/legal/termos"><Button variant="outline" size="sm">{t("legal.termos")}</Button></Link>
          <Link to="/legal/privacidade"><Button variant="outline" size="sm">{t("legal.privacidade")}</Button></Link>
          <Link to="/legal/bonificacao"><Button variant="outline" size="sm">{t("legal.bonificacao")}</Button></Link>
          <Link to="/legal/antifraude"><Button variant="outline" size="sm">{t("legal.antifraude")}</Button></Link>
        </div>
      </Card>
    </section>
  );
}

function Disclaimer() {
  const { t } = useLanguage();
  return (
    <section id="disclaimer" className="container mx-auto px-4 py-20">
      <Card className="p-8 md:p-12 bg-card/50 border-border/50 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-8 w-8 text-muted-foreground" />
          <h2 className="text-2xl md:text-3xl font-bold">{t("disclaimer.title")}</h2>
        </div>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>{t("disclaimer.p1")}</p>
          <p>{t("disclaimer.p2")}</p>
          <p>{t("disclaimer.p3")}</p>
          <p>{t("disclaimer.p4")}</p>
        </div>
        <div className="flex flex-wrap gap-3 mt-6">
          <Link to="/legal/termos"><Button variant="outline" size="sm">{t("legal.termos")}</Button></Link>
          <Link to="/legal/bonificacao"><Button variant="outline" size="sm">{t("legal.bonificacao")}</Button></Link>
          <Link to="/legal/privacidade"><Button variant="outline" size="sm">{t("legal.privacidade")}</Button></Link>
        </div>
      </Card>
    </section>
  );
}

function CTA() {
  const { t } = useLanguage();
  return (
    <section className="container mx-auto px-4 py-20 text-center">
      <h2 className="text-3xl md:text-5xl font-bold mb-4">{t("cta.title")}</h2>
      <p className="text-muted-foreground mb-8">{t("cta.subtitle")}</p>
      <Link to={"/cadastro" as any}>
        <Button size="lg" className="bg-gold-gradient text-primary-foreground shadow-gold">
          {t("cta.button")} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Link>
      <p className="text-xs text-muted-foreground mt-8 max-w-2xl mx-auto">
        {t("cta.disclaimer1")} <a href="#disclaimer" className="underline hover:text-foreground">{t("cta.disclaimerLink")}</a>.
      </p>
    </section>
  );
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-border/50 mt-12">
      <div className="container mx-auto px-4 py-8 space-y-3 text-center text-xs text-muted-foreground">
        <p className="max-w-3xl mx-auto">
          {t("footer.disclaimer")}
        </p>
        <p>© {new Date().getFullYear()} Viral Hub. {t("footer.rights")}</p>
      </div>
    </footer>
  );
}
