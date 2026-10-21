-- 0005：管理端（运营总览 + 用户支持）
-- 权限边界：所有 RPC 仅允许携带 app_metadata.role=admin 的登录用户执行；
-- 返回值只含账号与简历元信息，绝不返回 resumes.data、分享密文或 Storage 对象地址。
-- 管理员授权不提供界面，通过 Supabase 管理端或受控 SQL 设置 app_metadata.role。

-- ---------- 审计日志 ----------
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  actor_email text not null default '',
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon, authenticated;
-- 不创建策略：普通用户无法读写；security definer 函数以所有者权限访问。

create index if not exists admin_audit_created_at_idx
  on public.admin_audit (created_at desc);

-- ---------- 总览 ----------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (
        select count(*) from auth.users u
        where u.deleted_at is null
      ),
      'new7d', (
        select count(*) from auth.users u
        where u.deleted_at is null and u.created_at >= now() - interval '7 days'
      ),
      'active7d', (
        select count(*) from auth.users u
        where u.deleted_at is null and u.last_sign_in_at >= now() - interval '7 days'
      )
    ),
    'resumes', jsonb_build_object(
      'total', (
        select count(*) from public.resumes r
        join auth.users u on u.id = r.user_id
        where u.deleted_at is null
      ),
      'new7d', (
        select count(*) from public.resumes r
        join auth.users u on u.id = r.user_id
        where u.deleted_at is null and r.created_at >= now() - interval '7 days'
      ),
      'updated7d', (
        select count(*) from public.resumes r
        join auth.users u on u.id = r.user_id
        where u.deleted_at is null and r.updated_at >= now() - interval '7 days'
      )
    ),
    'daily', jsonb_build_object(
      'users', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object('date', to_char(d.day, 'MM-DD'), 'count', coalesce(c.n, 0))
            order by d.day
          ),
          '[]'::jsonb
        )
        from generate_series(
          (now() at time zone 'Asia/Shanghai')::date - 13,
          (now() at time zone 'Asia/Shanghai')::date,
          interval '1 day'
        ) as d(day)
        left join (
          select (u.created_at at time zone 'Asia/Shanghai')::date as day, count(*)::int as n
          from auth.users u
          where u.deleted_at is null
            and u.created_at >= (now() at time zone 'Asia/Shanghai')::date - 13
          group by 1
        ) c on c.day = d.day::date
      ),
      'resumes', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object('date', to_char(d.day, 'MM-DD'), 'count', coalesce(c.n, 0))
            order by d.day
          ),
          '[]'::jsonb
        )
        from generate_series(
          (now() at time zone 'Asia/Shanghai')::date - 13,
          (now() at time zone 'Asia/Shanghai')::date,
          interval '1 day'
        ) as d(day)
        left join (
          select (r.created_at at time zone 'Asia/Shanghai')::date as day, count(*)::int as n
          from public.resumes r
          join auth.users u on u.id = r.user_id
          where u.deleted_at is null
            and r.created_at >= (now() at time zone 'Asia/Shanghai')::date - 13
          group by 1
        ) c on c.day = d.day::date
      )
    ),
    'recentUsers', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t."createdAt" desc), '[]'::jsonb)
      from (
        select u.id, u.email, u.created_at as "createdAt", u.last_sign_in_at as "lastSignInAt",
               coalesce(rc.n, 0) as "resumeCount"
        from auth.users u
        left join (
          select r.user_id, count(*)::int as n
          from public.resumes r
          group by r.user_id
        ) rc on rc.user_id = u.id
        where u.deleted_at is null
        order by u.created_at desc
        limit 8
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------- 用户搜索 ----------
create or replace function public.admin_search_users(
  p_query text default '',
  p_limit int default 20,
  p_offset int default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := btrim(coalesce(p_query, ''));
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_total bigint;
  v_users jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select count(*) into v_total
  from auth.users u
  where u.deleted_at is null
    and (v_query = '' or u.email ilike '%' || v_query || '%' or u.id::text = v_query);

  select coalesce(jsonb_agg(to_jsonb(t) order by t."createdAt" desc), '[]'::jsonb)
  into v_users
  from (
    select u.id, u.email, u.created_at as "createdAt", u.last_sign_in_at as "lastSignInAt",
           u.banned_until as "bannedUntil",
           (coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin') as "isAdmin",
           coalesce(rc.n, 0) as "resumeCount",
           rc.last_updated as "lastResumeUpdate"
    from auth.users u
    left join (
      select r.user_id, count(*)::int as n, max(r.updated_at) as last_updated
      from public.resumes r
      group by r.user_id
    ) rc on rc.user_id = u.id
    where u.deleted_at is null
      and (v_query = '' or u.email ilike '%' || v_query || '%' or u.id::text = v_query)
    order by u.created_at desc
    limit v_limit offset v_offset
  ) t;

  return jsonb_build_object('total', v_total, 'users', coalesce(v_users, '[]'::jsonb));
end;
$$;

-- ---------- 用户详情（只含元信息） ----------
create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id and u.deleted_at is null
  ) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'user', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'createdAt', u.created_at,
        'emailConfirmedAt', u.email_confirmed_at,
        'lastSignInAt', u.last_sign_in_at,
        'bannedUntil', u.banned_until,
        'isAdmin', (coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin')
      )
      from auth.users u
      where u.id = p_user_id
    ),
    'profile', (
      select jsonb_build_object('displayName', p.display_name)
      from public.profiles p
      where p.id = p_user_id
    ),
    'resumes', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'name', r.name,
            'createdAt', r.created_at,
            'updatedAt', r.updated_at,
            'bytes', octet_length(r.data::text)
          )
          order by r.updated_at desc
        ),
        '[]'::jsonb
      )
      from public.resumes r
      where r.user_id = p_user_id
    ),
    'storage', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('bucket', s.bucket_id, 'objects', s.n, 'bytes', s.bytes)
          order by s.bucket_id
        ),
        '[]'::jsonb
      )
      from (
        select o.bucket_id,
               count(*)::int as n,
               coalesce(
                 sum(
                   case
                     when (o.metadata ->> 'size') ~ '^[0-9]+$' then (o.metadata ->> 'size')::bigint
                     else 0
                   end
                 ),
                 0
               ) as bytes
        from storage.objects o
        where o.bucket_id in ('resume-photos', 'avatars')
          and (storage.foldername(o.name))[1] = p_user_id::text
          and coalesce(o.is_delete_marker, false) = false
        group by o.bucket_id
      ) s
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------- 禁用 / 恢复登录 ----------
-- 禁用会写入 banned_until（GoTrue 登录时校验），并清除会话与刷新令牌；
-- 已签发的 access token 仍可能存活到自然过期（通常 1 小时内）。
create or replace function public.admin_set_ban(p_user_id uuid, p_banned boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_target_email text;
  v_target_is_admin boolean;
  v_banned_until timestamptz;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_banned is null then
    raise exception 'invalid ban state' using errcode = '22023';
  end if;
  if v_actor = p_user_id then
    raise exception 'cannot ban yourself' using errcode = '22023';
  end if;

  select u.email, coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
  into v_target_email, v_target_is_admin
  from auth.users u
  where u.id = p_user_id and u.deleted_at is null;

  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if v_target_is_admin then
    raise exception 'cannot ban an admin' using errcode = '22023';
  end if;

  if p_banned then
    v_banned_until := now() + interval '100 years';
    update auth.users
    set banned_until = v_banned_until, updated_at = now()
    where id = p_user_id;

    delete from auth.refresh_tokens where user_id = p_user_id::text;
    delete from auth.sessions where user_id = p_user_id;
  else
    v_banned_until := null;
    update auth.users
    set banned_until = null, updated_at = now()
    where id = p_user_id;
  end if;

  select u.email into v_actor_email from auth.users u where u.id = v_actor;

  insert into public.admin_audit (actor_id, actor_email, action, target_type, target_id, detail)
  values (
    v_actor,
    coalesce(v_actor_email, ''),
    case when p_banned then 'user.ban' else 'user.unban' end,
    'user',
    p_user_id::text,
    jsonb_build_object('email', coalesce(v_target_email, ''))
  );

  return jsonb_build_object('banned', p_banned, 'bannedUntil', v_banned_until);
end;
$$;

-- ---------- 记录非禁用类操作（如重置密码邮件） ----------
create or replace function public.admin_log_action(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if coalesce(btrim(p_action), '') = ''
     or coalesce(btrim(p_target_type), '') = ''
     or coalesce(btrim(p_target_id), '') = '' then
    raise exception 'invalid audit entry' using errcode = '22023';
  end if;

  select u.email into v_actor_email from auth.users u where u.id = v_actor;

  insert into public.admin_audit (actor_id, actor_email, action, target_type, target_id, detail)
  values (
    v_actor,
    coalesce(v_actor_email, ''),
    left(p_action, 80),
    left(p_target_type, 40),
    left(p_target_id, 120),
    coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;

-- ---------- 最近操作 ----------
create or replace function public.admin_recent_audit(p_limit int default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(t) order by t."createdAt" desc), '[]'::jsonb)
    from (
      select a.id,
             a.actor_email as "actorEmail",
             a.action,
             a.target_type as "targetType",
             a.target_id as "targetId",
             a.detail,
             a.created_at as "createdAt"
      from public.admin_audit a
      order by a.created_at desc
      limit v_limit
    ) t
  );
end;
$$;

-- ---------- 执行权限 ----------
revoke all on function public.admin_overview() from public, anon, authenticated;
revoke all on function public.admin_search_users(text, int, int) from public, anon, authenticated;
revoke all on function public.admin_user_detail(uuid) from public, anon, authenticated;
revoke all on function public.admin_set_ban(uuid, boolean) from public, anon, authenticated;
revoke all on function public.admin_log_action(text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_recent_audit(int) from public, anon, authenticated;

grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_search_users(text, int, int) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_set_ban(uuid, boolean) to authenticated;
grant execute on function public.admin_log_action(text, text, text, jsonb) to authenticated;
grant execute on function public.admin_recent_audit(int) to authenticated;
