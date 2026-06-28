-- 1. Accorde le rôle admin à l'administrateur par email
--    (remplacez l'email si nécessaire)
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'thivand@gmail.com'
);

-- 2. Bucket Supabase Storage pour les affiches d'événements
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-posters', 'event-posters', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Politique : tout le monde peut lire les affiches (bucket public)
CREATE POLICY "event_posters_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-posters');

-- 4. Politique : seuls les utilisateurs connectés peuvent uploader
CREATE POLICY "event_posters_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-posters' AND auth.role() = 'authenticated');

-- 5. Politique : seul l'auteur ou un admin peut supprimer
CREATE POLICY "event_posters_owner_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'event-posters' AND auth.uid() = owner);
