-- Membres invités sur un road trip + suivi de position GPS en temps réel.
-- Un road trip a un propriétaire (roadtrip_requests.user_id). Le propriétaire
-- invite des comptes Monarch existants par email ; chaque membre invité doit
-- accepter, puis peut activer/désactiver manuellement le partage de sa position
-- (conformité RGPD : rien n'est partagé sans action explicite du membre).

CREATE TABLE IF NOT EXISTS public.roadtrip_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadtrip_id uuid NOT NULL REFERENCES public.roadtrip_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','member')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (roadtrip_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.roadtrip_locations (
  roadtrip_id uuid NOT NULL REFERENCES public.roadtrip_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  heading double precision,
  speed double precision,
  sharing boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (roadtrip_id, user_id)
);

CREATE INDEX IF NOT EXISTS roadtrip_members_roadtrip_idx ON public.roadtrip_members (roadtrip_id);
CREATE INDEX IF NOT EXISTS roadtrip_members_user_idx ON public.roadtrip_members (user_id);

-- L'utilisateur est-il propriétaire ou membre accepté de ce road trip ?
-- SECURITY DEFINER pour éviter toute récursion des policies RLS qui s'appuient dessus.
CREATE OR REPLACE FUNCTION public.is_roadtrip_participant(p_roadtrip_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.roadtrip_requests r
    WHERE r.id = p_roadtrip_id AND r.user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.roadtrip_members m
    WHERE m.roadtrip_id = p_roadtrip_id AND m.user_id = p_user_id AND m.status = 'accepted'
  );
$$;

ALTER TABLE public.roadtrip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadtrip_locations ENABLE ROW LEVEL SECURITY;

-- Un propriétaire de road trip peut lire/inviter/retirer des membres sur SES road trips.
CREATE POLICY "roadtrip_members_owner_manage" ON public.roadtrip_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.roadtrip_requests r WHERE r.id = roadtrip_id AND r.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.roadtrip_requests r WHERE r.id = roadtrip_id AND r.user_id = auth.uid())
  );

-- Un membre voit sa propre invitation, et une fois accepté, la liste complète de l'équipe.
CREATE POLICY "roadtrip_members_self_read" ON public.roadtrip_members
  FOR SELECT USING (auth.uid() = user_id OR public.is_roadtrip_participant(roadtrip_id, auth.uid()));

-- Un membre invité peut accepter/refuser (mettre à jour uniquement sa propre ligne).
CREATE POLICY "roadtrip_members_self_respond" ON public.roadtrip_members
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Positions : lisibles uniquement par les participants (propriétaire + membres acceptés) du même road trip.
CREATE POLICY "roadtrip_locations_participant_read" ON public.roadtrip_locations
  FOR SELECT USING (public.is_roadtrip_participant(roadtrip_id, auth.uid()));

-- Chacun ne peut écrire QUE sa propre position, et uniquement s'il participe au road trip.
CREATE POLICY "roadtrip_locations_self_write" ON public.roadtrip_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_roadtrip_participant(roadtrip_id, auth.uid()));

CREATE POLICY "roadtrip_locations_self_update" ON public.roadtrip_locations
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "roadtrip_locations_self_delete" ON public.roadtrip_locations
  FOR DELETE USING (auth.uid() = user_id);

-- Un participant (pas seulement le propriétaire) peut désormais relire le road trip
-- auquel il a été invité et a accepté de participer.
CREATE POLICY "roadtrip_requests_participant_read" ON public.roadtrip_requests
  FOR SELECT USING (public.is_roadtrip_participant(id, auth.uid()));

-- Realtime : mise à jour live de la carte (positions) et du statut des invitations (équipe).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.roadtrip_locations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.roadtrip_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
