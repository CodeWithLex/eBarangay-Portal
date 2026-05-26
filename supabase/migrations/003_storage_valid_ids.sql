-- Storage bucket for valid ID uploads (required for document requests)
-- Run in Supabase → SQL Editor

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'valid-ids',
  'valid-ids',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Residents upload/read only their own folder: {user_id}/filename
drop policy if exists "valid-ids: own upload" on storage.objects;
create policy "valid-ids: own upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'valid-ids'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "valid-ids: own read" on storage.objects;
create policy "valid-ids: own read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'valid-ids'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "valid-ids: own update" on storage.objects;
create policy "valid-ids: own update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'valid-ids'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

notify pgrst, 'reload schema';
