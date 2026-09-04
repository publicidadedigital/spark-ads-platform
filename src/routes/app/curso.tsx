import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, ChevronDown, ChevronRight, CheckCircle2, GraduationCap,
  Instagram, TrendingUp, Rocket, Users, Star, Lightbulb, Target,
  Share2, DollarSign, ShieldCheck, Clock, Megaphone, Zap, MessageCircle, MousePointerClick,
} from "lucide-react";

export const Route = createFileRoute("/app/curso")({ component: CursoPage });

type Lesson = {
  title: string;
  content: string[];
  tips?: string[];
  icon?: React.ElementType;
};

type Module = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  lessons: Lesson[];
};

const MODULES: Module[] = [
  {
    id: "plataforma",
    title: "Módulo 1 — Como usar a plataforma Spark Ads",
    description: "Aprenda a navegar, compartilhar campanhas e receber seus bônus diários.",
    icon: Rocket,
    color: "#2563eb",
    lessons: [
      {
        title: "O que é a Spark Ads e como funciona",
        icon: Star,
        content: [
          "A Spark Ads é uma plataforma de marketing colaborativo onde você divulga campanhas de marcas parceiras no Instagram e recebe bônus diários por isso.",
          "O modelo é simples: você adquire um pacote, compartilha publicações no Instagram todos os dias e ganha bônus enquanto mantém o pacote ativo.",
          "Cada pacote tem um bônus diário diferente. Quanto maior o pacote, maior o bônus que você recebe por dia.",
          "Além do bônus diário, você também ganha bônus de adesão ao indicar pessoas para a plataforma.",
        ],
        tips: [
          "Acesse a plataforma todos os dias para não perder o bônus diário.",
          "Quanto mais consistente você for, mais rápido acumula saldo para saque.",
        ],
      },
      {
        title: "Ativando seu pacote",
        icon: Rocket,
        content: [
          "Para começar a ganhar bônus, você precisa ter um pacote ativo. Acesse o menu 'Pacotes' e escolha o plano ideal para você.",
          "Os pacotes disponíveis são: Beginner ($20), Start ($70), Plus ($130), Pro ($310) e Elite ($1.010).",
          "Após escolher o pacote, clique em 'Contratar agora' e você será redirecionado para o checkout seguro via Cakto.",
          "Após o pagamento confirmado, seu ciclo é ativado automaticamente e você já pode começar a compartilhar campanhas.",
        ],
        tips: [
          "Comece pelo Beginner se quiser testar antes de investir mais.",
          "Pacotes maiores têm bônus diários maiores e maior limite de ganho por ciclo.",
        ],
      },
      {
        title: "Como compartilhar campanhas e enviar a prova",
        icon: Share2,
        content: [
          "Acesse o menu 'Campanhas' para ver todas as campanhas disponíveis no momento.",
          "Escolha uma campanha, baixe a imagem ou vídeo e poste no seu Instagram (feed ou stories).",
          "Após publicar, copie o link da publicação no Instagram e cole no campo 'Link da publicação' dentro da campanha.",
          "Selecione se foi Feed ou Stories e clique em 'Enviar para análise'.",
          "Sua publicação será analisada. Após aprovação, ela conta para o seu bônus do dia.",
          "Você precisa ter 5 publicações aprovadas no dia para receber o bônus diário completo.",
        ],
        tips: [
          "Publique de manhã para ter tempo de corrigir eventuais rejeições no mesmo dia.",
          "Sempre use o link da campanha na legenda ou bio para facilitar a aprovação.",
          "Nunca apague a publicação antes do período de monitoramento acabar.",
        ],
      },
      {
        title: "Entendendo seu saldo e fazendo saques",
        icon: DollarSign,
        content: [
          "Seu saldo fica visível no painel principal. Ele é dividido em 'Saldo disponível' e 'Saldo a liberar'.",
          "O saldo a liberar vai se tornando disponível conforme o ciclo avança e os bônus são creditados.",
          "Para sacar, acesse o menu 'Saque', preencha seus dados de pagamento e solicite o valor desejado.",
          "O valor mínimo para saque é de $50. Os saques são processados em até 3 dias úteis.",
          "Acompanhe seu histórico completo de ganhos e saques no menu 'Extrato'.",
        ],
        tips: [
          "Mantenha seus dados de pagamento sempre atualizados no perfil.",
          "Solicite o saque somente quando tiver saldo disponível suficiente.",
        ],
      },
    ],
  },
  {
    id: "instagram",
    title: "Módulo 2 — Marketing no Instagram",
    description: "Aprenda a usar o Instagram de forma estratégica para maximizar seu alcance.",
    icon: Instagram,
    color: "#e1306c",
    lessons: [
      {
        title: "Otimizando seu perfil no Instagram",
        icon: Star,
        content: [
          "Um perfil profissional atrai mais seguidores e transmite credibilidade. Use uma foto clara e um nome fácil de encontrar.",
          "Escreva uma bio objetiva que explique quem você é e o que você compartilha. Use palavras-chave do seu nicho.",
          "Adicione um link na bio — pode ser o link da campanha atual ou seu link de indicação da Spark Ads.",
          "Mantenha o perfil público para que as publicações possam ser verificadas pela plataforma.",
          "Use destaques no Stories para organizar conteúdos importantes e facilitar a navegação dos seus seguidores.",
        ],
        tips: [
          "Troque a foto de perfil para uma foto real e profissional — perfis com foto de rosto têm mais confiança.",
          "Revise sua bio a cada mês para mantê-la atual.",
        ],
      },
      {
        title: "Como criar publicações que engajam",
        icon: TrendingUp,
        content: [
          "Posts de qualidade geram mais curtidas, comentários e compartilhamentos — isso aumenta seu alcance orgânico.",
          "Use imagens de alta resolução e bem iluminadas. O Instagram valoriza conteúdo visual bonito.",
          "Escreva legendas que gerem interação: faça perguntas, peça opiniões ou use chamadas para ação (CTA).",
          "Use de 5 a 10 hashtags relevantes ao seu nicho. Evite hashtags genéricas com milhões de posts.",
          "Publique nos horários em que seu público está mais ativo — geralmente entre 18h e 21h.",
          "Stories diários mantêm seu perfil ativo e aparecem primeiro para seus seguidores.",
        ],
        tips: [
          "Responda todos os comentários — isso aumenta o alcance do post pelo algoritmo.",
          "Use o recurso de 'Enquete' nos Stories para aumentar o engajamento rapidamente.",
        ],
      },
      {
        title: "Crescendo seus seguidores organicamente",
        icon: Users,
        content: [
          "Consistência é a chave: perfis que publicam diariamente crescem muito mais rápido.",
          "Interaja com perfis do seu nicho: curta, comente e responda Stories de outros criadores.",
          "Faça parcerias com outros usuários para aparecer no perfil deles (collabs e reposts).",
          "Use o Reels — o Instagram prioriza o formato de vídeo curto no algoritmo e entrega para novos públicos.",
          "Analise suas métricas toda semana: veja quais posts tiveram mais alcance e repita o formato.",
          "Nunca compre seguidores — isso prejudica o engajamento e pode banir sua conta.",
        ],
        tips: [
          "Crie séries de conteúdo (ex: 'Dica da semana') para fidelizar seguidores.",
          "Salve as mídias das campanhas e re-edite com seu estilo antes de postar.",
        ],
      },
      {
        title: "Usando Stories e Reels a seu favor",
        icon: Megaphone,
        content: [
          "Stories desaparecem em 24h mas são muito visualizados. Use para conteúdo do dia a dia e campanhas rápidas.",
          "Reels têm alcance muito maior que posts normais. Crie Reels curtos (15-30 segundos) e dinâmicos.",
          "Use música popular nos Reels — o algoritmo favorece áudios em tendência.",
          "Adicione legendas nos vídeos: muitas pessoas assistem sem som.",
          "Marque localizações e use as hashtags nos Stories para aumentar a descoberta.",
          "Compartilhe os Reels também nos Stories para amplificar o alcance.",
        ],
        tips: [
          "Grave um Reels mostrando como você usa a plataforma — conteúdo autêntico performa muito bem.",
          "Use o recurso 'Colaboração' para aparecer no feed de outro criador ao mesmo tempo.",
        ],
      },
    ],
  },
  {
    id: "empreendedorismo",
    title: "Módulo 3 — Empreendedorismo Digital",
    description: "Desenvolva a mentalidade e as habilidades de quem constrói renda online.",
    icon: TrendingUp,
    color: "#7c3aed",
    lessons: [
      {
        title: "Mentalidade empreendedora",
        icon: Lightbulb,
        content: [
          "Empreender digitalmente exige disciplina, consistência e foco em resultados de longo prazo.",
          "Todo negócio online começa pequeno. O segredo é começar, aprender com os erros e melhorar continuamente.",
          "Defina metas claras: quanto você quer ganhar por mês? Quantas horas vai dedicar por dia?",
          "Investir em conhecimento é sempre rentável. Quem aprende mais, ganha mais.",
          "Não compare seu começo com o meio da jornada de outra pessoa. Cada trajetória é única.",
          "Celebre cada conquista — uma meta atingida, um saque realizado, um novo indicado.",
        ],
        tips: [
          "Reserve 30 minutos por dia para estudar marketing e empreendedorismo.",
          "Anote seus objetivos em um lugar visível para se lembrar deles todos os dias.",
        ],
      },
      {
        title: "Construindo múltiplas fontes de renda",
        icon: DollarSign,
        content: [
          "Depender de uma única fonte de renda é arriscado. O empreendedor digital diversifica seus ganhos.",
          "Com a Spark Ads, você tem 3 fontes: bônus diário de campanhas, bônus de indicação direta e bônus residual de rede.",
          "Fora da plataforma, você pode explorar: venda de infoprodutos, dropshipping, prestação de serviços online, cursos.",
          "O bônus de indicação é uma fonte poderosa — cada pessoa que você indicar e ativar gera bônus para você.",
          "Reinvista parte dos seus ganhos para crescer: upgrade de pacote, cursos, ferramentas.",
        ],
        tips: [
          "Automatize o que puder: agende posts, use ferramentas de gestão e foque no que gera mais resultado.",
          "Calcule quanto você ganha por hora de trabalho — isso te ajuda a priorizar as atividades certas.",
        ],
      },
      {
        title: "Gestão financeira pessoal",
        icon: Target,
        content: [
          "Controle seus gastos e saiba exatamente quanto entra e sai da sua conta todo mês.",
          "Crie uma reserva de emergência antes de reinvestir. O ideal é ter pelo menos 3 meses de despesas guardados.",
          "Separe as contas: renda digital é diferente da renda do emprego. Organize cada entrada em categorias.",
          "Defina um percentual fixo para reinvestir no negócio (ex: 20% dos ganhos).",
          "Use aplicativos de controle financeiro como Mobills, GuiaBolso ou uma planilha simples.",
          "Pague seus impostos corretamente — isso evita problemas futuros e te permite crescer com tranquilidade.",
        ],
        tips: [
          "Regra básica: nunca gaste mais do que ganha. Parece óbvio, mas poucos praticam.",
          "Antes de comprar algo, pergunte: isso me gera dinheiro ou me custa dinheiro?",
        ],
      },
      {
        title: "Produtividade e organização para trabalhar online",
        icon: Clock,
        content: [
          "Trabalhar em casa exige disciplina. Defina horários fixos para suas atividades digitais.",
          "Use a técnica Pomodoro: 25 minutos de foco total, 5 minutos de pausa. Isso aumenta muito a produtividade.",
          "Crie uma lista de tarefas diárias e marque o que for concluído. A sensação de progresso motiva.",
          "Elimine distrações: desligue notificações desnecessárias durante o tempo de trabalho.",
          "Organize seu espaço de trabalho — um ambiente limpo e organizado melhora o foco.",
          "Aprenda a dizer não para atividades que não te aproximam dos seus objetivos.",
        ],
        tips: [
          "Comece o dia pela tarefa mais importante — isso garante que o essencial seja feito.",
          "Revise seus resultados toda semana e ajuste a estratégia conforme necessário.",
        ],
      },
    ],
  },
  {
    id: "copywriting",
    title: "Módulo 5 — Copywriting e Comunicação Persuasiva",
    description: "Aprenda a escrever legendas que vendem, mensagens que convertem e histórias que atraem indicados.",
    icon: Zap,
    color: "#f59e0b",
    lessons: [
      {
        title: "O que é copywriting e por que ele muda tudo",
        icon: Star,
        content: [
          "Copywriting é a arte de escrever textos que persuadem e levam o leitor a tomar uma ação — curtir, comentar, clicar, comprar ou se cadastrar.",
          "Não é sobre enganar ninguém. É sobre comunicar o valor certo, para a pessoa certa, no momento certo.",
          "Bons copies (textos persuasivos) aumentam o alcance dos seus posts, melhoram o engajamento e atraem mais indicados naturalmente.",
          "Qualquer pessoa pode aprender copywriting. É uma habilidade treinável, não um dom.",
          "Quem aprende a escrever bem nas redes sociais tem uma vantagem enorme sobre a concorrência.",
        ],
        tips: [
          "Leia os posts dos perfis que você mais admira e tente identificar o que torna o texto deles tão atraente.",
          "Escreva todos os dias, mesmo que seja pouco. A habilidade vem com a prática.",
        ],
      },
      {
        title: "Como escrever legendas que geram engajamento",
        icon: MessageCircle,
        content: [
          "A primeira linha da legenda é a mais importante — ela aparece antes do 'ver mais' e decide se a pessoa vai continuar lendo.",
          "Comece com uma pergunta, uma afirmação ousada ou um número: 'Você sabia que 90% das pessoas...', 'O erro que quase me fez desistir...'",
          "Use a estrutura AIDA: Atenção → Interesse → Desejo → Ação.",
          "Conte uma mini-história: todo post com narrativa pessoal gera mais conexão do que posts genéricos.",
          "Termine sempre com uma chamada para ação (CTA): 'Comenta aqui', 'Salva esse post', 'Me manda mensagem'.",
          "Use espaços e emojis estratégicos para tornar o texto mais fácil de ler no celular.",
        ],
        tips: [
          "Evite legendas genéricas como 'Confira nosso produto'. Seja específico e humano.",
          "Salve as legendas que performaram bem para reutilizar como modelo.",
        ],
      },
      {
        title: "Storytelling — contar histórias que vendem",
        icon: BookOpen,
        content: [
          "Storytelling é a técnica de usar histórias para conectar emocionalmente com o público e comunicar uma mensagem.",
          "Histórias ativam o cérebro de forma diferente de dados e fatos — elas criam empatia e memória.",
          "Estrutura básica de uma boa história: Situação → Conflito → Virada → Resultado.",
          "Exemplo: 'Antes de entrar na Spark Ads eu estava [situação difícil]. Então descobri a plataforma e [o que mudou]. Hoje [resultado positivo].'",
          "Não precisa inventar — sua própria jornada é a melhor história que você pode contar.",
          "Use detalhes reais e específicos: eles tornam a história mais crível e envolvente.",
        ],
        tips: [
          "Escreva sua história de transformação com a Spark Ads e use em posts, stories e abordagens.",
          "Quanto mais vulnerável e honesta a história, mais as pessoas se identificam.",
        ],
      },
      {
        title: "Palavras e gatilhos que aumentam a conversão",
        icon: Target,
        content: [
          "Gatilhos mentais são atalhos que o cérebro usa para tomar decisões. Usá-los eticamente acelera resultados.",
          "Gatilho da Escassez: 'Últimas vagas', 'Só até hoje'. Cria urgência real.",
          "Gatilho da Prova Social: 'Mais de 500 pessoas já entraram', 'Veja o que fulano conquistou'. Reduz o medo de errar.",
          "Gatilho da Autoridade: Mostre resultados reais, extratos, prints. Quem prova tem credibilidade.",
          "Gatilho da Reciprocidade: Entregue valor antes de pedir. Quem recebe algo sente vontade de retribuir.",
          "Gatilho da Curiosidade: 'O segredo que poucos sabem', 'O erro que eu cometi no começo'. Estimula o clique.",
          "Palavras que convertem: grátis, exclusivo, agora, comprovado, simples, você, resultado, rápido.",
        ],
        tips: [
          "Nunca use gatilhos de forma desonesta — isso destrói a confiança e a sua reputação.",
          "Teste diferentes abordagens e veja qual gera mais engajamento no seu perfil.",
        ],
      },
    ],
  },
  {
    id: "trafego-pago",
    title: "Módulo 6 — Tráfego Pago para Iniciantes",
    description: "Aprenda a criar anúncios no Instagram e Facebook para crescer sua rede mais rápido.",
    icon: MousePointerClick,
    color: "#0ea5e9",
    lessons: [
      {
        title: "O que é tráfego pago e como funciona",
        icon: TrendingUp,
        content: [
          "Tráfego pago é quando você investe dinheiro para exibir seus posts/anúncios para um público específico.",
          "Diferente do tráfego orgânico (que depende do algoritmo), o tráfego pago entrega seus conteúdos para quem você escolhe — por idade, cidade, interesse, comportamento.",
          "As principais plataformas são: Meta Ads (Instagram + Facebook), TikTok Ads e Google Ads.",
          "Para divulgar seu link de indicação da Spark Ads, o Meta Ads é o mais indicado por ter o perfil certo de público.",
          "Você não precisa de muito dinheiro para começar — R$10 a R$20 por dia já traz resultados visíveis.",
        ],
        tips: [
          "Antes de investir em tráfego, tenha um perfil profissional e uma boa oferta preparada.",
          "Comece pequeno, teste, aprenda e depois escale o que funciona.",
        ],
      },
      {
        title: "Criando sua primeira campanha no Meta Ads",
        icon: Megaphone,
        content: [
          "Acesse o Gerenciador de Anúncios em business.facebook.com e crie uma conta de anúncios.",
          "Escolha o objetivo da campanha: para indicações, use 'Tráfego' (direciona para seu link) ou 'Geração de Cadastros'.",
          "Defina seu público: comece com pessoas de 25 a 45 anos, interessadas em 'renda extra', 'empreendedorismo', 'marketing digital'.",
          "Selecione os posicionamentos: Instagram Feed e Stories são os mais eficazes para esse público.",
          "Defina o orçamento diário (R$10 a R$30 para começar) e o período da campanha.",
          "Crie o criativo: use uma imagem ou vídeo curto com um texto direto sobre a oportunidade.",
        ],
        tips: [
          "Nunca anuncie sem ter uma landing page ou perfil otimizado para receber o público.",
          "Deixe o anúncio rodar pelo menos 3 dias antes de julgar os resultados — o algoritmo precisa de tempo para aprender.",
        ],
      },
      {
        title: "Criando anúncios que convertem",
        icon: Zap,
        content: [
          "Um bom anúncio tem 3 elementos: imagem/vídeo que para o scroll, texto que desperta interesse e CTA claro.",
          "Use vídeos curtos (15 a 30 segundos) mostrando seu resultado real — extratos, depoimentos, rotina.",
          "O texto do anúncio deve começar com a dor ou desejo do público: 'Procurando uma renda extra sem sair de casa?'",
          "Use prova social no texto: 'Mais de 500 pessoas já estão ganhando com isso'.",
          "O botão de ação (CTA) deve ser direto: 'Saiba mais', 'Cadastre-se', 'Fale comigo'.",
          "Teste pelo menos 2 variações de criativo para ver qual performa melhor (teste A/B).",
        ],
        tips: [
          "Imagens com pessoas reais convertem mais do que artes genéricas.",
          "Evite textos longos no criativo — menos é mais no anúncio.",
        ],
      },
      {
        title: "Analisando resultados e otimizando",
        icon: Target,
        content: [
          "As métricas mais importantes para indicações são: CPC (custo por clique), CTR (taxa de clique) e CPL (custo por lead).",
          "CTR acima de 1% é bom. Se estiver abaixo, melhore o criativo.",
          "Se o CPC estiver alto, tente segmentações mais específicas ou mude o criativo.",
          "Desligue anúncios que não performam após 3-5 dias. Escale os que funcionam aumentando o orçamento gradualmente.",
          "Analise os resultados pelo menos 3 vezes por semana e faça ajustes baseados nos dados.",
          "Não mude tudo de uma vez — altere um elemento por vez para saber o que gerou a melhora.",
        ],
        tips: [
          "Instale o Pixel do Facebook no seu site ou landing page para rastrear conversões com precisão.",
          "Com o tempo, o algoritmo aprende quem converte e entrega seus anúncios para pessoas mais qualificadas.",
        ],
      },
    ],
  },
  {
    id: "vendas-whatsapp",
    title: "Módulo 7 — Vendas pelo WhatsApp",
    description: "Scripts prontos, como abordar leads, superar objeções e fechar indicações pelo WhatsApp.",
    icon: MessageCircle,
    color: "#22c55e",
    lessons: [
      {
        title: "Por que o WhatsApp é a melhor ferramenta de vendas",
        icon: Star,
        content: [
          "O WhatsApp tem mais de 2 bilhões de usuários e é o app mais usado no Brasil. Ignorá-lo é deixar dinheiro na mesa.",
          "A taxa de abertura de mensagens no WhatsApp é de 98% — muito acima do e-mail ou de qualquer outra rede social.",
          "É uma ferramenta pessoal: a conversa é um a um, o que cria confiança e facilita a decisão de compra.",
          "Com o WhatsApp Business, você profissionaliza a comunicação com catálogo, respostas automáticas e etiquetas.",
          "Grupos e listas de transmissão permitem escalar a comunicação sem perder o toque pessoal.",
        ],
        tips: [
          "Use o WhatsApp Business separado do seu pessoal — isso mantém o profissionalismo.",
          "Configure uma mensagem de saudação automática para não deixar ninguém sem resposta.",
        ],
      },
      {
        title: "Como abordar um lead pelo WhatsApp",
        icon: MessageCircle,
        content: [
          "A abordagem é o momento mais crítico. Uma mensagem errada fecha a porta antes mesmo de abrir.",
          "Nunca comece com o produto. Comece gerando curiosidade ou com uma pergunta sobre a situação da pessoa.",
          "Script de abordagem fria: 'Oi [nome], tudo bem? Vi seu perfil e acredito que tenho algo que pode te interessar. Posso compartilhar?'",
          "Script para leads quentes (que viram seu post): 'Oi [nome], obrigado pelo interesse! Você viu meu post sobre renda extra, certo? Me conta um pouco sobre sua situação.'",
          "Sempre peça permissão antes de enviar informações — isso evita bloqueios e aumenta a receptividade.",
          "Personalize a mensagem com o nome da pessoa e uma referência a algo que ela postou ou comentou.",
        ],
        tips: [
          "Nunca copie e cole a mesma mensagem para todo mundo — as pessoas percebem e ignoram.",
          "Se não responder em 24h, mande um follow-up gentil: 'Oi [nome], só passando para ver se recebeu minha mensagem!'",
        ],
      },
      {
        title: "Scripts prontos para apresentar a oportunidade",
        icon: Share2,
        content: [
          "Após a permissão, apresente a oportunidade de forma clara, simples e sem exageros.",
          "Script básico: 'A Spark Ads é uma plataforma onde você compartilha publicidades de marcas no seu Instagram e recebe bônus diários por isso. O investimento inicial é de $20 (plano Beginner) e você pode sacar a partir de $50.'",
          "Envie prints ou prints de saque logo após a apresentação — prova social é o melhor argumento.",
          "Não envie um áudio longo no primeiro contato. Use texto curto e direto, depois ofereça um áudio para quem quiser mais detalhes.",
          "Após apresentar, faça uma pergunta: 'Faz sentido pra você? Quer saber mais sobre como funciona o dia a dia?'",
          "Script com storytelling: 'Antes de entrar, eu também tinha dúvidas. Mas após [X dias], já recebi meu primeiro bônus de [valor]. Me surpreendeu muito.'",
        ],
        tips: [
          "Tenha um mini-vídeo seu (30-60s) explicando a plataforma para enviar aos interessados.",
          "Crie um catálogo no WhatsApp Business com os planos e valores para facilitar a visualização.",
        ],
      },
      {
        title: "Como superar objeções e fechar a indicação",
        icon: Target,
        content: [
          "Objeção não é recusa — é pedido de mais informação. Quem objeta ainda está considerando.",
          "'Parece golpe / pirâmide': 'Entendo sua preocupação. A diferença é que aqui você recebe por um trabalho real: divulgar publicidades. Sem exageros, sem promessas falsas.'",
          "'Não tenho dinheiro agora': 'O plano Beginner é de $20. Se isso ainda for difícil, posso te explicar como começar a se preparar para entrar em breve.'",
          "'Não tenho seguidores': 'Você não precisa de muitos seguidores, só precisa de um perfil público e real. Eu mesmo comecei com poucos.'",
          "'Não tenho tempo': 'São apenas 5 publicações por dia, em qualquer horário. Muita gente faz em menos de 20 minutos.'",
          "Após responder uma objeção, sempre faça uma pergunta de avanço: 'Isso faz sentido pra você? Tem mais alguma dúvida?'",
          "Fechamento: 'Você está pronto pra começar? Posso te passar o link agora e você já consegue ativar hoje mesmo.'",
        ],
        tips: [
          "Nunca pressione. Se a pessoa não quiser agora, respeite e mantenha o relacionamento.",
          "Quem disse não hoje pode dizer sim daqui a 30 dias. Mantenha contato com conteúdo de valor.",
        ],
      },
    ],
  },
  {
    id: "vendas-afiliados",
    title: "Módulo 8 — Vendas e Programa de Afiliados",
    description: "Aprenda a indicar pessoas, construir sua rede e multiplicar seus ganhos.",
    icon: Users,
    color: "#059669",
    lessons: [
      {
        title: "Entendendo o programa de afiliados da Spark Ads",
        icon: Share2,
        content: [
          "O programa de afiliados da Spark Ads permite que você ganhe bônus ao indicar novas pessoas para a plataforma.",
          "Quando um indicado seu ativa um pacote, você recebe um bônus de adesão imediato.",
          "Além disso, você recebe bônus residuais pelos ganhos dos seus indicados diretos e indiretos (até 3 níveis).",
          "Nível 1 (indicados diretos): maior percentual de bônus.",
          "Nível 2 (indicados dos seus indicados): percentual intermediário.",
          "Nível 3 (rede ampliada): percentual menor, mas escalável.",
          "Acesse o menu 'Bônus de Rede' para ver sua rede completa e os bônus recebidos.",
        ],
        tips: [
          "Quanto maior o pacote do seu indicado, maior o bônus de adesão que você recebe.",
          "Uma rede ativa e bem orientada pode gerar mais do que o bônus diário das campanhas.",
        ],
      },
      {
        title: "Como indicar de forma eficiente",
        icon: Target,
        content: [
          "Acesse o menu 'Indicação' para pegar seu link personalizado de indicação.",
          "Compartilhe seu link no Instagram, WhatsApp, Telegram e outras redes sociais.",
          "Explique claramente como a plataforma funciona antes de indicar — indicados bem informados têm mais sucesso.",
          "Crie conteúdo mostrando seus próprios resultados: prints do saldo, bônus recebidos, saques realizados.",
          "Ofereça suporte ao seu indicado nos primeiros dias — isso aumenta a chance de ele se manter ativo.",
          "Faça grupos de WhatsApp com seus indicados para tirar dúvidas e manter a motivação.",
        ],
        tips: [
          "Seja honesto sobre o funcionamento — indicados com expectativas reais ficam mais tempo ativos.",
          "Documente sua jornada e compartilhe nas redes: nada vende mais do que resultados reais.",
        ],
      },
      {
        title: "Técnicas de vendas para o digital",
        icon: TrendingUp,
        content: [
          "Vender é comunicar valor. Antes de oferecer, mostre o benefício que a pessoa vai ter.",
          "Use o storytelling: conte sua própria história de como começou e o que mudou com a plataforma.",
          "Crie urgência real: 'hoje é o último dia com esse bônus' ou 'só tem X vagas nessa turma'.",
          "Responda objeções antes que elas apareçam: prepare respostas para as dúvidas mais comuns.",
          "Follow-up é essencial: quem não comprou hoje pode comprar amanhã. Acompanhe os interessados.",
          "Use depoimentos e provas sociais — prints de saques e resultados de outras pessoas são poderosos.",
        ],
        tips: [
          "Não force a venda — ofereça a oportunidade e deixe a pessoa decidir com calma.",
          "Crie um roteiro de apresentação simples para usar no WhatsApp ou chamada de vídeo.",
        ],
      },
      {
        title: "Construindo uma equipe de sucesso",
        icon: Users,
        content: [
          "Uma rede forte não é só grande — é ativa. Foque em qualidade antes de quantidade.",
          "Oriente seus indicados a também indicarem outras pessoas — isso multiplica seus ganhos de rede.",
          "Reconheça e celebre as conquistas da sua equipe: isso cria um ambiente positivo e motivador.",
          "Crie treinamentos e materiais simples para ensinar seus indicados a usarem a plataforma.",
          "Mantenha comunicação constante: um grupo de apoio bem gerido retém mais pessoas ativas.",
          "Líderes que ajudam sua equipe a crescer são os que constroem as maiores rendas residuais.",
        ],
        tips: [
          "Compartilhe este curso com seus indicados — um time bem treinado produz melhores resultados para todos.",
          "Organize lives ou reuniões mensais para apresentar resultados e motivar a equipe.",
        ],
      },
    ],
  },
];

function CursoPage() {
  const [openModule, setOpenModule] = useState<string | null>("plataforma");
  const [openLesson, setOpenLesson] = useState<string | null>("plataforma-0");

  const totalLessons = MODULES.reduce((s, m) => s + m.lessons.length, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <GraduationCap className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Curso Spark Ads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {MODULES.length} módulos · {totalLessons} aulas · Texto + dicas práticas
          </p>
        </div>
      </div>

      {/* Módulos */}
      <div className="space-y-3">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          const isOpen = openModule === mod.id;
          return (
            <Card key={mod.id} className="border-border/50 bg-card/60 overflow-hidden">
              {/* Cabeçalho do módulo */}
              <button
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/20 transition"
                onClick={() => setOpenModule(isOpen ? null : mod.id)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${mod.color}20` }}>
                  <Icon className="h-5 w-5" style={{ color: mod.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-snug">{mod.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{mod.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">{mod.lessons.length} aulas</Badge>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {/* Aulas */}
              {isOpen && (
                <div className="border-t border-border/40">
                  {mod.lessons.map((lesson, idx) => {
                    const lessonKey = `${mod.id}-${idx}`;
                    const isLessonOpen = openLesson === lessonKey;
                    const LessonIcon = lesson.icon ?? BookOpen;
                    return (
                      <div key={lessonKey} className="border-b border-border/30 last:border-0">
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/10 transition"
                          onClick={() => setOpenLesson(isLessonOpen ? null : lessonKey)}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <LessonIcon className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="flex-1 text-sm font-medium">{lesson.title}</span>
                          {isLessonOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </button>

                        {isLessonOpen && (
                          <div className="px-4 pb-5 space-y-4">
                            <div className="space-y-3 pl-10">
                              {lesson.content.map((para, i) => (
                                <p key={i} className="text-sm text-muted-foreground leading-relaxed">{para}</p>
                              ))}
                            </div>

                            {lesson.tips && lesson.tips.length > 0 && (
                              <div className="ml-10 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
                                <p className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                                  <Lightbulb className="h-3.5 w-3.5" /> Dicas práticas
                                </p>
                                {lesson.tips.map((tip, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                    <p className="text-xs text-muted-foreground">{tip}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="ml-10">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs border-success/30 text-success hover:bg-success/10"
                                onClick={() => setOpenLesson(null)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar como concluída
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="border-primary/20 bg-primary/5 p-5 text-center">
        <ShieldCheck className="h-8 w-8 text-primary mx-auto mb-2" />
        <p className="font-semibold">Parabéns por investir no seu conhecimento!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Continue estudando e aplicando o que aprendeu. O sucesso vem da consistência.
        </p>
      </Card>
    </div>
  );
}
