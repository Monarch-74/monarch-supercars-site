-- MONARCH SUPERCARS - Migration complémentaire
-- À exécuter dans Supabase SQL Editor (après schema.sql et seed.sql)

-- 1) Bucket de stockage pour les logos partenaires (lecture publique, upload depuis le formulaire public)
insert into storage.buckets (id, name, public)
values ('partner-logos', 'partner-logos', true)
on conflict (id) do nothing;

drop policy if exists "partner_logos_public_read" on storage.objects;
create policy "partner_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'partner-logos');

drop policy if exists "partner_logos_anon_insert" on storage.objects;
create policy "partner_logos_anon_insert"
  on storage.objects for insert
  with check (bucket_id = 'partner-logos');

-- 2) Permettre à l'administrateur (profiles.role = 'admin') de lire toutes les
--    demandes partenaires (pending/paid/rejected) et tous les messages de contact
--    depuis l'espace Admin (frontend/admin.html), en plus des lectures publiques existantes.
drop policy if exists "partners_admin_read_all" on public.partners;
create policy "partners_admin_read_all"
  on public.partners for select
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

drop policy if exists "contact_messages_admin_read" on public.contact_messages;
create policy "contact_messages_admin_read"
  on public.contact_messages for select
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

-- 3) Pour donner le rôle admin à TON compte (remplace l'email ci-dessous puis exécute une seule fois) :
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'TON_EMAIL@exemple.com');

-- Vérifier qui a actuellement le rôle admin :
-- select p.id, u.email, p.role from public.profiles p
-- join auth.users u on u.id = p.id
-- where p.role = 'admin';
