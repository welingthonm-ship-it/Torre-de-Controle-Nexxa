-- Torre de Controle Nexxa — estrutura do banco no Supabase (rodar uma vez no SQL Editor).
-- Não contém senhas nem dados de clientes.

-- 1) Documentos do portal (perfis, alertas, configurações, datasets...), no mesmo formato usado no Claude
create table if not exists public.docs (
  path        text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
alter table public.docs enable row level security;

-- 2) Quem pode entrar: um login por pessoa, ligado a um perfil do portal
create table if not exists public.acessos (
  user_id  uuid primary key references auth.users on delete cascade,
  usuario  text unique not null,
  perfil   text not null,
  editor   boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table public.acessos enable row level security;

create or replace function public.eh_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select editor from public.acessos where user_id = auth.uid()), false)
$$;
create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.acessos where user_id = auth.uid())
$$;

drop policy if exists "ler o proprio acesso" on public.acessos;
create policy "ler o proprio acesso" on public.acessos for select to authenticated
  using (user_id = auth.uid() or public.eh_editor());

-- Leitura: qualquer pessoa com login cadastrado. Escrita: só editores,
-- exceto alertas das rotas (operação e Customer Service registram) e dados pessoais.
drop policy if exists "ler docs" on public.docs;
create policy "ler docs" on public.docs for select to authenticated using (public.tem_acesso());
drop policy if exists "editor grava docs" on public.docs;
create policy "editor grava docs" on public.docs for all to authenticated
  using (public.eh_editor()) with check (public.eh_editor());
drop policy if exists "alertas" on public.docs;
create policy "alertas" on public.docs for all to authenticated
  using (public.tem_acesso() and path like 'alertas/%')
  with check (public.tem_acesso() and path like 'alertas/%');
drop policy if exists "validacoes" on public.docs;
create policy "validacoes" on public.docs for all to authenticated
  using (public.tem_acesso() and path like 'validacoes/%')
  with check (public.tem_acesso() and path like 'validacoes/%');
drop policy if exists "informados" on public.docs;
create policy "informados" on public.docs for all to authenticated
  using (public.tem_acesso() and path like 'informados/%')
  with check (public.tem_acesso() and path like 'informados/%');
drop policy if exists "dados pessoais" on public.docs;
create policy "dados pessoais" on public.docs for all to authenticated
  using (path like 'data/users/' || auth.uid()::text || '/%')
  with check (path like 'data/users/' || auth.uid()::text || '/%');

-- Atualização em tempo real (alertas, perfis e novos dados aparecem para todos na hora)
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Permissões da API (necessárias quando o projeto não libera tabelas novas automaticamente)
grant usage on schema public to anon, authenticated;
grant select on public.acessos to authenticated;
grant select, insert, update, delete on public.docs to authenticated;
grant execute on function public.eh_editor() to authenticated;
grant execute on function public.tem_acesso() to authenticated;

-- 3) Arquivos (as tabelas CSV geradas pela aba Atualizar dados)
insert into storage.buckets (id, name, public) values ('arquivos', 'arquivos', false)
  on conflict (id) do nothing;
drop policy if exists "ler arquivos" on storage.objects;
create policy "ler arquivos" on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and public.tem_acesso());
drop policy if exists "editor envia arquivos" on storage.objects;
create policy "editor envia arquivos" on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and public.eh_editor());
drop policy if exists "editor apaga arquivos" on storage.objects;
create policy "editor apaga arquivos" on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and public.eh_editor());

-- 4) Criar ou alterar um login (só roda no SQL Editor; o site não consegue chamar)
--    select public.criar_login('usuario', 'senha', 'perfil', editor true/false);
create extension if not exists pgcrypto with schema extensions;
create or replace function public.criar_login(p_usuario text, p_senha text, p_perfil text, p_editor boolean default false)
returns uuid language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  em  text := lower(trim(p_usuario)) || '@torre-nexxa.com';
  uid uuid;
begin
  if length(p_senha) < 6 then raise exception 'A senha precisa ter pelo menos 6 caracteres'; end if;
  select id into uid from auth.users where email = em;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', em,
      crypt(p_senha, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
      jsonb_build_object('sub', uid::text, 'email', em, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = crypt(p_senha, gen_salt('bf')), updated_at = now() where id = uid;
  end if;
  insert into public.acessos (user_id, usuario, perfil, editor) values (uid, lower(trim(p_usuario)), p_perfil, p_editor)
    on conflict (user_id) do update set perfil = excluded.perfil, editor = excluded.editor;
  insert into public.docs (path, data) values ('usuarios/' || uid, jsonb_build_object('perfil', p_perfil, 'usuario', lower(trim(p_usuario))))
    on conflict (path) do update set data = excluded.data, updated_at = now();
  return uid;
end $$;
revoke all on function public.criar_login(text, text, text, boolean) from public, anon, authenticated;

-- Remover um login:  select public.remover_login('usuario');
create or replace function public.remover_login(p_usuario text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  select user_id into uid from public.acessos where usuario = lower(trim(p_usuario));
  if uid is null then return; end if;
  delete from public.docs where path = 'usuarios/' || uid;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.remover_login(text) from public, anon, authenticated;
