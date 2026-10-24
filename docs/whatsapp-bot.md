# Bot do WhatsApp

Cada usuário liga o próprio WhatsApp à conta em **Configurações → WhatsApp** e passa a lançar gastos e
consultar o mês por mensagem. Tudo roda no plano gratuito: WhatsApp Cloud API (Meta), Vercel e Supabase.

## Como funciona

```
WhatsApp ──POST──> /api/whatsapp (Vercel) ──> Supabase (service_role, filtrando por user_id)
         <──resposta── Graph API <──────────┘
```

- `api/whatsapp.ts` — webhook: confere a assinatura da Meta e repassa cada mensagem.
- `api/_lib/bot.ts` — não repete mensagem, liga número ↔ conta pelo código, guarda o andamento da conversa.
- `api/_lib/conversa.ts` — o motor da conversa (perguntas, comandos, respostas). Testado em `conversa.test.ts`.
- `api/_lib/dados.ts` — leituras e lançamentos no Supabase, no mesmo formato que o app usa.
- `supabase/whatsapp.sql` — tabelas `whatsapp_vinculos`, `whatsapp_codigos`, `whatsapp_conversas`, `whatsapp_mensagens`.

O que o bot entende: `45,90 mercado` (e aí pergunta o tipo: cartão, conta mensal, conta do mês ou receita),
`fatura`, `fatura nubank`, `contas`, `sobra`, `cancelar`, `ajuda`.

## Configuração (uma vez)

### 1. Banco
No Supabase → SQL Editor, rode `supabase/whatsapp.sql`.

### 2. Meta (WhatsApp Cloud API)
1. Em [developers.facebook.com](https://developers.facebook.com/apps) → **Criar app** → tipo **Empresa** (Business).
2. No app, adicione o produto **WhatsApp** → **Configuração da API**.
3. Anote o **Phone number ID** do número de teste.
4. Em **Para** (destinatários), cadastre o seu número (e de quem for usar; o número de teste aceita até 5).
5. Gere um **token permanente**: Configurações do negócio → Usuários do sistema → criar usuário (Admin) →
   **Gerar token** com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
   (O token temporário da tela de API vence em 24h.)
6. Em Configurações do app → **Básico**, copie a **Chave secreta do app** (App Secret).

### 3. Vercel → Settings → Environment Variables

| Variável | Onde pegar |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` (**secreta**) |
| `WHATSAPP_TOKEN` | token permanente do passo 2.5 |
| `WHATSAPP_PHONE_NUMBER_ID` | passo 2.3 |
| `WHATSAPP_APP_SECRET` | passo 2.6 |
| `WHATSAPP_VERIFY_TOKEN` | uma senha qualquer que você inventa (usada no passo 4) |
| `VITE_WHATSAPP_NUMERO` | número do bot, só dígitos com DDI (aparece na tela de conectar) |
| `BOT_FUSO_HORARIO` | opcional; padrão `America/Sao_Paulo` (números +351 usam `Europe/Lisbon`) |

`VITE_SUPABASE_URL` já existe e o bot reaproveita. Depois de salvar, faça um novo deploy.

### 4. Ligar o webhook
No app da Meta → WhatsApp → **Configuração** → Webhook:
- URL de callback: `https://SEU-APP.vercel.app/api/whatsapp`
- Token de verificação: o mesmo `WHATSAPP_VERIFY_TOKEN`
- Clique **Verificar e salvar** e, em *Campos do webhook*, assine **messages**.

### 5. Testar
No app: Configurações → WhatsApp → **Conectar WhatsApp**, mande o código para o bot, depois `45 mercado`.

## Segurança
- O webhook só aceita POST com assinatura `X-Hub-Signature-256` válida (App Secret).
- O número é ligado à conta só com um código gerado pelo dono, válido por 10 minutos;
  5 códigos errados bloqueiam aquele número por 1 hora.
- A chave `service_role` fica só na Vercel (sem prefixo `VITE_`, nunca vai para o navegador),
  e toda consulta do bot filtra pelo `user_id` do número.

## Para mais de 5 pessoas
O número de teste só conversa com até 5 destinatários cadastrados. Para abrir a todos, registre um número
próprio na Cloud API (um chip que não esteja em uso no app do WhatsApp). As respostas continuam gratuitas
porque é sempre o usuário quem começa a conversa.
