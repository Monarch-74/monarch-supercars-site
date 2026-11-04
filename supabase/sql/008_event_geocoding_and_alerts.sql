-- Patch à coller dans l'éditeur SQL Supabase (dashboard).
-- 1) Coordonnées pour l'affichage carte (Leaflet / OpenStreetMap).
alter table public.events
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- 2) Abonnements aux alertes email "nouveaux événements près de chez vous".
-- Lecture réservée au service_role (edge function admin-update-status) : aucune
-- policy SELECT publique, pour ne jamais exposer les emails des abonnés.
create table if not exists public.event_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  country text not null,
  department text not null,
  created_at timestamptz not null default now()
);

alter table public.event_alerts enable row level security;

drop policy if exists "event_alerts_public_insert" on public.event_alerts;
create policy "event_alerts_public_insert" on public.event_alerts
  for insert with check (true);
