-- Planifie l'appel hebdomadaire de la fonction weekly-events-discovery
-- (tous les lundis à 6h UTC). Les événements trouvés sont insérés en base avec
-- status='pending_review' : rien n'est publié automatiquement, un admin doit
-- valider chaque événement dans l'admin avant qu'il n'apparaisse sur le site.
--
-- ⚠️ ÉTAPE MANUELLE AVANT D'EXÉCUTER CE FICHIER :
-- Remplacer <TON_SERVICE_ROLE_KEY> ci-dessous par la clé service_role du projet
-- (Dashboard > Project Settings > API > service_role key), puis coller dans
-- l'éditeur SQL Supabase et exécuter. Ne jamais committer ce fichier avec la
-- vraie clé remplie dans le dépôt Git.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'weekly_events_discovery_service_key';
  if v_id is null then
    perform vault.create_secret('<TON_SERVICE_ROLE_KEY>', 'weekly_events_discovery_service_key');
  else
    perform vault.update_secret(v_id, '<TON_SERVICE_ROLE_KEY>');
  end if;
end $$;

select cron.schedule(
  'weekly-events-discovery',
  '0 6 * * 1',
  $$
  select net.http_post(
    url := 'https://xmzvgjkwsifunkmfkvin.functions.supabase.co/weekly-events-discovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'weekly_events_discovery_service_key'
        order by created_at desc limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
