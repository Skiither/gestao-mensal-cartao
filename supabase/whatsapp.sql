-- ============================================================================
-- Bot do WhatsApp — tabelas extras
-- Rode este arquivo no SQL editor do Supabase (depois do schema.sql).
-- O bot (api/whatsapp.ts) acessa estas tabelas com a chave service_role, que
-- ignora RLS; as policies abaixo valem só para o app no navegador.
-- ============================================================================

-- Número de WhatsApp ligado a cada conta. Só o bot cria (depois de conferir o
-- código); o dono pode ver e desconectar pelo app.
create table if not exists whatsapp_vinculos (
  telefone text primary key, -- como o WhatsApp manda: só dígitos, com DDI (ex.: 5511999999999)
  user_id uuid not null unique references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- Código temporário gerado em Configurações para provar que o dono da conta é
-- o dono do número. Um por usuário; gerar outro substitui o anterior.
create table if not exists whatsapp_codigos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  codigo text not null unique,
  expira_em timestamptz not null
);

-- Andamento da conversa de cada número (em que pergunta parou e o que já foi
-- respondido), mais o limite de tentativas de código errado.
create table if not exists whatsapp_conversas (
  telefone text primary key,
  etapa text not null default 'livre',
  rascunho jsonb,
  tentativas_codigo int not null default 0,
  bloqueado_ate timestamptz,
  atualizado_em timestamptz not null default now()
);

-- Ids das mensagens já tratadas: o WhatsApp reenvia o webhook se demorarmos a
-- responder, e sem isso o mesmo gasto seria lançado duas vezes.
create table if not exists whatsapp_mensagens (
  id text primary key,
  recebida_em timestamptz not null default now()
);

alter table whatsapp_vinculos enable row level security;
alter table whatsapp_codigos enable row level security;
alter table whatsapp_conversas enable row level security;
alter table whatsapp_mensagens enable row level security;

create policy "whatsapp_vinculos_owner_select" on whatsapp_vinculos
  for select using (auth.uid() = user_id);

create policy "whatsapp_vinculos_owner_delete" on whatsapp_vinculos
  for delete using (auth.uid() = user_id);

create policy "whatsapp_codigos_owner" on whatsapp_codigos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- whatsapp_conversas e whatsapp_mensagens: sem policies, só o bot acessa.
