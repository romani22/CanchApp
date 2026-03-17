2-- Migración 009: bucket de Storage para avatares de perfil

-- Crear el bucket público "avatars"
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,                          -- público: las URLs son accesibles sin auth
  2097152,                       -- 2 MB máximo por archivo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Política: cualquier usuario autenticado puede subir su propio avatar
create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: el dueño puede actualizar su avatar
create policy "Users can update their own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: el dueño puede eliminar su avatar
create policy "Users can delete their own avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Política: cualquiera puede ver avatares (bucket público)
create policy "Anyone can view avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');