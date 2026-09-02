insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-assets',
  'content-assets',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists content_assets_owner_select on storage.objects;
drop policy if exists content_assets_owner_insert on storage.objects;
drop policy if exists content_assets_owner_update on storage.objects;
drop policy if exists content_assets_owner_delete on storage.objects;

create policy content_assets_owner_select on storage.objects
for select to authenticated
using (bucket_id = 'content-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy content_assets_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'content-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy content_assets_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'content-assets' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'content-assets' and (storage.foldername(name))[1] = auth.uid()::text);

create policy content_assets_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'content-assets' and (storage.foldername(name))[1] = auth.uid()::text);
