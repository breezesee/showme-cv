-- 照片：公开读桶（UUID 路径不可猜），登录用户只能写入自己的 uid 目录。
-- 不提供 anon SELECT 策略，避免匿名列举；公开 URL 读取不经过 RLS。
-- 删除简历照片时只清空 JSON 中的路径，不删除对象，避免历史分享破图。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resume-photos', 'resume-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resume_photos_insert_own" on storage.objects;
create policy "resume_photos_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resume-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

drop policy if exists "resume_photos_select_own" on storage.objects;
create policy "resume_photos_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resume-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
