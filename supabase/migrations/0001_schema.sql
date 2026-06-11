create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'user' check (role in ('user','admin','partner')),
  created_at timestamptz not null default now()
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  company_name text not null,
  contact_name text,
  email text not null,
  phone text,
  website_url text,
  logo_url text,
  description text,
  stripe_checkout_session_id text,
  stripe_customer_id text,
  stripe_payment_status text default 'unpaid',
  status text not null default 'pending' check (status in ('pending','paid','approved','rejected','inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  country text not null,
  department text not null,
  venue_name text,
  address text,
  event_date date,
  phone text,
  contact_email text,
  poster_url text,
  description text,
  source_type text default 'manual' check (source_type in ('manual','semi_assisted','official_api')),
  external_source text,
  external_url text,
  stripe_checkout_session_id text,
  stripe_payment_status text default 'unpaid',
  status text not null default 'draft' check (status in ('draft','paid','pending_review','approved','rejected','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.roadtrip_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  payload jsonb not null,
  ai_summary text,
  route_google_maps_url text,
  route_waze_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_user_id uuid,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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

alter table public.partners enable row level security;
alter table public.events enable row level security;
alter table public.contact_messages enable row level security;
alter table public.roadtrip_requests enable row level security;
alter table public.audit_logs enable row level security;
alter table public.payments enable row level security;
alter table public.profiles enable row level security;

create policy "profiles_self_read" on public.profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id);

create policy "partners_public_read_approved" on public.partners for select using (status = 'approved');
create policy "partners_owner_insert" on public.partners for insert with check (auth.uid() = user_id or user_id is null);
create policy "partners_owner_read" on public.partners for select using (auth.uid() = user_id);

create policy "events_public_read_approved" on public.events for select using (status = 'approved');
create policy "events_owner_insert" on public.events for insert with check (auth.uid() = user_id or user_id is null);
create policy "events_owner_read" on public.events for select using (auth.uid() = user_id);

create policy "roadtrip_owner_insert" on public.roadtrip_requests for insert with check (auth.uid() = user_id or user_id is null);
create policy "roadtrip_owner_read" on public.roadtrip_requests for select using (auth.uid() = user_id);

-- Admin access is handled by service role in Edge Functions.
