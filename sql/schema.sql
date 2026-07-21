-- =========================================================
-- SISTEMA RH - ESTOQUE + EXAMES PERIÓDICOS
-- Rode este script inteiro no SQL Editor do seu projeto Supabase
-- (Supabase > seu projeto > SQL Editor > New query > colar > Run)
-- =========================================================

-- Extensão necessária para gerar IDs únicos (uuid)
create extension if not exists "pgcrypto";

-- Observação: se você já rodou este script antes e está só
-- atualizando (ex: para ganhar o trigger de reversão de estoque),
-- pode rodar o arquivo inteiro de novo sem medo — os comandos usam
-- "if not exists" / "or replace" e não apagam dados existentes.

-- ---------------------------------------------------------
-- TABELA: materiais
-- ---------------------------------------------------------
create table if not exists materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text,
  unidade text not null default 'un',
  quantidade_atual numeric not null default 0,
  estoque_minimo numeric not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TABELA: funcionarios
-- ---------------------------------------------------------
create table if not exists funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text,
  setor text,
  data_admissao date,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Garante as colunas novas mesmo em bancos que já tinham a tabela
alter table funcionarios add column if not exists sexo text;
alter table funcionarios add column if not exists idade integer;
alter table funcionarios add column if not exists dependentes text;

-- ---------------------------------------------------------
-- TABELA: movimentacoes_estoque
-- (toda entrada/saída de material fica registrada aqui)
-- ---------------------------------------------------------
create table if not exists movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materiais(id) on delete cascade,
  funcionario_id uuid references funcionarios(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  quantidade numeric not null check (quantidade > 0),
  observacao text,
  data timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TABELA: exames_periodicos
-- ---------------------------------------------------------
create table if not exists exames_periodicos (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  data_ultimo_exame date not null,
  data_proximo_exame date not null,
  realizado boolean not null default false,
  observacao text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- TABELA: avaliacoes
-- Guarda as avaliações PAFDC-RH, PDR, PDI e Treinamento.
-- As datas (1ª, 2ª, 3ª e Eficácia) são preenchidas manualmente
-- pelo RH; o sistema avisa quando a próxima data preenchida
-- estiver perto (mesma lógica do exame periódico).
-- ---------------------------------------------------------
create table if not exists avaliacoes (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  tipo text not null check (tipo in ('pafdc_rh', 'pdr', 'pdi', 'pde', 'treinamento')),
  departamento text,
  data_1 date,
  data_eficacia date,
  data_2 date,
  data_3 date,
  observacao text,
  created_at timestamptz not null default now()
);

-- Garante a coluna nova mesmo em bancos que já tinham a tabela
alter table avaliacoes add column if not exists resultado text;

-- Libera o tipo "pde" em bancos que já tinham a tabela criada
-- antes dessa opção existir
alter table avaliacoes drop constraint if exists avaliacoes_tipo_check;
alter table avaliacoes add constraint avaliacoes_tipo_check
  check (tipo in ('pafdc_rh', 'pdr', 'pdi', 'pde', 'treinamento'));

-- ---------------------------------------------------------
-- TRIGGER: atualiza automaticamente a quantidade_atual do
-- material sempre que uma movimentação é inserida.
-- Entrada soma, saída subtrai.
-- ---------------------------------------------------------
create or replace function fn_atualizar_estoque()
returns trigger as $$
begin
  if new.tipo = 'entrada' then
    update materiais
      set quantidade_atual = quantidade_atual + new.quantidade
      where id = new.material_id;
  elsif new.tipo = 'saida' then
    update materiais
      set quantidade_atual = quantidade_atual - new.quantidade
      where id = new.material_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_atualizar_estoque on movimentacoes_estoque;
create trigger trg_atualizar_estoque
after insert on movimentacoes_estoque
for each row execute function fn_atualizar_estoque();

-- ---------------------------------------------------------
-- TRIGGER: quando uma movimentação é EXCLUÍDA, desfaz o efeito
-- dela no estoque (o inverso do trigger acima).
-- ---------------------------------------------------------
create or replace function fn_reverter_estoque()
returns trigger as $$
begin
  if old.tipo = 'entrada' then
    update materiais
      set quantidade_atual = quantidade_atual - old.quantidade
      where id = old.material_id;
  elsif old.tipo = 'saida' then
    update materiais
      set quantidade_atual = quantidade_atual + old.quantidade
      where id = old.material_id;
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_reverter_estoque on movimentacoes_estoque;
create trigger trg_reverter_estoque
after delete on movimentacoes_estoque
for each row execute function fn_reverter_estoque();

-- ---------------------------------------------------------
-- GRANTS: garante que as tabelas fiquem acessíveis pela API
-- (em projetos novos do Supabase, tabelas criadas pelo SQL
-- Editor não ficam expostas à API automaticamente)
-- ---------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on materiais to anon, authenticated;
grant select, insert, update, delete on funcionarios to anon, authenticated;
grant select, insert, update, delete on movimentacoes_estoque to anon, authenticated;
grant select, insert, update, delete on exames_periodicos to anon, authenticated;
grant select, insert, update, delete on avaliacoes to anon, authenticated;

-- =========================================================
-- IMPORTANTE - SOBRE SEGURANÇA (RLS)
-- =========================================================
-- Por padrão essas tabelas ficam com RLS (Row Level Security)
-- DESLIGADO, ou seja, qualquer pessoa que tiver a "chave anon"
-- do projeto consegue ler/gravar. Isso é aceitável para um
-- sistema interno, mas a chave não deve ser exposta publicamente
-- (não publique este projeto em um site público sem antes
-- adicionar autenticação). Se quiser evoluir isso depois,
-- me avise que te ajudo a colocar login por e-mail/senha do RH.
-- =========================================================
