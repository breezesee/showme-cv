-- ShowMe 云同步：每用户一份简历（name 维度为将来多份简历预留）
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '我的简历',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.resumes enable row level security;

revoke all on public.resumes from anon;
grant select, insert, update on public.resumes to authenticated;

create policy "resumes_select_own" on public.resumes
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "resumes_insert_own" on public.resumes
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "resumes_update_own" on public.resumes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 删除入口落地（多份简历）时再补 delete 策略

-- updated_at 由服务器维护：客户端时钟不可信，合并判定依赖它
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger resumes_set_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();
