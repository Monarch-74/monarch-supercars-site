-- MONARCH SUPERCARS - Migration 004 : bucket de stockage pour les affiches d'événements
-- (utilisé par frontend/event-submit.html avant l'appel à create-event-checkout)

insert into storage.buckets (id, name, public)
values ('event-posters', 'event-posters', true)
on conflict (id) do nothing;

drop policy if exists "event_posters_public_read" on storage.objects;
create policy "event_posters_public_read"
  on storage.objects for select
  using (bucket_id = 'event-posters');

drop policy if exists "event_posters_anon_insert" on storage.objects;
create policy "event_posters_anon_insert"
  on storage.objects for insert
  with check (bucket_id = 'event-posters');
