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

## 1 bis. L'appli Android (APK)

**Pourquoi.** Sur certains téléphones, notamment les Xiaomi, Chrome retire tout seul la permission de notifications de la version web installée : les rappels push ne sont pas fiables. Dans une vraie appli Android, les rappels sont programmés par Android lui-même (notifications locales, comme une alarme). Ils sonnent appli fermée, sans Internet et sans serveur.

**Comment.** **Capacitor** emballe les mêmes fichiers web (HTML, CSS, JS) dans une appli Android. Le code reste le même : seul `js/natif.js` sert dans l'appli, pour programmer les rappels et pour la sauvegarde. Dans le navigateur, il ne fait rien.

**Qui fabrique l'APK : GitHub, tout seul.** À chaque envoi sur `main`, le workflow `.github/workflows/android.yml` installe Capacitor, copie l'appli dans `www/`, crée le projet Android, fabrique l'APK et le publie ici :

**<https://github.com/Madix-Sanzeu/Tout-Dans-L-Agenda/releases/download/apk/TDA.apk>**

- Suivre une fabrication : onglet **Actions** du dépôt (environ 5 minutes).
- Relancer à la main : **Actions → Appli Android (APK) → Run workflow**.
- Les dossiers `www/`, `android/` et `node_modules/` sont fabriqués à chaque fois : ils ne sont jamais enregistrés dans le dépôt.

**Les fichiers :**
- `capacitor.config.json` : identifiant de l'appli (`io.github.madixsanzeu.tda`, à ne jamais changer une fois l'appli distribuée) et nom affiché sous l'icône (`appName`).
- `package.json` : les outils Capacitor utilisés par GitHub.
- `android-ressources/icones/` : l'icône de l'appli, toute prête à chaque taille d'Android (copiée telle quelle par GitHub).
- `android-ressources/ic_stat_tda.xml` : la petite icône blanche des notifications.

**Clé de signature.** Android n'accepte une mise à jour que si elle est signée avec la même clé que la version installée.
- **Clé permanente en place depuis le 24/11/2026** : elle est rangée dans le secret GitHub `ANDROID_KEYSTORE_BASE64` (Settings → Secrets and variables → Actions). `android.yml` l'utilise et signe lui-même l'APK. Le journal de fabrication affiche « Signature avec la clé permanente (secret GitHub) » et l'empreinte **SHA-256 `73b12cf5…2e98ea`**. Si une fabrication affiche une autre empreinte, quelque chose ne va pas : ne pas distribuer cet APK.
- Le fichier de clé (`tda-android.keystore`, alias `androiddebugkey`, mots de passe `android`, valable jusqu'en 2054) est gardé par le porteur du projet, **hors de GitHub**. Sans lui, impossible de publier une mise à jour si le secret était perdu.
- Pour recréer le secret à partir du fichier, sous Windows : `certutil -encodehex -f tda-android.keystore cle.txt 0x40000001`, puis coller le contenu de `cle.txt` dans le secret.
- **Play Store (plus tard)** : Google gère la clé de signature définitive (« Play App Signing ») ; cette clé servira de clé d'envoi (« upload key »).

**Rappels à la minute près.** L'APK déclare la permission `USE_EXACT_ALARM`, accordée d'office sur Android 13 et plus. ⚠️ Pour une future publication sur le Play Store, Google réserve cette permission aux applis d'agenda ou de réveil : il faudra peut-être passer à `SCHEDULE_EXACT_ALARM`, que la personne accorde elle-même. Le bouton « Autoriser les rappels à la minute près » de ⚙️ est déjà prévu pour ça.

**Distribution.** L'APK s'installe sans store (« sideloading »). En France, c'est libre pour l'instant. Google prévoit d'exiger, d'ici 2027, que les applis installées hors store viennent d'un développeur vérifié (compte gratuit « distribution limitée » pour les usages personnels).

---

## 2. Le serveur de rappels sur Supabase

Il ne sert qu'à la **version web**. L'appli Android n'en a pas besoin.

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
