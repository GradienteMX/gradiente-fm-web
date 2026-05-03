-- ============================================================================
-- 0003_storage.sql — uploads bucket + storage RLS (squash of 0013)
-- ============================================================================
-- Image-upload bucket. Files compressed client-side via
-- browser-image-compression (lib/imageUpload.ts) and uploaded under
-- `${user.id}/${random}.{ext}`. The first folder segment is the auth uid —
-- gate for self-only writes.
--
-- Public bucket: read is unauthenticated (cards/overlays serve from
-- ${SUPABASE_URL}/storage/v1/object/public/uploads/...). Writes restricted
-- to authenticated users on their own folder.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

create policy uploads_self_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy uploads_self_update on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy uploads_self_delete on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy uploads_public_read on storage.objects
  for select
  using (bucket_id = 'uploads');
