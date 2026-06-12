-- MONARCH SUPERCARS - Migration 005 : suivi de fréquentation pour le dashboard admin
-- Ajoute une table de mesure d'audience (pages vues, sessions, durée de consultation)
-- alimentée par frontend/js/analytics.js et lue par la fonction admin-dashboard.

create extension if not exists pgcrypto;

create table if not exists public.analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  path text,
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists analytics_sessions_session_id_idx on public.analytics_sessions (session_id);
create index if not exists analytics_sessions_created_at_idx on public.analytics_sessions (created_at);

alter table public.analytics_sessions enable row level security;

-- Le tracker frontend écrit avec la clé anonyme : tout visiteur peut créer/mettre à
-- jour son propre enregistrement de visite (aucune lecture publique n'est autorisée).
drop policy if exists "analytics_insert_anyone" on public.analytics_sessions;
create policy "analytics_insert_anyone" on public.analytics_sessions for insert with check (true);

drop policy if exists "analytics_update_anyone" on public.analytics_sessions;
create policy "analytics_update_anyone" on public.analytics_sessions for update using (true) with check (true);

-- Agrégats utilisés par la fonction Edge admin-dashboard (appelée avec la clé service_role).
create or replace function public.admin_analytics_summary()
returns table (
  page_views bigint,
  unique_visits bigint,
  duration_min integer,
  duration_max integer,
  duration_avg numeric
)
language sql
stable
as $$
  select
    count(*) as page_views,
    count(distinct session_id) as unique_visits,
    min(duration_seconds) filter (where duration_seconds > 0) as duration_min,
    max(duration_seconds) filter (where duration_seconds > 0) as duration_max,
    round(avg(duration_seconds) filter (where duration_seconds > 0)) as duration_avg
  from public.analytics_sessions;
$$;
