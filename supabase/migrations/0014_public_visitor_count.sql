-- Compteur visiteur public et discret (footer du site). Fonction publique
-- (SECURITY DEFINER car analytics_sessions n'a aucune policy SELECT publique)
-- qui ne renvoie qu'un total agrégé, jamais de ligne individuelle.
create or replace function public.public_visitor_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct session_id) from public.analytics_sessions;
$$;

grant execute on function public.public_visitor_count() to anon, authenticated;
