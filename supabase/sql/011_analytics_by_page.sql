-- Patch à coller dans l'éditeur SQL Supabase (dashboard).
-- Agrégat de fréquentation par page (remplace la case "Durée de consultation"
-- par un graphique de fréquence par page dans l'admin). Même modèle que
-- admin_analytics_summary() : appelée uniquement via service_role depuis
-- l'edge function admin-dashboard, pas de lecture publique nécessaire.
create or replace function public.admin_analytics_by_page()
returns table (
  path text,
  page_views bigint,
  duration_avg numeric
)
language sql
stable
as $$
  select
    coalesce(path, '(inconnu)') as path,
    count(*) as page_views,
    round(avg(duration_seconds) filter (where duration_seconds > 0)) as duration_avg
  from public.analytics_sessions
  group by path
  order by page_views desc
  limit 15;
$$;
