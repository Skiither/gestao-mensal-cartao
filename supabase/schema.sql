-- ============================================================================
-- App de Planejamento Financeiro Mensal — schema Supabase/Postgres
-- Rode este arquivo inteiro no SQL editor do Supabase (ou via `supabase db push`)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabelas
-- ----------------------------------------------------------------------------

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz default now()
);

create table if not exists receitas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  valor numeric(12,2) not null,
  data date not null,
  recorrente boolean not null default false,
  tipo text not null check (tipo in ('recorrente','extraordinaria')),
  created_at timestamptz default now()
);

create table if not exists compromissos_financeiros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  categoria_id uuid references categorias(id) on delete set null,
  nome text not null,
  valor numeric(12,2) not null,
  vencimento date not null,
  competencia text not null, -- formato 'YYYY-MM'
  recorrencia text not null check (recorrencia in ('recorrente','eventual')),
  essencial boolean not null default true,
  status text not null default 'pendente' check (status in ('pendente','pago')),
  serie_id uuid not null default gen_random_uuid(), -- liga as linhas mensais geradas de um mesmo compromisso recorrente
  created_at timestamptz default now()
);

create table if not exists cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  limite numeric(12,2),
  dia_fechamento int not null,
  dia_vencimento int not null,
  created_at timestamptz default now()
);

create table if not exists compras_parceladas (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid not null references cartoes(id) on delete cascade,
  descricao text not null,
  valor_total numeric(12,2) not null,
  quantidade_parcelas int not null,
  valor_parcela numeric(12,2) not null,
  mes_inicial text not null, -- 'YYYY-MM'
  pessoas int not null default 1 check (pessoas >= 1), -- divide valor_total/quantidade_parcelas entre N pessoas
  created_at timestamptz default now()
);

create table if not exists parcelas (
  id uuid primary key default gen_random_uuid(),
  compra_parcelada_id uuid not null references compras_parceladas(id) on delete cascade,
  numero_parcela int not null,
  competencia text not null, -- 'YYYY-MM'
  valor numeric(12,2) not null,
  status text not null default 'pendente' check (status in ('pendente','pago')),
  created_at timestamptz default now(),
  unique (compra_parcelada_id, numero_parcela)
);

create table if not exists metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  valor_desejado numeric(12,2) not null,
  valor_acumulado numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

create table if not exists patrimonio (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('guardado','investido')),
  valor numeric(12,2) not null,
  atualizado_em timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- Índices úteis (consultas são quase sempre filtradas por user_id + competência)
-- ----------------------------------------------------------------------------

create index if not exists idx_compromissos_user_competencia on compromissos_financeiros(user_id, competencia);
create index if not exists idx_compromissos_serie on compromissos_financeiros(serie_id, competencia);
create index if not exists idx_receitas_user_data on receitas(user_id, data);
create index if not exists idx_parcelas_competencia on parcelas(competencia);
create index if not exists idx_parcelas_compra on parcelas(compra_parcelada_id);
create index if not exists idx_compras_parceladas_cartao on compras_parceladas(cartao_id);
create index if not exists idx_cartoes_user on cartoes(user_id);

-- ----------------------------------------------------------------------------
-- Função + trigger: gerar/regenerar parcelas ao inserir ou editar compra_parcelada
-- No update, faz upsert por numero_parcela (preserva o status 'pago' das parcelas
-- que continuam existindo) e remove as parcelas que sobrarem se a quantidade caiu.
-- ----------------------------------------------------------------------------

create or replace function gerar_parcelas_compra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  i int;
  competencia_ref date;
  valor_parcela_calc numeric(12,2);
begin
  if TG_OP = 'UPDATE'
     and new.valor_total = old.valor_total
     and new.quantidade_parcelas = old.quantidade_parcelas
     and new.mes_inicial = old.mes_inicial
     and new.pessoas = old.pessoas then
    return new;
  end if;

  competencia_ref := to_date(new.mes_inicial || '-01', 'YYYY-MM-DD');
  valor_parcela_calc := round((new.valor_total / new.quantidade_parcelas / new.pessoas)::numeric, 2);

  for i in 0 .. (new.quantidade_parcelas - 1) loop
    insert into parcelas (compra_parcelada_id, numero_parcela, competencia, valor, status)
    values (
      new.id,
      i + 1,
      to_char(competencia_ref + (i || ' months')::interval, 'YYYY-MM'),
      valor_parcela_calc,
      'pendente'
    )
    on conflict (compra_parcelada_id, numero_parcela)
    do update set competencia = excluded.competencia, valor = excluded.valor;
  end loop;

  delete from parcelas
  where compra_parcelada_id = new.id
    and numero_parcela > new.quantidade_parcelas;

  return new;
end;
$$;

drop trigger if exists trg_gerar_parcelas on compras_parceladas;
create trigger trg_gerar_parcelas
  after insert on compras_parceladas
  for each row
  execute function gerar_parcelas_compra();

drop trigger if exists trg_atualizar_parcelas on compras_parceladas;
create trigger trg_atualizar_parcelas
  after update on compras_parceladas
  for each row
  execute function gerar_parcelas_compra();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table categorias enable row level security;
alter table receitas enable row level security;
alter table compromissos_financeiros enable row level security;
alter table cartoes enable row level security;
alter table compras_parceladas enable row level security;
alter table parcelas enable row level security;
alter table metas enable row level security;
alter table patrimonio enable row level security;

-- Tabelas com user_id direto: policy simples auth.uid() = user_id

create policy "categorias_owner" on categorias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "receitas_owner" on receitas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "compromissos_owner" on compromissos_financeiros
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "cartoes_owner" on cartoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "metas_owner" on metas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "patrimonio_owner" on patrimonio
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Tabelas filhas (sem user_id próprio): dono verificado via join

create policy "compras_parceladas_owner" on compras_parceladas
  for all using (
    exists (
      select 1 from cartoes
      where cartoes.id = compras_parceladas.cartao_id
        and cartoes.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from cartoes
      where cartoes.id = compras_parceladas.cartao_id
        and cartoes.user_id = auth.uid()
    )
  );

create policy "parcelas_owner" on parcelas
  for all using (
    exists (
      select 1 from compras_parceladas
      join cartoes on cartoes.id = compras_parceladas.cartao_id
      where compras_parceladas.id = parcelas.compra_parcelada_id
        and cartoes.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from compras_parceladas
      join cartoes on cartoes.id = compras_parceladas.cartao_id
      where compras_parceladas.id = parcelas.compra_parcelada_id
        and cartoes.user_id = auth.uid()
    )
  );
