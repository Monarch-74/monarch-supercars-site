-- MONARCH SUPERCARS - Migration 006 : lecture admin sur la table events
-- Permet à l'administrateur (rôle "admin" dans public.profiles) de voir tous les
-- événements (y compris pending_review/paid/rejected) dans la page admin, comme
-- c'est déjà le cas pour la table partners.

drop policy if exists "events_admin_read_all" on public.events;
create policy "events_admin_read_all" on public.events for select using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);
