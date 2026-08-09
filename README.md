# 💰 Gestão Mensal & Cartão

Aplicação web de planejamento financeiro pessoal: compromissos mensais, cartões de crédito parcelados, categorias, patrimônio e uma visão consolidada de "quanto sobra" por mês — com autenticação completa e dados isolados por usuário.

[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](#)

🇧🇷 **Português** (abaixo) · 🇬🇧 [**English**](#-english)

---

## 📌 Sobre o projeto

Comecei esse app porque as planilhas que eu usava para controlar meu orçamento mensal não davam conta da complexidade real: compras parceladas em múltiplos cartões, contas fixas que se repetem todo mês, contas avulsas que só acontecem uma vez, e a pergunta que toda planilha falha em responder rápido — **"quanto realmente sobra esse mês depois de tudo pago?"**

A ideia central do produto é separar dois tipos de compromisso financeiro:

- **Recorrente** — aluguel, água, luz, internet, academia, assinaturas... aparece todo mês automaticamente até que a pessoa decida excluir.
- **Pontual** — uma compra ou conta que existe só naquele mês específico.

E resolver um problema sutil de UX financeiro: se hoje é dia 20 de agosto e eu cadastro uma conta com vencimento dia 5 de setembro, ela **não** deve aparecer como pendência de agosto. O sistema deriva a competência automaticamente a partir da data de vencimento, então o usuário nunca precisa pensar em "em que mês isso entra".

## ✨ Funcionalidades

- **Dashboard** — visão geral do mês selecionado: receitas, compromissos pendentes, faturas de cartão e o que sobra.
- **Compromissos** — checklist mensal de contas recorrentes e pontuais, com marcação de pago/pendente. Compromissos recorrentes se auto-propagam mês a mês até serem excluídos (não apenas marcados como pagos).
- **Cartões** — cadastro de cartões (limite, dia de fechamento, dia de vencimento) e lançamento de compras parceladas, com geração automática de todas as parcelas via trigger no banco.
- **Categorias** — hub de gestão que agrupa compromissos por categoria (Moradia, Recorrentes mensais, Não essenciais...), com cor fixa por categoria para leitura visual rápida em todo o app.
- **Patrimônio** — histórico de valores guardados/investidos, com lançamentos editáveis.
- **Histórico** — gráfico de pizza da composição do mês (Moradia / Recorrentes / Não essenciais / Cartão de crédito / Sobra) em %, mais tabela de faturas agrupadas por cartão e resumo por categoria.
- **Autenticação completa** — cadastro, login, recuperação de senha por e-mail, onboarding no primeiro acesso (moeda + receitas fixas) e configurações de conta (nome, e-mail, senha, tema claro/escuro).
- **Zona de risco** — reset de dados financeiros com dupla confirmação (senha + "tem certeza?"), mantendo a conta de login intacta.
- **Responsivo** — menu hambúrguer no mobile, layout adaptado para telas pequenas.
- **Tema claro/escuro** — com persistência de preferência do sistema.

## 🧠 Decisões de arquitetura e domínio

Algumas decisões que não são óbvias só de ler o código:

**Competência automática pela data de vencimento.** Em vez de perguntar "para qual mês é isso?", o app calcula a competência a partir do `vencimento`. Um compromisso cadastrado hoje com vencimento no mês seguinte já nasce no mês seguinte — elimina uma classe inteira de erro de usuário.

**`serie_id` para compromissos recorrentes.** Cada compromisso recorrente tem um `serie_id` que liga todas as suas ocorrências mensais. Isso permite editar/excluir "a série toda" de forma consistente e evita duplicação ao gerar os meses seguintes. Durante o desenvolvimento, uma migração tardia dessa coluna causou colapso de dados (linhas sem `serie_id` colidindo em `Map`s chaveados por ele) — a correção ficou como guarda defensiva: qualquer geração futura de meses recorrentes é abortada (no-op) se alguma linha ainda não tiver `serie_id`, em vez de arriscar gerar dados errados.

**RLS multi-tenant com dois padrões.** Tabelas com `user_id` direto (`categorias`, `receitas`, `compromissos_financeiros`, `cartoes`, `metas`, `patrimonio`) usam policy simples `auth.uid() = user_id`. Tabelas filhas sem `user_id` próprio (`compras_parceladas`, `parcelas`) verificam posse via `exists (...)` fazendo join até `cartoes.user_id` — evita duplicar `user_id` em tabelas que já têm dono implícito pela relação.

**Geração de parcelas via trigger no Postgres**, não na aplicação: ao inserir uma `compra_parcelada`, um trigger (`gerar_parcelas_compra`) já cria todas as N parcelas com a competência correta, garantindo atomicidade e uma única fonte de verdade.

**"Sobra" como métrica derivada**, nunca armazenada: `receitas do mês − (moradia + recorrentes mensais + não essenciais + soma de todas as faturas de cartão do mês)`. Calculada em tempo de leitura para nunca ficar dessincronizada.

**Cor fixa por categoria, não posicional.** Em vez de atribuir cores por ordem/índice (que muda a cada re-render ou reordenação), cada categoria tem uma cor fixa por nome (`categoriaColor.ts`), com fallback determinístico por hash para categorias novas — a paleta foi validada para contraste e acessibilidade (diferenciação em daltonismo).

## 🛠️ Stack técnica

| Camada | Tecnologia |
|---|---|
| Framework | React 19 + Vite 8 + TypeScript |
| Estilo | TailwindCSS v4 (tokens OKLCH) + shadcn/ui (Radix primitives) |
| Dados/estado servidor | TanStack Query v5 |
| Formulários | React Hook Form + Zod |
| Roteamento | React Router v7 |
| Gráficos | Recharts |
| Tema | next-themes (claro/escuro) |
| Backend | Supabase (Postgres + Auth + Row Level Security) |

## 🗄️ Modelo de dados

```
categorias ──┐
             ├──< compromissos_financeiros (recorrente/eventual, competência derivada do vencimento)
receitas     │
             │
cartoes ──< compras_parceladas ──< parcelas (geradas via trigger no insert)
             │
metas
patrimonio
```

Todas as tabelas com Row Level Security habilitada — cada usuário só enxerga seus próprios dados, garantido no banco e não só na aplicação. Schema completo em [`supabase/schema.sql`](./supabase/schema.sql).

## 📁 Estrutura de pastas

```
src/
├── components/       # AppLayout, seletor de competência, painéis compartilhados, ui/ (shadcn)
├── contexts/         # AuthContext, CompetenciaContext
├── hooks/            # useCartoes, useCompromissos, useReceitas, useResetarConta...
├── lib/              # cliente Supabase, cores de categoria, cálculo de competência, formatação
├── pages/            # Dashboard, Compromissos, Cartões, Categorias, Patrimônio, Histórico,
│                      # Auth, Onboarding, Configurações, Redefinir senha
└── types/            # tipos gerados/derivados do schema do banco
supabase/
└── schema.sql        # tabelas, índices, trigger de parcelas, policies de RLS
```

## 🚀 Rodando localmente

```bash
git clone https://github.com/Skiither/gestao-mensal-cartao.git
cd gestao-mensal-cartao
npm install
cp .env.example .env   # preencher com suas credenciais do Supabase
npm run dev
```

Variáveis de ambiente necessárias (`.env`):

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
```

Rode o conteúdo de `supabase/schema.sql` no SQL Editor do seu projeto Supabase antes do primeiro uso.

## 🗺️ Possíveis próximos passos

- Exportação de relatórios mensais em PDF/CSV
- Notificações de vencimento próximo
- Metas financeiras com progresso visual mais detalhado
- Suporte a múltiplas moedas simultâneas por usuário

---

<a id="-english"></a>
## 🇬🇧 English

Personal finance planning web app: monthly commitments, installment credit card purchases, categories, net worth tracking, and a consolidated view of "how much is actually left over" each month — with full authentication and per-user data isolation.

### About

Spreadsheets couldn't keep up with the real complexity of my monthly budget: installment purchases split across multiple cards, fixed bills that repeat every month, one-off charges that happen once, and the question every spreadsheet is slow to answer — **"how much do I actually have left this month after everything is paid?"**

The core domain idea is splitting financial commitments into two kinds:

- **Recurring** — rent, water, electricity, internet, gym, subscriptions... shows up every month automatically until the user deletes it.
- **One-off** — a charge or bill that exists for a single specific month.

It also solves a subtle financial UX problem: if today is August 20th and I register a bill due September 5th, it should **not** show up as an August pending item. The app derives the accounting month (competência) automatically from the due date, so the user never has to think about "which month does this belong to."

### Features

- **Dashboard** — overview of the selected month: income, pending commitments, card statements, and what's left over.
- **Commitments** — monthly checklist of recurring and one-off bills, with paid/pending toggling. Recurring commitments auto-propagate month over month until deleted (not just marked paid).
- **Cards** — register cards (limit, closing day, due day) and log installment purchases, with all installments auto-generated via a database trigger.
- **Categories** — management hub grouping commitments by category (Housing, Monthly recurring, Non-essentials...), with a fixed color per category for fast visual scanning across the app.
- **Net worth** — history of saved/invested amounts, with editable entries.
- **History** — pie chart of the month's composition (Housing / Recurring / Non-essentials / Credit card / Leftover) in %, plus a table of statements grouped by card and a per-category summary.
- **Full authentication** — sign up, sign in, email password recovery, first-login onboarding (default currency + fixed income), and account settings (name, email, password, light/dark theme).
- **Danger zone** — reset financial data with double confirmation (password + "are you sure?"), keeping the login account intact.
- **Responsive** — hamburger menu on mobile, layout adapted for small screens.
- **Light/dark theme** — with system preference persistence.

### Architecture & domain decisions

A few decisions that aren't obvious just from reading the code:

**Automatic accounting month from the due date.** Instead of asking "which month is this for?", the app computes the accounting month (`competência`) from the `vencimento` (due date). A commitment registered today with a due date next month is born in next month — this removes an entire class of user error.

**`serie_id` for recurring commitments.** Every recurring commitment has a `serie_id` linking all of its monthly occurrences, enabling consistent series-wide edit/delete and preventing duplication when generating future months. A late migration adding this column caused a real data-collapse incident during development (rows without `serie_id` colliding in `Map`s keyed by it) — the fix became a defensive guard: any future month-generation for recurring items is a no-op if any row is still missing `serie_id`, rather than risk generating incorrect data.

**Two RLS patterns for multi-tenancy.** Tables with a direct `user_id` (`categorias`, `receitas`, `compromissos_financeiros`, `cartoes`, `metas`, `patrimonio`) use a simple `auth.uid() = user_id` policy. Child tables without their own `user_id` (`compras_parceladas`, `parcelas`) verify ownership via an `exists (...)` join up to `cartoes.user_id` — avoids duplicating `user_id` on tables that already have an implicit owner through the relationship.

**Installment generation via a Postgres trigger**, not application code: inserting a `compra_parcelada` fires a trigger (`gerar_parcelas_compra`) that creates all N installments with the correct accounting month, guaranteeing atomicity and a single source of truth.

**"Leftover" as a derived metric**, never stored: `month's income − (housing + monthly recurring + non-essentials + sum of all card statements for the month)`. Computed at read time so it can never drift out of sync.

**Fixed color per category, not positional.** Instead of assigning colors by index/order (which shifts on every re-render or reorder), each category gets a fixed color by name (`categoriaColor.ts`), with a deterministic hash-based fallback for new categories — the palette was validated for contrast and colorblind-safe differentiation.

### Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 8 + TypeScript |
| Styling | TailwindCSS v4 (OKLCH tokens) + shadcn/ui (Radix primitives) |
| Server state | TanStack Query v5 |
| Forms | React Hook Form + Zod |
| Routing | React Router v7 |
| Charts | Recharts |
| Theme | next-themes (light/dark) |
| Backend | Supabase (Postgres + Auth + Row Level Security) |

### Data model

```
categorias ──┐
             ├──< compromissos_financeiros (recurring/one-off, month derived from due date)
receitas     │
             │
cartoes ──< compras_parceladas ──< parcelas (generated via insert trigger)
             │
metas
patrimonio
```

Row Level Security enabled on every table — each user only ever sees their own data, enforced at the database level, not just in the app. Full schema in [`supabase/schema.sql`](./supabase/schema.sql).

### Running locally

```bash
git clone https://github.com/Skiither/gestao-mensal-cartao.git
cd gestao-mensal-cartao
npm install
cp .env.example .env   # fill in your Supabase credentials
npm run dev
```

Required environment variables (`.env`):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Run the contents of `supabase/schema.sql` in your Supabase project's SQL Editor before first use.

### Possible next steps

- Monthly report export (PDF/CSV)
- Upcoming due date notifications
- Financial goals with more detailed progress visualization
- Support for multiple simultaneous currencies per user
