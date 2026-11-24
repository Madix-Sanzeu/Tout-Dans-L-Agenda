# Relais — où en est TDA

_Mis à jour le 24/11/2026 : appli Android (APK, Capacitor, rappels natifs) en cours de validation._

## Décisions prises
- Format : PWA (site installable), HTML/CSS/JS sans framework.
- Stockage des tâches : sur l'appareil uniquement (localStorage) ; comptes peut-être en phase 3.
- Priorisation : article « Comment prioriser ses tâches avec un TDAH » (le-tdah-au-quotidien.com), avec la matrice d'Eisenhower (② important passe avant ③ urgent seul).
- Rappel obligatoire ; « Nouveau » automatique (moins de 48 h).
- Hébergement de l'appli : GitHub Pages, dépôt `Madix-Sanzeu/Tout-Dans-L-Agenda`, adresse https://madix-sanzeu.github.io/Tout-Dans-L-Agenda/
- Rappels appli fermée : notifications push via un projet Supabase dédié « TDA » (`qcnxjmmcrxrnjnrzcqrn`, Paris), dans l'organisation « madix's Org », séparé de « Max Kompte ».
- Don : décision repoussée (`LIEN_DON` vide = bouton caché).
- Avis des testeurs : lien vers les « issues » GitHub (`LIEN_AVIS`).

## Fait ✅
- Phase 1 et maquette pour Learnhavior (voir l'historique Git).
- Phase 2, côté appli :
  - `js/push.js` : activation avec consentement explicite, option « masquer les titres », désactivation qui efface les données du serveur ;
  - `sw.js` : réception des notifications push ;
  - pages `aide.html` (installation Android / iPhone), `confidentialite.html` (RGPD) et `mentions-legales.html` ;
  - liens dans le pied de page (dont « Donner mon avis »).
- Phase 2, côté serveur, **déployé et testé** (abonnement, synchronisation, refus d'un mauvais secret, planificateur chaque minute, effacement après envoi) ; contrôle de sécurité Supabase OK (`pg_net` déplacé hors du schéma public).
- L'appli est branchée sur le serveur (`PUSH` rempli dans `js/config.js`) et publiée sur GitHub Pages.
- Clés VAPID générées : la publique est dans le code, la privée dans `CLES-PRIVEES-NE-PAS-PUBLIER.txt` (dossier local uniquement, exclu de Git).
- Sauvegarde des tâches (sans serveur) : stockage persistant, boutons « Sauvegarder » (menu Partager sur téléphone) / « Restaurer » (avec confirmation), rappel doux après 14 jours sans sauvegarde. Testé dans Chrome (ordinateur) ; `sw.js` passé en `tda-v5`. Publié sur GitHub Pages. Testé sur Android le 24/11 : sauvegarde et restauration OK ; la confirmation native `confirm()` ne s'affichait pas → remplacée par une fenêtre de l'appli (`demanderConfirmation()` dans app.js, `sw.js` en `tda-v6`).
- Android (MIUI) : une 2ᵉ fenêtre TDA vide peut rester dans les applis récentes après un partage. Effet du système, non corrigeable côté PWA (`launch_handler` non géré sur Chrome Android) : il suffit de la balayer.
- **Rappel push appli fermée testé sur Android le 24/11 : la notification arrive.** ✅
- **Tâches récurrentes** (24/11) : tous les jours / semaines (jours au choix) / mois / ans, ou tous les N. « C'est fait » archive une copie et passe à la date suivante (annulable) ; zone « Récurrentes à venir » ; rattrapage des oublis ; dates suivantes envoyées à l'avance au serveur push (14 dates max sur 31 jours). Nouveau fichier `js/recurrence.js`, `sw.js` en `tda-v8`. Testé : calculs de dates (changement d'heure, 31 du mois, 29 février, toutes les 2 semaines), parcours complet dans Chrome, liste envoyée au serveur.
- **Assistant « 🔁 Rappel récurrent »** (24/11, `js/modeles.js`, `sw.js` en `tda-v9`) : 7 modèles. 🎂 Anniversaire (rappel cadeau X jours avant ; âge affiché dans le titre si l'année est connue, mis à jour chaque année — `tda-v10`), 💊 Médicament (1 à 6 prises par jour, tous les jours / certains jours / tous les N jours, pas d'arrêt / N jours / jusqu'au…), 🧾 Facture ou paiement, 📄 Renouvellement, 📅 Chaque semaine, 🌱 Tous les N jours, ✏️ Personnalisé. Séries supprimables d'un coup ; date de fin dans le moteur ; personnalisation via ✎ (« Répéter » + « jusqu'au »). Le champ « Répéter » n'apparaît plus à la création d'une tâche simple. Testé dans Chrome : les 7 modèles, prises programmées, suppression de série, aucune erreur.
- Mise à jour des téléphones fiabilisée (24/11, `tda-v11`) : `sw.js` vérifie chaque fichier auprès du serveur (`cache: 'no-cache'`) au lieu de se fier à la mémoire de 10 min de GitHub Pages, qui pouvait mélanger une page neuve et d'anciens scripts. Numéro de version affiché en bas de l'appli. **Vérifié sur téléphone le 24/11** : mise à jour reçue, assistant « Rappel récurrent » et âge des anniversaires OK.
- **Incident du 24/11 : plus de rappels appli fermée.** Dans la nuit, le serveur a effacé l'abonnement du téléphone (adresse de notification refusée par Google, probablement notifications coupées ou économies de batterie MIUI). L'appli ne s'en apercevait pas et le serveur refusait ses synchronisations (403). Corrigé (`tda-v12`) : réparation automatique (réabonnement au démarrage, au retour dans l'appli, sur erreur 403 ou changement d'adresse), état de la dernière synchronisation dans ⚙️, bouton « Envoyer une notification de test » (action serveur `tester`), journal côté serveur quand un abonnement expire. Fonctions `tda-rappels` et `tda-envoi` redéployées. Testé dans Chrome avec un faux serveur ; à vérifier sur le téléphone.
- **Diagnostic (24/11, Xiaomi + Chrome)** : le site est « géré par l'application » TDA (permission déléguée à l'appli installée). Android autorise les notifications pour TDA et pour Chrome, mais à chaque ouverture la page voit la permission « non accordée ». Chrome annule alors l'abonnement push, Google répond 410 au serveur, l'appareil est effacé. Défaut Chrome / appli web installée, pas de l'appli ni du serveur. Test de notification : OK une fois (12:54–12:55), puis adresse annulée à 12:57.
- **Garde-fou (`tda-v13`)** : bandeau rouge « ⚠️ Vos rappels sont coupés » sur l'écran principal dès que la permission a sauté, bouton « Réactiver les rappels » (permission + réabonnement en un toucher). Le bouton « Activer les notifications » de ⚙️ fait la même chose. Testé dans Chrome (3 cas : OK, coupé puis réactivé, coupé puis refusé).
- **Appli Android (24/11, `tda-v14`)** : Capacitor + notifications locales programmées par Android (`js/natif.js`), sans serveur ni Internet. Sauvegarde par le menu Partager d'Android. APK fabriqué par GitHub Actions (`.github/workflows/android.yml`) et publié à https://github.com/Madix-Sanzeu/Tout-Dans-L-Agenda/releases/download/apk/TDA.apk. Identifiant `io.github.madixsanzeu.tda`, nom sous l'icône « TDA ». Nom de l'appli centralisé dans `TDA.config.NOM` (changement de nom prévu, voir la recette dans GUIDE.md). Testé dans Chrome en simulant l'appli Android (rappels programmés, garde-fou, test, réglage minute près, sauvegarde) ; **testé sur le Xiaomi le 24/11 : notification de test reçue appli fermée, et l'APK a passé les analyses de sécurité du téléphone (Play Protect)**.
- Tests dans un navigateur : appli, réglages et pages OK, aucune erreur ; fonctions serveur vérifiées pour la syntaxe uniquement (pas d'environnement Deno ici).

## Reste à faire pour finir la phase 2
0. Tester la nouvelle confirmation de « Restaurer » sur Android, puis « Sauvegarder » / « Restaurer » sur iPhone.
1. Tester un vrai rappel appli fermée **sur iPhone** (Android OK). En cas de souci : Supabase → Edge Functions → `tda-envoi` → Logs.
0 bis. Sur Xiaomi (MIUI) : Chrome en démarrage automatique, batterie « Aucune restriction », notifications autorisées pour Chrome et TDA ; vérifier avec le bouton de test, appli fermée.
1 bis. Tester une tâche récurrente sur téléphone (ex. rappel quotidien) pendant 2–3 jours, appli fermée.
2. Relire `confidentialite.html` et `mentions-legales.html`, et choisir un contact plus simple que GitHub pour les testeurs (email, formulaire).
3. Plus tard : choisir la plateforme de don.

## Appli Android : reste à faire
- APK installé sur le Xiaomi ✅ ; reste à vérifier les rappels réels appli fermée sur 2 à 3 jours (tâche simple, médicament quotidien).
- Clé de signature : gardée dans le cache GitHub, consulté chaque lundi par `garder-cle.yml` pour qu'il ne soit pas vidé (pas de réinstallation). Avant de distribuer à des testeurs : clé permanente dans le secret `ANDROID_KEYSTORE_BASE64` (à faire depuis l'ordinateur ; `android.yml` l'utilise automatiquement ; une dernière réinstallation sera nécessaire).
- Mises à jour : pas de bandeau « nouvelle version » (décision du 24/11) ; pendant les tests, il retélécharge l'APK lui-même et prévient les testeurs ; mise à jour automatique une fois sur le Play Store.
- iPhone : nécessite un Mac (Xcode) ; en attendant, la version web avec le push reste l'option iPhone.

## Décision à prendre : rappels fiables sur TOUS les téléphones (en cours : appli Android)
Le push web dépend du bon accord entre Chrome et le système, et ce n'est pas le cas partout (Xiaomi). Pistes universelles :
1. **« Ajouter à mon agenda »** : exporter les rappels importants (médicaments, anniversaires, factures) vers l'agenda du téléphone (fichier .ics, avec répétition et alarme). C'est le système qui sonne, sans Chrome ni serveur, sur Android comme sur iPhone. Limite : modifier une tâche dans TDA ne met pas à jour l'agenda (sauf à réexporter).
2. **Appli native (phase 4 avancée)** : Capacitor + Firebase Cloud Messaging et notifications locales planifiées par le système. C'est la solution la plus fiable, mais elle demande les stores et un Mac pour iPhone.

## À valider avec Learnhavior (3 psychologues, dont Sandra)
_Tableau à remplir par Learnhavior (mêmes questions) : https://claude.ai/artifact/NfwuV8XGJ5onk4R1PxPnoB_
- Le rappel de sauvegarde : fréquence (14 jours) et formulation, pour ne pas culpabiliser.
- Phase 3 — récupération d'un compte chiffré (mot de passe ET e-mail perdus) : quels moyens proposer, sachant que ce public perd facilement les codes ? Code de récupération à l'inscription, clé dans le fichier de sauvegarde, autre appareil connecté, contact de confiance (proche, aidant), ou plusieurs cumulés.
- Phase 3 — comment expliquer simplement que, sans aucun de ces moyens, les tâches sont perdues (prix d'une confidentialité réelle) ?
- Phase 3 — comptes sans e-mail (pseudonyme seul) : acceptable pour le public ?
- L'ordre des cases et les seuils d'urgence automatique (3 jours ; 2 h à rendre dans 7 jours).
- « Nouveau » : la durée (48 h) et son poids faible (+3).
- « Pas maintenant » (60 min) : faut-il limiter les reports ?
- La case ④ : proposer activement de la supprimer ?
- Relancer un rappel quand la tâche n'est toujours pas faite ?
- Tâches récurrentes : affichage 30 min avant le rappel, est-ce le bon délai ? Faut-il signaler les prises de médicament oubliées (aujourd'hui on passe simplement à la suivante, sans compter les oublis) ?
- Les modèles de l'assistant : la liste convient-elle ? D'autres à ajouter (rendez-vous de suivi, routine du matin / du soir, pause, s'hydrater…) ?
- Médicament : une tâche par prise (« Prendre X (1/3 · 8h) »). Est-ce lisible, ou vaut-il mieux une seule tâche avec plusieurs heures ?
- Imposer le découpage en étapes au-delà d'une certaine durée ?

## Phases suivantes
- **Phase 3 — comptes avec chiffrement de bout en bout (facultatif)** : synchronisation entre appareils + copie de secours, en ne remplaçant que `js/stockage.js`. Les tâches sont chiffrées SUR le téléphone : le serveur ne stocke qu'un bloc illisible (objectif : impossibilité pour nous de voir les données, mais restauration possible si la personne perd son téléphone). RGPD renforcé, page de confidentialité à revoir.
  - Décision du 24/11 : la « pré-3 » (sauvegarde automatique chiffrée) est fusionnée ici.
  - Écartés pour la sauvegarde : e-mail (serveur qui lit les tâches, adresse à stocker, spam, coût) ; Google Drive (validation Google, reconnexions, exclut les non-Google).
  - Récupération si mot de passe ET e-mail perdus : un formulaire anonyme ne peut pas prouver qui est la personne, et sans clé personne ne peut déchiffrer → il faut un moyen de secours gardé par la personne (choix à faire avec Learnhavior, voir plus haut). Garder la sauvegarde fichier en parallèle.
  - À faire : plan en 5 points avant de commencer.
- **Phase 4 — stores** : Android via PWABuilder ou Bubblewrap (environ 25 $ une seule fois) ; iPhone via Capacitor (Mac + environ 99 $ par an).
