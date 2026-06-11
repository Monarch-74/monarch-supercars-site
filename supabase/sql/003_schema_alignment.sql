-- MONARCH SUPERCARS - Migration 003 : alignement de la base de production
-- avec le schéma attendu par les fonctions Edge (partner-request-intake,
-- create-partner-checkout, create-event-checkout, admin-dashboard,
-- admin-update-status, ai-roadtrip-plan, stripe-webhook, contact-intake).
--
-- Migration purement additive : aucune table ni colonne existante n'est supprimée.

create extension if not exists pgcrypto;

-- 1) Table profiles (rôles : user / admin / partner)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('user','admin','partner')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill : créer un profil pour les comptes déjà existants
insert into public.profiles (id, full_name)
select id, coalesce(raw_user_meta_data->>'full_name','')
from auth.users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id);

-- 2) Table partners : colonnes attendues par partner-request-intake,
--    create-partner-checkout, admin-dashboard, admin-update-status, stripe-webhook
alter table public.partners
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists company_name text,
  add column if not exists contact_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists website_url text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_payment_status text default 'unpaid';

alter table public.partners
  add column if not exists status text not null default 'pending' check (status in ('pending','paid','approved','rejected','inactive'));

-- Reprise des anciennes colonnes vers les nouvelles si des partenaires existent déjà
update public.partners set company_name = coalesce(company_name, name) where company_name is null;
update public.partners set website_url = coalesce(website_url, website) where website_url is null;
update public.partners set email = coalesce(email, '') where email is null;

-- L'ancienne colonne "name" était NOT NULL mais n'est plus renseignée par
-- partner-request-intake / create-partner-checkout (qui utilisent company_name)
alter table public.partners alter column name drop not null;

alter table public.partners enable row level security;
drop policy if exists "partners_public_read_approved" on public.partners;
create policy "partners_public_read_approved" on public.partners for select using (status = 'approved');
drop policy if exists "partners_owner_insert" on public.partners;
create policy "partners_owner_insert" on public.partners for insert with check (auth.uid() = user_id or user_id is null);
drop policy if exists "partners_owner_read" on public.partners;
create policy "partners_owner_read" on public.partners for select using (auth.uid() = user_id);
drop policy if exists "partners_admin_read_all" on public.partners;
create policy "partners_admin_read_all" on public.partners for select using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

-- 3) Table events : colonnes attendues par create-event-checkout,
--    admin-dashboard, admin-update-status, stripe-webhook
alter table public.events
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists country text,
  add column if not exists department text,
  add column if not exists venue_name text,
  add column if not exists event_date date,
  add column if not exists phone text,
  add column if not exists contact_email text,
  add column if not exists poster_url text,
  add column if not exists source_type text default 'manual' check (source_type in ('manual','semi_assisted','official_api')),
  add column if not exists external_source text,
  add column if not exists external_url text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_status text default 'unpaid';

alter table public.events
  add column if not exists status text not null default 'draft' check (status in ('draft','paid','pending_review','approved','rejected','archived'));

-- Reprise des anciennes colonnes vers les nouvelles si des événements existent déjà
update public.events set poster_url = coalesce(poster_url, image_url) where poster_url is null;
update public.events set external_url = coalesce(external_url, link) where external_url is null;
update public.events set event_date = coalesce(event_date, date) where event_date is null;

alter table public.events enable row level security;
drop policy if exists "events_public_read_approved" on public.events;
create policy "events_public_read_approved" on public.events for select using (status = 'approved');
drop policy if exists "events_owner_insert" on public.events;
create policy "events_owner_insert" on public.events for insert with check (auth.uid() = user_id or user_id is null);
drop policy if exists "events_owner_read" on public.events;
create policy "events_owner_read" on public.events for select using (auth.uid() = user_id);

-- 4) contact_messages : ajout du statut utilisé par l'espace admin
alter table public.contact_messages add column if not exists status text not null default 'new';

alter table public.contact_messages enable row level security;
drop policy if exists "contact_messages_admin_read" on public.contact_messages;
create policy "contact_messages_admin_read" on public.contact_messages for select using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);

-- 5) roadtrip_requests : utilisée par ai-roadtrip-plan
create table if not exists public.roadtrip_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null,
  ai_summary text,
  route_google_maps_url text,
  route_waze_url text,
  created_at timestamptz not null default now()
);

alter table public.roadtrip_requests enable row level security;
drop policy if exists "roadtrip_owner_insert" on public.roadtrip_requests;
create policy "roadtrip_owner_insert" on public.roadtrip_requests for insert with check (auth.uid() = user_id or user_id is null);
drop policy if exists "roadtrip_owner_read" on public.roadtrip_requests;
create policy "roadtrip_owner_read" on public.roadtrip_requests for select using (auth.uid() = user_id);

-- 6) audit_logs et payments : utilisées par admin-update-status, create-partner-checkout,
--    create-event-checkout, stripe-webhook (toujours via la clé service_role -> RLS
--    activée sans policy publique = accès réservé au backend)
create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_user_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('partner','event')),
  target_id uuid not null,
  amount_cents integer not null,
  currency text not null default 'eur',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  payment_status text not null default 'created',
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;

-- 7) Donne le rôle admin au compte du propriétaire de l'application
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'admin@monarch-apps.com');
