# Guide de Tout Dans l'Agenda (TDA)

Ce guide explique comment l'application est construite et comment la modifier sans connaître la programmation à l'avance. Lis-le dans l'ordre la première fois, puis sers-t'en comme d'un aide-mémoire.

---

## 1. Ouvrir l'application

**Méthode rapide :** double-clique sur `index.html`. L'appli s'ouvre dans le navigateur et fonctionne : tâches, tri, moments de vie et rappels quand la page est ouverte.

**Méthode complète** (nécessaire pour tester l'installation sur l'écran d'accueil et le mode hors-ligne) : il faut passer par un petit serveur web local. Avec Python installé, dans un terminal ouvert dans le dossier du projet :

```
python -m http.server 8000
```

Ouvre ensuite <http://localhost:8000> dans le navigateur. Pour arrêter le serveur : `Ctrl + C`.

> Pourquoi cette différence ? Pour des raisons de sécurité, les navigateurs n'activent certaines fonctions (le *service worker*, voir plus bas) que sur une adresse `http://` ou `https://`, jamais sur un fichier ouvert directement.

---

## 2. Les trois langages, en une image

Une page web, c'est comme une maison :

| Langage | Rôle | Dans la maison | Fichier(s) |
|---|---|---|---|
| **HTML** | La structure : ce qui existe | Les murs, les pièces, les portes | `index.html` |
| **CSS** | L'apparence | La peinture, la déco | `css/style.css` |
| **JavaScript** | Le comportement | L'électricité, la plomberie | `js/*.js` |

Le navigateur lit le HTML, applique le CSS, puis exécute le JavaScript. Le JavaScript peut modifier la page à tout moment, par exemple pour afficher la liste des tâches.

---

## 3. La carte des fichiers

```
TDA - Tout Dans lAgenda/
├── index.html        Structure de la page (en-tête, zones, fenêtres)
├── css/style.css     Toute l'apparence (couleurs, tailles, mode sombre)
├── js/
│   ├── config.js     ⭐ LES RÉGLAGES : étiquettes, poids, moments, lien de don
│   ├── stockage.js   Enregistrer / relire les données sur l'appareil
│   ├── moments.js    Savoir quel moment de vie est en cours
│   ├── priorite.js   ⭐ LE CALCUL DU SCORE et le tri des tâches
│   ├── rappels.js    Les notifications quand l'appli est ouverte
│   ├── recurrence.js Les dates des tâches qui reviennent (anniversaires, médicaments…)
│   ├── modeles.js    Les modèles de l'assistant « Rappel récurrent » (questions + fabrication)
│   ├── push.js       Les rappels même appli fermée (dialogue avec le serveur)
│   └── app.js        Le chef d'orchestre : affichage et clics
├── sw.js             Service worker : hors-ligne + réception des notifications push
├── aide.html, confidentialite.html, mentions-legales.html   Pages publiques
├── supabase/         Le serveur de rappels push (base de données + 2 fonctions)
├── DEPLOIEMENT.md    Comment mettre en ligne l'appli et le serveur
├── manifest.json     Carte d'identité de l'appli (nom, icône, couleurs)
├── icone.svg / .png  L'icône
├── GUIDE.md          Ce guide
├── RELAIS.md         Où on en est, et la suite
└── CLAUDE.md         Règles du projet (pour travailler avec Claude)
```

**Principe d'organisation :** chaque fichier JavaScript fait **une seule chose**. Ils sont chargés dans un ordre précis (en bas de `index.html`), car chacun utilise les précédents :

```
config → stockage → moments → priorite → rappels → recurrence → modeles → push → app
```

Tous rangent leurs fonctions dans un même « tiroir » global nommé `TDA` : `TDA.config`, `TDA.stockage`, `TDA.priorite`, etc. Ça évite les conflits de noms.

---

## 4. Ce qui se passe quand on clique : l'exemple de « C'est fait »

C'est le meilleur moyen de comprendre le code. Suivons un clic :

1. **Le bouton existe dans la page.** Il a été fabriqué par la fonction `afficher()` de `app.js` avec deux attributs : `data-action="faire"` et `data-id="lq3k9x-a8f2c"` (l'identifiant de la tâche).
2. **Quelqu'un « écoute ».** Au démarrage, `brancherEvenements()` a dit : « quand on clique n'importe où dans la zone `maintenant`, appelle `surClicListe` ».
3. **`surClicListe` lit les attributs** : action = `faire`, id = `lq3k9x-a8f2c`. Il appelle donc `faire(id)`.
4. **`faire(id)` modifie les données** : il retrouve la tâche et remplit `faiteLe` avec la date du moment.
5. **`sauverEtAfficher()`** enregistre la liste (via `stockage.js`) puis appelle `afficher()`.
6. **`afficher()` redessine tout l'écran** à partir des données : la tâche faite disparaît de la liste et apparaît dans « Faites aujourd'hui ».
7. Un bandeau « Bravo, une de moins ! » s'affiche, avec un bouton **Annuler** qui appelle `defaire(id)`.

👉 **La règle d'or du projet :** on ne modifie jamais l'écran « à la main ». On modifie les **données**, puis on redessine. L'écran reflète donc toujours exactement les données.

---

## 5. Le calcul de priorité (`js/priorite.js`)

Les règles viennent de l'article « Comment prioriser ses tâches avec un TDAH » (le-tdah-au-quotidien.com). Elles reposent sur la **matrice d'Eisenhower**, qui range chaque tâche dans une des 4 cases :

| Case | Signification | Conseil affiché | Points |
|---|---|---|---|
| ① Urgent et important | | À faire maintenant | 400 |
| ② Important, pas urgent | Rapproche d'un objectif qui compte | À faire **avant** les urgences simples | 300 |
| ③ Urgent, pas important | | Déléguer si possible, sinon programmer | 200 |
| ④ Ni l'un ni l'autre | | À éliminer, ou à reporter | 100 |

L'écart de 100 points entre deux cases garantit qu'une tâche passe **toujours** devant celles de la case suivante. Attention à l'ordre voulu par l'article : la case ② passe avant la ③, pour ne pas vivre d'urgence en urgence.

**« Urgent » est aussi automatique.** Selon l'article, une tâche est urgente si son échéance est proche ou si elle demande beaucoup de temps. L'appli la rend donc urgente toute seule si :
- elle est cochée Urgent ;
- ou son échéance est dans moins de 3 jours (ou déjà dépassée) ;
- ou elle dure 2 h ou plus et doit être rendue dans moins de 7 jours.

**À l'intérieur d'une même case**, on ajoute de petits points :
- d'abord l'échéance la plus proche : +50 si dépassée, +40 si moins de 24 h, +30 si moins de 3 jours, +20 cette semaine, +10 ce mois-ci ;
- puis le **départage conseillé par l'article** (« la plus facile, ou celle dont on a envie ») : 🌿 Agréable +8, ⚡ tâche de 15 min ou moins +8, ✨ Nouveau +3, ⌛ +1 par jour d'attente (au maximum +5).

« Nouveau » ne compte que pour 3 points, car selon l'article la nouveauté attire déjà trop l'attention d'un cerveau TDAH.

**Exemple :** « Envoyer le dossier de la CAF » est cochée *Important* et doit être rendue demain : elle devient urgente toute seule et tombe en case ① (+400). Échéance dans moins de 24 h (+40), créée il y a 3 jours (+3). Score : **443**.

Dans l'appli, le bouton « Pourquoi ? » d'une tâche affiche ce détail.

**Autres règles de l'article reprises dans l'appli :**
- **« Nouveau » est automatique** : une tâche créée depuis moins de 48 h (`NOUVEAU_DUREE_HEURES`).
- **Le rappel est obligatoire** : le formulaire propose d'office « dans 1 h », et « Pas maintenant » reprogramme le rappel à la fin du report.
- **La durée est affichée avec un tiers de marge** (`MARGE_DUREE`).
- **Découper en étapes** : une zone « une étape par ligne », cochables sur la carte « Maintenant ». L'appli suggère de découper toute tâche d'une heure ou plus.
- **Un verbe d'action** : c'est rappelé dans le formulaire.
- **Les repères d'échéance** : boutons Aujourd'hui, Cette semaine, Semaine prochaine, Ce mois-ci, Plus tard.

**Pour changer les règles :** ouvre `js/config.js` (sections `QUADRANTS`, `REGLES`, `POIDS`), change un nombre, enregistre, puis recharge la page.

---

## 6. Les moments de vie (`js/moments.js`)

Un moment de vie (Travail, Perso…) possède une ou plusieurs **plages** : des jours de la semaine, une heure de début et une heure de fin. Par défaut :

- 💼 **Travail** : du lundi au vendredi, de 9 h à 18 h
- 🏡 **Perso** : du lundi au vendredi de 18 h à 22 h, et le week-end de 9 h à 22 h
- 🕒 **N'importe quand** : toujours actif (moment spécial, non modifiable)

L'écran principal n'affiche que les tâches des moments **actifs maintenant**, plus celles « N'importe quand ». C'est ce qui sépare le travail de la vie perso : le soir, les tâches pro disparaissent. La case **« Tous les moments »** permet de tout voir quand même.

Les utilisateurs modifient leurs moments dans ⚙️ Réglages. Les valeurs de `config.js` ne servent qu'au tout premier lancement.

Les plages qui passent minuit (ex. 22:00 → 02:00) sont gérées.

---

## 7. Les rappels

Il y a deux mécanismes complémentaires.

**a) Appli ouverte (`js/rappels.js`).** Toutes les 30 secondes, l'appli vérifie si un rappel est arrivé à l'heure, puis affiche une notification du système, ou un bandeau si les notifications sont refusées.

**b) Appli fermée : les notifications « push » (`js/push.js` + dossier `supabase/`).** Cette option doit être activée dans ⚙️, avec le consentement de l'utilisateur.

1. **Abonner.** Le navigateur fournit une adresse de notification. L'appli l'envoie au serveur avec un identifiant et un secret tirés au hasard : il n'y a aucun compte.
2. **Synchroniser.** À chaque changement (`sauverEtAfficher()`), l'appli envoie la liste des rappels à venir : l'heure, et le titre si l'utilisateur ne l'a pas masqué.
3. **Envoyer.** Chaque minute, la base de données réveille la fonction `tda-envoi`, qui envoie les notifications arrivées à l'heure puis les efface.
4. **Recevoir.** `sw.js` reçoit l'événement `push` et affiche la notification, même appli fermée.

Désactiver l'option efface tout ce qui concerne l'appareil sur le serveur.

**Réparation automatique.** L'adresse de notification d'un téléphone peut expirer : Google ou Apple la renouvellent, des économies de batterie la coupent, les notifications sont désactivées… Le serveur efface alors l'appareil (le journal `tda-envoi` le note). L'appli s'en rend compte toute seule, au démarrage, au retour dans l'appli ou quand le serveur répond « appareil inconnu » (erreur 403) : elle se réenregistre et renvoie ses rappels (`verifier()` et `synchroniserMaintenant()` dans `push.js`).

**Vérifier que ça marche.** Dans ⚙️, la ligne « Dernière synchronisation » indique si tout va bien. Le bouton « 🔔 Envoyer une notification de test » demande au serveur une notification immédiate : elle arrive en moins d'une minute, même appli fermée. Sur iPhone, le push ne fonctionne que si l'appli a été ajoutée à l'écran d'accueil. Les détails de mise en ligne sont dans `DEPLOIEMENT.md`.

Si l'appli est ouverte, la même tâche peut déclencher les deux notifications. Elles portent la même étiquette (`tag`), donc la seconde remplace la première au lieu de s'empiler.

---

## 7 bis. Les rappels récurrents (`js/recurrence.js` et `js/modeles.js`)

**Créer : l'assistant.** Le bouton « 🔁 Rappel récurrent » ouvre un assistant. On choisit un modèle, puis on répond à quelques questions :

| Modèle | Questions | Ce qui est créé |
|---|---|---|
| 🎂 Anniversaire | De qui, date de naissance, afficher l'âge (si l'année est connue), heure, rappel X jours avant pour le cadeau | 1 tâche par an, plus « Trouver un cadeau » X jours avant (avec ses étapes). Si l'année est connue, l'âge s'affiche dans le titre, par exemple « (37 ans) », et se met à jour chaque année (`majAge()` dans `app.js`, grâce au champ `anneeNaissance`) |
| 💊 Médicament | Nom, combien de fois par jour et à quelles heures, tous les jours, certains jours ou tous les N jours, à partir de quand, pendant combien de temps (pas d'arrêt / N jours / jusqu'au…) | 1 tâche par prise |
| 🧾 Facture ou paiement | Quoi, prochaine échéance, mois / 3 mois / an, prévenir X jours avant | 1 tâche, avec l'échéance comme date limite |
| 📄 Renouvellement | Quoi, date limite, tous les N mois ou ans, prévenir X jours avant | idem |
| 📅 Chaque semaine | Quoi, quels jours, heure | 1 tâche |
| 🌱 Tous les N jours | Quoi, tous les combien de jours, à partir de quand, heure | 1 tâche |
| ✏️ Personnalisé | Toutes les options | 1 tâche par heure |

Les tâches créées ensemble (les prises d'un médicament, l'anniversaire et son cadeau) forment une **série** (champ `groupe`). On peut les supprimer d'un coup avec « Supprimer toute la série ».

**Personnaliser.** Chaque rappel se modifie ensuite avec ✎, dans le formulaire habituel : rappel, « Répéter », espacement, jours, « jusqu'au », priorités, étapes… Le bloc « Répéter » n'apparaît qu'en modification : pour créer, on passe par l'assistant.

**Ajouter un modèle** (fichier `js/modeles.js`) : copie un modèle de la liste `MODELES`, puis change son `id`, ses textes, ses `champs` (les questions) et sa fonction `construire` (qui transforme les réponses en tâches). L'assistant affiche les questions tout seul. Les heures proposées par défaut sont dans `config.js` (`ASSISTANT`).

**La règle de répétition.** Elle est enregistrée dans la tâche, par exemple :

```json
"recurrence": { "unite": "jour", "intervalle": 1, "jours": [], "ancre": "2026-11-25T07:00:00.000Z", "fin": null }
```

L'**ancre** est la première date. Toutes les dates suivantes sont calculées à partir d'elle, et non en ajoutant un jour à la date précédente. Ainsi l'heure ne glisse pas au changement d'heure, et un anniversaire le 29 février tombe le 28 février les années non bissextiles. **fin** est la dernière date incluse ; `null` signifie « pas d'arrêt prévu ».

**Quand on coche « C'est fait »** (`faireRecurrente()` dans `app.js`) : une copie est rangée dans « Faites aujourd'hui » (l'historique, qu'on peut annuler), et la tâche passe à sa prochaine date. S'il n'y a plus de date (fin du traitement), la tâche est simplement terminée.

**Pour ne pas encombrer la liste**, une tâche récurrente n'apparaît que 30 min avant son rappel (`RECURRENCE.AFFICHER_AVANT_MINUTES`). Le reste du temps, elle attend dans « 🔁 Récurrentes à venir ». Une occurrence oubliée est rattrapée : la tâche passe à la date la plus récente (`rattraperRecurrentes()`).

**Rappels appli fermée.** `push.js` envoie au serveur les prochaines dates à l'avance (14 au plus, dans les 31 jours). Le rappel de demain arrive donc même si l'appli n'a pas été rouverte.

---

## 8. Les données

Les données sont stockées dans le **localStorage** du navigateur, un petit espace propre à chaque site et à chaque appareil. Rien n'est envoyé sur Internet.

Une tâche ressemble à ceci (c'est du **JSON**, un format texte pour décrire des objets) :

```json
{
  "id": "lq3k9x-a8f2c",
  "titre": "Appeler le médecin",
  "etiquettes": ["urgent", "important"],
  "etapes": [{ "texte": "Trouver le numéro", "fait": false }],
  "moment": "perso",
  "echeance": "2026-11-25T17:00:00.000Z",
  "duree": 5,
  "rappel": "2026-11-24T08:00:00.000Z",
  "rappelEnvoye": false,
  "creeLe": "2026-11-23T19:00:00.000Z",
  "faiteLe": null,
  "reporteJusqua": null
}
```

Les dates sont en heure universelle (le `Z` final) ; l'affichage les convertit en heure locale.

⚠️ Si l'utilisateur efface les données de son navigateur, ses tâches disparaissent. Trois protections, toutes sans serveur :
- **Stockage persistant** : au démarrage, `TDA.stockage.demanderPersistance()` demande au navigateur de ne pas effacer les données de lui-même (manque de place). Ça ne protège pas d'un effacement manuel.
- **Sauvegarder / Restaurer** (réglages) : un fichier `.json` (ou `.txt` si le téléphone refuse le `.json`). Sur téléphone, « Sauvegarder » ouvre le menu Partager (`navigator.share`) pour l'envoyer vers Drive, e-mail… ; sinon le fichier est téléchargé. « Restaurer » demande confirmation avant de remplacer la liste. C'est aussi la façon de changer de téléphone.
- **Rappel doux** : au démarrage, s'il y a des tâches et aucune sauvegarde depuis `SAUVEGARDE_RAPPEL_JOURS` (config.js, 14 j), un bandeau propose de sauvegarder (au plus une fois par jour).

**Phase 3 (comptes en ligne) :** seul `stockage.js` devra changer. Le reste de l'appli ne sait pas *où* sont rangées les données, il appelle simplement `TDA.stockage.lireTaches()`.

---

## 9. Recettes de modifications courantes

| Je veux… | Où | Quoi faire |
|---|---|---|
| Changer l'importance d'un critère | `js/config.js` → `POIDS` | Modifier le nombre |
| Changer quand une tâche devient urgente toute seule | `js/config.js` → `REGLES` | Modifier les nombres de jours ou de minutes |
| Changer la durée pendant laquelle une tâche est « Nouvelle » | `js/config.js` | `NOUVEAU_DUREE_HEURES` |
| Changer le rappel proposé par défaut | `js/config.js` | `RAPPEL_PAR_DEFAUT_MINUTES` |
| Changer la durée de « Pas maintenant » | `js/config.js` | `REPORT_MINUTES` |
| Afficher le bouton de don | `js/config.js` | Mettre l'adresse dans `LIEN_DON` |
| Changer une couleur générale | `css/style.css` | Variables au début du fichier (`--principal`, `--fond`…) |
| Changer un texte affiché | `index.html` ou `js/app.js` | Chercher le texte (`Ctrl + F`) et le remplacer |
| Publier une nouvelle version en ligne | `sw.js` | Augmenter `VERSION` (`tda-v1` → `tda-v2`), sinon les téléphones gardent l'ancienne. Le numéro s'affiche en bas de l'appli (« Version tda-v… ») : c'est le moyen de vérifier qu'un téléphone est à jour |

⚠️ Ne change jamais l'`id` d'une étiquette ou d'un moment déjà utilisé : les tâches existantes y font référence. Change seulement le `nom`.

---

## 10. Quand quelque chose ne marche pas

1. Appuie sur **F12** dans le navigateur, puis ouvre l'onglet **Console**. Les erreurs JavaScript y apparaissent en rouge, avec le nom du fichier et le numéro de ligne.
2. L'onglet **Application → Local Storage** montre les données enregistrées (`tda.taches`, `tda.moments`). On peut les lire et les supprimer.
3. Une erreur fréquente après une modification : une **virgule** ou une **accolade** oubliée dans `config.js`. La console indique la ligne.
4. Après une modification, recharge la page avec **Ctrl + F5** (rechargement forcé).

Un éditeur gratuit comme **Visual Studio Code** colore le code et signale beaucoup d'erreurs avant même de recharger.

---

## 11. Petit glossaire

- **Fonction** : un bloc de code qui porte un nom et qu'on peut appeler (`faire(id)`).
- **Objet** : un ensemble de paires `clé: valeur` entre accolades, comme une fiche (`{ titre: '…', duree: 5 }`).
- **Tableau** : une liste entre crochets (`['urgent', 'important']`).
- **Événement** : quelque chose qui arrive (un clic, une saisie). On y « branche » une fonction avec `addEventListener`.
- **DOM** : la page telle que le JavaScript la voit et la modifie.
- **localStorage** : le petit espace de stockage du navigateur.
- **PWA** : *Progressive Web App*, un site installable comme une application.
- **Service worker** : un script d'arrière-plan qui permet le hors-ligne et les notifications push.
- **JSON** : le format texte utilisé pour enregistrer les données.
