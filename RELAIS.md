# Relais — où en est TDA

_Mis à jour le 23/11/2026 : phase 2 quasiment terminée + sauvegarde des données ajoutée._

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
- Phase 1 et maquette pour Sandra (voir l'historique Git).
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
- Tests dans un navigateur : appli, réglages et pages OK, aucune erreur ; fonctions serveur vérifiées pour la syntaxe uniquement (pas d'environnement Deno ici).

## Reste à faire pour finir la phase 2
0. Tester la nouvelle confirmation de « Restaurer » sur Android, puis « Sauvegarder » / « Restaurer » sur iPhone.
1. **Tester un vrai rappel appli fermée**, d'abord sur Android, puis sur iPhone (appli ajoutée à l'écran d'accueil). En cas de souci : Supabase → Edge Functions → `tda-envoi` → Logs.
2. Relire `confidentialite.html` et `mentions-legales.html`, et choisir un contact plus simple que GitHub pour les testeurs (email, formulaire).
3. Plus tard : choisir la plateforme de don.

## À valider avec Sandra
- Le rappel de sauvegarde : fréquence (14 jours) et formulation, pour ne pas culpabiliser.
- L'ordre des cases et les seuils d'urgence automatique (3 jours ; 2 h à rendre dans 7 jours).
- « Nouveau » : la durée (48 h) et son poids faible (+3).
- « Pas maintenant » (60 min) : faut-il limiter les reports ?
- La case ④ : proposer activement de la supprimer ?
- Relancer un rappel quand la tâche n'est toujours pas faite ?
- Imposer le découpage en étapes au-delà d'une certaine durée ?

## Phases suivantes
- **Phase pré-3 — sauvegarde automatique chiffrée (facultative, avec consentement)** : à l'ouverture de l'appli / après un changement, les tâches sont chiffrées SUR le téléphone avec un code de récupération que seule la personne possède, puis envoyées à Supabase (bloc illisible pour nous). Restauration sur un nouveau téléphone avec le code. Android et iPhone.
  - Écartés : e-mail (serveur qui lit les tâches, adresse à stocker, spam, coût) ; Google Drive (validation Google, reconnexions, exclut les non-Google).
  - Risque : code perdu = données perdues → proposer de partager le code dès sa création ; garder la sauvegarde fichier en parallèle.
  - À faire : plan en 5 points ; mettre à jour confidentialite.html ; en parler avec Sandra (les tâches ne sont plus « uniquement sur l'appareil », même chiffrées).
- **Phase 3 — comptes (facultatif)** : synchronisation entre appareils, en ne remplaçant que `js/stockage.js` ; RGPD renforcé.
- **Phase 4 — stores** : Android via PWABuilder ou Bubblewrap (environ 25 $ une seule fois) ; iPhone via Capacitor (Mac + environ 99 $ par an).
