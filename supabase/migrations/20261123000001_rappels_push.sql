-- =====================================================================
-- Base de données du serveur de rappels push de TDA
-- ---------------------------------------------------------------------
-- Deux tables :
--   appareils : un téléphone/navigateur abonné aux notifications
--   rappels   : les rappels À VENIR de chaque appareil (effacés dès l'envoi)
--
-- Sécurité : la "Row Level Security" (RLS) est activée SANS aucune règle
-- d'accès. Résultat : personne ne peut lire ni écrire ces tables depuis
-- Internet. Seules nos deux fonctions serveur (qui utilisent la clé
-- "service_role", jamais publiée) y ont accès.
-- =====================================================================

create table public.appareils (
  id           uuid primary key,                 -- tiré au hasard par l'appli
  secret_hash  text not null,                    -- empreinte SHA-256 du secret (le secret lui-même n'est jamais stocké)
  abonnement   jsonb not null,                   -- l'adresse de notification fournie par le navigateur
  cree_le      timestamptz not null default now(),
  vu_le        timestamptz not null default now() -- dernière synchro (pour effacer les appareils abandonnés)
);

create table public.rappels (
  id           bigint generated always as identity primary key,
  appareil_id  uuid not null references public.appareils(id) on delete cascade,
  tache_id     text not null,
  quand        timestamptz not null,
  titre        text,                             -- null si l'utilisateur a choisi de masquer les titres
  unique (appareil_id, tache_id)
);
create index rappels_quand_idx on public.rappels (quand);

alter table public.appareils enable row level security;
alter table public.rappels   enable row level security;
revoke all on public.appareils, public.rappels from anon, authenticated;

-- ---------------------------------------------------------------------
-- Le "réveil" : chaque minute, la base appelle la fonction tda-envoi.
-- Un secret tiré au hasard (rangé dans le coffre-fort "vault") prouve
-- que l'appel vient bien de nous.
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'tda_cron_secret');

-- Vérifie le secret reçu par la fonction tda-envoi.
create or replace function public.tda_verifier_cron(secret_recu text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'tda_cron_secret' and decrypted_secret = secret_recu
  );
$$;
revoke all on function public.tda_verifier_cron(text) from public, anon, authenticated;
grant execute on function public.tda_verifier_cron(text) to service_role;
