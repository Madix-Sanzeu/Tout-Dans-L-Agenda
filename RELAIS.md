# Relais — où en est TDA

_Mis à jour le 23/11/2026 : phase 2 (mise en ligne) en cours._

## Décisions prises
- Format : PWA (site installable), HTML/CSS/JS sans framework.
- Stockage des tâches : sur l'appareil uniquement (localStorage) ; comptes peut-être en phase 3.
- Priorisation : article « Comment prioriser ses tâches avec un TDAH » (le-tdah-au-quotidien.com), avec la matrice d'Eisenhower (② important passe avant ③ urgent seul).
- Rappel obligatoire ; « Nouveau » automatique (moins de 48 h).
- Hébergement de l'appli : GitHub Pages, dépôt `Madix-Sanzeu/Tout-Dans-L-Agenda`, adresse https://madix-sanzeu.github.io/Tout-Dans-L-Agenda/
- Rappels appli fermée : notifications push via un projet Supabase dédié « TDA », sur le compte Supabase lié à GitHub **Madix-Sanzeu** (pas le compte « madix's Org » / Max Kompte).
- Don : décision repoussée (`LIEN_DON` vide = bouton caché).
- Avis des testeurs : lien vers les « issues » GitHub (`LIEN_AVIS`).

## Fait ✅
- Phase 1 et maquette pour Sandra (voir l'historique Git).
- Phase 2, côté appli :
  - `js/push.js` : activation avec consentement explicite, option « masquer les titres », désactivation qui efface les données du serveur ;
  - `sw.js` : réception des notifications push ;
  - pages `aide.html` (installation Android / iPhone), `confidentialite.html` (RGPD) et `mentions-legales.html` ;
  - liens dans le pied de page (dont « Donner mon avis »).
- Phase 2, côté serveur (écrit, **pas encore déployé**) : `supabase/migrations/` (tables verrouillées par RLS, planificateur pg_cron) et `supabase/functions/` (`tda-rappels`, `tda-envoi`).
- Clés VAPID générées : la publique est dans le code, la privée dans `CLES-PRIVEES-NE-PAS-PUBLIER.txt` (dossier local uniquement, exclu de Git).
- Tests dans un navigateur : appli, réglages et pages OK, aucune erreur ; fonctions serveur vérifiées pour la syntaxe uniquement (pas d'environnement Deno ici).

## Reste à faire pour finir la phase 2
1. **Toi :** te connecter à Supabase avec GitHub Madix-Sanzeu, puis relier ce compte à Claude (connecteur Supabase).
2. **Claude :** créer le projet « TDA » (Paris), appliquer les migrations, déployer les 2 fonctions et remplir `PUSH` dans `js/config.js` (voir `DEPLOIEMENT.md`).
3. **Toi :** saisir le secret `VAPID_PRIVATE_KEY` quand Supabase le demande.
4. Tester un vrai rappel appli fermée sur Android, puis sur iPhone.
5. Relire `confidentialite.html` et `mentions-legales.html`, et décider d'un contact plus simple que GitHub pour les testeurs (email, formulaire).

## À valider avec Sandra
- L'ordre des cases et les seuils d'urgence automatique (3 jours ; 2 h à rendre dans 7 jours).
- « Nouveau » : la durée (48 h) et son poids faible (+3).
- « Pas maintenant » (60 min) : faut-il limiter les reports ?
- La case ④ : proposer activement de la supprimer ?
- Relancer un rappel quand la tâche n'est toujours pas faite ?
- Imposer le découpage en étapes au-delà d'une certaine durée ?

## Phases suivantes
- **Phase 3 — comptes (facultatif)** : synchronisation entre appareils, en ne remplaçant que `js/stockage.js` ; RGPD renforcé.
- **Phase 4 — stores** : Android via PWABuilder ou Bubblewrap (environ 25 $ une seule fois) ; iPhone via Capacitor (Mac + environ 99 $ par an).
