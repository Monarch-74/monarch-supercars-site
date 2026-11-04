-- Coordonnées pour l'affichage carte (Leaflet). Nullable : rempli plus tard par
-- géocodage côté client (MVP) ou côté admin à l'approbation (stretch goal futur).
alter table public.events
  add column if not exists lat double precision,
  add column if not exists lng double precision;
