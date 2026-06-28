-- ── Table analytics_sessions ──
-- Enregistre chaque visite de page avec sa durée de consultation.
-- Alimentée par frontend/js/analytics.js.
CREATE TABLE IF NOT EXISTS public.analytics_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    text NOT NULL,
  path          text NOT NULL,
  duration_seconds integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Index pour les requêtes d'agrégation (30 derniers jours)
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_created
  ON public.analytics_sessions (created_at DESC);

-- RLS : accessible uniquement via service role (fonctions admin)
ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur connecté peut insérer sa propre session (tracking anonyme)
CREATE POLICY "analytics_insert_any"
  ON public.analytics_sessions FOR INSERT
  WITH CHECK (true);

-- Mise à jour de la durée uniquement par la ligne concernée (pas d'auth nécessaire)
CREATE POLICY "analytics_update_own"
  ON public.analytics_sessions FOR UPDATE
  USING (true);

-- ── Fonction RPC admin_analytics_summary ──
-- Agrège les statistiques de fréquentation des 30 derniers jours.
-- Appelée par l'edge function admin-dashboard.
DROP FUNCTION IF EXISTS public.admin_analytics_summary();
CREATE OR REPLACE FUNCTION public.admin_analytics_summary()
RETURNS TABLE (
  page_views   bigint,
  unique_visits bigint,
  duration_min  integer,
  duration_avg  numeric,
  duration_max  integer
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)                          AS page_views,
    COUNT(DISTINCT session_id)        AS unique_visits,
    MIN(duration_seconds)             AS duration_min,
    ROUND(AVG(duration_seconds))::integer AS duration_avg,
    MAX(duration_seconds)             AS duration_max
  FROM public.analytics_sessions
  WHERE created_at > NOW() - INTERVAL '30 days';
$$;
