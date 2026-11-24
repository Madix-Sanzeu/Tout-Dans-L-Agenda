# Relais — où en est TDA

_Mis à jour le 24/11/2026 : assistant « Rappel récurrent » (7 modèles) ; push testé sur Android._

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
- Tests dans un navigateur : appli, réglages et pages OK, aucune erreur ; fonctions serveur vérifiées pour la syntaxe uniquement (pas d'environnement Deno ici).

## Reste à faire pour finir la phase 2
0. Tester la nouvelle confirmation de « Restaurer » sur Android, puis « Sauvegarder » / « Restaurer » sur iPhone.
1. Tester un vrai rappel appli fermée **sur iPhone** (Android OK). En cas de souci : Supabase → Edge Functions → `tda-envoi` → Logs.
1 bis. Tester une tâche récurrente sur téléphone (ex. rappel quotidien) pendant 2–3 jours, appli fermée.
2. Relire `confidentialite.html` et `mentions-legales.html`, et choisir un contact plus simple que GitHub pour les testeurs (email, formulaire).
3. Plus tard : choisir la plateforme de don.

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
