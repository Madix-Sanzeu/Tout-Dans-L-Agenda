/* =====================================================================
   config.js — LES RÉGLAGES DE L'APPLICATION
   ---------------------------------------------------------------------
   C'est LE fichier à modifier en priorité. Tout ce qui est "réglable"
   (étiquettes, poids du calcul de priorité, moments de vie par défaut,
   lien de don) est rassemblé ici pour ne pas avoir à fouiller le code.

   Rappel JavaScript :
   - `const` déclare une valeur qui ne sera pas réassignée.
   - { clé: valeur } est un "objet" (comme un dictionnaire).
   - [ a, b, c ] est un "tableau" (une liste).
   - Tout ce qui est entre /* et *\/ ou après // est un commentaire.
   ===================================================================== */

// On crée un seul "espace de noms" global appelé TDA.
// Tous nos fichiers rangent leurs fonctions dedans : TDA.config,
// TDA.stockage, TDA.priorite... Ça évite que les noms se mélangent.
window.TDA = window.TDA || {};

TDA.config = {

  /* ---------- Les étiquettes de priorité ----------
     Une tâche peut en avoir plusieurs à la fois (elles se cumulent).
     - id      : nom technique (sans accent ni espace), ne pas le changer
                 une fois que des tâches l'utilisent.
     - nom     : ce qui s'affiche à l'écran.
     - emoji   : petit repère visuel.
     - couleur : code couleur hexadécimal. */
  ETIQUETTES: [
    { id: 'urgent',    nom: 'Urgent',    emoji: '🔥', couleur: '#d9480f' },
    { id: 'important', nom: 'Important', emoji: '⭐', couleur: '#7048e8' },
    { id: 'agreable',  nom: 'Agréable',  emoji: '🌿', couleur: '#2b8a3e' }
  ],

  /* ---------- L'étiquette "Nouveau" (AUTOMATIQUE) ----------
     On ne la coche pas : toute tâche créée depuis moins de
     NOUVEAU_DUREE_HEURES est considérée comme nouvelle. */
  NOUVEAU: { id: 'nouveau', nom: 'Nouveau', emoji: '✨', couleur: '#1c7ed6' },
  NOUVEAU_DUREE_HEURES: 48,

  /* ---------- Le rappel (OBLIGATOIRE) ----------
     Chaque tâche doit avoir un rappel. Valeur proposée par défaut
     quand on crée une tâche : dans RAPPEL_PAR_DEFAUT_MINUTES. */
  RAPPEL_PAR_DEFAUT_MINUTES: 60,

  /* ---------- Les tâches récurrentes (anniversaires, médicaments…) ----------
     Voir js/recurrence.js pour le calcul des dates. */
  RECURRENCE: {
    // Une tâche récurrente n'apparaît dans la liste qu'à l'approche de son
    // rappel (ici 30 min avant). Le reste du temps, elle attend dans
    // la zone repliable « Récurrentes à venir ».
    AFFICHER_AVANT_MINUTES: 30,
    // Pour que les rappels arrivent même si l'appli n'est pas rouverte,
    // on envoie à l'avance au serveur les prochaines dates :
    PUSH_NOMBRE: 14,   // au plus 14 dates par tâche...
    PUSH_JOURS: 31     // ...dans les 31 prochains jours
  },

  /* ---------- L'assistant « Rappel récurrent » (voir js/modeles.js) ----------
     Les heures proposées d'office ; la personne peut toujours les changer. */
  ASSISTANT: {
    HEURE_PAR_DEFAUT: '09:00',
    HEURE_ANNIVERSAIRE: '09:00',
    // Médicament : heures proposées selon le nombre de prises par jour
    HEURES_PRISES: {
      1: ['08:00'],
      2: ['08:00', '20:00'],
      3: ['08:00', '13:00', '20:00'],
      4: ['08:00', '12:00', '16:00', '20:00'],
      5: ['07:00', '10:00', '13:00', '16:00', '20:00'],
      6: ['07:00', '10:00', '13:00', '16:00', '19:00', '22:00']
    }
  },

  /* ---------- La matrice d'Eisenhower ----------
     Source : le-tdah-au-quotidien.com (« Comment prioriser ses tâches
     avec un TDAH »). Chaque tâche tombe dans une des 4 cases. Les points
     d'une case sont assez grands pour qu'elle passe TOUJOURS devant la
     case suivante. Attention à l'ordre voulu par l'article : la case 2
     (important, pas urgent) passe AVANT la case 3 (urgent seulement). */
  QUADRANTS: {
    1: { points: 400, emoji: '①', nom: 'Urgent et important', conseil: 'À faire maintenant.', couleur: '#c92a2a' },
    2: { points: 300, emoji: '②', nom: 'Important', conseil: 'À faire avant les urgences simples.', couleur: '#7048e8' },
    3: { points: 200, emoji: '③', nom: 'Urgent', conseil: 'Déléguer si possible, sinon programmer.', couleur: '#e8590c' },
    4: { points: 100, emoji: '④', nom: 'Ni urgent ni important', conseil: 'À éliminer, ou à reporter.', couleur: '#868e96' }
  },

  /* ---------- Quand une tâche devient-elle urgente toute seule ? ----------
     L'article : « urgente » = échéance proche OU demande beaucoup de temps. */
  REGLES: {
    urgentSiEcheanceSousJours: 3,  // échéance dans moins de 3 jours → urgente
    grosseTacheMinutes: 120,       // une tâche de 2 h ou plus...
    grosseTacheEcheanceJours: 7    // ...à rendre dans moins de 7 jours → urgente
  },

  // L'article conseille d'ajouter un tiers à la durée estimée (1/3 ≈ 0,33).
  MARGE_DUREE: 1 / 3,

  /* ---------- Les points DANS une même case ----------
     Ils ne changent jamais de case une tâche : ils départagent.
     👉 C'est ici qu'on ajuste le comportement avec Learnhavior (les psychologues). */
  POIDS: {
    echeanceDepassee: 50,  // l'échéance est déjà passée
    echeance24h: 40,       // échéance dans moins de 24 h
    echeance3j: 30,        // échéance dans moins de 3 jours
    echeance7j: 20,        // échéance cette semaine
    echeance30j: 10,       // échéance ce mois-ci

    // Départage conseillé par l'article : la plus facile, ou celle dont on a envie
    agreable: 8,           // étiquette Agréable
    tacheCourte: 8,        // durée estimée ≤ 15 min
    nouveau: 3,            // automatique (petit : la nouveauté attire déjà trop l'attention TDAH)
    parJourDAttente: 1,    // +1 point par jour d'ancienneté...
    attenteMax: 5          // ...plafonné à 5
  },

  // Repères d'échéance proposés en un clic (« règle simple » de l'article).
  HORIZONS: [
    { id: 'aujourdhui', nom: "Aujourd'hui" },
    { id: 'semaine', nom: 'Cette semaine' },
    { id: 'semaineProchaine', nom: 'Semaine prochaine' },
    { id: 'mois', nom: 'Ce mois-ci' },
    { id: 'plusTard', nom: 'Plus tard' }
  ],

  /* ---------- Les moments de vie par défaut ----------
     Utilisés seulement au tout premier lancement ; ensuite l'utilisateur
     les modifie dans l'écran "Réglages".
     - jours : 0 = dimanche, 1 = lundi, ... 6 = samedi
     - debut / fin : heures au format "HH:MM" */
  MOMENTS_PAR_DEFAUT: [
    {
      id: 'travail', nom: 'Travail', emoji: '💼', couleur: '#1971c2',
      plages: [{ jours: [1, 2, 3, 4, 5], debut: '09:00', fin: '18:00' }]
    },
    {
      id: 'perso', nom: 'Perso', emoji: '🏡', couleur: '#e8590c',
      plages: [
        { jours: [1, 2, 3, 4, 5], debut: '18:00', fin: '22:00' },
        { jours: [0, 6], debut: '09:00', fin: '22:00' }
      ]
    }
  ],

  // Le moment spécial "N'importe quand" : ses tâches sont toujours visibles.
  MOMENT_PARTOUT: { id: 'partout', nom: "N'importe quand", emoji: '🕒', couleur: '#868e96' },

  // "Pas maintenant" : de combien de minutes on repousse une tâche.
  REPORT_MINUTES: 60,

  // Toutes les combien de millisecondes on vérifie les rappels (30 000 = 30 s).
  INTERVALLE_RAPPELS_MS: 30000,

  /* ---------- Les notifications push (rappels appli FERMÉE) ----------
     Le serveur est un projet Supabase (voir le dossier supabase/ et
     DEPLOIEMENT.md). Tant que URL_SUPABASE est vide, l'option est
     simplement affichée comme "bientôt disponible".
     - URL_SUPABASE : l'adresse du projet, ex. 'https://abcd.supabase.co'
     - CLE_PUBLIQUE_SUPABASE : la clé "publishable" (publique, sans danger)
     - CLE_PUBLIQUE_VAPID : la moitié PUBLIQUE de la paire de clés qui
       signe les notifications (la moitié privée reste sur le serveur). */
  PUSH: {
    URL_SUPABASE: 'https://qcnxjmmcrxrnjnrzcqrn.supabase.co',
    CLE_PUBLIQUE_SUPABASE: 'sb_publishable_iwidFWw7T_7poDumz1IuHg_nxdOVddf',
    CLE_PUBLIQUE_VAPID: 'BBf_49_c2dGPShOcYm1KooVIgAvOc7YEZZ_8QM0rW3U70MHX8m4xkFrOGfh4W0G9gpYEC5zBlbzJV9rQpdfnB3E'
  },

  /* ---------- La sauvegarde ----------
     Les tâches ne sont que sur l'appareil : si le navigateur est vidé ou si
     on change de téléphone, seul un fichier de sauvegarde permet de les
     retrouver. Au-delà de ce nombre de jours sans sauvegarde, l'appli le
     propose gentiment (au plus une fois par jour). */
  SAUVEGARDE_RAPPEL_JOURS: 14,

  // Où les testeurs donnent leur avis (ici : une "issue" sur GitHub).
  LIEN_AVIS: 'https://github.com/Madix-Sanzeu/Tout-Dans-L-Agenda/issues/new',

  /* ---------- Le lien de don ----------
     Laisser vide ('') pour cacher le bouton.
     Exemple : 'https://liberapay.com/ton-pseudo/donate' */
  LIEN_DON: ''
};
