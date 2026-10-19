-- 0002：多份简历 + 账号资料
-- 在 0001 的单简历表基础上补齐简历库所需能力，并新增用户资料表。
-- 仅登录用户可访问；所有策略都带本人归属判断。

-- ---------- 简历库：删除能力与排序索引 ----------
-- Supabase 默认会给 authenticated 授予 ALL（含 TRUNCATE，绕过 RLS），这里收紧为最小权限
revoke all on public.resumes from authenticated;
grant select, insert, update, delete on public.resumes to authenticated;

create policy "resumes_delete_own" on public.resumes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists resumes_user_updated_at_idx
  on public.resumes (user_id, updated_at desc);

-- ---------- 账号资料 ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select, insert, update on public.profiles to authenticated;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
