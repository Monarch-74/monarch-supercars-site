-- Ajoute une date de fin optionnelle aux événements (plages "du ... au ...")
-- et crée la table des associations soutenues par MONARCH (gérée par l'admin,
-- visible publiquement, avec lien de don vers la plateforme de l'association).

alter table public.events
  add column if not exists event_end_date date;

create table if not exists public.associations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cause text,
  description text,
  logo_url text,
  website_url text,
  donation_url text,
  contact_email text,
  created_at timestamptz not null default now()
);

alter table public.associations enable row level security;

drop policy if exists "associations_public_read" on public.associations;
create policy "associations_public_read"
  on public.associations for select
  using (true);

drop policy if exists "associations_admin_all" on public.associations;
create policy "associations_admin_all"
  on public.associations for all
  using (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

insert into storage.buckets (id, name, public)
values ('association-logos', 'association-logos', true)
on conflict (id) do nothing;

drop policy if exists "association_logos_public_read" on storage.objects;
create policy "association_logos_public_read"
  on storage.objects for select
  using (bucket_id = 'association-logos');

drop policy if exists "association_logos_admin_insert" on storage.objects;
create policy "association_logos_admin_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'association-logos'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
