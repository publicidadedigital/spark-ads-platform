# Pagamentos Cakto Pix e Saques

## Resumo

A integracao EFI foi removida do codigo. O checkout Pix agora usa a estrutura Cakto, com pedido interno em `payment_orders`, confirmacao por webhook e ativacao do ciclo pelo webhook interno seguro.

A implementacao foi feita para ser configuravel porque a Cakto pode entregar o checkout de duas formas:

1. Criacao de checkout por API, usando `CAKTO_CREATE_CHECKOUT_ENDPOINT` e `CAKTO_API_TOKEN`.
2. Link/base de checkout hospedado, usando `CAKTO_CHECKOUT_URL` com parametros do pedido.

Quando voce tiver a documentacao exata da Cakto, o ajuste fino fica centralizado em `src/lib/payments/cakto.server.ts`.

## Pacotes em dolar

| Pacote | Valor bonificavel | Curso | Total pago |
|---|---:|---:|---:|
| Start | US$ 60 | US$ 10 | US$ 70 |
| Plus | US$ 120 | US$ 10 | US$ 130 |
| Pro | US$ 300 | US$ 10 | US$ 310 |
| Elite | US$ 1.000 | US$ 10 | US$ 1.010 |

A taxa/curso nao gera bonus, nao gera pontos, nao conta para 200% e nao entra em comissoes de rede.

## Variaveis de ambiente Cakto

Configure na Vercel/Supabase, nunca no codigo.

### Opcao A: checkout por API

```bash
CAKTO_CREATE_CHECKOUT_ENDPOINT=https://api-ou-endpoint-da-cakto
CAKTO_API_TOKEN=...
CAKTO_WEBHOOK_SECRET=...
# opcional, caso a Cakto trabalhe com token simples no webhook
CAKTO_WEBHOOK_TOKEN=...
```

### Opcao B: checkout por URL/base hospedada

```bash
CAKTO_CHECKOUT_URL=https://checkout-da-cakto-ou-link-do-produto
CAKTO_WEBHOOK_SECRET=...
# opcional
CAKTO_WEBHOOK_TOKEN=...
```

### Variaveis gerais

```bash
APP_URL=https://spark-ads-platform.vercel.app
PAYMENTS_WEBHOOK_SECRET=uma_chave_forte
USD_BRL_FALLBACK_RATE=5.5
CAKTO_SUCCESS_URL=https://spark-ads-platform.vercel.app/app
CAKTO_CANCEL_URL=https://spark-ads-platform.vercel.app/app/checkout
CAKTO_WEBHOOK_URL=https://spark-ads-platform.vercel.app/api/public/cakto/webhook
```

## Checkout Pix Cakto

Fluxo implementado:

1. Usuario escolhe pacote no checkout.
2. Front chama `/api/public/cakto/create-checkout` com token do usuario.
3. Backend valida sessao, perfil, pais e pacote.
4. Pix permanece liberado apenas para Brasil.
5. Backend calcula separadamente pacote bonificavel, taxa do curso e total pago.
6. Backend gera `external_id` unico do pedido.
7. Backend cria o checkout na Cakto ou monta a URL configurada.
8. Backend registra o pedido em `payment_orders` com `provider = cakto`.
9. Front exibe link do checkout Cakto ou Pix copia-e-cola/QR code se a Cakto retornar esses campos.

## Webhook Cakto

Endpoint:

```text
/api/public/cakto/webhook
```

O webhook:

1. Valida assinatura HMAC por `CAKTO_WEBHOOK_SECRET`, quando configurado.
2. Valida token por `CAKTO_WEBHOOK_TOKEN`, quando configurado.
3. Extrai `external_id`/reference do payload.
4. Localiza o pedido em `payment_orders`.
5. Marca pedido como aprovado, pendente ou falho.
6. Quando aprovado, chama `/api/public/payments-webhook` com assinatura HMAC usando `PAYMENTS_WEBHOOK_SECRET`.
7. O webhook interno ativa o ciclo e registra a movimentacao financeira.
8. Falhas sao registradas em logs do sistema para conciliacao administrativa.

## Saques

Regras mantidas:

- Minimo: US$ 50
- Maximo: US$ 4.000
- Saques pagos somente nos dias 15 e 30
- Saque nunca e automatico no momento do pedido
- Usuario solicita saque usando saldo disponivel
- Admin revisa e aprova/recusa
- Admin paga individualmente ou em massa
- Pagamento em massa processa apenas saques aprovados
- O sistema registra lotes em `withdrawal_batches`

Tela:

```text
/admin/saques
```

## Arquivos principais

- `src/lib/payments/cakto.server.ts`
- `src/lib/payments/provider.ts`
- `src/routes/api/public/cakto/create-checkout.ts`
- `src/routes/api/public/cakto/webhook.ts`
- `src/routes/api/public/payments-webhook.ts`
- `src/routes/app/checkout.$packageId.tsx`
- `src/lib/withdrawals/withdrawal.functions.ts`
- `src/routes/admin/saques.tsx`
- `supabase/migrations/20260613130000_cakto_pix_withdrawals.sql`

## Pendencias operacionais

- Informar as variaveis Cakto reais na Vercel.
- Configurar na Cakto o webhook para `/api/public/cakto/webhook`.
- Validar qual campo a Cakto envia como referencia externa. O parser ja cobre formatos comuns (`external_id`, `reference`, `metadata.external_id`), mas pode precisar de ajuste fino quando chegar o payload real.
- Aplicar a migration no Supabase.
- Fazer um pagamento de teste e conferir `payment_orders`, ativacao do ciclo e extrato.
