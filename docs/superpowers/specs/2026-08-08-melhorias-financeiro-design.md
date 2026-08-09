# Melhorias no app financeiro — design

Data: 2026-08-08

## Contexto

Usuário mora em Portugal; dívidas (cartões, compromissos) são em EUR, mas
patrimônio/investimentos podem estar em EUR (Portugal) ou BRL (Brasil). App
hoje está fixo em BRL em toda parte, não mostra limite disponível do cartão,
não tem visão de fatura mensal do cartão dentro de Compromissos, o "marcar
pago" é irreversível e sem indicação visual de risco, receitas recorrentes
não preservam histórico ao mudar de valor, e a troca de mês está lenta.

## 1. Performance

**Diagnóstico**: medido via `performance.getEntriesByType('resource')` no
Chrome real do usuário — as 5 chamadas Supabase da Dashboard rodam em
paralelo (correto), mas cada uma leva ~900ms. Somado ao carregamento de
~78 módulos JS não empacotados do `vite dev`, o primeiro load leva quase 2s.

**Resultado da medição** (2026-08-08):
- Build de produção, chamadas sequenciais simples: ~200ms cada (bate com o
  teste via `curl` do terminal — não é overhead de dev mode).
- App em dev mode, **trocando de mês com a conexão já aquecida** (não é o
  primeiro load da página): as chamadas do Dashboard levam **~230ms cada**,
  todas em paralelo — ou seja, a troca de mês em si é rápida.
- Os ~900ms observados antes eram específicos do **primeiro carregamento da
  página** (5 conexões novas abrindo ao mesmo tempo, cada uma pagando o
  custo de handshake TLS/DNS do zero) — não se repetem a cada troca de mês.

**Conclusão**: não há evidência de que a região São Paulo seja a causa da
lentidão reportada em uso normal (trocar de mês). Migração de região **não
recomendada** neste momento — falta identificar o que exatamente estava
lento na prática do usuário (pode ser algo específico de alguma tela, ou a
percepção era do carregamento inicial). Sem mudança de código nesta parte;
se a lentidão persistir depois das outras mudanças, revisitar com medições
mais específicas (tela a tela) em vez de assumir a causa.

## 2. Multi-moeda (revisado: moeda padrão da conta + Patrimônio sempre pergunta)

**Decisão final** (ajustada durante a implementação): em vez de pedir moeda em
todo formulário de Patrimônio e Metas, o usuário escolhe uma **moeda padrão
da conta no cadastro** (`user_metadata.moeda_padrao`, guardada no Supabase
Auth — sem tabela nova). Essa moeda padrão é usada silenciosamente em
Receitas, Compromissos, Cartões e Metas (sem seletor visível). Só
**Patrimônio** (guardado/investido) sempre pergunta a moeda no formulário,
porque é onde o usuário de fato tem valores em países diferentes.

**Schema**:
```sql
alter table patrimonio add column moeda text not null default 'EUR' check (moeda in ('EUR','BRL'));
alter table metas add column moeda text not null default 'EUR' check (moeda in ('EUR','BRL'));
```
`metas` ganhou a coluna por consistência/histórico, mas o formulário não
expõe seletor — usa `moeda_padrao` da conta automaticamente ao criar.

**Frontend**:
- `formatarMoeda(valor, moeda = "EUR")` passa a receber a moeda.
- `AuthContext.moedaPadrao` lê `user.user_metadata.moeda_padrao` (default EUR
  para contas antigas sem esse campo).
- Tela de cadastro ganha um `Select` de moeda padrão.
- Formulário de Patrimônio ganha um `Select` de moeda (EUR/BRL), sempre visível.
- Dashboard e página de Patrimônio agrupam e somam **por moeda**, sem
  conversão (ex: "Guardado: € 450,00 + R$ 300,00", dois números, não um só).

## 3. Limite do cartão + Fatura mensal em Compromissos

**Limite disponível** (calculado no front, sem coluna nova):
```
disponível = limite - soma(parcelas.valor where status='pendente' and parcela.compra.cartao_id = cartao.id)
```
Exibido nos cards de `CartoesPage` e no cabeçalho de `CartaoDetalhePage`.

**Fatura mensal em Compromissos**: a lista de Compromissos passa a incluir,
junto com os compromissos normais do mês, uma linha por cartão: **"Fatura
[Nome do Cartão] — valor"**, somando as parcelas daquele cartão com
`competencia` = mês selecionado (reaproveitando `useParcelasDaCompetencia`).
Não é um registro novo no banco, é uma linha calculada, misturada na mesma
lista dos compromissos reais (não em aba separada).

- Checkbox da linha da fatura → marca **todas** as parcelas daquele
  cartão+mês como pagas de uma vez (update em lote).
- Linha expansível mostra as parcelas individuais que compõem a fatura, cada
  uma com seu próprio checkbox, para corrigir uma sem mexer nas outras —
  sempre dentro do mesmo mês (nunca afeta parcelas de outros meses da mesma
  compra parcelada).

## 4. Checkbox "pago" (Compromissos + parcelas/fatura)

Troca o botão de "marcar pago" (irreversível, ícone de check) por um
`Checkbox` real:
- Marcado → status `pago`, linha com `line-through` (riscada).
- Desmarcado → status `pendente`, remove o risco. Reversível a qualquer
  momento (correção de clique errado).
- Sempre escopado ao registro daquele mês específico — nunca cria nem apaga
  registros de outros meses. Isso já bate com o modelo atual: compromissos
  recorrentes já existem como uma linha por mês (marcar pago no mês atual
  não afeta o próximo mês, que já é gerado como linha própria e independente).
- Aplica-se tanto em `CompromissosPage` (compromissos normais) quanto nas
  linhas de fatura/parcelas de cartão (item 3).
- Compromisso recorrente: marcar pago continua gerando a linha do próximo
  mês automaticamente (comportamento atual), mas passa a ser **idempotente**
  — só gera se ainda não existir uma linha para aquele compromisso na
  próxima competência (evita duplicar ao marcar/desmarcar/marcar de novo).
  Desmarcar nunca apaga a linha do próximo mês já gerada.

## 5. Receitas recorrentes com histórico

**Problema atual**: `receitas` recorrente é uma única linha reaproveitada
todo mês; editar o valor muda retroativamente todos os meses (passados e
futuros), porque a query só filtra por `data <= fim_do_mês`.

**Schema**:
```sql
alter table receitas add column valido_ate date;
```

**Comportamento**:
- Query de receitas do mês passa a considerar recorrentes onde
  `data <= fim_do_mês AND (valido_ate IS NULL OR valido_ate >= inicio_do_mês)`.
- Editar o **valor** de uma receita `recorrente` não faz `UPDATE` na linha
  existente. Em vez disso:
  1. Fecha a linha antiga: `valido_ate = último dia do mês anterior ao mês
     efetivo da mudança`.
  2. Insere uma linha nova com o valor novo, mesmo nome, `recorrente=true`,
     `data = primeiro dia do mês efetivo`, `valido_ate = null`.
- Isso preserva o valor histórico nos meses passados sem exigir uma tabela
  de histórico separada.
- Receitas `extraordinaria` (pontuais) continuam editando em lugar, como
  hoje — não precisam desse split.

**Bug pré-existente corrigido nesta implementação**: a query de receitas do
mês (e a de histórico) usava `${competencia}-31` fixo como fim do mês, o que
gera uma data inválida (ex: `2026-09-31`) e faz a query falhar silenciosamente
em qualquer mês com menos de 31 dias. Corrigido para calcular o último dia
real do mês (`new Date(ano, mes, 0).getDate()`) em `useReceitas.ts` e
`useHistorico.ts`. Também foi preciso ajustar o filtro `or()` para que o
ramo "receita não recorrente por data exata" não capture receitas
recorrentes antigas cuja `data` original caiu dentro do mês consultado
(adicionado `recorrente.eq.false` a esse ramo).

## Fora de escopo

- Conversão automática de câmbio (usuário optou por não converter).
- Migração de região do Supabase (decisão adiada, condicionada ao resultado
  do diagnóstico de performance).
- Moeda em receitas/compromissos/cartões (ficam fixos em EUR).
