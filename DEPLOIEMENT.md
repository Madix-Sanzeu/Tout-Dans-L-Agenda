# Mise en ligne de TDA

Deux morceaux sont mis en ligne séparément :

| Morceau | Où | Rôle |
|---|---|---|
| L'appli (HTML, CSS, JS) | GitHub Pages | Ce que les utilisateurs ouvrent |
| Le serveur de rappels (dossier `supabase/`) | Supabase | Envoie les notifications push, même appli fermée |

---

## 1. L'appli sur GitHub Pages

Le code est sur <https://github.com/Madix-Sanzeu/Tout-Dans-L-Agenda>. L'appli est publiée à l'adresse :

**<https://madix-sanzeu.github.io/Tout-Dans-L-Agenda/>**

**Activer GitHub Pages (une seule fois) :** sur GitHub, ouvre le dépôt, puis **Settings → Pages**. Dans « Build and deployment », choisis **Source : Deploy from a branch**, **Branch : `main`**, dossier **`/ (root)`**, puis **Save**. La première mise en ligne prend une à deux minutes.

**Publier une modification :** dès qu'un changement est envoyé (« push ») sur la branche `main`, GitHub remet le site à jour tout seul en une à deux minutes. N'oublie pas d'augmenter `VERSION` dans `sw.js`, sinon les téléphones gardent l'ancienne version en cache.

---

## 2. Le serveur de rappels sur Supabase

### Comment ça marche

```
Téléphone ──(1) abonner / synchroniser──▶ fonction tda-rappels ──▶ tables appareils + rappels
                                                                         │
Base de données ──(2) chaque minute (pg_cron)──▶ fonction tda-envoi ─────┘
                                                     │
Téléphone ◀──(3) notification push (chiffrée)────────┘
```

### Les fichiers

- `supabase/migrations/…_rappels_push.sql` : crée les tables (verrouillées par RLS), le secret du planificateur et sa fonction de vérification.
- `supabase/migrations/…_planifier_envoi.sql` : programme l'appel de `tda-envoi` chaque minute.
- `supabase/functions/tda-rappels/index.ts` : reçoit les demandes de l'appli.
- `supabase/functions/tda-envoi/index.ts` : envoie les notifications dont l'heure est arrivée.

### État actuel (23/11/2026) : ✅ déployé

- Projet Supabase **« TDA »** (identifiant `qcnxjmmcrxrnjnrzcqrn`), région Paris, organisation « madix's Org ».
- Tableau de bord : <https://supabase.com/dashboard/project/qcnxjmmcrxrnjnrzcqrn>
- Migrations appliquées, fonctions `tda-rappels` et `tda-envoi` déployées, secret `VAPID_PRIVATE_KEY` enregistré, planificateur actif chaque minute.
- Testé côté serveur : abonnement, synchronisation, refus d'un mauvais secret, passage du planificateur et effacement du rappel.

### Les étapes (pour refaire l'installation sur un autre projet)

1. Créer un projet Supabase « TDA », région **eu-west-3 (Paris)**.
2. Appliquer la migration `…_rappels_push.sql`.
3. Déployer les fonctions `tda-rappels` et `tda-envoi`, **sans vérification JWT** (`verify_jwt: false`) : chacune fait sa propre vérification (secret de l'appareil pour la première, secret du planificateur pour la seconde).
4. Ajouter le secret **`VAPID_PRIVATE_KEY`** à la main dans le tableau de bord (**Edge Functions → Secrets**). Sa valeur est dans le fichier `CLES-PRIVEES-NE-PAS-PUBLIER.txt` de ton dossier local. ⚠️ Ne publie jamais ce fichier.
5. Appliquer `…_planifier_envoi.sql`, en adaptant l'adresse du projet si besoin.
6. Dans `js/config.js`, remplir `PUSH.URL_SUPABASE` et `PUSH.CLE_PUBLIQUE_SUPABASE` (la clé « publishable », qui peut être publiée sans danger), augmenter `VERSION` dans `sw.js`, puis publier.

### Vérifier que tout marche

- Dans l'appli : ⚙️ → « J'accepte et j'active », puis créer une tâche avec un rappel « Dans 15 min », et fermer l'appli.
- Dans Supabase, **Table Editor → rappels** : le rappel doit apparaître, puis disparaître une fois envoyé.
- En cas de souci : **Edge Functions → tda-envoi → Logs**.

### Bon à savoir

- L'offre gratuite de Supabase met en pause un projet sans activité pendant une semaine. L'appel automatique de chaque minute devrait le garder actif, mais vérifie de temps en temps que le projet est bien « Active ».
- Les clés VAPID vont par paire : la moitié publique est écrite dans `js/config.js` et dans `tda-envoi`, la moitié privée seulement dans les secrets Supabase. Si tu changes la paire, tous les utilisateurs devront réactiver les rappels.
