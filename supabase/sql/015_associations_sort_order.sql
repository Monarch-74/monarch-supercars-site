-- Ajoute un ordre d'affichage manuel pour les associations (ex: "la mettre en 2ème position").
-- Tri croissant, valeurs nulles affichées en dernier.

alter table public.associations
  add column if not exists sort_order integer;
