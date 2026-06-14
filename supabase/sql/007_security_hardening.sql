-- MONARCH SUPERCARS - Migration 007 : durcissement sécurité RLS
--
-- 1) Supprime les policies INSERT publiques inutilisées sur events/partners/
--    roadtrip_requests. Le parcours réel (Stripe + Edge Functions service role)
--    ne passe jamais par ces policies, qui permettaient à n'importe quel visiteur
--    (clé anon) d'insérer directement une ligne avec status="approved" et de la
--    publier instantanément sur les pages publiques, en contournant le paiement
--    et la modération admin.
--
-- 2) Applique la migration 006 (lecture admin complète sur events), oubliée lors
--    de son ajout, pour que l'admin voie les événements en attente de validation.

drop policy if exists "events_owner_insert" on public.events;
drop policy if exists "partners_owner_insert" on public.partners;
drop policy if exists "roadtrip_owner_insert" on public.roadtrip_requests;

drop policy if exists "events_admin_read_all" on public.events;
create policy "events_admin_read_all" on public.events for select using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
);
