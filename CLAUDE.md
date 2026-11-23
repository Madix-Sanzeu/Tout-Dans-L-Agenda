# TDA — Tout Dans l'Agenda

PWA de gestion de tâches pour personnes TDA(H), conçue avec Learnhavior (3 psychologues). Le porteur du projet débute en code : il doit pouvoir lire et modifier seul.

## Règles durables
- HTML/CSS/JavaScript « nus », sans framework ni étape de compilation. Scripts classiques (pas de modules ES), pour que `index.html` s'ouvre aussi par double-clic.
- Code, noms de variables et commentaires **en français**, avec des commentaires pédagogiques.
- Un fichier JS = une responsabilité ; tout ce qui se règle est dans `js/config.js`.
- On modifie les données puis on redessine avec `afficher()` ; jamais de modification de l'écran « à la main ».
- Le stockage passe uniquement par `js/stockage.js` (pour pouvoir passer aux comptes en phase 3).
- Après tout changement de fichier publié, augmenter `VERSION` dans `sw.js`.
- Ne jamais publier de clé privée ni de clé `service_role` : seulement les clés publiques dans `js/config.js`. Les tâches restent sur l'appareil ; le serveur (`supabase/`) ne garde que le strict nécessaire pour les rappels push.
- Déploiement : appli sur GitHub Pages (branche `main`), serveur sur Supabase ; voir `DEPLOIEMENT.md`.
- Mettre à jour `GUIDE.md` quand l'architecture change et `RELAIS.md` à la fin de chaque session.
- Plan en 5 points avant les gros changements ; une phase = une session.
