-- Colonne pour les événements mis en avant manuellement par l'équipe MONARCH
-- (section "Sélection MONARCH" dans events.html — sans IA, choix humain)
alter table public.events
  add column if not exists is_featured boolean not null default false;

-- Les événements mis en avant restent lisibles par tous les utilisateurs connectés
-- (la RLS existante couvre déjà les events approuvés pour la lecture publique)
