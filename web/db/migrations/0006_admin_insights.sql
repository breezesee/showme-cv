-- 0006：管理总览洞察与用户筛选
-- 在 0005 基础上补充：可执行的关注队列、最近活跃用户、建立过简历的用户数，以及用户列表筛选。
-- 权限边界不变：仅 app_metadata.role=admin 可执行；返回值只含账号与简历元信息。

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
      ),
      'usersWithResume', (
        select count(distinct r.user_id)
        from public.resumes r
        join auth.users u on u.id = r.user_id
        where u.deleted_at is null
      )
    ),
    'attention', jsonb_build_object(
      'banned', (
        select count(*)
        from auth.users u
        where u.deleted_at is null
          and u.banned_until > now()
          and coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
      ),
      'noResume7d', (
        select count(*)
        from auth.users u
        left join (
          select r.user_id, count(*)::int as n
          from public.resumes r
          group by r.user_id
        ) rc on rc.user_id = u.id
        where u.deleted_at is null
          and u.created_at < now() - interval '7 days'
          and coalesce(rc.n, 0) = 0
          and coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
          and (u.banned_until is null or u.banned_until <= now())
      ),
      'inactive7d', (
        select count(*)
        from auth.users u
        where u.deleted_at is null
          and u.created_at < now() - interval '7 days'
          and (u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '7 days')
          and coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
          and (u.banned_until is null or u.banned_until <= now())
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
        order by u.created_at desc
        limit 8
      ) t
    ),
    'activeUsers', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t."lastSignInAt" desc), '[]'::jsonb)
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
          and u.last_sign_in_at is not null
          and coalesce(u.raw_app_meta_data ->> 'role', '') <> 'admin'
        order by u.last_sign_in_at desc
        limit 6
      ) t
    )
  ) into v_result;

  return v_result;
end;
$$;

-- ---------- 用户搜索（带关注筛选） ----------
-- p_filter 不设默认值，避免与旧的三参数版本产生重载歧义。
create or replace function public.admin_search_users(
  p_query text,
  p_limit int,
  p_offset int,
  p_filter text
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
  v_filter text := coalesce(nullif(btrim(p_filter), ''), 'all');
  v_total bigint;
  v_users jsonb;
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if v_filter not in ('all', 'banned', 'no_resume7d', 'inactive7d') then
    raise exception 'invalid user filter' using errcode = '22023';
  end if;

  with base as (
    select u.id, u.email, u.created_at, u.last_sign_in_at, u.banned_until,
           (coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin') as is_admin,
           coalesce(rc.n, 0) as resume_count,
           rc.last_updated
    from auth.users u
    left join (
      select r.user_id, count(*)::int as n, max(r.updated_at) as last_updated
      from public.resumes r
      group by r.user_id
    ) rc on rc.user_id = u.id
    where u.deleted_at is null
      and (v_query = '' or u.email ilike '%' || v_query || '%' or u.id::text = v_query)
  ),
  filtered as (
    select *
    from base b
    where v_filter = 'all'
       or (v_filter = 'banned' and b.banned_until > now())
       or (
         v_filter = 'no_resume7d'
         and b.created_at < now() - interval '7 days'
         and b.resume_count = 0
         and not b.is_admin
         and (b.banned_until is null or b.banned_until <= now())
       )
       or (
         v_filter = 'inactive7d'
         and b.created_at < now() - interval '7 days'
         and (b.last_sign_in_at is null or b.last_sign_in_at < now() - interval '7 days')
         and not b.is_admin
         and (b.banned_until is null or b.banned_until <= now())
       )
  )
  select count(*) into v_total from filtered;

  select coalesce(jsonb_agg(to_jsonb(t) order by t."createdAt" desc), '[]'::jsonb)
  into v_users
  from (
    select id, email, created_at as "createdAt", last_sign_in_at as "lastSignInAt",
           banned_until as "bannedUntil", is_admin as "isAdmin",
           resume_count as "resumeCount", last_updated as "lastResumeUpdate"
    from filtered
    order by created_at desc
    limit v_limit offset v_offset
  ) t;

  return jsonb_build_object('total', v_total, 'users', coalesce(v_users, '[]'::jsonb));
end;
$$;

-- 旧客户端仍可能调用三参数版本：保留为委托入口。
create or replace function public.admin_search_users(
  p_query text default '',
  p_limit int default 20,
  p_offset int default 0
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.admin_search_users(p_query, p_limit, p_offset, 'all');
$$;

revoke all on function public.admin_overview() from public, anon, authenticated;
revoke all on function public.admin_search_users(text, int, int) from public, anon, authenticated;
revoke all on function public.admin_search_users(text, int, int, text) from public, anon, authenticated;

grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_search_users(text, int, int) to authenticated;
grant execute on function public.admin_search_users(text, int, int, text) to authenticated;
