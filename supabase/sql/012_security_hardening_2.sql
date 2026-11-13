-- Patch à coller dans l'éditeur SQL Supabase (dashboard).
-- Durcissement sécurité suite à audit externe (novembre 2026).

-- 1) Limite taille/type de fichier sur les buckets d'upload anonyme (event-posters,
--    partner-logos). L'upload reste anonyme par conception (soumission d'événement
--    et inscription partenaire ne nécessitent pas de compte) : on ne restreint donc
--    PAS l'authentification, seulement le type/poids du fichier accepté.
update storage.buckets
set file_size_limit = 5242880, -- 5 Mo
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id in ('event-posters', 'partner-logos');

-- 2) Purge automatique des positions GPS (roadtrip_locations) au-delà de 30 jours.
create extension if not exists pg_cron;

select cron.schedule(
  'purge-old-roadtrip-locations',
  '0 4 * * *',
  $$ delete from public.roadtrip_locations where updated_at < now() - interval '30 days'; $$
);
