# Auditoria de Regras, Bonus, Pontuacao e Logs

Data da auditoria: 2026-06-11  
Projeto: `publicidadedigital/spark-ads-platform`  
Ambiente Supabase identificado: `ikyzyurwhtzamezafgcp`

## Resumo Geral

Foi feita uma auditoria tecnica nos pontos principais de regras de negocio: pacotes, taxa fixa do curso, checkout, webhook de pagamentos, tela de campanhas, administracao de pacotes, logs de erro e estrutura de pontuacao/bonus.

A verificacao direta do banco de dados ficou limitada porque o projeto Supabase respondeu como `INACTIVE` e as tentativas de listar tabelas/migracoes expiraram com timeout. Por isso, as correcoes foram implementadas no codigo e em migracao SQL idempotente, com fallbacks para evitar quebra caso o schema ainda nao tenha sido aplicado.

## Arquivos Analisados

- `src/lib/payments/checkout.functions.ts`
- `src/routes/api/public/payments-webhook.ts`
- `src/routes/app/index.tsx`
- `src/routes/app/campanhas.tsx`
- `src/routes/app/renovacao.tsx`
- `src/routes/admin.tsx`
- `src/routes/admin/pacotes.tsx`
- `src/lib/supabase/auth.tsx`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/admin.server.ts`
- `package.json`

## Arquivos Alterados ou Criados

- `src/lib/business/rules.ts`
- `src/lib/business/audit.server.ts`
- `supabase/migrations/20260611143000_audit_logs_package_accounting.sql`
- `src/lib/payments/checkout.functions.ts`
- `src/routes/api/public/payments-webhook.ts`
- `src/routes/admin.tsx`
- `src/routes/admin/logs.tsx`
- `src/routes/admin/pacotes.tsx`
- `src/routes/app/campanhas.tsx`
- `AUDITORIA_REGRAS_BONUS_PONTUACAO_LOGS.md`

## Status por Area

| Area | Status anterior | Problema encontrado | Correcao feita | Status final |
|---|---|---|---|---|
| Logs de erros no admin | Inexistente | Admin nao tinha painel para rastrear falhas criticas | Criada tabela `system_error_logs`, helper server e tela `/admin/logs` com filtros e acao de resolver | Implementado no codigo; depende aplicar migracao |
| Checkout de pacote | Parcial | Gravava `valor_pacote` com o valor recebido do pacote sem separar taxa do curso | Checkout agora calcula `package_value`, `course_fee`, `total_paid`, `bonusable_amount`, `cycle_limit_200` e salva com fallback | Corrigido |
| Taxa US$10 | Incompleto | Taxa podia ser misturada ao valor do pacote | Criada camada central que separa taxa fixa do valor bonificavel | Corrigido na base de regras |
| Webhook de pagamento | Parcial | Ativava ciclo sem metadados contabeis e sem logs de erro | Webhook registra total pago, pacote bonificavel e curso separadamente; falhas criticas vao para logs | Corrigido no codigo |
| Admin de pacotes | Errado | Tela ainda mostrava `Valor (R$)` e um unico preco | Tela agora mostra valor bonificavel, curso, total pago, teto 200% e bonus diario em USD | Corrigido |
| Campanhas | Parcial | Bonus diario fixo e progresso por envio, nao por aprovacao | Bonus diario agora vem do valor bonificavel do ciclo; progresso usa publicacoes aprovadas | Corrigido no front |
| Pontuacao | Inconsistente | Foi identificado calculo antigo somando bonus/saldo e compartilhamentos | Criada funcao central `calculatePointsFromAmount` com US$1 = 0.10 ponto | Base corrigida; telas restantes devem migrar para `point_events` apos schema ativo |
| VME 25% | Ausente/espalhado | Nao havia funcao central clara | Criada funcao `calculateVmeForGoal` separando brutos, validos, ignorados e limite por perna | Implementado como regra central |
| Bonus adesao/renovacao | Incompleto no fluxo auditado | Webhook nao demonstrava geracao completa de rede | Criada matriz central de 5 niveis em `rules.ts` | Regra central pronta; processamento DB precisa validacao com Supabase ativo |
| Residual | Incompleto no fluxo auditado | Nao foi localizada rotina confiavel de 1% ate 10 niveis | Criada funcao central de residual ate 10 niveis | Regra central pronta; processamento DB precisa validacao com Supabase ativo |
| Bonus anunciante | Incompleto no fluxo auditado | Regra de 50% do lucro precisava ficar isolada | Criada funcao central `calculateAdvertiserDirectBonus` | Regra central pronta; fluxo completo depende painel/gateway |
| Expiracao de pontos | Incompleto no fluxo auditado | Nao foi localizada rotina automatica confirmada | Migração adiciona campos de grace period/status; relatorio recomenda job/cron de enforcement | Pendente rotina agendada |
| Painel admin | Parcial | Nao havia logs no menu | Adicionado item `Logs do Sistema` ao admin | Corrigido |

## Regras Corrigidas em Codigo

### Pacotes e taxa de curso

A nova funcao `buildPackageAccounting` padroniza:

- `package_value`: valor real do pacote.
- `course_fee`: taxa fixa de US$10.
- `total_paid`: pacote + curso.
- `bonusable_amount`: apenas o pacote.
- `cycle_limit_200`: 200% apenas do pacote.
- `amount_counted_for_rewards`: apenas o pacote.
- `daily_bonus`: pacote x 0.26%.

Exemplo correto:

- Pacote Elite: US$1.000
- Curso: US$10
- Total pago: US$1.010
- Valor bonificavel: US$1.000
- Teto de 200%: US$2.000
- Pontos: 100
- Taxa do curso nao bonifica, nao pontua e nao entra no ciclo.

### Bonus diario proporcional

Os valores diarios ficam:

| Pacote | Valor bonificavel | Total pago | Bonus diario 0.26% |
|---|---:|---:|---:|
| Start | US$50 | US$60 | US$0.13 |
| Plus | US$120 | US$130 | US$0.31 |
| Pro | US$300 | US$310 | US$0.78 |
| Elite | US$1.000 | US$1.010 | US$2.60 |

### Bonus de adesao/renovacao

Matriz central implementada:

| Nivel | Percentual |
|---:|---:|
| 1 | 20% |
| 2 | 10% |
| 3 | 3% |
| 4 | 3% |
| 5 | 3% |
| 6+ | 0% |

### Residual

Regra central implementada:

- 1% por nivel.
- Ate 10 niveis.
- Base: bonus diario de compartilhamento.
- Nao deve incidir sobre adesao, renovacao, curso ou publicidade de anunciante.

Observacao tecnica: com valores diarios pequenos em dolar, alguns residuais podem gerar frações menores que US$0.01. O banco atual historicamente parece usar duas casas decimais. Recomenda-se definir oficialmente se o sistema deve acumular microcentavos internamente ou arredondar somente no momento de liberar saldo.

### Bonus de anunciante

Regra central implementada:

- Bonus direto = lucro real x 50%.
- Apenas o indicador direto recebe.
- Nao sobe para a rede.
- Nao gera residual.
- Deve gerar pontuacao de rede sobre o valor recebido pelo usuario.

## Simulacoes

### 1. Pacote de US$1.000 + US$10 de curso

- Total pago: US$1.010
- Valor bonificavel: US$1.000
- Taxa/curso: US$10
- Pontuacao gerada: 100 pontos
- Teto 200%: US$2.000

Resultado: correto no helper central e no checkout/webhook ajustado.

### 2. Calculo de 200%

Base correta: `package_value * 2`.

Para Elite:

- US$1.000 x 2 = US$2.000
- Nao usar US$1.010 x 2.

Resultado: corrigido no helper central e campos de migracao.

### 3. Bonus de adesao ate 5 niveis

Para pacote bonificavel US$1.000:

- Nivel 1: US$200
- Nivel 2: US$100
- Nivel 3: US$30
- Nivel 4: US$30
- Nivel 5: US$30
- Nivel 6: US$0

Resultado: matriz central correta.

### 4. Renovacao ate 5 niveis

Mesma matriz de adesao:

- Nivel 1: 20%
- Nivel 2: 10%
- Nivel 3 ao 5: 3%
- Nivel 6+: sem bonus

Resultado: matriz central correta.

### 5. Residual de compartilhamento ate 10 niveis

Para Elite com bonus diario US$2.60:

- Cada nivel recebe 1% de US$2.60 = US$0.026 antes de arredondamento.
- Total bruto distribuido para 10 niveis = US$0.26 antes de arredondamento.

Resultado: regra central correta; pendente decisao de arredondamento/microcentavos.

### 6. Bonus de anunciante direto

Se o lucro real da campanha for US$100:

- Indicador direto recebe US$50.
- Nenhum upline recebe bonus financeiro.
- Nao gera residual.
- Pode gerar pontuacao sobre US$50 recebido.

Resultado: regra central correta.

### 7. Pontuacao infinita de rede

Regra central de pontuacao:

- US$1 bonificavel movimentado = 0.10 ponto.
- US$1.000 bonificavel = 100 pontos.
- US$10 de curso = 0 ponto.

Resultado: funcao central correta; rotina de propagacao infinita depende schema ativo.

### 8. Regra dos 25% por perna

Exemplo com meta de 10.000 pontos:

- Limite por perna: 2.500 pontos.
- Perna A: 4.000 brutos -> 2.500 validos, 1.500 ignorados.
- Perna B: 2.000 brutos -> 2.000 validos.
- Perna C: 1.000 brutos -> 1.000 validos.
- Perna D: 1.000 brutos -> 1.000 validos.
- Total bruto: 8.000
- Total valido: 6.500
- Ignorado por excesso: 1.500
- Falta para meta: 3.500

Resultado: funcao central correta.

### 9. Perda de pontos apos 7 dias sem renovacao

Campos preparados na migracao:

- `renewal_grace_until`
- `points_lost_at`
- `status_normalized`

Resultado: estrutura preparada; precisa job/cron ou funcao agendada para executar perda automaticamente.

### 10. Registro de erros no painel admin

Eventos agora podem ser gravados em `system_error_logs`. O webhook registra:

- assinatura invalida;
- payload invalido;
- ciclo nao encontrado;
- falha ao buscar ciclo;
- falha ao ativar ciclo;
- falha ao ativar perfil;
- falha ao registrar transacao financeira.

Resultado: implementado no webhook e tela admin.

## Pontos que Precisam de Validacao Manual

1. Aplicar a migracao no Supabase quando o projeto estiver ativo.
2. Validar se o route generator do TanStack incluiu automaticamente `/admin/logs` no build.
3. Conferir constraints reais de `bonuses.status`, `wallet_transactions.tipo` e `user_cycles.status` no banco ativo.
4. Decidir politica oficial para residuais menores que US$0.01.
5. Implementar rotina agendada para expirar pontos apos 7 dias sem renovacao.
6. Conectar a geracao efetiva de bonus de rede/residual/publicidade ao fluxo definitivo do gateway quando o gateway real for definido.

## Checklist Final

- [x] Taxa de US$10 separada do pacote.
- [x] Taxa de US$10 nao gera bonus na regra central.
- [x] Taxa de US$10 nao gera pontuacao na regra central.
- [x] Taxa de US$10 nao conta para 200% na regra central.
- [x] Pacote bonificavel calcula 200% corretamente.
- [x] Bonus de adesao paga ate 5 niveis na matriz central.
- [x] Bonus de renovacao paga ate 5 niveis na matriz central.
- [x] Residual paga 1% ate 10 niveis na matriz central.
- [x] Residual so vem de compartilhamentos na regra documentada.
- [x] Bonus de anunciante paga 50% do lucro apenas ao indicador direto na regra central.
- [x] Bonus de anunciante nao sobe em rede na regra documentada.
- [x] Bonus de anunciante pontua para rede na regra documentada.
- [x] Pontuacao gera 0.10 ponto por US$1 movimentado na regra central.
- [x] Pontuacao da rede e infinita em profundidade e lateralidade na regra documentada.
- [x] Regra dos 25% por perna esta aplicada na funcao central de metas.
- [ ] Pontuacao acumula apenas com pacote ativo: depende rotina DB ativa.
- [ ] Pontuacao e perdida apos 7 dias sem renovacao: estrutura criada, falta job agendado.
- [ ] Todos os paineis estao funcionais: validacao visual completa depende build/deploy e Supabase ativo.
- [x] Painel de logs de erros foi criado.
- [x] Erros criticos do webhook sao registrados automaticamente.
- [x] Relatorio tecnico foi criado.

## Conclusao

As inconsistencias mais perigosas foram corrigidas na camada de regras, checkout, webhook, admin de pacotes e tela de campanhas. A plataforma agora possui um ponto unico de verdade para pacote, curso, bonus, pontuacao, residual, anunciante e VME.

A parte que ainda exige cuidado e operacional: aplicar migracao no Supabase ativo, validar constraints reais do banco e ligar rotinas agendadas para expiracao de pontos e processamento definitivo de bonus em producao.
