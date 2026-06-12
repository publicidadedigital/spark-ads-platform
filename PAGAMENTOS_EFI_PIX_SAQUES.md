# Pagamentos EFI Pix e Saques

## Resumo

Esta entrega deixa pronta a estrutura de pagamentos Pix via EFI, conversao USD -> BRL por cotacao USDT/BRL da Binance, pedidos de pagamento, webhook de confirmacao e fluxo administrativo de saques sem disparo automatico.

Nenhuma credencial sensivel foi gravada no repositorio. As credenciais vistas em tela devem ser regeneradas/rotacionadas antes de producao e cadastradas somente como variaveis de ambiente.

## Pacotes em dolar

O pacote Start foi corrigido para:

- Valor bonificavel do pacote: US$ 60
- Curso/taxa de marketing digital: US$ 10
- Total pago pelo usuario: US$ 70
- Teto de 200%: US$ 120
- Bonus diario proporcional: US$ 0,16, calculado por `package_value * 0.0026`, arredondado em duas casas

Os demais pacotes seguem a regra ja definida:

| Pacote | Valor bonificavel | Curso | Total pago |
|---|---:|---:|---:|
| Start | US$ 60 | US$ 10 | US$ 70 |
| Plus | US$ 120 | US$ 10 | US$ 130 |
| Pro | US$ 300 | US$ 10 | US$ 310 |
| Elite | US$ 1.000 | US$ 10 | US$ 1.010 |

A taxa/curso nao gera bonus, nao gera pontos, nao conta para 200% e nao entra em comissoes de rede.

## Variaveis de ambiente necessarias

Configure na Vercel/Supabase, nunca no codigo:

```bash
EFI_ENV=production
EFI_CLIENT_ID=...
EFI_CLIENT_SECRET=...
EFI_PIX_KEY=...
EFI_CERT_BASE64=...
# ou, em ambiente que aceite arquivo:
EFI_CERT_PATH=/path/to/certificado.p12
EFI_CERT_PASSPHRASE=...
EFI_PIX_EXPIRATION_SECONDS=3600

APP_URL=https://seu-dominio.com
PAYMENTS_WEBHOOK_SECRET=...
USD_BRL_FALLBACK_RATE=5.5
```

`EFI_CERT_BASE64` deve conter o certificado `.p12` convertido para base64. A EFI exige certificado ativo para API Pix.

## Checkout Pix EFI

Fluxo implementado:

1. Usuario escolhe pacote no checkout.
2. Front chama `/api/public/efi/create-pix-checkout` com token do usuario.
3. Backend valida o usuario e o pais.
4. Pix so e permitido para Brasil.
5. Backend busca cotacao USDT/BRL na Binance.
6. Backend converte o total pago em USD para BRL.
7. Backend cria a cobranca Pix na EFI.
8. Backend registra `payment_orders`.
9. Front mostra copia e cola Pix, QR code e cotacao usada.

## Webhook EFI

Endpoint criado:

```text
/api/public/efi/pix-webhook
```

Ao receber notificacao Pix, o backend:

1. Localiza o pedido por `txid` em `payment_orders`.
2. Consulta a EFI para confirmar se a cobranca esta concluida.
3. Marca o pedido como aprovado.
4. Chama o webhook interno `/api/public/payments-webhook` com assinatura HMAC usando `PAYMENTS_WEBHOOK_SECRET`.
5. Se o webhook interno falhar, registra erro critico em logs do sistema para reconciliacao administrativa.

## Migração Supabase

Arquivo criado:

```text
supabase/migrations/20260611173000_efi_pix_withdrawals.sql
```

A migracao cria:

- `payment_orders`
- `withdrawal_requests`
- `withdrawal_batches`
- campos de vinculo em `wallet_transactions`
- correcao do pacote Start para US$ 60 + US$ 10

Ela precisa ser aplicada no projeto Supabase antes do fluxo real operar.

## Saques

Regras implementadas:

- Minimo: US$ 50
- Maximo: US$ 4.000
- Saques somente podem ser pagos nos dias 15 e 30
- Saque nunca e automatico no momento do pedido
- Usuario solicita saque usando saldo disponivel
- Admin revisa e aprova/recusa
- Admin paga individualmente ou em massa
- Pagamento em massa so processa saques aprovados
- O sistema registra lotes em `withdrawal_batches`

Tela criada:

```text
/admin/saques
```

A tela permite:

- filtrar por status
- aprovar saque
- recusar saque
- marcar saque como pago individualmente
- pagar aprovados em massa
- registrar referencia/observacao do pagamento

## Status de saque

- `solicitado`
- `em_analise`
- `aprovado`
- `em_processamento`
- `pago`
- `recusado`

## Arquivos principais

- `src/lib/business/rules.ts`
- `src/lib/payments/binance.server.ts`
- `src/lib/payments/efi.server.ts`
- `src/lib/payments/provider.ts`
- `src/lib/withdrawals/withdrawal.functions.ts`
- `src/routes/api/public/efi/create-pix-checkout.ts`
- `src/routes/api/public/efi/pix-webhook.ts`
- `src/routes/app/checkout.$packageId.tsx`
- `src/routes/admin.tsx`
- `src/routes/admin/saques.tsx`
- `supabase/migrations/20260611173000_efi_pix_withdrawals.sql`

## Pendencias operacionais

- Inserir as variaveis de ambiente na Vercel/Supabase.
- Converter e cadastrar o certificado EFI em `EFI_CERT_BASE64` ou disponibilizar `EFI_CERT_PATH`.
- Configurar o webhook Pix na EFI apontando para `/api/public/efi/pix-webhook`.
- Aplicar a migracao no Supabase.
- Fazer um Pix real de baixo valor em homologacao antes de producao.
- Integrar disparo bancario real de Pix de saida quando a EFI/API de pagamentos de saida estiver habilitada. Hoje o admin marca o saque como pago apos executar/verificar manualmente, como solicitado.
