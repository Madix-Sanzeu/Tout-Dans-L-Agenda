-- =====================================================================
-- Planification : chaque minute, appeler la fonction tda-envoi.
-- ⚠️ À appliquer APRÈS avoir déployé la fonction tda-envoi, en
-- remplaçant ADRESSE_DU_PROJET par l'adresse du projet Supabase
-- (ex. https://abcdefgh.supabase.co).
-- =====================================================================

select cron.schedule(
  'tda-envoi-rappels',
  '* * * * *',
  $$
  select net.http_post(
    url     := 'ADRESSE_DU_PROJET/functions/v1/tda-envoi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-tda-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'tda_cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
